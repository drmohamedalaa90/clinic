-- =========================================================
-- OPERATION CLINIC
-- HOURLY APPOINTMENTS: 4 PATIENTS PER HOUR
--
-- Requested behavior:
-- • 15:00–16:00 = one appointment hour
-- • 16:00–17:00 = one appointment hour
-- • each hour carries up to FOUR patients
-- • doctors land on Appointments after login
--
-- Run the FULL CONTENTS in Supabase SQL Editor.
-- =========================================================


-- =========================================================
-- 1. ALL REGULAR / EXTRA CLINIC SLOTS BECOME 60 MINUTES
-- =========================================================

update public.doctor_working_hours
set slot_minutes = 60
where slot_minutes is distinct from 60;

update public.doctor_schedule_exceptions
set slot_minutes = 60
where exception_type in ('extra_clinic','changed_hours')
  and slot_minutes is distinct from 60;


-- =========================================================
-- 2. REMOVE OLD "ONE APPOINTMENT ONLY" OVERLAP CONSTRAINT
--
-- The old exclusion constraint prevented two patients from
-- occupying the same doctor time range. We now permit up to 4.
-- =========================================================

alter table public.appointments
drop constraint if exists appointments_no_doctor_overlap;


create index if not exists appointments_doctor_hour_capacity_idx
on public.appointments (
  doctor_id,
  scheduled_start,
  scheduled_end,
  status
);


-- =========================================================
-- 3. GENERATE THE DOCTOR'S VALID HOURLY CLINIC WINDOWS
--
-- This function:
-- • uses regular hours
-- • changed_hours replaces regular hours for that date
-- • extra_clinic adds hours
-- • apology/vacation/emergency cancellation removes hours
-- • blocked_period removes overlapping hours
-- =========================================================

create or replace function private.hourly_slots_for_date(
  p_doctor_id uuid,
  p_date date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  local_start time,
  local_end time,
  source text
)
language sql
stable
security definer
set search_path = ''
as $$

with

approved_changed as (
  select
    se.start_time,
    se.end_time
  from public.doctor_schedule_exceptions se
  where se.doctor_id = p_doctor_id
    and se.exception_date = p_date
    and se.status = 'approved'
    and se.exception_type = 'changed_hours'
    and se.is_all_day = false
    and se.start_time is not null
    and se.end_time is not null
),

base_windows as (
  -- If there is any approved changed-hours record for the day,
  -- it replaces normal regular hours.
  select
    ac.start_time,
    ac.end_time,
    'changed_hours'::text as source
  from approved_changed ac

  union all

  select
    wh.start_time,
    wh.end_time,
    'regular'::text as source
  from public.doctor_working_hours wh
  where wh.doctor_id = p_doctor_id
    and wh.is_active = true
    and wh.weekday = extract(isodow from p_date)::smallint
    and p_date >= wh.effective_from
    and (
      wh.effective_until is null
      or p_date <= wh.effective_until
    )
    and not exists (
      select 1
      from approved_changed
    )
),

extra_windows as (
  select
    se.start_time,
    se.end_time,
    'extra_clinic'::text as source
  from public.doctor_schedule_exceptions se
  where se.doctor_id = p_doctor_id
    and se.exception_date = p_date
    and se.status = 'approved'
    and se.exception_type = 'extra_clinic'
    and se.is_all_day = false
    and se.start_time is not null
    and se.end_time is not null
),

all_windows as (
  select * from base_windows
  union all
  select * from extra_windows
),

generated as (
  select
    (
      p_date + gs::time
    )::timestamp
      at time zone 'Africa/Cairo'
      as slot_start,

    (
      p_date + (gs + interval '1 hour')::time
    )::timestamp
      at time zone 'Africa/Cairo'
      as slot_end,

    gs::time as local_start,

    (gs + interval '1 hour')::time as local_end,

    w.source

  from all_windows w

  cross join lateral generate_series(
    w.start_time::interval,
    (w.end_time - interval '1 hour')::time::interval,
    interval '1 hour'
  ) gs

  where w.end_time > w.start_time
    and (
      extract(epoch from (w.end_time - w.start_time))
      >= 3600
    )
),

not_closed as (
  select g.*
  from generated g
  where not exists (
    select 1
    from public.doctor_schedule_exceptions se
    where se.doctor_id = p_doctor_id
      and se.exception_date = p_date
      and se.status = 'approved'
      and se.exception_type in (
        'apology',
        'vacation',
        'emergency_cancellation',
        'blocked_period'
      )
      and (
        se.is_all_day = true
        or (
          se.start_time is not null
          and se.end_time is not null
          and tstzrange(
            (
              p_date + se.start_time
            )::timestamp at time zone 'Africa/Cairo',
            (
              p_date + se.end_time
            )::timestamp at time zone 'Africa/Cairo',
            '[)'
          )
          &&
          tstzrange(
            g.slot_start,
            g.slot_end,
            '[)'
          )
        )
      )
  )
)

select
  n.slot_start,
  n.slot_end,
  n.local_start,
  n.local_end,
  n.source
from not_closed n
order by n.slot_start;

$$;


revoke all
on function private.hourly_slots_for_date(uuid,date)
from public, anon, authenticated;


-- =========================================================
-- 4. FRONTEND: HOURLY SLOT + CAPACITY
--
-- Returns ALL hourly slots, including full hours.
-- capacity = 4
-- booked_count = current non-cancelled/non-rescheduled patients
-- remaining_capacity = 4 - booked_count
-- =========================================================

create or replace function public.frontend_get_hourly_slots(
  p_doctor uuid,
  p_day date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  local_start time,
  local_end time,
  capacity integer,
  booked_count integer,
  remaining_capacity integer,
  source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  ) then
    raise exception 'Active clinic staff account required';
  end if;

  return query

  select
    hs.slot_start,
    hs.slot_end,
    hs.local_start,
    hs.local_end,

    4::integer as capacity,

    count(a.id)::integer as booked_count,

    greatest(
      0,
      4 - count(a.id)::integer
    )::integer as remaining_capacity,

    hs.source

  from private.hourly_slots_for_date(
    p_doctor,
    p_day
  ) hs

  left join public.appointments a
    on a.doctor_id = p_doctor
    and a.status not in (
      'cancelled',
      'rescheduled'
    )
    and tstzrange(
      a.scheduled_start,
      a.scheduled_end,
      '[)'
    )
    &&
    tstzrange(
      hs.slot_start,
      hs.slot_end,
      '[)'
    )

  group by
    hs.slot_start,
    hs.slot_end,
    hs.local_start,
    hs.local_end,
    hs.source

  order by hs.slot_start;

end;
$$;


revoke all
on function public.frontend_get_hourly_slots(uuid,date)
from public, anon;

grant execute
on function public.frontend_get_hourly_slots(uuid,date)
to authenticated;


-- =========================================================
-- 5. REPLACE APPOINTMENT SLOT VALIDATION
--
-- Important:
-- • new appointments MUST exactly match an hourly clinic slot
-- • up to 4 active appointments may overlap that hour
-- • status-only updates of old historical appointments remain valid
-- • transaction advisory lock prevents two simultaneous bookings
--   from creating a 5th patient in the same hour
-- =========================================================

create or replace function private.enforce_valid_appointment_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_capacity_used integer;
  v_slot_exists boolean;
  v_lock_key bigint;
begin

  -- Do not revalidate timing on status-only updates.
  if tg_op = 'UPDATE'
     and new.doctor_id is not distinct from old.doctor_id
     and new.scheduled_start is not distinct from old.scheduled_start
     and new.scheduled_end is not distinct from old.scheduled_end
  then
    return new;
  end if;

  if new.status in ('cancelled','rescheduled') then
    return new;
  end if;

  if new.doctor_id is null
     or new.scheduled_start is null
     or new.scheduled_end is null
  then
    raise exception 'Doctor and appointment time are required';
  end if;

  v_date :=
    (
      new.scheduled_start
      at time zone 'Africa/Cairo'
    )::date;

  if (
    new.scheduled_end
    at time zone 'Africa/Cairo'
  )::date <> v_date
  then
    raise exception 'Appointment must remain within one clinic day';
  end if;

  select exists (
    select 1
    from private.hourly_slots_for_date(
      new.doctor_id,
      v_date
    ) hs
    where hs.slot_start = new.scheduled_start
      and hs.slot_end = new.scheduled_end
  )
  into v_slot_exists;

  if not v_slot_exists then
    raise exception
      'Appointment must exactly match a valid one-hour clinic slot';
  end if;

  -- Serialize booking attempts for this doctor/hour.
  v_lock_key :=
    hashtextextended(
      new.doctor_id::text
      || '|'
      || new.scheduled_start::text,
      0
    );

  perform pg_advisory_xact_lock(v_lock_key);

  select count(*)::integer
  into v_capacity_used
  from public.appointments a
  where a.doctor_id = new.doctor_id
    and a.status not in (
      'cancelled',
      'rescheduled'
    )
    and (
      tg_op <> 'UPDATE'
      or a.id <> new.id
    )
    and tstzrange(
      a.scheduled_start,
      a.scheduled_end,
      '[)'
    )
    &&
    tstzrange(
      new.scheduled_start,
      new.scheduled_end,
      '[)'
    );

  if v_capacity_used >= 4 then
    raise exception
      'This hourly slot is full (4 patients maximum)';
  end if;

  return new;
end;
$$;


revoke all
on function private.enforce_valid_appointment_slot()
from public, anon, authenticated;


-- =========================================================
-- 6. FORCE NEW SCHEDULE ENTRIES TO 60 MINUTES
-- =========================================================

create or replace function public.frontend_save_working_hours(
  p_doctor uuid,
  p_weekday integer,
  p_start time,
  p_end time,
  p_slot_minutes integer default 60,
  p_effective_from date default current_date,
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

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then
    raise exception 'Management access required';
  end if;

  if p_weekday not between 1 and 7 then
    raise exception 'Weekday must be between 1 and 7';
  end if;

  if p_start is null
     or p_end is null
     or p_end <= p_start
  then
    raise exception 'End time must be after start time';
  end if;

  if extract(epoch from (p_end - p_start)) < 3600 then
    raise exception 'Clinic duration must contain at least one full hour';
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
    60,
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
-- 7. FRONTEND EXCEPTIONS: EXTRA / CHANGED HOURS ALSO 60 MIN
-- =========================================================

create or replace function public.frontend_save_schedule_exception(
  p_doctor uuid,
  p_date date,
  p_type text,
  p_all_day boolean default true,
  p_start time default null,
  p_end time default null,
  p_slot_minutes integer default 60,
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

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then
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
    case
      when coalesce(p_all_day,true)
        then null
      else p_start
    end,
    case
      when coalesce(p_all_day,true)
        then null
      else p_end
    end,
    case
      when p_type in (
        'extra_clinic',
        'changed_hours'
      )
        then 60
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


create or replace function public.frontend_request_schedule_exception(
  p_date date,
  p_type text,
  p_all_day boolean default true,
  p_start time default null,
  p_end time default null,
  p_slot_minutes integer default 60,
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

  if auth.uid() is null
     or not private.has_role('doctor')
  then
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
    case
      when coalesce(p_all_day,true)
        then null
      else p_start
    end,
    case
      when coalesce(p_all_day,true)
        then null
      else p_end
    end,
    case
      when p_type in (
        'extra_clinic',
        'changed_hours'
      )
        then 60
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
-- 8. REFRESH REST SCHEMA
-- =========================================================

notify pgrst, 'reload schema';


-- =========================================================
-- 9. VERIFY
-- =========================================================

select
  p.display_name,
  wh.weekday,
  wh.start_time,
  wh.end_time,
  wh.slot_minutes
from public.doctor_working_hours wh
join public.profiles p
  on p.id = wh.doctor_id
where wh.is_active = true
order by
  p.display_name,
  wh.weekday,
  wh.start_time;


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'frontend_get_hourly_slots';

