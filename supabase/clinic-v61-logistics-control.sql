-- =========================================================
-- ALAA CLINIC V61 — LOGISTICS CONTROL
-- Run AFTER V60.
-- Adds: minimum stock, categories, consumable/equipment type,
-- quick stock history, purchase requests, equipment status/maintenance.
-- =========================================================
begin;

alter table public.clinic_inventory_items
  add column if not exists min_stock integer not null default 2,
  add column if not exists category text not null default 'other',
  add column if not exists item_type text not null default 'consumable',
  add column if not exists equipment_status text not null default 'working',
  add column if not exists maintenance_due_date date;

alter table public.clinic_inventory_items
  drop constraint if exists clinic_inventory_items_category_check;
alter table public.clinic_inventory_items
  add constraint clinic_inventory_items_category_check
  check (category in ('drinks','cleaning','stationery','disposable','equipment','other'));

alter table public.clinic_inventory_items
  drop constraint if exists clinic_inventory_items_item_type_check;
alter table public.clinic_inventory_items
  add constraint clinic_inventory_items_item_type_check
  check (item_type in ('consumable','equipment'));

alter table public.clinic_inventory_items
  drop constraint if exists clinic_inventory_items_equipment_status_check;
alter table public.clinic_inventory_items
  add constraint clinic_inventory_items_equipment_status_check
  check (equipment_status in ('working','maintenance','broken'));

create table if not exists public.clinic_inventory_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.clinic_inventory_items(id) on delete cascade,
  delta integer not null,
  note text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists clinic_inventory_history_item_time_idx
  on public.clinic_inventory_history(item_id, changed_at desc);

create table if not exists public.clinic_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.clinic_inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  estimated_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2),
  note text,
  status text not null default 'pending'
    check (status in ('pending','approved','purchased','received','cancelled')),
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  purchased_at timestamptz,
  received_at timestamptz
);

create index if not exists clinic_purchase_requests_status_idx
  on public.clinic_purchase_requests(status, requested_at desc);

-- Categorize seeded photographed items.
update public.clinic_inventory_items set category='drinks'
where lower(coalesce(english_name,'')) like any(array['%coffee%','%tea%','%sweetener%','%sugar%','%water dispenser%']);

update public.clinic_inventory_items set category='cleaning'
where lower(coalesce(english_name,'')) like any(array['%dishwashing%','%hand soap%','%cleaning appliance%','%paper towel%','%tissue%']);

update public.clinic_inventory_items set category='disposable'
where lower(coalesce(english_name,'')) like any(array['%cup%','%battery%']);

update public.clinic_inventory_items set category='stationery'
where lower(coalesce(english_name,'')) like any(array['%organizer%','%magazine%']);

update public.clinic_inventory_items
set item_type='equipment', category='equipment', min_stock=0
where lower(coalesce(english_name,'')) like any(array[
  '%water filter%','%electric kettle%','%cleaning appliance%','%water dispenser%'
]);

create or replace function public.v61_logistics_items()
returns table (
  id uuid,
  arabic_name text,
  english_name text,
  image_url text,
  available_stock integer,
  min_stock integer,
  category text,
  item_type text,
  equipment_status text,
  maintenance_due_date text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.arabic_name,
    i.english_name,
    i.image_url,
    i.available_stock,
    i.min_stock,
    i.category,
    i.item_type,
    i.equipment_status,
    to_char(i.maintenance_due_date,'YYYY-MM-DD'),
    i.is_active
  from public.clinic_inventory_items i
  where auth.uid() is not null and i.is_active = true
  order by coalesce(nullif(trim(i.english_name),''), i.arabic_name);
$$;

revoke all on function public.v61_logistics_items() from public, anon;
grant execute on function public.v61_logistics_items() to authenticated;

create or replace function public.v61_save_inventory_item(
  p_item uuid,
  p_arabic_name text,
  p_english_name text,
  p_image_url text,
  p_item_type text,
  p_category text,
  p_available_stock integer,
  p_min_stock integer,
  p_equipment_status text,
  p_maintenance_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then raise exception 'Administrator access required'; end if;

  if p_item_type not in ('consumable','equipment') then raise exception 'Invalid item type'; end if;
  if p_category not in ('drinks','cleaning','stationery','disposable','equipment','other') then raise exception 'Invalid category'; end if;
  if p_equipment_status not in ('working','maintenance','broken') then raise exception 'Invalid equipment status'; end if;

  if p_item is null then
    insert into public.clinic_inventory_items(
      arabic_name,english_name,image_url,available_stock,min_stock,
      category,item_type,equipment_status,maintenance_due_date,is_active,created_by
    ) values(
      coalesce(nullif(trim(p_arabic_name),''),nullif(trim(p_english_name),'')),
      nullif(trim(coalesce(p_english_name,'')),''),
      nullif(trim(coalesce(p_image_url,'')),''),
      greatest(coalesce(p_available_stock,0),0),
      greatest(coalesce(p_min_stock,0),0),
      p_category,p_item_type,p_equipment_status,p_maintenance_due_date,true,auth.uid()
    ) returning id into v_id;
  else
    update public.clinic_inventory_items
    set arabic_name=coalesce(nullif(trim(p_arabic_name),''),nullif(trim(p_english_name),''),arabic_name),
        english_name=nullif(trim(coalesce(p_english_name,'')),''),
        image_url=nullif(trim(coalesce(p_image_url,'')),''),
        available_stock=case when p_item_type='equipment' then available_stock else greatest(coalesce(p_available_stock,0),0) end,
        min_stock=case when p_item_type='equipment' then 0 else greatest(coalesce(p_min_stock,0),0) end,
        category=p_category,
        item_type=p_item_type,
        equipment_status=p_equipment_status,
        maintenance_due_date=p_maintenance_due_date,
        is_active=true,
        updated_at=now()
    where id=p_item returning id into v_id;
    if v_id is null then raise exception 'Inventory item not found'; end if;
  end if;

  return jsonb_build_object('success',true,'item_id',v_id);
end;
$$;

revoke all on function public.v61_save_inventory_item(uuid,text,text,text,text,text,integer,integer,text,date) from public, anon;
grant execute on function public.v61_save_inventory_item(uuid,text,text,text,text,text,integer,integer,text,date) to authenticated;

create or replace function public.v61_adjust_inventory_stock(
  p_item uuid,
  p_delta integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_new integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then raise exception 'Administrator access required'; end if;
  if p_delta = 0 then raise exception 'Change cannot be zero'; end if;

  update public.clinic_inventory_items
  set available_stock = greatest(available_stock + p_delta, 0),
      updated_at = now()
  where id=p_item and is_active=true and item_type='consumable'
  returning available_stock into v_new;

  if v_new is null then raise exception 'Consumable item not found'; end if;

  insert into public.clinic_inventory_history(item_id,delta,note,changed_by)
  values(p_item,p_delta,p_note,auth.uid());

  return jsonb_build_object('success',true,'stock',v_new);
end;
$$;

revoke all on function public.v61_adjust_inventory_stock(uuid,integer,text) from public, anon;
grant execute on function public.v61_adjust_inventory_stock(uuid,integer,text) to authenticated;

create or replace function public.v61_create_purchase_request(
  p_item uuid,
  p_quantity integer,
  p_estimated_cost numeric,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(p_quantity,0) <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  insert into public.clinic_purchase_requests(
    item_id,quantity,estimated_cost,note,requested_by
  ) values(
    p_item,p_quantity,greatest(coalesce(p_estimated_cost,0),0),nullif(trim(coalesce(p_note,'')),''),auth.uid()
  ) returning id into v_id;

  return jsonb_build_object('success',true,'request_id',v_id);
end;
$$;

revoke all on function public.v61_create_purchase_request(uuid,integer,numeric,text) from public, anon;
grant execute on function public.v61_create_purchase_request(uuid,integer,numeric,text) to authenticated;

create or replace function public.v61_inventory_history(p_item uuid)
returns table(
  delta integer,
  note text,
  changed_by_name text,
  changed_at_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    h.delta,
    coalesce(h.note,''),
    coalesce(p.display_name,p.username,''),
    to_char(h.changed_at at time zone 'Africa/Cairo','DD/MM/YYYY HH24:MI')
  from public.clinic_inventory_history h
  left join public.profiles p on p.id=h.changed_by
  where auth.uid() is not null and h.item_id=p_item
  order by h.changed_at desc
  limit 100;
$$;

revoke all on function public.v61_inventory_history(uuid) from public, anon;
grant execute on function public.v61_inventory_history(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

select 'V61 Logistics Control installed' as status;
