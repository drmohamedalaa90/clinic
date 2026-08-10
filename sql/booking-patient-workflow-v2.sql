-- =========================================================
-- ALAA CLINIC
-- BOOKING / PATIENT WORKFLOW V2
--
-- Adds:
-- 1) Privacy-aware public returning-patient lookup by registered phone.
-- 2) Returning patient self-booking WITHOUT creating a duplicate patient.
-- 3) New-public-booking guard: registered phone must use returning flow.
-- 4) Internal phone-first patient lookup.
-- 5) Edit patient/booking data before check-in.
-- 6) Check-in automatically moves the appointment to WAITING,
--    so the patient's file is immediately in the assigned doctor's queue.
-- =========================================================


-- =========================================================
-- PHONE NORMALIZATION
-- =========================================================

create or replace function private.normalize_clinic_phone(
  p_phone text
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v text;
begin

  v :=
    regexp_replace(
      coalesce(
        p_phone,
        ''
      ),
      '[^0-9]',
      '',
      'g'
    );


  if left(v,4)='0020' then
    v :=
      substring(
        v
        from 3
      );
  end if;


  if left(v,2)='20'
     and length(v)>=11
  then
    v :=
      '0'
      ||
      substring(
        v
        from 3
      );
  end if;


  if left(v,1)='1'
     and length(v)=10
  then
    v :=
      '0'
      ||
      v;
  end if;


  return v;

end;
$$;


revoke all
on function private.normalize_clinic_phone(text)
from public, anon, authenticated;



-- =========================================================
-- PUBLIC RETURNING-PATIENT TOKENS
--
-- We intentionally DO NOT expose a patient's full record publicly.
-- The page receives only a short-lived opaque token and a masked name.
-- =========================================================

create table if not exists public.public_booking_patient_tokens (

  token uuid primary key
    default gen_random_uuid(),

  patient_id uuid not null
    references public.patients(id)
    on delete cascade,

  expires_at timestamptz not null,

  used_at timestamptz,

  created_at timestamptz not null
    default now()
);


create index if not exists
  public_booking_patient_tokens_patient_idx
on public.public_booking_patient_tokens(
  patient_id,
  expires_at
);


alter table public.public_booking_patient_tokens
enable row level security;


revoke all
on public.public_booking_patient_tokens
from public, anon, authenticated;



-- =========================================================
-- PUBLIC: FIND RETURNING PATIENT BY PHONE
--
-- If more than one patient uses the same phone:
-- ask for year of birth to disambiguate.
-- =========================================================

create or replace function public.public_find_returning_patient_by_phone(

  p_phone text,

  p_birth_year integer default null

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_phone text;

  v_count integer := 0;

  v_patient public.patients%rowtype;

  v_token uuid;

  v_masked_name text;

begin

  v_phone :=
    private.normalize_clinic_phone(
      p_phone
    );


  if length(v_phone)<8 then
    raise exception
      'Invalid phone number';
  end if;


  delete from public.public_booking_patient_tokens
  where expires_at <
    now() - interval '1 day';


  select count(*)::integer

  into v_count

  from public.patients p

  where p.is_active = true

    and private.normalize_clinic_phone(
      p.mobile
    ) = v_phone

    and (
      p_birth_year is null
      or p.birth_year =
         p_birth_year
    );


  if v_count=0 then

    return jsonb_build_object(
      'found',
        false,

      'needs_birth_year',
        false
    );

  end if;


  if v_count>1
     and p_birth_year is null
  then

    return jsonb_build_object(
      'found',
        false,

      'needs_birth_year',
        true
    );

  end if;


  select p.*

  into v_patient

  from public.patients p

  where p.is_active = true

    and private.normalize_clinic_phone(
      p.mobile
    ) = v_phone

    and (
      p_birth_year is null
      or p.birth_year =
         p_birth_year
    )

  order by
    p.updated_at desc nulls last,
    p.created_at desc

  limit 1;


  if v_patient.id is null then

    return jsonb_build_object(
      'found',
        false,

      'needs_birth_year',
        false
    );

  end if;


  insert into public.public_booking_patient_tokens (

    patient_id,

    expires_at

  )

  values (

    v_patient.id,

    now()
    +
    interval '15 minutes'

  )

  returning token
  into v_token;


  /*
   * Public page receives a MASKED display only.
   * Full patient demographics remain inside the secured clinic app.
   */
  v_masked_name :=
    case

      when nullif(
        trim(
          v_patient.arabic_name
        ),
        ''
      ) is not null
      then
        left(
          trim(
            v_patient.arabic_name
          ),
          1
        )
        ||
        '***'

      when nullif(
        trim(
          v_patient.english_name
        ),
        ''
      ) is not null
      then
        left(
          trim(
            v_patient.english_name
          ),
          1
        )
        ||
        '***'

      else
        '***'

    end;


  return jsonb_build_object(

    'found',
      true,

    'needs_birth_year',
      false,

    'booking_token',
      v_token,

    'masked_name',
      v_masked_name

  );

end;
$$;


revoke all
on function public.public_find_returning_patient_by_phone(
  text,
  integer
)
from public;


grant execute
on function public.public_find_returning_patient_by_phone(
  text,
  integer
)
to anon, authenticated;



-- =========================================================
-- PUBLIC: NEW PATIENT WRAPPER
--
-- Prevents a registered phone from creating another duplicate record.
-- =========================================================

create or replace function public.submit_public_new_patient_booking(

  p_doctor uuid,

  p_start timestamptz,

  p_end timestamptz,

  p_arabic_name text,

  p_birth_year integer,

  p_gender text,

  p_residency_area text,

  p_whatsapp text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_phone text;

begin

  v_phone :=
    private.normalize_clinic_phone(
      p_whatsapp
    );


  if exists (

    select 1

    from public.patients p

    where p.is_active = true

      and private.normalize_clinic_phone(
        p.mobile
      ) = v_phone

  ) then

    raise exception
      'PHONE_ALREADY_REGISTERED';

  end if;


  return public.submit_public_booking(

    p_doctor,

    p_start,

    p_end,

    p_arabic_name,

    p_birth_year,

    p_gender,

    p_residency_area,

    p_whatsapp

  );

end;
$$;


revoke all
on function public.submit_public_new_patient_booking(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text
)
from public;


grant execute
on function public.submit_public_new_patient_booking(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text
)
to anon, authenticated;



-- =========================================================
-- PUBLIC: EXISTING PATIENT BOOKING
-- =========================================================

create or replace function public.submit_public_returning_booking(

  p_booking_token uuid,

  p_doctor uuid,

  p_start timestamptz,

  p_end timestamptz

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_token public.public_booking_patient_tokens%rowtype;

  v_patient public.patients%rowtype;

  v_appointment public.appointments%rowtype;

  v_today date :=
    (
      now()
      at time zone 'Africa/Cairo'
    )::date;

  v_day date;

  v_slot_exists boolean := false;

  v_used integer := 0;

  v_lock_key bigint;

  v_doctor_name text;

  v_has_type boolean := false;

  v_has_appointment_type boolean := false;

begin

  if p_booking_token is null then
    raise exception
      'Patient verification is required';
  end if;


  select *

  into v_token

  from public.public_booking_patient_tokens

  where token =
    p_booking_token

  for update;


  if not found
     or v_token.used_at is not null
     or v_token.expires_at < now()
  then

    raise exception
      'Patient verification expired';

  end if;


  select *

  into v_patient

  from public.patients

  where id =
    v_token.patient_id

    and is_active = true;


  if not found then
    raise exception
      'Patient record is unavailable';
  end if;


  select
    coalesce(
      nullif(
        trim(
          p.display_name
        ),
        ''
      ),
      nullif(
        trim(
          p.username
        ),
        ''
      ),
      'Doctor'
    )

  into v_doctor_name

  from public.profiles p

  where p.id =
    p_doctor

    and p.is_active = true

    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id =
        p.id
        and ur.role =
          'doctor'
    );


  if v_doctor_name is null then
    raise exception
      'Doctor is unavailable';
  end if;


  if p_start is null
     or p_end is null
     or p_end<=p_start
  then
    raise exception
      'Invalid appointment time';
  end if;


  v_day :=
    (
      p_start
      at time zone 'Africa/Cairo'
    )::date;


  if v_day < v_today
     or v_day > v_today+13
  then
    raise exception
      'Appointment date is outside the booking window';
  end if;


  if p_start<=now() then
    raise exception
      'This appointment time has already started';
  end if;


  select exists (

    select 1

    from private.hourly_slots_for_date(
      p_doctor,
      v_day
    ) hs

    where hs.slot_start =
      p_start

      and hs.slot_end =
        p_end

  )

  into v_slot_exists;


  if not v_slot_exists then
    raise exception
      'This clinic slot is no longer available';
  end if;


  v_lock_key :=
    hashtextextended(
      p_doctor::text
      ||
      '|'
      ||
      p_start::text,
      0
    );


  perform pg_advisory_xact_lock(
    v_lock_key
  );


  select count(*)::integer

  into v_used

  from public.appointments a

  where a.doctor_id =
    p_doctor

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
      p_start,
      p_end,
      '[)'
    );


  if v_used>=4 then
    raise exception
      'This clinic slot is full';
  end if;


  if exists (

    select 1

    from public.appointments a

    where a.patient_id =
      v_patient.id

      and a.doctor_id =
        p_doctor

      and a.scheduled_start =
        p_start

      and a.scheduled_end =
        p_end

      and a.status not in (
        'cancelled',
        'rescheduled'
      )

  ) then

    raise exception
      'This booking was already submitted';

  end if;


  select exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='type'
  )
  into v_has_type;


  select exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='appointment_type'
  )
  into v_has_appointment_type;


  if v_has_type then

    execute $insert$
      insert into public.appointments (

        patient_id,

        doctor_id,

        type,

        scheduled_start,

        scheduled_end,

        status,

        notes,

        booking_source,

        created_by,

        updated_by

      )

      values (

        $1,

        $2,

        'follow_up',

        $3,

        $4,

        'booked',

        'Public returning patient self-booking',

        'public_returning',

        $2,

        $2

      )

      returning *
    $insert$

    into v_appointment

    using
      v_patient.id,
      p_doctor,
      p_start,
      p_end;


  elsif v_has_appointment_type then

    execute $insert$
      insert into public.appointments (

        patient_id,

        doctor_id,

        appointment_type,

        scheduled_start,

        scheduled_end,

        status,

        notes,

        booking_source,

        created_by,

        updated_by

      )

      values (

        $1,

        $2,

        'follow_up',

        $3,

        $4,

        'booked',

        'Public returning patient self-booking',

        'public_returning',

        $2,

        $2

      )

      returning *
    $insert$

    into v_appointment

    using
      v_patient.id,
      p_doctor,
      p_start,
      p_end;


  else

    raise exception
      'Appointment type column was not found';

  end if;


  update public.public_booking_patient_tokens

  set used_at=
    now()

  where token=
    p_booking_token;


  return jsonb_build_object(

    'success',
      true,

    'appointment_id',
      v_appointment.id,

    'appointment_number',
      v_appointment.appointment_number,

    'patient_id',
      v_patient.id,

    'patient_mrn',
      v_patient.medical_record_number,

    'doctor_name',
      v_doctor_name,

    'patient_name',
      v_patient.arabic_name,

    'whatsapp',
      v_patient.mobile,

    'slot_start',
      v_appointment.scheduled_start,

    'slot_end',
      v_appointment.scheduled_end,

    'status',
      v_appointment.status,

    'booking_source',
      v_appointment.booking_source

  );

end;
$$;


revoke all
on function public.submit_public_returning_booking(
  uuid,
  uuid,
  timestamptz,
  timestamptz
)
from public;


grant execute
on function public.submit_public_returning_booking(
  uuid,
  uuid,
  timestamptz,
  timestamptz
)
to anon, authenticated;



-- =========================================================
-- INTERNAL: PHONE-FIRST PATIENT SEARCH
-- =========================================================

create or replace function public.frontend_find_patient_by_phone(
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare

  v_phone text;

  v_matches jsonb;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
    or private.has_role('doctor')
  ) then

    raise exception
      'Clinic staff access required';

  end if;


  v_phone :=
    private.normalize_clinic_phone(
      p_phone
    );


  if length(v_phone)<8 then

    return jsonb_build_object(
      'count',
        0,

      'matches',
        '[]'::jsonb
    );

  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(

          'id',
            p.id,

          'medical_record_number',
            p.medical_record_number,

          'arabic_name',
            p.arabic_name,

          'english_name',
            p.english_name,

          'birth_year',
            p.birth_year,

          'gender',
            p.gender,

          'mobile',
            p.mobile,

          'residency_area',
            p.residency_area,

          'address',
            p.address
        )
        order by
          p.updated_at desc nulls last,
          p.created_at desc
      ),
      '[]'::jsonb
    )

  into v_matches

  from public.patients p

  where p.is_active = true

    and private.normalize_clinic_phone(
      p.mobile
    ) = v_phone;


  return jsonb_build_object(

    'count',
      jsonb_array_length(
        v_matches
      ),

    'matches',
      v_matches

  );

end;
$$;


revoke all
on function public.frontend_find_patient_by_phone(text)
from public, anon;


grant execute
on function public.frontend_find_patient_by_phone(text)
to authenticated;



-- =========================================================
-- INTERNAL: PRE-CHECK-IN EDIT AUDIT
-- =========================================================

create table if not exists public.booking_precheckin_edits (

  id uuid primary key
    default gen_random_uuid(),

  appointment_id uuid not null,

  patient_id uuid not null,

  before_patient jsonb not null,

  after_patient jsonb not null,

  before_appointment jsonb not null,

  after_appointment jsonb not null,

  changed_by uuid not null
    references public.profiles(id)
    on delete restrict,

  changed_at timestamptz not null
    default now()
);


alter table public.booking_precheckin_edits
enable row level security;


revoke all
on public.booking_precheckin_edits
from public, anon, authenticated;


grant select
on public.booking_precheckin_edits
to authenticated;


drop policy if exists
  "Management view precheckin booking edits"
on public.booking_precheckin_edits;


create policy
  "Management view precheckin booking edits"

on public.booking_precheckin_edits

for select
to authenticated

using (
     private.has_role('owner')
  or private.has_role('manager')
  or private.has_role('deputy_manager')
);



-- =========================================================
-- INTERNAL: EDIT BOOKING BEFORE CHECK-IN
-- =========================================================

create or replace function public.frontend_edit_booking_before_checkin(

  p_appointment_id uuid,

  p_arabic_name text,

  p_english_name text,

  p_birth_year integer,

  p_gender text,

  p_mobile text,

  p_residency_area text,

  p_address text,

  p_type text,

  p_notes text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_appointment_before public.appointments%rowtype;

  v_appointment_after public.appointments%rowtype;

  v_patient_before public.patients%rowtype;

  v_patient_after public.patients%rowtype;

  v_current_year integer :=
    extract(
      year
      from (
        now()
        at time zone 'Africa/Cairo'
      )
    )::integer;

  v_has_type boolean := false;

  v_has_appointment_type boolean := false;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
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


  select *

  into v_appointment_before

  from public.appointments

  where id =
    p_appointment_id

  for update;


  if not found then
    raise exception
      'Appointment not found';
  end if;


  if v_appointment_before.status not in (
    'booked',
    'confirmed'
  ) then
    raise exception
      'Booking can only be edited before check-in';
  end if;


  select *

  into v_patient_before

  from public.patients

  where id =
    v_appointment_before.patient_id

  for update;


  if not found then
    raise exception
      'Patient not found';
  end if;


  if nullif(
       trim(
         p_arabic_name
       ),
       ''
     ) is null

     and

     nullif(
       trim(
         p_english_name
       ),
       ''
     ) is null
  then
    raise exception
      'Patient name is required';
  end if;


  if p_birth_year is not null
     and (
       p_birth_year<1900
       or p_birth_year>v_current_year
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


  if p_type not in (
    'new',
    'follow_up'
  ) then
    raise exception
      'Invalid appointment type';
  end if;


  update public.patients

  set
    arabic_name=
      nullif(
        trim(
          p_arabic_name
        ),
        ''
      ),

    english_name=
      nullif(
        trim(
          p_english_name
        ),
        ''
      ),

    birth_year=
      p_birth_year,

    gender=
      p_gender,

    mobile=
      nullif(
        trim(
          p_mobile
        ),
        ''
      ),

    residency_area=
      nullif(
        trim(
          p_residency_area
        ),
        ''
      ),

    address=
      nullif(
        trim(
          p_address
        ),
        ''
      ),

    updated_by=
      auth.uid(),

    updated_at=
      now()

  where id=
    v_patient_before.id

  returning *

  into v_patient_after;


  select exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='type'
  )
  into v_has_type;


  select exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='appointments'
      and column_name='appointment_type'
  )
  into v_has_appointment_type;


  if v_has_type then

    execute $update$
      update public.appointments
      set
        type=$1,
        notes=$2,
        updated_by=$3,
        updated_at=now()
      where id=$4
      returning *
    $update$

    into v_appointment_after

    using
      p_type,
      nullif(
        trim(
          p_notes
        ),
        ''
      ),
      auth.uid(),
      p_appointment_id;


  elsif v_has_appointment_type then

    execute $update$
      update public.appointments
      set
        appointment_type=$1,
        notes=$2,
        updated_by=$3,
        updated_at=now()
      where id=$4
      returning *
    $update$

    into v_appointment_after

    using
      p_type,
      nullif(
        trim(
          p_notes
        ),
        ''
      ),
      auth.uid(),
      p_appointment_id;


  else

    raise exception
      'Appointment type column was not found';

  end if;


  insert into public.booking_precheckin_edits (

    appointment_id,

    patient_id,

    before_patient,

    after_patient,

    before_appointment,

    after_appointment,

    changed_by

  )

  values (

    p_appointment_id,

    v_patient_before.id,

    to_jsonb(
      v_patient_before
    ),

    to_jsonb(
      v_patient_after
    ),

    to_jsonb(
      v_appointment_before
    ),

    to_jsonb(
      v_appointment_after
    ),

    auth.uid()

  );


  return jsonb_build_object(

    'success',
      true,

    'patient',
      to_jsonb(
        v_patient_after
      ),

    'appointment',
      to_jsonb(
        v_appointment_after
      )

  );

end;
$$;


revoke all
on function public.frontend_edit_booking_before_checkin(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon;


grant execute
on function public.frontend_edit_booking_before_checkin(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;



-- =========================================================
-- CHECK-IN:
-- ARRIVAL + FINANCE + AUTOMATIC SEND TO DOCTOR
-- =========================================================

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

  v_patient_mrn text;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
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


  if p_fee is null
     or p_fee<0
  then
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

  where id=
    p_id

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


  /*
   * 1) Physical arrival.
   * Existing trigger records checked_in_at.
   */
  select *

  into v_appointment

  from public.check_in_appointment(
    p_id
  );


  /*
   * 2) Finance entry.
   */
  if p_fee>0 then

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
        nullif(
          trim(
            p_note
          ),
          ''
        ),
        'Consultation fee at patient arrival'
      ),

      auth.uid()

    );

  end if;


  /*
   * 3) AUTOMATICALLY send patient to assigned doctor's queue.
   * No separate "Send to doctor" click is needed anymore.
   */
  perform public.frontend_send_to_doctor(
    p_id
  );


  select *

  into v_appointment

  from public.appointments

  where id=
    p_id;


  select
    p.medical_record_number

  into v_patient_mrn

  from public.patients p

  where p.id=
    v_appointment.patient_id;


  return jsonb_build_object(

    'appointment',
      to_jsonb(
        v_appointment
      ),

    'patient_id',
      v_appointment.patient_id,

    'patient_mrn',
      v_patient_mrn,

    'doctor_id',
      v_appointment.doctor_id,

    'sent_to_doctor',
      true,

    'fee',
      coalesce(
        p_fee,
        0
      ),

    'income_recorded',
      (
        p_fee>0
      )

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



notify pgrst, 'reload schema';



-- =========================================================
-- VERIFY
-- =========================================================

select
  routine_name

from information_schema.routines

where routine_schema='public'

  and routine_name in (
    'public_find_returning_patient_by_phone',
    'submit_public_new_patient_booking',
    'submit_public_returning_booking',
    'frontend_find_patient_by_phone',
    'frontend_edit_booking_before_checkin',
    'frontend_check_in_with_fee'
  )

order by routine_name;
