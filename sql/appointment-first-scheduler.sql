-- =========================================================
-- OPERATION CLINIC
-- APPOINTMENT-FIRST WORKFLOW + ROBUST SCHEDULE API
--
-- This patch:
-- 1) allows patient creation INSIDE the booking transaction
-- 2) exposes stable read/write schedule RPCs to the frontend
-- 3) keeps schedule access role-aware
--
-- Run the FULL CONTENTS in Supabase SQL Editor.
-- =========================================================


-- =========================================================
-- 1. CREATE PATIENT + BOOK APPOINTMENT IN ONE TRANSACTION
-- =========================================================

create or replace function public.frontend_create_patient_and_book(
  p_doctor uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_type text,
  p_note text default null,
  p_arabic_name text default null,
  p_english_name text default null,
  p_birth_year integer default null,
  p_gender text default null,
  p_mobile text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient public.patients%rowtype;
  v_appointment public.appointments%rowtype;
  v_current_year integer :=
    extract(year from (now() at time zone 'Africa/Cairo'))::integer;
  v_can_book boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_can_book :=
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
    or (
      private.has_role('doctor')
      and p_doctor = auth.uid()
    );

  if not v_can_book then
    raise exception 'You are not allowed to create this booking';
  end if;

  if nullif(trim(p_arabic_name), '') is null
     and nullif(trim(p_english_name), '') is null
  then
    raise exception 'Patient name is required';
  end if;

  if p_birth_year is not null
     and (
       p_birth_year < 1900
       or p_birth_year > v_current_year
     )
  then
    raise exception 'Invalid year of birth';
  end if;

  if p_gender is not null
     and p_gender not in ('male','female')
  then
    raise exception 'Invalid gender';
  end if;

  insert into public.patients (
    arabic_name,
    english_name,
    birth_year,
    gender,
    mobile,
    address,
    is_active,
    created_by,
    updated_by
  )
  values (
    nullif(trim(p_arabic_name), ''),
    nullif(trim(p_english_name), ''),
    p_birth_year,
    p_gender,
    nullif(trim(p_mobile), ''),
    nullif(trim(p_address), ''),
    true,
    auth.uid(),
    auth.uid()
  )
  returning *
  into v_patient;

  select *
  into v_appointment
  from public.book_appointment(
    v_patient.id,
    p_doctor,
    p_start,
    p_end,
    p_type,
    p_note
  );

  return jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'appointment', to_jsonb(v_appointment)
  );
end;
$$;

revoke all
on function public.frontend_create_patient_and_book(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.frontend_create_patient_and_book(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- 2. SCHEDULE ACCESS HELPERS
-- =========================================================

create or replace function private.frontend_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
    );
$$;

revoke all
on function private.frontend_is_active_staff()
from public, anon, authenticated;


create or replace function private.frontend_can_manage_schedules()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager');
$$;

revoke all
on function private.frontend_can_manage_schedules()
from public, anon, authenticated;


-- =========================================================
-- 3. READ WORKING HOURS
-- =========================================================

create or replace function public.frontend_get_doctor_working_hours(
  p_doctor uuid
)
returns setof public.doctor_working_hours
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.frontend_is_active_staff() then
    raise exception 'Active clinic staff account required';
  end if;

  return query
  select wh.*
  from public.doctor_working_hours wh
  where wh.doctor_id = p_doctor
  order by wh.weekday, wh.start_time, wh.effective_from;
end;
$$;

revoke all
on function public.frontend_get_doctor_working_hours(uuid)
from public, anon;

grant execute
on function public.frontend_get_doctor_working_hours(uuid)
to authenticated;


-- =========================================================
-- 4. READ SCHEDULE EXCEPTIONS
-- =========================================================

create or replace function public.frontend_get_doctor_schedule_exceptions(
  p_doctor uuid,
  p_from date default null,
  p_to date default null
)
returns setof public.doctor_schedule_exceptions
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.frontend_is_active_staff() then
    raise exception 'Active clinic staff account required';
  end if;

  return query
  select se.*
  from public.doctor_schedule_exceptions se
  where se.doctor_id = p_doctor
    and (
      p_from is null
      or se.exception_date >= p_from
    )
    and (
      p_to is null
      or se.exception_date <= p_to
    )
  order by se.exception_date, se.start_time nulls first, se.created_at;
end;
$$;

revoke all
on function public.frontend_get_doctor_schedule_exceptions(uuid,date,date)
from public, anon;

grant execute
on function public.frontend_get_doctor_schedule_exceptions(uuid,date,date)
to authenticated;


-- =========================================================
-- 5. MANAGEMENT: ADD WORKING HOURS
-- =========================================================

create or replace function public.frontend_save_working_hours(
  p_doctor uuid,
  p_weekday integer,
  p_start time,
  p_end time,
  p_slot_minutes integer,
  p_effective_from date,
  p_effective_until date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.doctor_working_hours%rowtype;
begin
  if not private.frontend_can_manage_schedules() then
    raise exception 'Management access required';
  end if;

  if p_weekday not between 1 and 7 then
    raise exception 'Weekday must be between 1 and 7';
  end if;

  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'End time must be after start time';
  end if;

  if p_slot_minutes is null or p_slot_minutes < 5 or p_slot_minutes > 180 then
    raise exception 'Invalid slot duration';
  end if;

  if p_effective_from is null then
    raise exception 'Effective start date is required';
  end if;

  if p_effective_until is not null
     and p_effective_until < p_effective_from
  then
    raise exception 'Invalid effective date range';
  end if;

  insert into public.doctor_working_hours (
    doctor_id,
    weekday,
    start_time,
    end_time,
    slot_minutes,
    effective_from,
    effective_until,
    is_active,
    notes,
    created_by
  )
  values (
    p_doctor,
    p_weekday,
    p_start,
    p_end,
    p_slot_minutes,
    p_effective_from,
    p_effective_until,
    true,
    nullif(trim(p_notes),''),
    auth.uid()
  )
  returning *
  into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all
on function public.frontend_save_working_hours(
  uuid,integer,time,time,integer,date,date,text
)
from public, anon;

grant execute
on function public.frontend_save_working_hours(
  uuid,integer,time,time,integer,date,date,text
)
to authenticated;


-- =========================================================
-- 6. MANAGEMENT: ACTIVATE / DEACTIVATE WORKING HOURS
-- =========================================================

create or replace function public.frontend_set_working_hours_active(
  p_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.doctor_working_hours%rowtype;
begin
  if not private.frontend_can_manage_schedules() then
    raise exception 'Management access required';
  end if;

  update public.doctor_working_hours
  set is_active = coalesce(p_active,false)
  where id = p_id
  returning *
  into v_row;

  if not found then
    raise exception 'Working-hours row not found';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all
on function public.frontend_set_working_hours_active(uuid,boolean)
from public, anon;

grant execute
on function public.frontend_set_working_hours_active(uuid,boolean)
to authenticated;


-- =========================================================
-- 7. MANAGEMENT: ADD APPROVED EXCEPTION
-- =========================================================

create or replace function public.frontend_save_schedule_exception(
  p_doctor uuid,
  p_date date,
  p_type text,
  p_all_day boolean default true,
  p_start time default null,
  p_end time default null,
  p_slot_minutes integer default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.doctor_schedule_exceptions%rowtype;
begin
  if not private.frontend_can_manage_schedules() then
    raise exception 'Management access required';
  end if;

  insert into public.doctor_schedule_exceptions (
    doctor_id,
    exception_date,
    exception_type,
    is_all_day,
    start_time,
    end_time,
    slot_minutes,
    status,
    note,
    requested_by,
    reviewed_by,
    reviewed_at
  )
  values (
    p_doctor,
    p_date,
    p_type::public.schedule_exception_type,
    coalesce(p_all_day,true),
    case when coalesce(p_all_day,true) then null else p_start end,
    case when coalesce(p_all_day,true) then null else p_end end,
    case
      when p_type in ('extra_clinic','changed_hours')
        then p_slot_minutes
      else null
    end,
    'approved',
    nullif(trim(p_note),''),
    auth.uid(),
    auth.uid(),
    now()
  )
  returning *
  into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all
on function public.frontend_save_schedule_exception(
  uuid,date,text,boolean,time,time,integer,text
)
from public, anon;

grant execute
on function public.frontend_save_schedule_exception(
  uuid,date,text,boolean,time,time,integer,text
)
to authenticated;


-- =========================================================
-- 8. DOCTOR: REQUEST SCHEDULE EXCEPTION
-- =========================================================

create or replace function public.frontend_request_schedule_exception(
  p_date date,
  p_type text,
  p_all_day boolean default true,
  p_start time default null,
  p_end time default null,
  p_slot_minutes integer default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.doctor_schedule_exceptions%rowtype;
begin
  if auth.uid() is null or not private.has_role('doctor') then
    raise exception 'Doctor access required';
  end if;

  insert into public.doctor_schedule_exceptions (
    doctor_id,
    exception_date,
    exception_type,
    is_all_day,
    start_time,
    end_time,
    slot_minutes,
    status,
    note,
    requested_by
  )
  values (
    auth.uid(),
    p_date,
    p_type::public.schedule_exception_type,
    coalesce(p_all_day,true),
    case when coalesce(p_all_day,true) then null else p_start end,
    case when coalesce(p_all_day,true) then null else p_end end,
    case
      when p_type in ('extra_clinic','changed_hours')
        then p_slot_minutes
      else null
    end,
    'pending',
    nullif(trim(p_note),''),
    auth.uid()
  )
  returning *
  into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all
on function public.frontend_request_schedule_exception(
  date,text,boolean,time,time,integer,text
)
from public, anon;

grant execute
on function public.frontend_request_schedule_exception(
  date,text,boolean,time,time,integer,text
)
to authenticated;


-- =========================================================
-- 9. MANAGEMENT: REVIEW SCHEDULE REQUEST
-- =========================================================

create or replace function public.frontend_review_schedule_exception(
  p_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.doctor_schedule_exceptions%rowtype;
begin
  if not private.frontend_can_manage_schedules() then
    raise exception 'Management access required';
  end if;

  if p_action not in ('approved','rejected') then
    raise exception 'Action must be approved or rejected';
  end if;

  update public.doctor_schedule_exceptions
  set
    status = p_action::public.schedule_request_status,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_id
    and status = 'pending'
  returning *
  into v_row;

  if not found then
    raise exception 'Pending schedule request not found';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all
on function public.frontend_review_schedule_exception(uuid,text)
from public, anon;

grant execute
on function public.frontend_review_schedule_exception(uuid,text)
to authenticated;


-- =========================================================
-- 10. POSTGREST CACHE REFRESH
-- =========================================================

notify pgrst, 'reload schema';


-- =========================================================
-- 11. VERIFICATION
-- =========================================================

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_create_patient_and_book',
    'frontend_get_doctor_working_hours',
    'frontend_get_doctor_schedule_exceptions',
    'frontend_save_working_hours',
    'frontend_set_working_hours_active',
    'frontend_save_schedule_exception',
    'frontend_request_schedule_exception',
    'frontend_review_schedule_exception'
  )
order by routine_name;


-- Optional diagnostic:
-- This tells you which CURRENT doctor account owns each saved schedule.
select
  p.email,
  p.display_name,
  count(wh.id) as working_hour_rows
from public.profiles p
join public.user_roles ur
  on ur.user_id = p.id
  and ur.role = 'doctor'
left join public.doctor_working_hours wh
  on wh.doctor_id = p.id
where p.is_active = true
group by p.id, p.email, p.display_name
order by p.display_name, p.email;
