-- =========================================================
-- OPERATION CLINIC
-- BOOKING FEES -> FINANCE / INCOME
--
-- Correct workflow:
-- Booking = no fee
-- Patient arrives / check-in = enter fee
-- Fee exports to Finance > Income
-- =========================================================


-- =========================================================
-- 1. BOOKING INCOME LEDGER
-- =========================================================

create table if not exists public.booking_income (

  id uuid primary key
    default gen_random_uuid(),

  appointment_id uuid not null unique
    references public.appointments(id)
    on delete restrict,

  patient_id uuid not null
    references public.patients(id)
    on delete restrict,

  doctor_id uuid not null
    references public.profiles(id)
    on delete restrict,

  amount numeric(12,2) not null
    check (amount > 0),

  payment_method text not null
    check (
      payment_method in (
        'cash',
        'card',
        'instapay',
        'bank_transfer',
        'other'
      )
    ),

  note text,

  received_at timestamptz not null
    default now(),

  received_by uuid not null
    references public.profiles(id)
    on delete restrict,

  is_voided boolean not null
    default false,

  void_reason text,

  voided_at timestamptz,

  voided_by uuid
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()

);


create index if not exists booking_income_received_at_idx
on public.booking_income(received_at desc);

create index if not exists booking_income_patient_idx
on public.booking_income(patient_id);

create index if not exists booking_income_doctor_idx
on public.booking_income(doctor_id);


-- =========================================================
-- 2. RLS
-- =========================================================

alter table public.booking_income
enable row level security;

revoke all
on public.booking_income
from public, anon, authenticated;

grant select
on public.booking_income
to authenticated;


drop policy if exists
  "Reception and management view booking income"
on public.booking_income;


create policy
  "Reception and management view booking income"

on public.booking_income

for select
to authenticated

using (
     private.has_role('owner')
  or private.has_role('manager')
  or private.has_role('deputy_manager')
  or private.has_role('secretary')
);



-- =========================================================
-- 3. CORRECT WORKFLOW:
--    FEES ARE COLLECTED ONLY WHEN THE PATIENT ARRIVES
-- =========================================================

-- Disable/remove the previous fee-during-booking functions if
-- they were installed from the earlier patch.
drop function if exists
public.frontend_book_existing_patient_with_fee(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  numeric,
  text
);

drop function if exists
public.frontend_create_patient_and_book_with_fee(
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
  text,
  numeric,
  text
);


create or replace function public.frontend_check_in_with_fee(

  p_id uuid,

  p_fee numeric default 0,

  p_payment_method text default 'cash',

  p_note text default null

)

returns jsonb

language plpgsql
security definer
set search_path = ''

as $$

declare

  v_appointment public.appointments%rowtype;

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

    raise exception
      'Reception access required';

  end if;


  if p_fee is null or p_fee < 0 then
    raise exception
      'Fee cannot be negative';
  end if;


  if p_payment_method not in (
    'cash',
    'card',
    'instapay',
    'bank_transfer',
    'other'
  ) then

    raise exception
      'Invalid payment method';

  end if;


  select *
  into v_appointment

  from public.appointments

  where id = p_id

  for update;


  if not found then
    raise exception
      'Appointment not found';
  end if;


  if v_appointment.status not in (
    'booked',
    'confirmed'
  ) then

    raise exception
      'Only booked or confirmed appointments can be checked in';

  end if;


  -- Existing clinic workflow changes the appointment to ARRIVED.
  select *
  into v_appointment

  from public.check_in_appointment(
    p_id
  );


  -- Income exists only after the patient physically arrives.
  if p_fee > 0 then

    insert into public.booking_income (

      appointment_id,

      patient_id,

      doctor_id,

      amount,

      payment_method,

      note,

      received_by

    )

    values (

      v_appointment.id,

      v_appointment.patient_id,

      v_appointment.doctor_id,

      p_fee,

      p_payment_method,

      coalesce(
        nullif(trim(p_note),''),
        'Consultation fee at patient arrival'
      ),

      auth.uid()

    );

  end if;


  return jsonb_build_object(

    'appointment',
    to_jsonb(v_appointment),

    'fee',
    coalesce(p_fee,0),

    'income_recorded',
    (p_fee > 0)

  );

end;

$$;


revoke all
on function public.frontend_check_in_with_fee(
  uuid,
  numeric,
  text,
  text
)
from public, anon;


grant execute
on function public.frontend_check_in_with_fee(
  uuid,
  numeric,
  text,
  text
)
to authenticated;

-- =========================================================
-- 7. FINANCE SUMMARY
-- =========================================================

create or replace function public.frontend_booking_income_summary(

  p_from date,

  p_to date

)

returns jsonb

language plpgsql
stable
security definer
set search_path = ''

as $$

declare

  v_result jsonb;

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


  select jsonb_build_object(

    'total_income',
      coalesce(
        sum(amount)
          filter (
            where is_voided = false
          ),
        0
      ),

    'cash_income',
      coalesce(
        sum(amount)
          filter (
            where is_voided = false
              and payment_method = 'cash'
          ),
        0
      ),

    'card_income',
      coalesce(
        sum(amount)
          filter (
            where is_voided = false
              and payment_method = 'card'
          ),
        0
      ),

    'instapay_income',
      coalesce(
        sum(amount)
          filter (
            where is_voided = false
              and payment_method = 'instapay'
          ),
        0
      ),

    'bank_income',
      coalesce(
        sum(amount)
          filter (
            where is_voided = false
              and payment_method = 'bank_transfer'
          ),
        0
      ),

    'income_count',
      count(*)
        filter (
          where is_voided = false
        )

  )

  into v_result

  from public.booking_income bi

  where
    (
      bi.received_at
      at time zone 'Africa/Cairo'
    )::date
    between p_from and p_to;


  return coalesce(
    v_result,
    '{}'::jsonb
  );

end;

$$;


revoke all
on function public.frontend_booking_income_summary(date,date)
from public, anon;


grant execute
on function public.frontend_booking_income_summary(date,date)
to authenticated;


-- =========================================================
-- 8. VOID BOOKING INCOME
-- =========================================================

create or replace function public.void_booking_income(

  p_income_id uuid,

  p_reason text

)

returns public.booking_income

language plpgsql
security definer
set search_path = ''

as $$

declare

  v public.booking_income%rowtype;

begin

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then

    raise exception
      'Management access required';

  end if;


  if nullif(trim(p_reason),'') is null then

    raise exception
      'Void reason is required';

  end if;


  update public.booking_income

  set
    is_voided = true,

    void_reason =
      trim(p_reason),

    voided_at =
      now(),

    voided_by =
      auth.uid(),

    updated_at =
      now()

  where id =
    p_income_id

    and is_voided = false

  returning *
  into v;


  if not found then

    raise exception
      'Active income entry not found';

  end if;


  return v;

end;

$$;


revoke all
on function public.void_booking_income(uuid,text)
from public, anon;


grant execute
on function public.void_booking_income(uuid,text)
to authenticated;



-- =========================================================
-- POSTGREST REFRESH + VERIFY
-- =========================================================

notify pgrst, 'reload schema';


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_check_in_with_fee',
    'frontend_booking_income_summary',
    'void_booking_income'
  )
order by routine_name;


select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'booking_income';
