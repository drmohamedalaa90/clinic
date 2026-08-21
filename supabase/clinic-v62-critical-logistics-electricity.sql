-- =========================================================
-- ALAA CLINIC V62
-- CRITICAL LOGISTICS + PURCHASE -> FINANCE + ELECTRICITY SATURDAY NOTE
-- Run AFTER V61.
-- =========================================================
begin;

alter table public.clinic_inventory_items
  add column if not exists is_critical boolean not null default false,
  add column if not exists critical_note text,
  add column if not exists critical_marked_by uuid references public.profiles(id) on delete set null,
  add column if not exists critical_marked_at timestamptz,
  add column if not exists system_key text;

create unique index if not exists clinic_inventory_items_system_key_uq
on public.clinic_inventory_items(system_key)
where system_key is not null;

-- Saturday electricity notes.
create table if not exists public.clinic_weekly_utility_notes (
  id uuid primary key default gen_random_uuid(),
  utility_key text not null,
  note_date date not null,
  note text not null,
  meter_reading text,
  secretary_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(utility_key,note_date)
);

alter table public.clinic_weekly_utility_notes enable row level security;
drop policy if exists clinic_weekly_utility_notes_read on public.clinic_weekly_utility_notes;
create policy clinic_weekly_utility_notes_read
on public.clinic_weekly_utility_notes for select to authenticated
using (auth.uid() is not null);

-- Electricity card. Free Unsplash image by Enrico Mantegazza.
insert into public.clinic_inventory_items(
  arabic_name,english_name,image_url,available_stock,min_stock,category,item_type,
  equipment_status,is_active,system_key
)
select
  'الكهرباء',
  'Electricity',
  'https://images.unsplash.com/photo-1530951226911-640987bd484c?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1200',
  1,0,'equipment','equipment','working',true,'electricity'
where not exists (
  select 1 from public.clinic_inventory_items where system_key='electricity'
);

create or replace function public.v62_logistics_items()
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
  is_active boolean,
  is_critical boolean,
  critical_note text,
  critical_marked_at timestamptz,
  system_key text,
  last_electricity_note_date text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    i.id,i.arabic_name,i.english_name,i.image_url,i.available_stock,i.min_stock,
    i.category,i.item_type,i.equipment_status,
    to_char(i.maintenance_due_date,'YYYY-MM-DD'),
    i.is_active,i.is_critical,i.critical_note,i.critical_marked_at,i.system_key,
    case when i.system_key='electricity' then (
      select to_char(max(n.note_date),'YYYY-MM-DD')
      from public.clinic_weekly_utility_notes n
      where n.utility_key='electricity'
    ) else null end
  from public.clinic_inventory_items i
  where auth.uid() is not null and i.is_active=true
  order by i.is_critical desc,
           case when i.system_key='electricity' then 0 else 1 end,
           coalesce(nullif(trim(i.english_name),''),i.arabic_name);
$$;

revoke all on function public.v62_logistics_items() from public,anon;
grant execute on function public.v62_logistics_items() to authenticated;

create or replace function public.v62_critical_logistics_count()
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select count(*)::integer
  from public.clinic_inventory_items
  where auth.uid() is not null and is_active=true and is_critical=true;
$$;

revoke all on function public.v62_critical_logistics_count() from public,anon;
grant execute on function public.v62_critical_logistics_count() to authenticated;

-- Any authenticated clinic member can raise/clear a critical alarm.
create or replace function public.v62_set_inventory_critical(
  p_item uuid,
  p_critical boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true)
  then raise exception 'Active clinic account required'; end if;

  update public.clinic_inventory_items
  set is_critical=coalesce(p_critical,false),
      critical_note=case when coalesce(p_critical,false) then nullif(trim(coalesce(p_note,'')),'') else null end,
      critical_marked_by=case when coalesce(p_critical,false) then auth.uid() else null end,
      critical_marked_at=case when coalesce(p_critical,false) then now() else null end,
      updated_at=now()
  where id=p_item and is_active=true and coalesce(system_key,'')<>'electricity';

  if not found then raise exception 'Inventory item not found'; end if;
  return jsonb_build_object('success',true,'critical',coalesce(p_critical,false));
end;
$$;

revoke all on function public.v62_set_inventory_critical(uuid,boolean,text) from public,anon;
grant execute on function public.v62_set_inventory_critical(uuid,boolean,text) to authenticated;

-- Purchase completion:
-- 1) adds stock
-- 2) saves purchase ledger
-- 3) clears critical alarm
-- 4) adds a normal Finance expense using the CURRENT clinic_expenses row type.
create or replace function public.v62_record_inventory_purchase(
  p_item uuid,
  p_units_added integer,
  p_amount_paid numeric,
  p_payment_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_before integer;
  v_after integer;
  v_purchase uuid;
  v_expense uuid;
  v_name text;
  v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
  ) then raise exception 'Purchase access required'; end if;

  if coalesce(p_units_added,0)<=0 then raise exception 'Quantity must be greater than zero'; end if;
  if coalesce(p_amount_paid,0)<=0 then raise exception 'Amount paid must be greater than zero'; end if;
  if p_payment_method not in ('cash','card','instapay','bank_transfer','other')
  then raise exception 'Invalid payment method'; end if;

  select available_stock,
         coalesce(nullif(trim(english_name),''),arabic_name)
  into v_before,v_name
  from public.clinic_inventory_items
  where id=p_item and is_active=true
  for update;

  if not found then raise exception 'Inventory item not found'; end if;

  v_after:=v_before+p_units_added;

  update public.clinic_inventory_items
  set available_stock=v_after,
      is_critical=false,
      critical_note=null,
      critical_marked_by=null,
      critical_marked_at=null,
      updated_at=now()
  where id=p_item;

  insert into public.clinic_inventory_purchases(
    item_id,linked_request_id,units_added,amount_paid,purchase_note,
    purchased_by,stock_before,stock_after
  )
  values(
    p_item,null,p_units_added,p_amount_paid,
    nullif(trim(coalesce(p_note,'')),''),
    auth.uid(),v_before,v_after
  )
  returning id into v_purchase;

  insert into public.clinic_inventory_history(item_id,delta,note,changed_by)
  values(p_item,p_units_added,'Purchased new stock',auth.uid());

  if to_regclass('public.clinic_expenses') is null then
    raise exception 'Finance expense table clinic_expenses was not found';
  end if;

  /*
   * jsonb_populate_record makes this compatible with the clinic's
   * current clinic_expenses structure while supplying all known fields.
   */
  v_payload:=jsonb_build_object(
    'amount',p_amount_paid,
    'description','Logistics purchase: '||v_name,
    'notes',nullif(trim(coalesce(p_note,'')),''),
    'note',nullif(trim(coalesce(p_note,'')),''),
    'item_name',v_name,
    'expense_at',now(),
    'payment_method',p_payment_method,
    'created_by',auth.uid(),
    'submitted_by',auth.uid(),
    'paid_by',auth.uid(),
    'is_voided',false
  );

  begin
    execute '
      insert into public.clinic_expenses
      select (jsonb_populate_record(null::public.clinic_expenses,$1)).*
      returning id
    '
    into v_expense
    using v_payload;
  exception when others then
    raise exception 'Purchase was NOT saved because Finance expense creation failed: %',sqlerrm;
  end;

  return jsonb_build_object(
    'success',true,
    'purchase_id',v_purchase,
    'expense_id',v_expense,
    'stock_before',v_before,
    'stock_after',v_after,
    'amount_paid',p_amount_paid
  );
end;
$$;

revoke all on function public.v62_record_inventory_purchase(uuid,integer,numeric,text,text) from public,anon;
grant execute on function public.v62_record_inventory_purchase(uuid,integer,numeric,text,text) to authenticated;

create or replace function public.v62_electricity_note_status()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  with x as (
    select (now() at time zone 'Africa/Cairo')::date as d,
           extract(isodow from (now() at time zone 'Africa/Cairo'))::integer as dow
  )
  select jsonb_build_object(
    'due_today',(select dow=6 from x),
    'completed_today',exists(
      select 1 from public.clinic_weekly_utility_notes n
      where n.utility_key='electricity'
        and n.note_date=(select d from x)
    ),
    'today',(select d from x)
  )
  where auth.uid() is not null;
$$;

revoke all on function public.v62_electricity_note_status() from public,anon;
grant execute on function public.v62_electricity_note_status() to authenticated;

create or replace function public.v62_submit_electricity_note(
  p_note text,
  p_meter_reading text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_dow integer := extract(isodow from (now() at time zone 'Africa/Cairo'))::integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_role('secretary') then raise exception 'Secretary access required'; end if;
  if v_dow<>6 then raise exception 'Electricity weekly note is scheduled for Saturday'; end if;
  if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Saturday note is required'; end if;

  insert into public.clinic_weekly_utility_notes(
    utility_key,note_date,note,meter_reading,secretary_id
  )
  values(
    'electricity',v_today,trim(p_note),nullif(trim(coalesce(p_meter_reading,'')),''),auth.uid()
  )
  on conflict(utility_key,note_date)
  do update set note=excluded.note,
                meter_reading=excluded.meter_reading,
                secretary_id=auth.uid(),
                created_at=now();

  return jsonb_build_object('success',true,'note_date',v_today);
end;
$$;

revoke all on function public.v62_submit_electricity_note(text,text) from public,anon;
grant execute on function public.v62_submit_electricity_note(text,text) to authenticated;

create or replace function public.v62_electricity_notes(p_limit integer default 20)
returns table(
  note_date text,
  note text,
  meter_reading text,
  secretary_name text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    to_char(n.note_date,'YYYY-MM-DD'),
    n.note,
    n.meter_reading,
    coalesce(nullif(trim(p.display_name),''),p.username,p.email,'Secretary')
  from public.clinic_weekly_utility_notes n
  left join public.profiles p on p.id=n.secretary_id
  where auth.uid() is not null and n.utility_key='electricity'
  order by n.note_date desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.v62_electricity_notes(integer) from public,anon;
grant execute on function public.v62_electricity_notes(integer) to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='clinic_weekly_utility_notes'
  ) then
    alter publication supabase_realtime add table public.clinic_weekly_utility_notes;
  end if;
exception when others then
  raise notice 'Realtime publication update skipped: %',sqlerrm;
end $$;

notify pgrst,'reload schema';
commit;

select 'V62 critical logistics + electricity installed' as status;
