-- CLINIC V49 — SERVER-SIDE BOOKING GRACE FIX
-- Rule: do NOT close individual hourly slots as their own time passes.
-- All still-available slots for a clinic day remain bookable until
-- TWO HOURS AFTER THE FINAL clinic slot ends.
--
-- This fixes the database-side rejection that produced:
-- "This appointment slot has already closed. Please choose another time."

create or replace function private.clinic_booking_grace_end(
  p_doctor uuid,
  p_day date
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(hs.slot_end) + interval '2 hours'
  from private.hourly_slots_for_date(p_doctor, p_day) hs;
$$;

revoke all on function private.clinic_booking_grace_end(uuid,date)
from public, anon, authenticated;


create or replace function public.frontend_book_appointment(
  p_patient uuid,
  p_doctor uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_type text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_grace_end timestamptz;
  v_slot_exists boolean := false;
  v_used integer := 0;
  v_appointment public.appointments%rowtype;
  v_has_type boolean := false;
  v_has_appointment_type boolean := false;
  v_lock_key bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
    or (private.has_role('doctor') and p_doctor = auth.uid())
  ) then
    raise exception 'You are not allowed to create this booking';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = p_patient and p.is_active = true
  ) then
    raise exception 'Active patient not found';
  end if;

  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid appointment time';
  end if;

  v_day := (p_start at time zone 'Africa/Cairo')::date;

  select exists (
    select 1
    from private.hourly_slots_for_date(p_doctor, v_day) hs
    where hs.slot_start = p_start
      and hs.slot_end = p_end
  ) into v_slot_exists;

  if not v_slot_exists then
    raise exception 'This clinic slot is no longer available';
  end if;

  v_grace_end := private.clinic_booking_grace_end(p_doctor, v_day);

  if v_grace_end is null or now() > v_grace_end then
    raise exception 'The clinic booking window has closed';
  end if;

  v_lock_key := hashtextextended(p_doctor::text || '|' || p_start::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select count(*)::integer
  into v_used
  from public.appointments a
  where a.doctor_id = p_doctor
    and a.status not in ('cancelled','rescheduled')
    and tstzrange(a.scheduled_start,a.scheduled_end,'[)')
        && tstzrange(p_start,p_end,'[)');

  if v_used >= 4 then
    raise exception 'This hourly slot is full (4 patients maximum)';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='type'
  ) into v_has_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='appointment_type'
  ) into v_has_appointment_type;

  if v_has_type then
    execute $insert$
      insert into public.appointments (
        patient_id, doctor_id, type,
        scheduled_start, scheduled_end,
        status, notes, booking_source,
        created_by, updated_by
      ) values (
        $1,$2,$3,$4,$5,
        'booked',$6,'internal',$7,$7
      ) returning *
    $insert$
    into v_appointment
    using p_patient,p_doctor,p_type,p_start,p_end,nullif(trim(p_note),''),auth.uid();

  elsif v_has_appointment_type then
    execute $insert$
      insert into public.appointments (
        patient_id, doctor_id, appointment_type,
        scheduled_start, scheduled_end,
        status, notes, booking_source,
        created_by, updated_by
      ) values (
        $1,$2,$3,$4,$5,
        'booked',$6,'internal',$7,$7
      ) returning *
    $insert$
    into v_appointment
    using p_patient,p_doctor,p_type,p_start,p_end,nullif(trim(p_note),''),auth.uid();

  else
    raise exception 'Appointment type column was not found';
  end if;

  return to_jsonb(v_appointment);
end;
$$;

revoke all on function public.frontend_book_appointment(
  uuid,uuid,timestamptz,timestamptz,text,text
) from public, anon;

grant execute on function public.frontend_book_appointment(
  uuid,uuid,timestamptz,timestamptz,text,text
) to authenticated;


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
  v_appointment jsonb;
  v_current_year integer := extract(year from (now() at time zone 'Africa/Cairo'))::integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_arabic_name),'') is null
     and nullif(trim(p_english_name),'') is null then
    raise exception 'Patient name is required';
  end if;

  if p_birth_year is not null
     and (p_birth_year < 1900 or p_birth_year > v_current_year) then
    raise exception 'Invalid year of birth';
  end if;

  if p_gender is not null and p_gender not in ('male','female') then
    raise exception 'Invalid gender';
  end if;

  insert into public.patients (
    arabic_name, english_name, birth_year, gender,
    mobile, address, is_active, created_by, updated_by
  ) values (
    nullif(trim(p_arabic_name),''),
    nullif(trim(p_english_name),''),
    p_birth_year,
    p_gender,
    nullif(trim(p_mobile),''),
    nullif(trim(p_address),''),
    true,
    auth.uid(),
    auth.uid()
  ) returning * into v_patient;

  v_appointment := public.frontend_book_appointment(
    v_patient.id,
    p_doctor,
    p_start,
    p_end,
    p_type,
    p_note
  );

  return jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'appointment', v_appointment
  );
end;
$$;

revoke all on function public.frontend_create_patient_and_book(
  uuid,timestamptz,timestamptz,text,text,text,text,integer,text,text,text
) from public, anon;

grant execute on function public.frontend_create_patient_and_book(
  uuid,timestamptz,timestamptz,text,text,text,text,integer,text,text,text
) to authenticated;

notify pgrst, 'reload schema';
