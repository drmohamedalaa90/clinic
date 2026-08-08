-- =========================================================
-- OPERATION CLINIC
-- BOOKING FEES -> FINANCE / INCOME
--
-- This patch:
-- 1) creates a dedicated booking-income ledger
-- 2) books a patient + appointment + fee atomically
-- 3) exports booking fees to Finance > Income
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
-- 3. INTERNAL HELPER: CAN BOOK
-- =========================================================

create or replace function private.can_create_booking_for_doctor(
  p_doctor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$

  select
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
    or (
      private.has_role('doctor')
      and p_doctor = auth.uid()
    );

$$;


revoke all
on function private.can_create_booking_for_doctor(uuid)
from public, anon, authenticated;


-- =========================================================
-- 4. INTERNAL HELPER: WRITE FEE
-- =========================================================

create or replace function private.insert_booking_fee(
  p_appointment uuid,
  p_patient uuid,
  p_doctor uuid,
  p_fee numeric,
  p_payment_method text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin

  if p_fee is null or p_fee <= 0 then
    return;
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
    p_appointment,
    p_patient,
    p_doctor,
    p_fee,
    p_payment_method,
    nullif(trim(p_note),''),
    auth.uid()
  );

end;
$$;


revoke all
on function private.insert_booking_fee(
  uuid,uuid,uuid,numeric,text,text
)
from public, anon, authenticated;


-- =========================================================
-- 5. EXISTING PATIENT:
--    BOOK APPOINTMENT + FEE IN ONE TRANSACTION
-- =========================================================

create or replace function public.frontend_book_existing_patient_with_fee(

  p_patient uuid,

  p_doctor uuid,

  p_start timestamptz,

  p_end timestamptz,

  p_type text,

  p_note text default null,

  p_fee numeric default 0,

  p_payment_method text default 'cash'

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


  if not private.can_create_booking_for_doctor(
    p_doctor
  ) then

    raise exception
      'You are not allowed to create this booking';

  end if;


  if not exists (
    select 1
    from public.patients p
    where p.id = p_patient
      and p.is_active = true
  ) then

    raise exception
      'Active patient not found';

  end if;


  select *
  into v_appointment

  from public.book_appointment(
    p_patient,
    p_doctor,
    p_start,
    p_end,
    p_type,
    p_note
  );


  perform private.insert_booking_fee(
    v_appointment.id,
    p_patient,
    p_doctor,
    p_fee,
    p_payment_method,
    'Booking fee'
  );


  return jsonb_build_object(
    'patient_id',
    p_patient,
    'appointment',
    to_jsonb(v_appointment),
    'fee',
    coalesce(p_fee,0)
  );

end;

$$;


revoke all
on function public.frontend_book_existing_patient_with_fee(
  uuid,uuid,timestamptz,timestamptz,text,text,numeric,text
)
from public, anon;


grant execute
on function public.frontend_book_existing_patient_with_fee(
  uuid,uuid,timestamptz,timestamptz,text,text,numeric,text
)
to authenticated;


-- =========================================================
-- 6. NEW PATIENT:
--    CREATE PATIENT + APPOINTMENT + FEE IN ONE TRANSACTION
-- =========================================================

create or replace function public.frontend_create_patient_and_book_with_fee(

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

  p_address text default null,

  p_fee numeric default 0,

  p_payment_method text default 'cash'

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
    extract(
      year from
      (
        now()
        at time zone 'Africa/Cairo'
      )
    )::integer;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not private.can_create_booking_for_doctor(
    p_doctor
  ) then

    raise exception
      'You are not allowed to create this booking';

  end if;


  if nullif(trim(p_arabic_name),'') is null
     and nullif(trim(p_english_name),'') is null
  then

    raise exception
      'Patient name is required';

  end if;


  if p_birth_year is not null
     and (
       p_birth_year < 1900
       or p_birth_year > v_current_year
     )
  then

    raise exception
      'Invalid year of birth';

  end if;


  if p_gender is not null
     and p_gender not in (
       'male',
       'female'
     )
  then

    raise exception
      'Invalid gender';

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

    nullif(trim(p_arabic_name),''),

    nullif(trim(p_english_name),''),

    p_birth_year,

    p_gender,

    nullif(trim(p_mobile),''),

    nullif(trim(p_address),''),

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


  perform private.insert_booking_fee(

    v_appointment.id,

    v_patient.id,

    p_doctor,

    p_fee,

    p_payment_method,

    'Booking fee'

  );


  return jsonb_build_object(

    'patient',
    to_jsonb(v_patient),

    'appointment',
    to_jsonb(v_appointment),

    'fee',
    coalesce(p_fee,0)

  );

end;

$$;


revoke all
on function public.frontend_create_patient_and_book_with_fee(
  uuid,timestamptz,timestamptz,text,text,text,text,integer,text,text,text,numeric,text
)
from public, anon;


grant execute
on function public.frontend_create_patient_and_book_with_fee(
  uuid,timestamptz,timestamptz,text,text,text,text,integer,text,text,text,numeric,text
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
-- 9. POSTGREST REFRESH + VERIFY
-- =========================================================

notify pgrst, 'reload schema';


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_book_existing_patient_with_fee',
    'frontend_create_patient_and_book_with_fee',
    'frontend_booking_income_summary',
    'void_booking_income'
  )
order by routine_name;


select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'booking_income';

