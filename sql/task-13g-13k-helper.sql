-- =========================================================
-- OPERATION CLINIC — FRONTEND HELPER PATCH
-- Tasks 13G–13K
-- Finance UI, Logistics UI, Attendance/Bonus UI,
-- User/Profile/Admin UI, Reports/Audit + PWA support.
-- =========================================================

-- ---------------------------------------------------------
-- 1. PROFILE EXTENSION
-- ---------------------------------------------------------
alter table public.profiles
  add column if not exists whatsapp text;

-- Keep identity fields protected during normal frontend writes,
-- but allow the owner-only controlled admin RPC to update them.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('clinic.admin_profile_write', true), 'off') = 'on' then
    return new;
  end if;

  if auth.uid() is not null then
    if new.id is distinct from old.id
       or new.username is distinct from old.username
       or new.email is distinct from old.email
       or new.is_active is distinct from old.is_active
    then
      raise exception 'Identity fields cannot be changed directly';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2. CLINIC SETTINGS
-- ---------------------------------------------------------
create table if not exists public.clinic_settings (
  id smallint primary key default 1 check (id = 1),
  clinic_name_en text not null default 'Operation Clinic',
  clinic_name_ar text not null default 'عيادة العمليات',
  timezone text not null default 'Africa/Cairo',
  currency char(3) not null default 'EGP',
  phone text,
  address_en text,
  address_ar text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.clinic_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.clinic_settings enable row level security;
revoke all on public.clinic_settings from anon, authenticated;
grant select on public.clinic_settings to authenticated;

drop policy if exists "Active clinic staff view clinic settings" on public.clinic_settings;
create policy "Active clinic staff view clinic settings"
on public.clinic_settings
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

-- ---------------------------------------------------------
-- 3. AUDIT LOG — NON-CLINICAL METADATA ONLY
-- ---------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_changed_at_idx
  on public.audit_log(changed_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log(entity_type, entity_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists "Owner views audit log" on public.audit_log;
create policy "Owner views audit log"
on public.audit_log
for select
to authenticated
using (private.has_role('owner'));

create or replace function private.audit_nonclinical_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := '{}'::jsonb;
  v_old jsonb := '{}'::jsonb;
  v_id uuid;
  v_details jsonb := '{}'::jsonb;
begin
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;

  begin
    v_id := coalesce(nullif(v_new->>'id','')::uuid, nullif(v_old->>'id','')::uuid);
  exception when others then
    v_id := null;
  end;

  case tg_table_name
    when 'appointments' then
      v_details := jsonb_build_object(
        'patient_id', coalesce(v_new->>'patient_id', v_old->>'patient_id'),
        'doctor_id', coalesce(v_new->>'doctor_id', v_old->>'doctor_id'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status',
        'scheduled_start', coalesce(v_new->>'scheduled_start', v_old->>'scheduled_start')
      );
    when 'referrals' then
      v_details := jsonb_build_object(
        'patient_id', coalesce(v_new->>'patient_id', v_old->>'patient_id'),
        'from_doctor_id', coalesce(v_new->>'from_doctor_id', v_old->>'from_doctor_id'),
        'to_doctor_id', coalesce(v_new->>'to_doctor_id', v_old->>'to_doctor_id'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status'
      );
    when 'invoices' then
      v_details := jsonb_build_object(
        'invoice_number', coalesce(v_new->>'invoice_number', v_old->>'invoice_number'),
        'patient_id', coalesce(v_new->>'patient_id', v_old->>'patient_id'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status',
        'total_amount', coalesce(v_new->>'total_amount', v_old->>'total_amount'),
        'paid_amount', coalesce(v_new->>'paid_amount', v_old->>'paid_amount')
      );
    when 'invoice_payments' then
      v_details := jsonb_build_object(
        'invoice_id', coalesce(v_new->>'invoice_id', v_old->>'invoice_id'),
        'amount', coalesce(v_new->>'amount', v_old->>'amount'),
        'payment_method', coalesce(v_new->>'payment_method', v_old->>'payment_method'),
        'is_voided', coalesce(v_new->>'is_voided', v_old->>'is_voided')
      );
    when 'clinic_expenses' then
      v_details := jsonb_build_object(
        'expense_number', coalesce(v_new->>'expense_number', v_old->>'expense_number'),
        'amount', coalesce(v_new->>'amount', v_old->>'amount'),
        'payment_method', coalesce(v_new->>'payment_method', v_old->>'payment_method'),
        'category_id', coalesce(v_new->>'category_id', v_old->>'category_id'),
        'is_voided', coalesce(v_new->>'is_voided', v_old->>'is_voided')
      );
    when 'logistics_requests' then
      v_details := jsonb_build_object(
        'item_name', coalesce(v_new->>'item_name', v_old->>'item_name'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status',
        'estimated_cost', coalesce(v_new->>'estimated_cost', v_old->>'estimated_cost'),
        'actual_cost', coalesce(v_new->>'actual_cost', v_old->>'actual_cost')
      );
    when 'attendance_records' then
      v_details := jsonb_build_object(
        'staff_id', coalesce(v_new->>'staff_id', v_old->>'staff_id'),
        'work_date', coalesce(v_new->>'work_date', v_old->>'work_date'),
        'late_minutes', coalesce(v_new->>'late_minutes', v_old->>'late_minutes'),
        'early_leave_minutes', coalesce(v_new->>'early_leave_minutes', v_old->>'early_leave_minutes'),
        'is_adjusted', coalesce(v_new->>'is_adjusted', v_old->>'is_adjusted')
      );
    when 'doctor_schedule_exceptions' then
      v_details := jsonb_build_object(
        'doctor_id', coalesce(v_new->>'doctor_id', v_old->>'doctor_id'),
        'exception_date', coalesce(v_new->>'exception_date', v_old->>'exception_date'),
        'exception_type', coalesce(v_new->>'exception_type', v_old->>'exception_type'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status'
      );
    when 'staff_leave_requests' then
      v_details := jsonb_build_object(
        'staff_id', coalesce(v_new->>'staff_id', v_old->>'staff_id'),
        'start_date', coalesce(v_new->>'start_date', v_old->>'start_date'),
        'end_date', coalesce(v_new->>'end_date', v_old->>'end_date'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status'
      );
    when 'monthly_staff_bonuses' then
      v_details := jsonb_build_object(
        'staff_id', coalesce(v_new->>'staff_id', v_old->>'staff_id'),
        'month_start', coalesce(v_new->>'month_start', v_old->>'month_start'),
        'old_status', v_old->>'status',
        'new_status', v_new->>'status',
        'final_bonus', coalesce(v_new->>'final_bonus', v_old->>'final_bonus')
      );
    else
      v_details := '{}'::jsonb;
  end case;

  insert into public.audit_log(entity_type, entity_id, action, changed_by, details)
  values (tg_table_name, v_id, lower(tg_op), auth.uid(), v_details);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_nonclinical_change() from public, anon, authenticated;

-- Attach audit triggers safely.
do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments',
    'referrals',
    'invoices',
    'invoice_payments',
    'clinic_expenses',
    'logistics_requests',
    'attendance_records',
    'doctor_schedule_exceptions',
    'staff_leave_requests',
    'monthly_staff_bonuses'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute procedure private.audit_nonclinical_change()',
        'audit_' || t,
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 4. PROFILE RPC
-- ---------------------------------------------------------
create or replace function public.frontend_save_my_profile(
  p_display_name text,
  p_language text,
  p_whatsapp text default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required';
  end if;

  if p_language not in ('ar','en') then
    raise exception 'Invalid language';
  end if;

  update public.profiles
  set
    display_name = trim(p_display_name),
    preferred_language = p_language,
    whatsapp = nullif(trim(p_whatsapp), ''),
    photo_url = coalesce(nullif(trim(p_photo_path), ''), photo_url),
    updated_at = now()
  where id = auth.uid()
  returning * into v;

  if not found then raise exception 'Profile not found'; end if;
  return to_jsonb(v);
end;
$$;

revoke all on function public.frontend_save_my_profile(text,text,text,text) from public, anon;
grant execute on function public.frontend_save_my_profile(text,text,text,text) to authenticated;

-- ---------------------------------------------------------
-- 5. OWNER USER DIRECTORY / MANAGEMENT
-- ---------------------------------------------------------
create or replace function public.frontend_list_clinic_users()
returns table (
  id uuid,
  username text,
  email text,
  display_name text,
  photo_url text,
  whatsapp text,
  preferred_language text,
  is_active boolean,
  roles text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;

  return query
  select
    p.id,
    p.username,
    p.email,
    p.display_name,
    p.photo_url,
    p.whatsapp,
    p.preferred_language,
    p.is_active,
    coalesce(array_agg(ur.role::text order by ur.role::text) filter (where ur.role is not null), array[]::text[])
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id
  order by coalesce(p.display_name, p.username, p.email);
end;
$$;

revoke all on function public.frontend_list_clinic_users() from public, anon;
grant execute on function public.frontend_list_clinic_users() to authenticated;

create or replace function public.frontend_list_staff_by_role(p_role text)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  photo_url text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (private.has_role('owner') or private.has_role('manager') or private.has_role('deputy_manager')) then
    raise exception 'Management access required';
  end if;

  begin
    v_role := p_role::public.app_role;
  exception when others then
    raise exception 'Invalid role';
  end;

  return query
  select p.id, p.username, p.display_name, p.email, p.photo_url, p.is_active
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role = v_role
    and p.is_active = true
  order by coalesce(p.display_name, p.username, p.email);
end;
$$;

revoke all on function public.frontend_list_staff_by_role(text) from public, anon;
grant execute on function public.frontend_list_staff_by_role(text) to authenticated;

create or replace function public.frontend_owner_update_user(
  p_user_id uuid,
  p_display_name text,
  p_username text,
  p_is_active boolean,
  p_roles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v public.profiles%rowtype;
begin
  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;

  if nullif(trim(p_display_name), '') is null then raise exception 'Display name is required'; end if;
  if nullif(trim(p_username), '') is null then raise exception 'Username is required'; end if;
  if p_roles is null or cardinality(p_roles) = 0 then raise exception 'At least one role is required'; end if;

  if p_user_id = auth.uid() then
    if p_is_active = false or not ('owner' = any(p_roles)) then
      raise exception 'You cannot deactivate yourself or remove your own owner role';
    end if;
  end if;

  foreach v_role in array p_roles loop
    if v_role not in ('owner','manager','deputy_manager','doctor','technical_admin','secretary') then
      raise exception 'Invalid role: %', v_role;
    end if;
  end loop;

  perform set_config('clinic.admin_profile_write', 'on', true);

  update public.profiles
  set
    display_name = trim(p_display_name),
    username = trim(p_username),
    is_active = p_is_active,
    updated_at = now()
  where id = p_user_id
  returning * into v;

  if not found then raise exception 'User not found'; end if;

  delete from public.user_roles where user_id = p_user_id;

  insert into public.user_roles(user_id, role)
  select p_user_id, x::public.app_role
  from unnest(p_roles) x
  on conflict (user_id, role) do nothing;

  insert into public.audit_log(entity_type, entity_id, action, changed_by, details)
  values (
    'profiles',
    p_user_id,
    'admin_update',
    auth.uid(),
    jsonb_build_object('display_name', trim(p_display_name), 'username', trim(p_username), 'is_active', p_is_active, 'roles', to_jsonb(p_roles))
  );

  return to_jsonb(v) || jsonb_build_object('roles', to_jsonb(p_roles));
end;
$$;

revoke all on function public.frontend_owner_update_user(uuid,text,text,boolean,text[]) from public, anon;
grant execute on function public.frontend_owner_update_user(uuid,text,text,boolean,text[]) to authenticated;

-- ---------------------------------------------------------
-- 6. CLINIC SETTINGS RPCs
-- ---------------------------------------------------------
create or replace function public.frontend_get_clinic_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else to_jsonb(s)
  end
  from public.clinic_settings s
  where s.id = 1;
$$;

revoke all on function public.frontend_get_clinic_settings() from public, anon;
grant execute on function public.frontend_get_clinic_settings() to authenticated;

create or replace function public.frontend_save_clinic_settings(
  p_name_en text,
  p_name_ar text,
  p_phone text default null,
  p_address_en text default null,
  p_address_ar text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.clinic_settings%rowtype;
begin
  if not (private.has_role('owner') or private.has_role('manager') or private.has_role('deputy_manager')) then
    raise exception 'Management access required';
  end if;

  update public.clinic_settings
  set
    clinic_name_en = coalesce(nullif(trim(p_name_en), ''), clinic_name_en),
    clinic_name_ar = coalesce(nullif(trim(p_name_ar), ''), clinic_name_ar),
    phone = nullif(trim(p_phone), ''),
    address_en = nullif(trim(p_address_en), ''),
    address_ar = nullif(trim(p_address_ar), ''),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v;

  return to_jsonb(v);
end;
$$;

revoke all on function public.frontend_save_clinic_settings(text,text,text,text,text) from public, anon;
grant execute on function public.frontend_save_clinic_settings(text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------
-- 7. TECHNICAL HEALTH SUMMARY
-- ---------------------------------------------------------
create or replace function public.frontend_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_users bigint;
  v_doctors bigint;
  v_patients bigint;
  v_today_appts bigint;
  v_pending_refs bigint;
  v_pending_logistics bigint;
  v_audit bigint;
begin
  if not (private.has_role('owner') or private.has_role('technical_admin')) then
    raise exception 'Technical administration access required';
  end if;

  select count(*) into v_users from public.profiles where is_active = true;
  select count(distinct ur.user_id) into v_doctors from public.user_roles ur join public.profiles p on p.id=ur.user_id where ur.role='doctor' and p.is_active=true;
  select count(*) into v_patients from public.patients where is_active=true;
  select count(*) into v_today_appts from public.appointments where (scheduled_start at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date and status not in ('cancelled','rescheduled');
  select count(*) into v_pending_refs from public.referrals where status='pending';
  select count(*) into v_pending_logistics from public.logistics_requests where status='requested';
  select count(*) into v_audit from public.audit_log;

  return jsonb_build_object(
    'database_time', now(),
    'active_users', v_users,
    'active_doctors', v_doctors,
    'active_patients', v_patients,
    'appointments_today', v_today_appts,
    'pending_referrals', v_pending_refs,
    'pending_logistics', v_pending_logistics,
    'audit_rows', v_audit,
    'timezone', 'Africa/Cairo'
  );
end;
$$;

revoke all on function public.frontend_system_health() from public, anon;
grant execute on function public.frontend_system_health() to authenticated;

-- ---------------------------------------------------------
-- 8. PROFILE PHOTO STORAGE POLICIES
-- IMPORTANT: create a PRIVATE bucket called profile-photos
-- from Supabase Storage dashboard before uploading photos.
-- ---------------------------------------------------------
drop policy if exists "Staff upload own profile photos" on storage.objects;
create policy "Staff upload own profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Clinic staff read profile photos" on storage.objects;
create policy "Clinic staff read profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "Staff update own profile photos" on storage.objects;
create policy "Staff update own profile photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Staff delete own profile photos" on storage.objects;
create policy "Staff delete own profile photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------
-- 9. VERIFY
-- ---------------------------------------------------------
select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'frontend_save_my_profile',
    'frontend_list_clinic_users',
    'frontend_list_staff_by_role',
    'frontend_owner_update_user',
    'frontend_get_clinic_settings',
    'frontend_save_clinic_settings',
    'frontend_system_health'
  )
order by routine_name;
