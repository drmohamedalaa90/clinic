-- =============================================================
-- ALAA CLINIC V31
-- WORKFLOW + CHAT + FEES + DOCTOR FINANCE + CLINICAL SEARCH
-- =============================================================

begin;


-- =============================================================
-- A) APPOINTMENT WORKFLOW
-- =============================================================

alter table public.appointments
  add column if not exists information_confirmed_at timestamptz,
  add column if not exists information_confirmed_by uuid
    references public.profiles(id);


-- -------------------------------------------------------------
-- A1) Never allow a NEW booking/reschedule into a slot whose
--     start time has already passed.
-- -------------------------------------------------------------

create or replace function public.clinic_block_past_appointment_slots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if
    new.status in (
      'booked',
      'confirmed'
    )
    and
    new.scheduled_start <= now()
  then

    raise exception
      'This appointment slot has already closed. Please choose another time.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_clinic_block_past_appointment_slots
on public.appointments;


create trigger
  trg_clinic_block_past_appointment_slots
before insert
or update of scheduled_start
on public.appointments
for each row
execute function
  public.clinic_block_past_appointment_slots();


-- -------------------------------------------------------------
-- A2) Information confirmation is REQUIRED before check-in.
-- -------------------------------------------------------------

create or replace function public.clinic_require_information_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if
    old.checked_in_at is null
    and
    new.checked_in_at is not null
    and
    new.information_confirmed_at is null
  then

    raise exception
      'Confirm patient information before check-in.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_clinic_require_information_confirmation
on public.appointments;


create trigger
  trg_clinic_require_information_confirmation
before update of checked_in_at
on public.appointments
for each row
execute function
  public.clinic_require_information_confirmation();


-- -------------------------------------------------------------
-- A3) Check-in automatically places the patient in doctor's queue.
--     No separate "Send to doctor" step.
-- -------------------------------------------------------------

create or replace function public.clinic_auto_queue_after_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if
    old.checked_in_at is null
    and
    new.checked_in_at is not null
  then

    update public.appointments

    set
      status =
        case
          when status in (
            'booked',
            'confirmed',
            'arrived'
          )
            then 'waiting'
          else status
        end,

      sent_to_doctor_at =
        coalesce(
          sent_to_doctor_at,
          now()
        ),

      updated_at =
        now()

    where id =
      new.id;

  end if;


  return null;

end;
$$;


drop trigger if exists
  trg_clinic_auto_queue_after_checkin
on public.appointments;


create trigger
  trg_clinic_auto_queue_after_checkin
after update of checked_in_at
on public.appointments
for each row
execute function
  public.clinic_auto_queue_after_checkin();


-- =============================================================
-- B) STANDARD FEES
--    كشف / examination = 350 EGP
--    استشارة / follow-up = 150 EGP
-- =============================================================

create or replace function public.clinic_require_reason_for_nonstandard_checkin_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_type text;

  v_standard numeric;

begin

  select
    a.appointment_type::text

  into
    v_type

  from public.appointments a

  where a.id =
    new.appointment_id;


  v_standard :=
    case
      when v_type =
        'follow_up'
        then 150
      else 350
    end;


  if
    coalesce(
      new.amount,
      0
    )
    <>
    v_standard
    and
    nullif(
      trim(
        coalesce(
          new.note,
          ''
        )
      ),
      ''
    )
    is null
  then

    raise exception
      'A reason is required when the check-in fee differs from the standard fee of % EGP.',
      v_standard;

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_clinic_require_reason_for_nonstandard_checkin_fee
on public.booking_income;


create trigger
  trg_clinic_require_reason_for_nonstandard_checkin_fee
before insert
on public.booking_income
for each row
execute function
  public.clinic_require_reason_for_nonstandard_checkin_fee();


-- Existing Finance edit flow already requires a reason.
-- This keeps the initial check-in consistent with that audit rule.


-- =============================================================
-- C) DOCTOR CLINICAL SEARCH
--    Search diagnosis + notes later from Patients
-- =============================================================

create or replace function public.doctor_search_patients_clinically(
  p_term text
)
returns table (

  patient_id uuid,

  medical_record_number text,

  patient_name text,

  visit_id uuid,

  visit_date timestamptz,

  match_source text,

  matched_text text

)
language sql
stable
security definer
set search_path = ''
as $$

  with input as (

    select
      nullif(
        trim(
          p_term
        ),
        ''
      ) as term

  ),


  text_matches as (

    select

      v.patient_id,

      v.id as visit_id,

      v.created_at as visit_date,

      case

        when coalesce(
               v.diagnosis_summary,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'Diagnosis'

        when coalesce(
               v.clinical_notes,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'Clinical notes'

        when coalesce(
               v.chief_complaint,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'Chief complaint'

        when coalesce(
               v.history_present_illness,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'History'

        when coalesce(
               v.examination,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'Examination'

        when coalesce(
               v.treatment_plan,
               ''
             )
             ilike
             '%' || i.term || '%'
          then 'Treatment'

        else
          'Follow-up'

      end
        as match_source,


      case

        when coalesce(
               v.diagnosis_summary,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.diagnosis_summary

        when coalesce(
               v.clinical_notes,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.clinical_notes

        when coalesce(
               v.chief_complaint,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.chief_complaint

        when coalesce(
               v.history_present_illness,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.history_present_illness

        when coalesce(
               v.examination,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.examination

        when coalesce(
               v.treatment_plan,
               ''
             )
             ilike
             '%' || i.term || '%'
          then v.treatment_plan

        else
          v.follow_up_plan

      end
        as matched_text


    from public.clinical_visits v

    cross join input i

    where
      auth.uid() is not null

      and
      exists (
        select 1
        from public.user_roles ur
        where
          ur.user_id =
            auth.uid()
          and
          ur.role::text =
            'doctor'
      )

      and
      v.doctor_id =
        auth.uid()

      and
      i.term is not null

      and
      length(
        i.term
      )
      >= 2

      and
      concat_ws(
        ' ',
        v.diagnosis_summary,
        v.clinical_notes,
        v.chief_complaint,
        v.history_present_illness,
        v.examination,
        v.treatment_plan,
        v.follow_up_plan
      )
      ilike
      '%' || i.term || '%'

  ),


  diagnosis_matches as (

    select

      v.patient_id,

      v.id as visit_id,

      v.created_at as visit_date,

      'Structured diagnosis'::text
        as match_source,

      d.diagnosis_text
        as matched_text


    from public.visit_diagnoses d

    join public.clinical_visits v
      on v.id =
         d.visit_id

    cross join input i

    where
      auth.uid() is not null

      and
      exists (
        select 1
        from public.user_roles ur
        where
          ur.user_id =
            auth.uid()
          and
          ur.role::text =
            'doctor'
      )

      and
      v.doctor_id =
        auth.uid()

      and
      i.term is not null

      and
      length(
        i.term
      )
      >= 2

      and
      coalesce(
        d.diagnosis_text,
        ''
      )
      ilike
      '%' || i.term || '%'

  ),


  combined as (

    select *
    from text_matches

    union all

    select *
    from diagnosis_matches

  ),


  latest as (

    select distinct on (
      c.patient_id
    )

      c.*

    from combined c

    order by
      c.patient_id,
      c.visit_date desc

  )


  select

    p.id,

    p.medical_record_number,

    coalesce(
      nullif(
        trim(
          p.english_name
        ),
        ''
      ),
      nullif(
        trim(
          p.arabic_name
        ),
        ''
      ),
      p.medical_record_number
    )
      as patient_name,

    l.visit_id,

    l.visit_date,

    l.match_source,

    l.matched_text


  from latest l

  join public.patients p
    on p.id =
       l.patient_id

  where
    p.is_active =
      true

  order by
    l.visit_date desc

  limit 50;

$$;


revoke all
on function
  public.doctor_search_patients_clinically(text)
from public, anon;


grant execute
on function
  public.doctor_search_patients_clinically(text)
to authenticated;


-- =============================================================
-- D) DOCTOR FINANCE — OWN CASES, READ ONLY
-- =============================================================

create or replace function public.doctor_finance_snapshot(
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

  if not exists (
    select 1

    from public.user_roles ur

    where
      ur.user_id =
        auth.uid()

      and
      ur.role::text =
        'doctor'
  )
  then

    raise exception
      'Doctor role required';

  end if;


  if
    p_from is null
    or
    p_to is null
    or
    p_from >
    p_to
  then

    raise exception
      'Invalid finance date range';

  end if;


  select jsonb_build_object(

    'total_income',
      coalesce(
        sum(
          case
            when not bi.is_voided
              then bi.amount
            else 0
          end
        ),
        0
      ),

    'cash_income',
      coalesce(
        sum(
          case
            when
              not bi.is_voided
              and
              bi.payment_method =
                'cash'
              then bi.amount
            else 0
          end
        ),
        0
      ),

    'instapay_income',
      coalesce(
        sum(
          case
            when
              not bi.is_voided
              and
              bi.payment_method =
                'instapay'
              then bi.amount
            else 0
          end
        ),
        0
      ),

    'case_count',
      count(
        distinct
        case
          when not bi.is_voided
            then bi.appointment_id
        end
      ),

    'rows',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(

              'appointment_id',
                x.appointment_id,

              'appointment_number',
                x.appointment_number,

              'appointment_type',
                x.appointment_type,

              'patient_id',
                x.patient_id,

              'medical_record_number',
                x.medical_record_number,

              'patient_name',
                x.patient_name,

              'amount',
                x.amount,

              'payment_method',
                x.payment_method,

              'received_at',
                x.received_at

            )
            order by
              x.received_at desc
          )

          from (

            select

              bi.appointment_id,

              a.appointment_number,

              a.appointment_type::text
                as appointment_type,

              bi.patient_id,

              p.medical_record_number,

              coalesce(
                nullif(
                  trim(
                    p.english_name
                  ),
                  ''
                ),
                nullif(
                  trim(
                    p.arabic_name
                  ),
                  ''
                ),
                p.medical_record_number
              )
                as patient_name,

              bi.amount,

              bi.payment_method,

              bi.received_at


            from public.booking_income bi

            join public.appointments a
              on a.id =
                 bi.appointment_id

            join public.patients p
              on p.id =
                 bi.patient_id

            where
              bi.doctor_id =
                auth.uid()

              and
              not bi.is_voided

              and
              (
                bi.received_at
                at time zone
                'Africa/Cairo'
              )::date
              between
                p_from
                and
                p_to

            order by
              bi.received_at desc

            limit 500

          ) x
        ),
        '[]'::jsonb
      )

  )

  into v_result

  from public.booking_income bi

  where
    bi.doctor_id =
      auth.uid()

    and
    (
      bi.received_at
      at time zone
      'Africa/Cairo'
    )::date
    between
      p_from
      and
      p_to;


  return coalesce(
    v_result,
    jsonb_build_object(
      'total_income',
        0,

      'cash_income',
        0,

      'instapay_income',
        0,

      'case_count',
        0,

      'rows',
        '[]'::jsonb
    )
  );

end;
$$;


revoke all
on function
  public.doctor_finance_snapshot(date,date)
from public, anon;


grant execute
on function
  public.doctor_finance_snapshot(date,date)
to authenticated;


-- =============================================================
-- E) CLINIC CHAT
-- =============================================================

create table if not exists
  public.clinic_chat_messages (

    id uuid
      primary key
      default gen_random_uuid(),

    sender_id uuid
      not null
      references public.profiles(id)
      on delete cascade,

    recipient_id uuid
      not null
      references public.profiles(id)
      on delete cascade,

    body text
      not null
      check (
        char_length(
          trim(
            body
          )
        )
        between 1 and 4000
      ),

    created_at timestamptz
      not null
      default now(),

    read_at timestamptz,

    constraint clinic_chat_not_self
      check (
        sender_id
        <>
        recipient_id
      )

  );


create index if not exists
  clinic_chat_sender_created_idx
on public.clinic_chat_messages(
  sender_id,
  created_at desc
);


create index if not exists
  clinic_chat_recipient_created_idx
on public.clinic_chat_messages(
  recipient_id,
  created_at desc
);


alter table
  public.clinic_chat_messages
enable row level security;


drop policy if exists
  clinic_chat_select
on public.clinic_chat_messages;


create policy
  clinic_chat_select
on public.clinic_chat_messages
for select
to authenticated
using (

  sender_id =
    auth.uid()

  or

  recipient_id =
    auth.uid()

  or

  exists (

    select 1

    from public.user_roles ur

    where
      ur.user_id =
        auth.uid()

      and
      ur.role::text =
        'owner'

  )

);


drop policy if exists
  clinic_chat_insert
on public.clinic_chat_messages;


create policy
  clinic_chat_insert
on public.clinic_chat_messages
for insert
to authenticated
with check (

  sender_id =
    auth.uid()

  and

  exists (

    select 1

    from public.user_roles me

    where
      me.user_id =
        auth.uid()

      and
      me.role::text in (
        'doctor',
        'secretary'
      )

  )

  and

  exists (

    select 1

    from public.user_roles them

    where
      them.user_id =
        recipient_id

      and
      them.role::text in (
        'doctor',
        'secretary'
      )

  )

);


create or replace function public.clinic_chat_participants()
returns table (

  id uuid,

  username text,

  email text,

  display_name text,

  roles text

)
language sql
stable
security definer
set search_path = ''
as $$

  select

    p.id,

    p.username,

    p.email,

    p.display_name,

    string_agg(
      distinct
      ur.role::text,
      ', '
      order by
      ur.role::text
    )
      as roles


  from public.profiles p

  join public.user_roles ur
    on ur.user_id =
       p.id

  where
    p.is_active =
      true

    and
    ur.role::text in (
      'doctor',
      'secretary'
    )

    and
    (
      exists (

        select 1

        from public.user_roles me

        where
          me.user_id =
            auth.uid()

          and
          me.role::text in (
            'doctor',
            'secretary',
            'owner'
          )

      )
    )

  group by
    p.id,
    p.username,
    p.email,
    p.display_name

  order by
    p.display_name nulls last,
    p.username;

$$;


revoke all
on function
  public.clinic_chat_participants()
from public, anon;


grant execute
on function
  public.clinic_chat_participants()
to authenticated;


create or replace function public.clinic_send_chat_message(
  p_recipient uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_id uuid;

  v_body text :=
    trim(
      coalesce(
        p_body,
        ''
      )
    );

begin

  if auth.uid() is null then

    raise exception
      'Authentication required';

  end if;


  if
    char_length(
      v_body
    )
    not between 1 and 4000
  then

    raise exception
      'Message must contain 1 to 4000 characters';

  end if;


  if
    p_recipient =
    auth.uid()
  then

    raise exception
      'You cannot send a message to yourself';

  end if;


  if not exists (

    select 1

    from public.user_roles me

    where
      me.user_id =
        auth.uid()

      and
      me.role::text in (
        'doctor',
        'secretary'
      )

  )
  then

    raise exception
      'Only doctors and the secretary can send clinic chat messages';

  end if;


  if not exists (

    select 1

    from public.user_roles them

    where
      them.user_id =
        p_recipient

      and
      them.role::text in (
        'doctor',
        'secretary'
      )

  )
  then

    raise exception
      'Recipient is not available for clinic chat';

  end if;


  insert into
    public.clinic_chat_messages (
      sender_id,
      recipient_id,
      body
    )

  values (
    auth.uid(),
    p_recipient,
    v_body
  )

  returning id

  into v_id;


  return v_id;

end;
$$;


revoke all
on function
  public.clinic_send_chat_message(uuid,text)
from public, anon;


grant execute
on function
  public.clinic_send_chat_message(uuid,text)
to authenticated;


create or replace function public.clinic_mark_chat_read(
  p_other uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_count integer;

begin

  update public.clinic_chat_messages

  set
    read_at =
      coalesce(
        read_at,
        now()
      )

  where
    recipient_id =
      auth.uid()

    and
    sender_id =
      p_other

    and
    read_at is null;


  get diagnostics
    v_count =
      row_count;


  return v_count;

end;
$$;


revoke all
on function
  public.clinic_mark_chat_read(uuid)
from public, anon;


grant execute
on function
  public.clinic_mark_chat_read(uuid)
to authenticated;


-- =============================================================
-- F) REALTIME
-- =============================================================

do $$
begin

  if not exists (

    select 1

    from pg_publication_tables

    where
      pubname =
        'supabase_realtime'

      and
      schemaname =
        'public'

      and
      tablename =
        'clinic_chat_messages'

  )
  then

    alter publication
      supabase_realtime
    add table
      public.clinic_chat_messages;

  end if;

exception

  when others then

    raise notice
      'Could not add clinic_chat_messages to supabase_realtime: %',
      sqlerrm;

end;
$$;


notify pgrst,
  'reload schema';


commit;


-- =============================================================
-- QUICK VERIFY
-- =============================================================

select
  'V31 installed' as status,

  (
    select count(*)
    from information_schema.routines
    where
      routine_schema =
        'public'
      and
      routine_name in (
        'doctor_search_patients_clinically',
        'doctor_finance_snapshot',
        'clinic_chat_participants',
        'clinic_send_chat_message',
        'clinic_mark_chat_read'
      )
  )
  as helper_functions_found;
