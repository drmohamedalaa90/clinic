-- =========================================================
-- OPERATION CLINIC
-- LOGISTICS MASTER LIST + SECRETARY MISSING-ITEM WORKFLOW
--
-- Workflow:
-- OWNER controls the clinic logistics master list.
-- SECRETARY chooses an item from that list and marks/orders it
-- when it is missing.
-- OWNER / MANAGER / DEPUTY receive a notification and approve/reject.
-- After approval, the ACTUAL purchase price is entered in FINANCE.
-- The price becomes a normal clinic expense linked to the request.
-- =========================================================


-- =========================================================
-- 1. LOGISTICS MASTER CATALOG
-- =========================================================

create table if not exists public.logistics_catalog (

  id uuid primary key
    default gen_random_uuid(),

  item_name_en text not null,

  item_name_ar text,

  category_id uuid
    references public.expense_categories(id)
    on delete set null,

  default_quantity numeric(12,2),

  unit text,

  notes text,

  display_order integer not null
    default 100,

  is_active boolean not null
    default true,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint logistics_catalog_name_required
    check (nullif(trim(item_name_en),'') is not null),

  constraint logistics_catalog_quantity_positive
    check (
      default_quantity is null
      or default_quantity > 0
    )
);


create index if not exists logistics_catalog_active_order_idx
on public.logistics_catalog(
  is_active,
  display_order,
  item_name_en
);


-- Link an order/request back to its owner-controlled catalog item.
alter table public.logistics_requests
  add column if not exists catalog_item_id uuid
    references public.logistics_catalog(id)
    on delete set null;


create index if not exists logistics_requests_catalog_item_idx
on public.logistics_requests(
  catalog_item_id,
  status,
  requested_at desc
);


-- =========================================================
-- 2. RLS / PRIVILEGES
-- =========================================================

alter table public.logistics_catalog
enable row level security;


revoke all
on public.logistics_catalog
from public, anon, authenticated;


-- Active clinic staff can read the logistics catalog.
grant select
on public.logistics_catalog
to authenticated;


drop policy if exists
  "Clinic staff view logistics catalog"
on public.logistics_catalog;


create policy
  "Clinic staff view logistics catalog"

on public.logistics_catalog

for select
to authenticated

using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);


-- =========================================================
-- 3. OWNER — CREATE / EDIT MASTER LIST ITEM
-- =========================================================

create or replace function public.owner_save_logistics_catalog_item(

  p_item_id uuid default null,

  p_item_name_en text default null,

  p_item_name_ar text default null,

  p_category_id uuid default null,

  p_default_quantity numeric default null,

  p_unit text default null,

  p_notes text default null,

  p_display_order integer default 100,

  p_is_active boolean default true

)

returns public.logistics_catalog

language plpgsql
security definer
set search_path = ''

as $$

declare
  v public.logistics_catalog%rowtype;

begin

  if auth.uid() is null
     or not private.has_role('owner')
  then
    raise exception 'Owner access required';
  end if;


  if nullif(trim(p_item_name_en),'') is null then
    raise exception 'Item name is required';
  end if;


  if p_default_quantity is not null
     and p_default_quantity <= 0
  then
    raise exception 'Default quantity must be greater than zero';
  end if;


  if p_item_id is null then

    insert into public.logistics_catalog (

      item_name_en,

      item_name_ar,

      category_id,

      default_quantity,

      unit,

      notes,

      display_order,

      is_active,

      created_by,

      updated_by

    )

    values (

      trim(p_item_name_en),

      nullif(trim(p_item_name_ar),''),

      p_category_id,

      p_default_quantity,

      nullif(trim(p_unit),''),

      nullif(trim(p_notes),''),

      coalesce(p_display_order,100),

      coalesce(p_is_active,true),

      auth.uid(),

      auth.uid()

    )

    returning *
    into v;

  else

    update public.logistics_catalog

    set
      item_name_en =
        trim(p_item_name_en),

      item_name_ar =
        nullif(trim(p_item_name_ar),''),

      category_id =
        p_category_id,

      default_quantity =
        p_default_quantity,

      unit =
        nullif(trim(p_unit),''),

      notes =
        nullif(trim(p_notes),''),

      display_order =
        coalesce(p_display_order,100),

      is_active =
        coalesce(p_is_active,true),

      updated_by =
        auth.uid(),

      updated_at =
        now()

    where id =
      p_item_id

    returning *
    into v;


    if not found then
      raise exception 'Catalog item not found';
    end if;

  end if;


  return v;

end;

$$;


revoke all
on function public.owner_save_logistics_catalog_item(
  uuid,text,text,uuid,numeric,text,text,integer,boolean
)
from public, anon;


grant execute
on function public.owner_save_logistics_catalog_item(
  uuid,text,text,uuid,numeric,text,text,integer,boolean
)
to authenticated;



-- =========================================================
-- 4. OWNER — ACTIVATE / DISABLE MASTER LIST ITEM
-- =========================================================

create or replace function public.owner_set_logistics_catalog_active(

  p_item_id uuid,

  p_is_active boolean

)

returns public.logistics_catalog

language plpgsql
security definer
set search_path = ''

as $$

declare
  v public.logistics_catalog%rowtype;

begin

  if auth.uid() is null
     or not private.has_role('owner')
  then
    raise exception 'Owner access required';
  end if;


  update public.logistics_catalog

  set
    is_active =
      coalesce(p_is_active,false),

    updated_by =
      auth.uid(),

    updated_at =
      now()

  where id =
    p_item_id

  returning *
  into v;


  if not found then
    raise exception 'Catalog item not found';
  end if;


  return v;

end;

$$;


revoke all
on function public.owner_set_logistics_catalog_active(uuid,boolean)
from public, anon;


grant execute
on function public.owner_set_logistics_catalog_active(uuid,boolean)
to authenticated;



-- =========================================================
-- 5. SECRETARY — SELECT MISSING ITEM FROM MASTER LIST
--    AND CREATE AN ORDER REQUEST
-- =========================================================

create or replace function public.secretary_order_missing_logistics_item(

  p_catalog_item_id uuid,

  p_quantity numeric default null,

  p_needed_by date default null,

  p_urgency text default 'routine',

  p_note text default null

)

returns public.logistics_requests

language plpgsql
security definer
set search_path = ''

as $$

declare

  v_item public.logistics_catalog%rowtype;

  v_request public.logistics_requests%rowtype;

  v_qty numeric;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not (
       private.has_role('secretary')
    or private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then
    raise exception 'Clinic logistics access required';
  end if;


  select *
  into v_item

  from public.logistics_catalog

  where id =
    p_catalog_item_id

    and is_active = true;


  if not found then
    raise exception 'Active logistics catalog item not found';
  end if;


  -- Avoid duplicate active orders for the same catalog item.
  if exists (

    select 1

    from public.logistics_requests lr

    where lr.catalog_item_id =
      p_catalog_item_id

      and lr.status not in (
        'completed',
        'rejected',
        'cancelled'
      )

  ) then

    raise exception
      'There is already an open order for this item';

  end if;


  v_qty :=
    coalesce(
      p_quantity,
      v_item.default_quantity,
      1
    );


  if v_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;


  if p_urgency not in (
    'routine',
    'urgent'
  ) then
    raise exception 'Urgency must be routine or urgent';
  end if;


  -- Use the clinic's existing logistics request function so
  -- the current workflow/status/audit behavior is preserved.
  select *
  into v_request

  from public.create_logistics_request(

    p_item_name :=
      v_item.item_name_en,

    p_category_id :=
      v_item.category_id,

    p_quantity :=
      v_qty,

    p_unit :=
      v_item.unit,

    p_estimated_cost :=
      null,

    p_needed_by :=
      p_needed_by,

    p_urgency :=
      p_urgency,

    p_notes :=
      nullif(trim(p_note),'')

  );


  update public.logistics_requests

  set
    catalog_item_id =
      p_catalog_item_id,

    updated_at =
      now()

  where id =
    v_request.id

  returning *
  into v_request;


  -- Missing item = deficiency.
  -- This keeps the existing clinic-wide deficiency notification,
  -- while management also receives the dedicated approval alert below.
  perform public.set_logistics_deficiency(

    v_request.id,

    true,

    coalesce(
      nullif(trim(p_note),''),
      'Missing from clinic stock'
    )

  );


  select *
  into v_request

  from public.logistics_requests

  where id =
    v_request.id;


  return v_request;

end;

$$;


revoke all
on function public.secretary_order_missing_logistics_item(
  uuid,numeric,date,text,text
)
from public, anon;


grant execute
on function public.secretary_order_missing_logistics_item(
  uuid,numeric,date,text,text
)
to authenticated;



-- =========================================================
-- 6. MANAGEMENT-ONLY LOGISTICS APPROVAL NOTIFICATIONS
--
-- These merge with the existing notification drawer through
-- js/notifications.js in this patch.
-- =========================================================

create table if not exists public.user_notification_reads (

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  notification_key text not null,

  read_at timestamptz not null
    default now(),

  primary key (
    user_id,
    notification_key
  )
);


create or replace function public.get_logistics_management_notifications(

  p_limit integer default 30

)

returns table (

  notification_key text,

  category text,

  priority integer,

  title_en text,

  title_ar text,

  body_en text,

  body_ar text,

  event_time timestamptz,

  target_page text,

  entity_id uuid,

  is_read boolean

)

language plpgsql
stable
security definer
set search_path = ''

as $$

declare

  v_uid uuid :=
    auth.uid();

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(p_limit,30),
        60
      )
    );

begin

  if v_uid is null then
    raise exception 'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then

    return;

  end if;


  return query

  select

    (
      'logistics-order:' ||
      lr.id::text
    )::text
      as notification_key,

    'logistics'::text
      as category,

    case
      when lr.urgency = 'urgent'
        then 99
      else 91
    end::integer
      as priority,

    'Logistics order awaiting approval'::text
      as title_en,

    'طلب احتياجات بانتظار الموافقة'::text
      as title_ar,

    (
      lr.item_name
      ||
      ' • Qty '
      ||
      coalesce(
        trim(
          to_char(
            lr.quantity,
            'FM999999990.##'
          )
        ),
        '—'
      )
      ||
      coalesce(
        ' ' ||
        nullif(lr.unit,''),
        ''
      )
      ||
      case
        when lr.urgency = 'urgent'
          then ' • URGENT'
        else ''
      end
    )::text
      as body_en,

    (
      lr.item_name
      ||
      ' • الكمية '
      ||
      coalesce(
        trim(
          to_char(
            lr.quantity,
            'FM999999990.##'
          )
        ),
        '—'
      )
      ||
      coalesce(
        ' ' ||
        nullif(lr.unit,''),
        ''
      )
      ||
      case
        when lr.urgency = 'urgent'
          then ' • عاجل'
        else ''
      end
    )::text
      as body_ar,

    lr.requested_at::timestamptz
      as event_time,

    'logistics'::text
      as target_page,

    lr.id::uuid
      as entity_id,

    exists (

      select 1

      from public.user_notification_reads nr

      where nr.user_id =
        v_uid

        and nr.notification_key =
          (
            'logistics-order:' ||
            lr.id::text
          )

    ) as is_read

  from public.logistics_requests lr

  where lr.status =
    'requested'

    and lr.catalog_item_id
      is not null

    and lr.requested_at >=
      now() - interval '30 days'

  order by
    case
      when lr.urgency = 'urgent'
        then 0
      else 1
    end,

    lr.requested_at desc

  limit v_limit;

end;

$$;


revoke all
on function public.get_logistics_management_notifications(integer)
from public, anon;


grant execute
on function public.get_logistics_management_notifications(integer)
to authenticated;



-- =========================================================
-- 7. POSTGREST CACHE + VERIFY
-- =========================================================

notify pgrst, 'reload schema';


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'owner_save_logistics_catalog_item',
    'owner_set_logistics_catalog_active',
    'secretary_order_missing_logistics_item',
    'get_logistics_management_notifications'
  )
order by routine_name;


select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'logistics_catalog';

