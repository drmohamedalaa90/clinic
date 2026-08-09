-- =========================================================
-- OPERATION CLINIC
-- ROUND 2 FIXES
--
-- 1. Live / cancellation-correct dashboard
-- 2. Sara attendance permission repair + today read RPC
-- 3. Owner historical records / edit / individual test delete
-- =========================================================


-- =========================================================
-- A. ATTENDANCE PERMISSION REPAIR
--
-- Existing attendance RLS policies call private.can_manage_attendance().
-- That helper had EXECUTE revoked from authenticated, which produces:
--   permission denied for function can_manage_attendance
--
-- Granting EXECUTE does NOT itself grant attendance access; the function's
-- own role logic remains the gate used by the RLS policies.
-- =========================================================

do $$
declare
  r record;
begin

  for r in
    select
      p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'can_manage_attendance'
  loop

    execute
      'grant execute on function '
      ||
      r.signature
      ||
      ' to authenticated';

  end loop;

end $$;


-- Also make sure the existing public attendance actions are executable.
do $$
declare
  r record;
begin

  for r in
    select
      p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'staff_check_in',
        'staff_check_out'
      )
  loop

    execute
      'grant execute on function '
      ||
      r.signature
      ||
      ' to authenticated';

  end loop;

end $$;


-- Secretary self-service attendance functions used by the frontend.
-- They intentionally allow check-in even when management has not yet configured
-- a weekly schedule. In that case late/early calculations are zero.

create or replace function public.frontend_staff_check_in(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_now timestamptz := now();
  v_existing public.attendance_records%rowtype;
  v_result public.attendance_records%rowtype;
  v_schedule public.staff_work_schedules%rowtype;
  v_scheduled_start timestamptz;
  v_late integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;

  select *
  into v_existing
  from public.attendance_records
  where staff_id = auth.uid()
    and work_date = v_today
  order by check_in_at desc
  limit 1
  for update;

  if found then
    if v_existing.check_in_at is not null then
      raise exception 'Already checked in today';
    end if;
  end if;

  select *
  into v_schedule
  from public.staff_work_schedules s
  where s.staff_id = auth.uid()
    and s.is_active = true
    and s.weekday = extract(isodow from v_today)::smallint
    and v_today >= s.effective_from
    and (s.effective_until is null or v_today <= s.effective_until)
  order by s.effective_from desc
  limit 1;

  if found then
    v_scheduled_start :=
      (v_today + v_schedule.start_time)::timestamp
      at time zone 'Africa/Cairo';

    v_late := greatest(
      0,
      floor(
        extract(epoch from (v_now - v_scheduled_start)) / 60
      )::integer
      - coalesce(v_schedule.late_grace_minutes,0)
    );
  end if;

  insert into public.attendance_records (
    staff_id,
    work_date,
    check_in_at,
    late_minutes,
    early_leave_minutes
  )
  values (
    auth.uid(),
    v_today,
    v_now,
    v_late,
    0
  )
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all
on function public.frontend_staff_check_in(text)
from public, anon;

grant execute
on function public.frontend_staff_check_in(text)
to authenticated;


create or replace function public.frontend_staff_check_out(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_now timestamptz := now();
  v_record public.attendance_records%rowtype;
  v_schedule public.staff_work_schedules%rowtype;
  v_scheduled_end timestamptz;
  v_early integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;

  select *
  into v_record
  from public.attendance_records
  where staff_id = auth.uid()
    and work_date = v_today
  order by check_in_at desc
  limit 1
  for update;

  if not found or v_record.check_in_at is null then
    raise exception 'Check in first';
  end if;

  if v_record.check_out_at is not null then
    raise exception 'Already checked out today';
  end if;

  select *
  into v_schedule
  from public.staff_work_schedules s
  where s.staff_id = auth.uid()
    and s.is_active = true
    and s.weekday = extract(isodow from v_today)::smallint
    and v_today >= s.effective_from
    and (s.effective_until is null or v_today <= s.effective_until)
  order by s.effective_from desc
  limit 1;

  if found then
    v_scheduled_end :=
      (v_today + v_schedule.end_time)::timestamp
      at time zone 'Africa/Cairo';

    v_early := greatest(
      0,
      floor(
        extract(epoch from (v_scheduled_end - v_now)) / 60
      )::integer
      - coalesce(v_schedule.early_leave_grace_minutes,0)
    );
  end if;

  update public.attendance_records
  set
    check_out_at = v_now,
    early_leave_minutes = v_early
  where id = v_record.id
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

revoke all
on function public.frontend_staff_check_out(text)
from public, anon;

grant execute
on function public.frontend_staff_check_out(text)
to authenticated;


create or replace function public.frontend_get_staff_attendance_today(
  p_staff_id uuid
)
returns setof public.attendance_records
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or (
      private.has_role('secretary')
      and p_staff_id = auth.uid()
    )
  ) then
    raise exception 'Attendance access denied';
  end if;


  return query

  select a.*

  from public.attendance_records a

  where a.staff_id =
    p_staff_id

    and a.work_date =
      (
        now()
        at time zone 'Africa/Cairo'
      )::date

  order by a.check_in_at desc

  limit 1;

end;
$$;


revoke all
on function public.frontend_get_staff_attendance_today(uuid)
from public, anon;

grant execute
on function public.frontend_get_staff_attendance_today(uuid)
to authenticated;



-- =========================================================
-- B. LIVE DASHBOARD SUMMARY
-- =========================================================

create or replace function public.frontend_dashboard_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare

  v_today date :=
    (
      now()
      at time zone 'Africa/Cairo'
    )::date;

  v_doctor_only boolean :=
       private.has_role('doctor')
    and not (
         private.has_role('owner')
      or private.has_role('manager')
      or private.has_role('deputy_manager')
      or private.has_role('secretary')
    );

  v_result jsonb;

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
    raise exception 'Active clinic account required';
  end if;


  with today_appointments as (

    select a.*

    from public.appointments a

    where
      (
        a.scheduled_start
        at time zone 'Africa/Cairo'
      )::date = v_today

      and (
        not v_doctor_only
        or a.doctor_id = auth.uid()
      )
  ),

  active_appointments as (

    select *

    from today_appointments

    where status not in (
      'cancelled',
      'rescheduled'
    )
  )

  select jsonb_build_object(

    'appointments_today',
      (
        select count(*)
        from active_appointments
      ),

    'patients_today',
      (
        select count(
          distinct patient_id
        )
        from active_appointments
      ),

    'booked',
      (
        select count(*)
        from today_appointments
        where status in (
          'booked',
          'confirmed'
        )
      ),

    'arrived',
      (
        select count(*)
        from today_appointments
        where status = 'arrived'
      ),

    'waiting',
      (
        select count(*)
        from today_appointments
        where status = 'waiting'
      ),

    'with_doctor',
      (
        select count(*)
        from today_appointments
        where status = 'with_doctor'
      ),

    'completed',
      (
        select count(*)
        from today_appointments
        where status = 'completed'
      ),

    'cancelled',
      (
        select count(*)
        from today_appointments
        where status in (
          'cancelled',
          'rescheduled'
        )
      ),

    'no_show',
      (
        select count(*)
        from today_appointments
        where status = 'no_show'
      ),

    'pending_logistics',
      case
        when (
             private.has_role('owner')
          or private.has_role('manager')
          or private.has_role('deputy_manager')
          or private.has_role('secretary')
        )
        then (
          select count(*)
          from public.logistics_requests l
          where l.status = 'requested'
        )
        else 0
      end,

    'income_today',
      case
        when (
             private.has_role('owner')
          or private.has_role('manager')
          or private.has_role('deputy_manager')
          or private.has_role('secretary')
        )
        then coalesce(
          (
            select sum(b.amount)
            from public.booking_income b
            where b.is_voided = false
              and (
                b.received_at
                at time zone 'Africa/Cairo'
              )::date = v_today
          ),
          0
        )
        else 0
      end
  )

  into v_result;


  return coalesce(
    v_result,
    '{}'::jsonb
  );

end;
$$;


revoke all
on function public.frontend_dashboard_today()
from public, anon;

grant execute
on function public.frontend_dashboard_today()
to authenticated;



-- =========================================================
-- C. OWNER HISTORICAL RECORDS
-- =========================================================

create or replace function public.owner_admin_records(
  p_search text default null,
  p_limit integer default 3000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(p_limit,3000),
        10000
      )
    );

  v_search text :=
    nullif(
      trim(p_search),
      ''
    );

  v_result jsonb;

begin

  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  select jsonb_build_object(

    'patients',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(x)
            order by x.created_at desc
          )

          from (
            select
              p.id,
              p.medical_record_number,
              p.arabic_name,
              p.english_name,
              p.birth_year,
              p.gender,
              p.mobile,
              p.residency_area,
              p.address,
              p.registration_source,
              p.is_active,
              p.created_at

            from public.patients p

            where
              v_search is null
              or coalesce(
                p.medical_record_number,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.arabic_name,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.english_name,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.mobile,
                ''
              ) ilike '%'||v_search||'%'

            order by p.created_at desc

            limit v_limit
          ) x
        ),
        '[]'::jsonb
      ),

    'appointments',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(x)
            order by x.scheduled_start desc
          )

          from (
            select
              a.id,
              a.appointment_number,
              a.patient_id,
              p.medical_record_number,

              coalesce(
                nullif(
                  trim(p.english_name),
                  ''
                ),
                nullif(
                  trim(p.arabic_name),
                  ''
                ),
                'Patient'
              ) as patient_name,

              a.doctor_id,

              coalesce(
                nullif(
                  trim(d.display_name),
                  ''
                ),
                d.username,
                'Doctor'
              ) as doctor_name,

              coalesce(
                to_jsonb(a)->>'type',
                to_jsonb(a)->>'appointment_type'
              ) as appointment_type,

              a.scheduled_start,
              a.scheduled_end,
              a.status::text as status,
              a.booking_source,
              a.created_at

            from public.appointments a

            join public.patients p
              on p.id = a.patient_id

            left join public.profiles d
              on d.id = a.doctor_id

            where
              v_search is null
              or coalesce(
                a.appointment_number,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.medical_record_number,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.arabic_name,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.english_name,
                ''
              ) ilike '%'||v_search||'%'
              or coalesce(
                p.mobile,
                ''
              ) ilike '%'||v_search||'%'

            order by a.scheduled_start desc

            limit v_limit
          ) x
        ),
        '[]'::jsonb
      )
  )

  into v_result;


  return v_result;

end;
$$;


revoke all
on function public.owner_admin_records(text,integer)
from public, anon;

grant execute
on function public.owner_admin_records(text,integer)
to authenticated;



-- =========================================================
-- D. OWNER EDIT PATIENT
-- =========================================================

create or replace function public.owner_edit_patient_record(

  p_patient_id uuid,

  p_arabic_name text,

  p_english_name text,

  p_birth_year integer,

  p_gender text,

  p_mobile text,

  p_residency_area text,

  p_address text,

  p_reason text

)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.patients%rowtype;
  v_new public.patients%rowtype;
begin

  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Edit reason is required';
  end if;


  if p_birth_year is not null
     and (
       p_birth_year < 1900
       or p_birth_year >
          extract(
            year
            from (
              now()
              at time zone 'Africa/Cairo'
            )
          )::integer
     )
  then
    raise exception 'Invalid birth year';
  end if;


  if p_gender is not null
     and p_gender not in (
       'male',
       'female'
     )
  then
    raise exception 'Invalid gender';
  end if;


  select *
  into v_old
  from public.patients
  where id = p_patient_id
  for update;


  if not found then
    raise exception 'Patient not found';
  end if;


  update public.patients

  set
    arabic_name =
      nullif(
        trim(p_arabic_name),
        ''
      ),

    english_name =
      nullif(
        trim(p_english_name),
        ''
      ),

    birth_year =
      p_birth_year,

    gender =
      p_gender,

    mobile =
      nullif(
        trim(p_mobile),
        ''
      ),

    residency_area =
      nullif(
        trim(p_residency_area),
        ''
      ),

    address =
      nullif(
        trim(p_address),
        ''
      ),

    updated_by =
      auth.uid(),

    updated_at =
      now()

  where id =
    p_patient_id

  returning *
  into v_new;


  if to_regclass(
    'public.audit_log'
  ) is not null then

    insert into public.audit_log(
      entity_type,
      entity_id,
      action,
      changed_by,
      details
    )
    values(
      'patients',
      p_patient_id,
      'owner_edit',
      auth.uid(),
      jsonb_build_object(
        'reason',
          trim(p_reason),

        'before',
          jsonb_build_object(
            'arabic_name',v_old.arabic_name,
            'english_name',v_old.english_name,
            'birth_year',v_old.birth_year,
            'gender',v_old.gender,
            'mobile',v_old.mobile,
            'residency_area',v_old.residency_area,
            'address',v_old.address
          ),

        'after',
          jsonb_build_object(
            'arabic_name',v_new.arabic_name,
            'english_name',v_new.english_name,
            'birth_year',v_new.birth_year,
            'gender',v_new.gender,
            'mobile',v_new.mobile,
            'residency_area',v_new.residency_area,
            'address',v_new.address
          )
      )
    );

  end if;


  return v_new;

end;
$$;


revoke all
on function public.owner_edit_patient_record(
  uuid,text,text,integer,text,text,text,text,text
)
from public, anon;

grant execute
on function public.owner_edit_patient_record(
  uuid,text,text,integer,text,text,text,text,text
)
to authenticated;



-- =========================================================
-- E. OWNER EDIT APPOINTMENT
-- =========================================================

create or replace function public.owner_edit_appointment_record(

  p_appointment_id uuid,

  p_doctor_id uuid,

  p_start timestamptz,

  p_end timestamptz,

  p_type text,

  p_status text,

  p_reason text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_old public.appointments%rowtype;

  v_new public.appointments%rowtype;

  v_type_column text;

begin

  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Edit reason is required';
  end if;


  if p_start is null
     or p_end is null
     or p_end <= p_start
  then
    raise exception 'Invalid appointment time';
  end if;


  if p_type not in (
    'new',
    'follow_up'
  ) then
    raise exception 'Invalid appointment type';
  end if;


  if p_status not in (
    'booked',
    'confirmed',
    'arrived',
    'waiting',
    'with_doctor',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
  ) then
    raise exception 'Invalid appointment status';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = p_doctor_id
      and p.is_active = true
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.role = 'doctor'
      )
  ) then
    raise exception 'Active doctor not found';
  end if;


  select *
  into v_old

  from public.appointments

  where id =
    p_appointment_id

  for update;


  if not found then
    raise exception 'Appointment not found';
  end if;


  select
    case
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'appointments'
          and column_name = 'type'
      )
      then 'type'
      else 'appointment_type'
    end

  into v_type_column;


  execute format(
    '
      update public.appointments

      set
        doctor_id = $1,
        scheduled_start = $2,
        scheduled_end = $3,
        %I = $4::public.appointment_type,
        status = $5::public.appointment_status,
        updated_by = $6,
        updated_at = now()

      where id = $7

      returning *
    ',
    v_type_column
  )

  into v_new

  using
    p_doctor_id,
    p_start,
    p_end,
    p_type,
    p_status,
    auth.uid(),
    p_appointment_id;


  if to_regclass(
    'public.audit_log'
  ) is not null then

    insert into public.audit_log(
      entity_type,
      entity_id,
      action,
      changed_by,
      details
    )
    values(
      'appointments',
      p_appointment_id,
      'owner_edit',
      auth.uid(),
      jsonb_build_object(
        'reason',
          trim(p_reason),

        'old_doctor_id',
          v_old.doctor_id,

        'new_doctor_id',
          v_new.doctor_id,

        'old_start',
          v_old.scheduled_start,

        'new_start',
          v_new.scheduled_start,

        'old_end',
          v_old.scheduled_end,

        'new_end',
          v_new.scheduled_end,

        'old_status',
          v_old.status,

        'new_status',
          v_new.status
      )
    );

  end if;


  return to_jsonb(
    v_new
  );

end;
$$;


revoke all
on function public.owner_edit_appointment_record(
  uuid,uuid,timestamptz,timestamptz,text,text,text
)
from public, anon;

grant execute
on function public.owner_edit_appointment_record(
  uuid,uuid,timestamptz,timestamptz,text,text,text
)
to authenticated;



-- =========================================================
-- F. OWNER DELETE ONE TEST APPOINTMENT
-- =========================================================

create or replace function public.owner_delete_test_appointment(

  p_appointment_id uuid,

  p_reason text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_appointment public.appointments%rowtype;

  v_visit_id uuid;

begin

  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Delete reason is required';
  end if;


  select *
  into v_appointment

  from public.appointments

  where id =
    p_appointment_id

  for update;


  if not found then
    raise exception 'Appointment not found';
  end if;


  if to_regclass(
    'public.audit_log'
  ) is not null then

    insert into public.audit_log(
      entity_type,
      entity_id,
      action,
      changed_by,
      details
    )
    values(
      'appointments',
      p_appointment_id,
      'owner_test_delete',
      auth.uid(),
      jsonb_build_object(
        'reason',
          trim(p_reason),

        'appointment_number',
          v_appointment.appointment_number,

        'patient_id',
          v_appointment.patient_id,

        'doctor_id',
          v_appointment.doctor_id,

        'scheduled_start',
          v_appointment.scheduled_start
      )
    );

  end if;


  -- Finance linked directly to the appointment.
  if to_regclass(
    'public.booking_income_edits'
  ) is not null then

    delete from public.booking_income_edits
    where appointment_id =
      p_appointment_id;

  end if;


  if to_regclass(
    'public.booking_income'
  ) is not null then

    delete from public.booking_income
    where appointment_id =
      p_appointment_id;

  end if;


  -- Invoice children + invoice, when linked to this appointment.
  if to_regclass(
    'public.invoices'
  ) is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'appointment_id'
  )
  then

    if to_regclass(
      'public.invoice_payments'
    ) is not null then

      execute '
        delete from public.invoice_payments p
        where p.invoice_id in (
          select i.id
          from public.invoices i
          where i.appointment_id = $1
        )
      '
      using p_appointment_id;

    end if;


    if to_regclass(
      'public.invoice_items'
    ) is not null then

      execute '
        delete from public.invoice_items x
        where x.invoice_id in (
          select i.id
          from public.invoices i
          where i.appointment_id = $1
        )
      '
      using p_appointment_id;

    end if;


    execute '
      delete from public.invoices
      where appointment_id = $1
    '
    using p_appointment_id;

  end if;


  -- Clinical visit children.
  if to_regclass(
    'public.clinical_visits'
  ) is not null then

    for v_visit_id in
      select v.id
      from public.clinical_visits v
      where v.appointment_id =
        p_appointment_id
    loop

      if to_regclass(
        'public.clinical_visit_amendments'
      ) is not null then
        delete from public.clinical_visit_amendments
        where visit_id = v_visit_id;
      end if;


      if to_regclass(
        'public.visit_vitals'
      ) is not null then
        delete from public.visit_vitals
        where visit_id = v_visit_id;
      end if;


      if to_regclass(
        'public.visit_diagnoses'
      ) is not null then
        delete from public.visit_diagnoses
        where visit_id = v_visit_id;
      end if;


      if to_regclass(
        'public.visit_investigations'
      ) is not null then
        delete from public.visit_investigations
        where visit_id = v_visit_id;
      end if;


      if to_regclass(
        'public.visit_medications'
      ) is not null then
        delete from public.visit_medications
        where visit_id = v_visit_id;
      end if;


      if to_regclass(
        'public.clinical_documents'
      ) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'clinical_documents'
          and column_name = 'visit_id'
      )
      then

        execute '
          delete from public.clinical_documents
          where visit_id = $1
        '
        using v_visit_id;

      end if;


      if to_regclass(
        'public.referrals'
      ) is not null then

        if exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'referrals'
            and column_name = 'source_visit_id'
        ) then

          execute '
            delete from public.referrals
            where source_visit_id = $1
          '
          using v_visit_id;

        end if;


        if exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'referrals'
            and column_name = 'clinical_visit_id'
        ) then

          execute '
            delete from public.referrals
            where clinical_visit_id = $1
          '
          using v_visit_id;

        end if;

      end if;

    end loop;


    delete from public.clinical_visits
    where appointment_id =
      p_appointment_id;

  end if;


  if to_regclass(
    'public.appointment_status_history'
  ) is not null then

    delete from public.appointment_status_history
    where appointment_id =
      p_appointment_id;

  end if;


  delete from public.appointments
  where id =
    p_appointment_id;


  return jsonb_build_object(
    'deleted',
      true,

    'appointment_id',
      p_appointment_id,

    'appointment_number',
      v_appointment.appointment_number
  );

end;
$$;


revoke all
on function public.owner_delete_test_appointment(uuid,text)
from public, anon;

grant execute
on function public.owner_delete_test_appointment(uuid,text)
to authenticated;



-- =========================================================
-- G. OWNER DELETE ONE TEST PATIENT
-- =========================================================

create or replace function public.owner_delete_test_patient(

  p_patient_id uuid,

  p_reason text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_patient public.patients%rowtype;

  v_appointment_id uuid;

begin

  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Delete reason is required';
  end if;


  select *
  into v_patient

  from public.patients

  where id =
    p_patient_id

  for update;


  if not found then
    raise exception 'Patient not found';
  end if;


  if to_regclass(
    'public.audit_log'
  ) is not null then

    insert into public.audit_log(
      entity_type,
      entity_id,
      action,
      changed_by,
      details
    )
    values(
      'patients',
      p_patient_id,
      'owner_test_delete',
      auth.uid(),
      jsonb_build_object(
        'reason',
          trim(p_reason),

        'medical_record_number',
          v_patient.medical_record_number,

        'arabic_name',
          v_patient.arabic_name,

        'english_name',
          v_patient.english_name
      )
    );

  end if;


  for v_appointment_id in

    select a.id

    from public.appointments a

    where a.patient_id =
      p_patient_id

  loop

    perform public.owner_delete_test_appointment(
      v_appointment_id,
      'Patient test deletion: '||trim(p_reason)
    );

  end loop;


  if to_regclass(
    'public.referrals'
  ) is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referrals'
      and column_name = 'patient_id'
  )
  then

    execute '
      delete from public.referrals
      where patient_id = $1
    '
    using p_patient_id;

  end if;


  -- Any invoices left that were not appointment-linked.
  if to_regclass(
    'public.invoices'
  ) is not null then

    if to_regclass(
      'public.invoice_payments'
    ) is not null then

      delete from public.invoice_payments
      where invoice_id in (
        select i.id
        from public.invoices i
        where i.patient_id =
          p_patient_id
      );

    end if;


    if to_regclass(
      'public.invoice_items'
    ) is not null then

      delete from public.invoice_items
      where invoice_id in (
        select i.id
        from public.invoices i
        where i.patient_id =
          p_patient_id
      );

    end if;


    delete from public.invoices
    where patient_id =
      p_patient_id;

  end if;


  delete from public.patients
  where id =
    p_patient_id;


  return jsonb_build_object(
    'deleted',
      true,

    'patient_id',
      p_patient_id,

    'medical_record_number',
      v_patient.medical_record_number
  );

end;
$$;


revoke all
on function public.owner_delete_test_patient(uuid,text)
from public, anon;

grant execute
on function public.owner_delete_test_patient(uuid,text)
to authenticated;



notify pgrst, 'reload schema';


-- =========================================================
-- VERIFY
-- =========================================================

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_staff_check_in',
    'frontend_staff_check_out',
    'frontend_get_staff_attendance_today',
    'frontend_dashboard_today',
    'owner_admin_records',
    'owner_edit_patient_record',
    'owner_edit_appointment_record',
    'owner_delete_test_appointment',
    'owner_delete_test_patient'
  )
order by routine_name;
