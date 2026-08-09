-- =========================================================
-- OPERATION CLINIC
-- OWNER PATIENT CONTROL
--
-- Adds:
--   owner_update_patient_record(...)
--   owner_delete_patient_record(...)
--
-- Both are OWNER ONLY.
--
-- Edit/delete reasons are preserved in a dedicated owner log.
-- =========================================================


create table if not exists public.owner_patient_change_log (

  id uuid primary key
    default gen_random_uuid(),

  patient_id uuid,

  action text not null,

  reason text not null,

  before_data jsonb,

  after_data jsonb,

  changed_by uuid not null
    references public.profiles(id)
    on delete restrict,

  changed_at timestamptz not null
    default now(),

  constraint owner_patient_change_log_action_check
    check (
      action in (
        'edit',
        'delete'
      )
    ),

  constraint owner_patient_change_log_reason_check
    check (
      nullif(
        trim(reason),
        ''
      ) is not null
    )
);


alter table public.owner_patient_change_log
enable row level security;


revoke all
on public.owner_patient_change_log
from public, anon, authenticated;


grant select
on public.owner_patient_change_log
to authenticated;


drop policy if exists
  "Owner view patient change log"
on public.owner_patient_change_log;


create policy
  "Owner view patient change log"

on public.owner_patient_change_log

for select
to authenticated

using (
  private.has_role('owner')
);



-- =========================================================
-- OWNER EDIT PATIENT
-- =========================================================

create or replace function public.owner_update_patient_record(

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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_before public.patients%rowtype;

  v_after public.patients%rowtype;

  v_current_year integer :=
    extract(
      year
      from (
        now()
        at time zone 'Africa/Cairo'
      )
    )::integer;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Edit reason is required';
  end if;


  if
    nullif(
      trim(p_arabic_name),
      ''
    ) is null

    and

    nullif(
      trim(p_english_name),
      ''
    ) is null

  then
    raise exception 'Patient name is required';
  end if;


  if p_birth_year is not null
     and (
       p_birth_year < 1900
       or p_birth_year > v_current_year
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
  into v_before

  from public.patients

  where id =
    p_patient_id

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
  into v_after;


  insert into public.owner_patient_change_log (

    patient_id,

    action,

    reason,

    before_data,

    after_data,

    changed_by

  )

  values (

    p_patient_id,

    'edit',

    trim(p_reason),

    to_jsonb(v_before),

    to_jsonb(v_after),

    auth.uid()

  );


  return to_jsonb(
    v_after
  );

end;
$$;


revoke all
on function public.owner_update_patient_record(
  uuid,text,text,integer,text,text,text,text,text
)
from public, anon;


grant execute
on function public.owner_update_patient_record(
  uuid,text,text,integer,text,text,text,text,text
)
to authenticated;



-- =========================================================
-- OWNER DELETE PATIENT
--
-- Intended for the clinic TEST PERIOD.
-- The patient snapshot is preserved in owner_patient_change_log.
-- Known patient-linked test data is removed before the patient row.
-- =========================================================

create or replace function public.owner_delete_patient_record(

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

  v_visit_id uuid;

  v_invoice_id uuid;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


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


  -- Keep a permanent snapshot BEFORE deletion.
  insert into public.owner_patient_change_log (

    patient_id,

    action,

    reason,

    before_data,

    after_data,

    changed_by

  )

  values (

    p_patient_id,

    'delete',

    trim(p_reason),

    to_jsonb(v_patient),

    null,

    auth.uid()

  );


  -- -------------------------------------------------------
  -- Appointment-linked records.
  -- -------------------------------------------------------

  for v_appointment_id in

    select a.id

    from public.appointments a

    where a.patient_id =
      p_patient_id

  loop

    if to_regclass(
      'public.booking_income_edits'
    ) is not null then

      execute '
        delete from public.booking_income_edits
        where appointment_id = $1
      '
      using v_appointment_id;

    end if;


    if to_regclass(
      'public.booking_income'
    ) is not null then

      execute '
        delete from public.booking_income
        where appointment_id = $1
      '
      using v_appointment_id;

    end if;


    if to_regclass(
      'public.appointment_status_history'
    ) is not null then

      execute '
        delete from public.appointment_status_history
        where appointment_id = $1
      '
      using v_appointment_id;

    end if;


    -- Clinical visit + children.
    if to_regclass(
      'public.clinical_visits'
    ) is not null then

      for v_visit_id in

        execute
          'select id
           from public.clinical_visits
           where appointment_id = $1'

        using v_appointment_id

      loop

        if to_regclass(
          'public.clinical_visit_amendments'
        ) is not null then

          execute '
            delete from public.clinical_visit_amendments
            where visit_id = $1
          '
          using v_visit_id;

        end if;


        if to_regclass(
          'public.visit_vitals'
        ) is not null then

          execute '
            delete from public.visit_vitals
            where visit_id = $1
          '
          using v_visit_id;

        end if;


        if to_regclass(
          'public.visit_diagnoses'
        ) is not null then

          execute '
            delete from public.visit_diagnoses
            where visit_id = $1
          '
          using v_visit_id;

        end if;


        if to_regclass(
          'public.visit_investigations'
        ) is not null then

          execute '
            delete from public.visit_investigations
            where visit_id = $1
          '
          using v_visit_id;

        end if;


        if to_regclass(
          'public.visit_medications'
        ) is not null then

          execute '
            delete from public.visit_medications
            where visit_id = $1
          '
          using v_visit_id;

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

      end loop;


      execute '
        delete from public.clinical_visits
        where appointment_id = $1
      '
      using v_appointment_id;

    end if;


    -- Invoice linked to appointment.
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

      for v_invoice_id in

        execute
          'select id
           from public.invoices
           where appointment_id = $1'

        using v_appointment_id

      loop

        if to_regclass(
          'public.invoice_payments'
        ) is not null then

          execute '
            delete from public.invoice_payments
            where invoice_id = $1
          '
          using v_invoice_id;

        end if;


        if to_regclass(
          'public.invoice_items'
        ) is not null then

          execute '
            delete from public.invoice_items
            where invoice_id = $1
          '
          using v_invoice_id;

        end if;

      end loop;


      execute '
        delete from public.invoices
        where appointment_id = $1
      '
      using v_appointment_id;

    end if;

  end loop;


  -- -------------------------------------------------------
  -- Patient-level records.
  -- -------------------------------------------------------

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


  -- Remaining invoices linked directly to patient.
  if to_regclass(
    'public.invoices'
  ) is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'patient_id'
  )
  then

    for v_invoice_id in

      execute
        'select id
         from public.invoices
         where patient_id = $1'

      using p_patient_id

    loop

      if to_regclass(
        'public.invoice_payments'
      ) is not null then

        execute '
          delete from public.invoice_payments
          where invoice_id = $1
        '
        using v_invoice_id;

      end if;


      if to_regclass(
        'public.invoice_items'
      ) is not null then

        execute '
          delete from public.invoice_items
          where invoice_id = $1
        '
        using v_invoice_id;

      end if;

    end loop;


    execute '
      delete from public.invoices
      where patient_id = $1
    '
    using p_patient_id;

  end if;


  delete from public.appointments

  where patient_id =
    p_patient_id;


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
on function public.owner_delete_patient_record(uuid,text)
from public, anon;


grant execute
on function public.owner_delete_patient_record(uuid,text)
to authenticated;


notify pgrst, 'reload schema';


-- =========================================================
-- VERIFY
-- =========================================================

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'owner_update_patient_record',
    'owner_delete_patient_record'
  )
order by routine_name;
