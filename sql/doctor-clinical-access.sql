-- =========================================================
-- ALAA CLINIC
-- DR AHMED — CHECKED-IN PATIENT CLINICAL ACCESS + SEARCH
-- =========================================================


-- ---------------------------------------------------------
-- 1) Allow the ASSIGNED doctor to promote an older "arrived"
--    checked-in case into the waiting workflow.
--
--    This does NOT allow doctors to touch another doctor's patient.
-- ---------------------------------------------------------

create or replace function public.doctor_prepare_checked_in_appointment(
  p_appointment uuid
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
    raise exception
      'Authentication required';
  end if;


  select *

  into v_appointment

  from public.appointments

  where id =
    p_appointment

  for update;


  if not found then
    raise exception
      'Appointment not found';
  end if;


  if v_appointment.doctor_id
     <> auth.uid()
  then
    raise exception
      'Only the assigned doctor can open this patient';
  end if;


  if v_appointment.status not in (
    'arrived',
    'waiting',
    'with_doctor',
    'completed'
  ) then
    raise exception
      'Patient has not checked in';
  end if;


  if v_appointment.status =
     'arrived'
  then

    update public.appointments

    set
      status =
        'waiting',

      updated_by =
        auth.uid(),

      updated_at =
        now()

    where id =
      p_appointment

    returning *

    into v_appointment;

  end if;


  return jsonb_build_object(

    'appointment_id',
      v_appointment.id,

    'patient_id',
      v_appointment.patient_id,

    'doctor_id',
      v_appointment.doctor_id,

    'status',
      v_appointment.status

  );

end;
$$;


revoke all
on function public.doctor_prepare_checked_in_appointment(uuid)
from public, anon;


grant execute
on function public.doctor_prepare_checked_in_appointment(uuid)
to authenticated;



-- ---------------------------------------------------------
-- 2) Search Dr Ahmed's OWN clinical records from Patients.
--
--    Searches:
--      - diagnosis summary
--      - chief complaint
--      - clinical notes
--      - history
--      - examination
--      - treatment plan
--      - follow-up plan
--      - structured diagnoses
--
--    Results only come from clinical_visits where
--    doctor_id = auth.uid().
-- ---------------------------------------------------------

create or replace function public.doctor_search_patients_clinically(
  p_term text
)
returns table (

  patient_id uuid,

  medical_record_number text,

  patient_name text,

  birth_year integer,

  mobile text,

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


  note_matches as (

    select

      v.patient_id,

      v.id as visit_id,

      v.created_at as visit_date,

      case

        when coalesce(
               v.diagnosis_summary,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'Diagnosis summary'

        when coalesce(
               v.chief_complaint,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'Chief complaint'

        when coalesce(
               v.clinical_notes,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'Clinical notes'

        when coalesce(
               v.history_present_illness,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'History'

        when coalesce(
               v.examination,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'Examination'

        when coalesce(
               v.treatment_plan,
               ''
             ) ilike
             '%' || i.term || '%'
          then 'Treatment plan'

        else
          'Follow-up'

      end as match_source,


      case

        when coalesce(
               v.diagnosis_summary,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.diagnosis_summary

        when coalesce(
               v.chief_complaint,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.chief_complaint

        when coalesce(
               v.clinical_notes,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.clinical_notes

        when coalesce(
               v.history_present_illness,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.history_present_illness

        when coalesce(
               v.examination,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.examination

        when coalesce(
               v.treatment_plan,
               ''
             ) ilike
             '%' || i.term || '%'
          then v.treatment_plan

        else
          v.follow_up_plan

      end as matched_text


    from public.clinical_visits v

    cross join input i

    where auth.uid() is not null

      and i.term is not null

      and length(
        i.term
      ) >= 2

      and v.doctor_id =
        auth.uid()

      and concat_ws(
        ' ',
        v.diagnosis_summary,
        v.chief_complaint,
        v.clinical_notes,
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

    where auth.uid() is not null

      and i.term is not null

      and length(
        i.term
      ) >= 2

      and v.doctor_id =
        auth.uid()

      and coalesce(
        d.diagnosis_text,
        ''
      )
      ilike
      '%' || i.term || '%'

  ),


  combined as (

    select *
    from note_matches

    union all

    select *
    from diagnosis_matches

  ),


  latest_per_patient as (

    select distinct on (
      c.patient_id
    )

      c.patient_id,

      c.visit_id,

      c.visit_date,

      c.match_source,

      c.matched_text


    from combined c

    order by

      c.patient_id,

      c.visit_date desc

  )


  select

    p.id as patient_id,

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
    ) as patient_name,

    p.birth_year,

    p.mobile,

    m.visit_id,

    m.visit_date,

    m.match_source,

    m.matched_text


  from latest_per_patient m

  join public.patients p
    on p.id =
       m.patient_id

  where p.is_active = true

  order by
    m.visit_date desc

  limit 50;

$$;


revoke all
on function public.doctor_search_patients_clinically(text)
from public, anon;


grant execute
on function public.doctor_search_patients_clinically(text)
to authenticated;


notify pgrst, 'reload schema';



-- ---------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------

select
  routine_name

from information_schema.routines

where routine_schema =
  'public'

  and routine_name in (
    'doctor_prepare_checked_in_appointment',
    'doctor_search_patients_clinically'
  )

order by routine_name;
