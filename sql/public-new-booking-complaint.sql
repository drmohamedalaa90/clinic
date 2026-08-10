-- =========================================================
-- ALAA CLINIC
-- PUBLIC NEW-PATIENT BOOKING + OPTIONAL PATIENT COMPLAINT
--
-- Keeps the established new-patient booking logic, then safely appends
-- the optional complaint to the created appointment notes.
-- =========================================================


create or replace function public.submit_public_new_patient_booking_v2(

  p_doctor uuid,

  p_start timestamptz,

  p_end timestamptz,

  p_arabic_name text,

  p_birth_year integer,

  p_gender text,

  p_residency_area text,

  p_whatsapp text,

  p_complaint text default null

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_result jsonb;

  v_appointment_id uuid;

  v_complaint text;

begin

  v_result :=
    public.submit_public_new_patient_booking(

      p_doctor,

      p_start,

      p_end,

      p_arabic_name,

      p_birth_year,

      p_gender,

      p_residency_area,

      p_whatsapp

    );


  v_appointment_id :=
    nullif(
      v_result ->> 'appointment_id',
      ''
    )::uuid;


  v_complaint :=
    nullif(
      trim(
        p_complaint
      ),
      ''
    );


  if v_appointment_id is not null
     and v_complaint is not null
  then

    update public.appointments

    set
      notes =
        concat_ws(
          E'\n',
          nullif(
            trim(
              notes
            ),
            ''
          ),
          'شكوى المريض: '
          ||
          left(
            v_complaint,
            1000
          )
        ),

      updated_at =
        now()

    where id =
      v_appointment_id;

  end if;


  return
    v_result
    ||
    jsonb_build_object(
      'patient_complaint',
      v_complaint
    );

end;
$$;


revoke all
on function public.submit_public_new_patient_booking_v2(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  text
)
from public;


grant execute
on function public.submit_public_new_patient_booking_v2(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  text
)
to anon, authenticated;


notify pgrst, 'reload schema';


-- VERIFY
select
  routine_name

from information_schema.routines

where routine_schema='public'
  and routine_name=
    'submit_public_new_patient_booking_v2';
