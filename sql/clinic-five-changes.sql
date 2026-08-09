-- =========================================================
-- OPERATION CLINIC
-- AUG 2026 UX / ATTENDANCE / FINANCE / NOTIFICATION PATCH
--
-- Includes:
-- 1. Staff attendance read RPCs for Secretary + Management
-- 2. Finance checked-in fee editing with mandatory reason + audit
-- 3. Repair duplicate appointment notification trigger/history
-- =========================================================


-- =========================================================
-- A. ATTENDANCE — SECURE READ ACCESS
-- =========================================================

create or replace function public.frontend_get_staff_work_schedule(
  p_staff_id uuid
)
returns setof public.staff_work_schedules
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

  select s.*

  from public.staff_work_schedules s

  where s.staff_id = p_staff_id

  order by
    s.is_active desc,
    s.weekday,
    s.effective_from desc;

end;
$$;


revoke all
on function public.frontend_get_staff_work_schedule(uuid)
from public, anon;

grant execute
on function public.frontend_get_staff_work_schedule(uuid)
to authenticated;



create or replace function public.frontend_get_staff_attendance_history(
  p_staff_id uuid,
  p_days integer default 45
)
returns setof public.attendance_records
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer :=
    greatest(
      1,
      least(
        coalesce(p_days,45),
        366
      )
    );
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

  where a.staff_id = p_staff_id

    and a.work_date >=
      (
        now()
        at time zone 'Africa/Cairo'
      )::date
      -
      (v_days - 1)

  order by
    a.work_date desc,
    a.check_in_at desc;

end;
$$;


revoke all
on function public.frontend_get_staff_attendance_history(uuid,integer)
from public, anon;

grant execute
on function public.frontend_get_staff_attendance_history(uuid,integer)
to authenticated;



-- =========================================================
-- B. FINANCE — EDIT CHECKED-IN FEE WITH MANDATORY REASON
-- =========================================================

create table if not exists public.booking_income_edits (

  id uuid primary key
    default gen_random_uuid(),

  appointment_id uuid not null
    references public.appointments(id)
    on delete restrict,

  booking_income_id uuid
    references public.booking_income(id)
    on delete set null,

  old_amount numeric(12,2),

  new_amount numeric(12,2) not null,

  old_payment_method text,

  new_payment_method text not null,

  old_note text,

  new_note text,

  reason text not null,

  edited_by uuid not null
    references public.profiles(id)
    on delete restrict,

  edited_at timestamptz not null
    default now(),

  constraint booking_income_edits_reason_required
    check (
      nullif(trim(reason),'') is not null
    ),

  constraint booking_income_edits_new_amount_positive
    check (
      new_amount > 0
    )
);


create index if not exists booking_income_edits_appointment_idx
on public.booking_income_edits(
  appointment_id,
  edited_at desc
);


alter table public.booking_income_edits
enable row level security;


revoke all
on public.booking_income_edits
from public, anon, authenticated;


grant select
on public.booking_income_edits
to authenticated;


drop policy if exists
  "Finance staff view booking income edits"
on public.booking_income_edits;


create policy
  "Finance staff view booking income edits"

on public.booking_income_edits

for select
to authenticated

using (
     private.has_role('owner')
  or private.has_role('manager')
  or private.has_role('deputy_manager')
  or private.has_role('secretary')
);


create or replace function public.finance_edit_checkin_fee(

  p_appointment_id uuid,

  p_amount numeric,

  p_payment_method text,

  p_reason text,

  p_note text default null

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_appointment public.appointments%rowtype;

  v_income public.booking_income%rowtype;

  v_old_amount numeric;

  v_old_method text;

  v_old_note text;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
  ) then
    raise exception 'Finance access required';
  end if;


  if p_amount is null
     or p_amount <= 0
  then
    raise exception 'Fee must be greater than zero';
  end if;


  if p_payment_method not in (
    'cash',
    'card',
    'instapay',
    'bank_transfer',
    'other'
  ) then
    raise exception 'Invalid payment method';
  end if;


  if nullif(trim(p_reason),'') is null then
    raise exception 'Edit reason is required';
  end if;


  select *
  into v_appointment

  from public.appointments

  where id = p_appointment_id

  for update;


  if not found then
    raise exception 'Appointment not found';
  end if;


  if v_appointment.checked_in_at is null then
    raise exception 'This patient has not been checked in';
  end if;


  select *
  into v_income

  from public.booking_income

  where appointment_id =
    p_appointment_id

    and is_voided = false

  for update;


  if found then

    v_old_amount :=
      v_income.amount;

    v_old_method :=
      v_income.payment_method;

    v_old_note :=
      v_income.note;


    update public.booking_income

    set
      amount =
        p_amount,

      payment_method =
        p_payment_method,

      note =
        nullif(trim(p_note),''),

      updated_at =
        now()

    where id =
      v_income.id

    returning *
    into v_income;

  else

    v_old_amount :=
      null;

    v_old_method :=
      null;

    v_old_note :=
      null;


    insert into public.booking_income (

      appointment_id,

      patient_id,

      doctor_id,

      amount,

      payment_method,

      note,

      received_at,

      received_by

    )

    values (

      v_appointment.id,

      v_appointment.patient_id,

      v_appointment.doctor_id,

      p_amount,

      p_payment_method,

      nullif(trim(p_note),''),

      coalesce(
        v_appointment.checked_in_at,
        now()
      ),

      auth.uid()

    )

    returning *
    into v_income;

  end if;


  insert into public.booking_income_edits (

    appointment_id,

    booking_income_id,

    old_amount,

    new_amount,

    old_payment_method,

    new_payment_method,

    old_note,

    new_note,

    reason,

    edited_by

  )

  values (

    v_appointment.id,

    v_income.id,

    v_old_amount,

    v_income.amount,

    v_old_method,

    v_income.payment_method,

    v_old_note,

    v_income.note,

    trim(p_reason),

    auth.uid()

  );


  return jsonb_build_object(

    'appointment_id',
      v_appointment.id,

    'income_id',
      v_income.id,

    'amount',
      v_income.amount,

    'payment_method',
      v_income.payment_method,

    'reason',
      trim(p_reason)

  );

end;
$$;


revoke all
on function public.finance_edit_checkin_fee(
  uuid,numeric,text,text,text
)
from public, anon;

grant execute
on function public.finance_edit_checkin_fee(
  uuid,numeric,text,text,text
)
to authenticated;



-- =========================================================
-- C. NOTIFICATIONS — REMOVE DUPLICATE BOOKING EVENTS
--
-- Older installs can have the same appointment-status trigger
-- attached twice. Keep exactly ONE trigger that calls
-- private.log_appointment_status_change().
-- =========================================================

do $$
declare
  r record;
begin

  for r in

    select
      t.tgname

    from pg_trigger t

    where t.tgrelid =
      'public.appointments'::regclass

      and not t.tgisinternal

      and t.tgfoid =
        'private.log_appointment_status_change()'::regprocedure

  loop

    execute format(
      'drop trigger if exists %I on public.appointments',
      r.tgname
    );

  end loop;

end $$;


create trigger
  appointments_log_status_change

after insert or update of status
on public.appointments

for each row
execute procedure
  private.log_appointment_status_change();


-- Remove existing duplicate history rows created at essentially
-- the same moment for the same appointment/status.
with ranked as (

  select
    h.id,

    row_number() over (

      partition by
        h.appointment_id,
        h.new_status,
        date_trunc(
          'second',
          h.changed_at
        )

      order by
        h.id

    ) as rn

  from public.appointment_status_history h

)

delete from public.appointment_status_history h

using ranked r

where h.id = r.id

  and r.rn > 1;


notify pgrst, 'reload schema';


-- =========================================================
-- VERIFY
-- =========================================================

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_get_staff_work_schedule',
    'frontend_get_staff_attendance_history',
    'finance_edit_checkin_fee'
  )
order by routine_name;


select
  t.tgname
from pg_trigger t
where t.tgrelid =
  'public.appointments'::regclass
  and not t.tgisinternal
  and t.tgfoid =
    'private.log_appointment_status_change()'::regprocedure;

