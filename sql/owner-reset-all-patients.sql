-- =========================================================
-- OPERATION CLINIC
-- OWNER TEST RESET: ALL PATIENTS + MRN RESTART FROM 1
--
-- Owner only.
--
-- Because appointments / visits / referrals / patient finance
-- records depend on patients, they are cleared first.
--
-- PRESERVED:
-- • users / roles
-- • doctor working-hours schedules
-- • doctor schedule exceptions
-- • clinic service / price list
-- • logistics requests
-- • attendance settings/data
--
-- CLEARED:
-- • booking income
-- • invoice payments / items / invoices
-- • referrals
-- • clinical visit children + visits
-- • appointment status history + appointments
-- • patients
--
-- NEXT NEW PATIENT:
-- OPC-000001
-- =========================================================


create or replace function public.owner_reset_all_patients_test_data(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patients integer := 0;
  v_appointments integer := 0;
  v_visits integer := 0;
  v_referrals integer := 0;
  v_booking_income integer := 0;
  v_invoices integer := 0;
begin

  if auth.uid() is null
     or not private.has_role('owner')
  then
    raise exception 'Owner access required';
  end if;


  if p_confirmation <> 'RESET PATIENTS' then
    raise exception
      'Confirmation text must be exactly RESET PATIENTS';
  end if;


  -- -------------------------------------------------------
  -- Finance records linked to patients / appointments
  -- -------------------------------------------------------

  if to_regclass('public.booking_income') is not null then
    execute 'delete from public.booking_income where true';
    get diagnostics v_booking_income = row_count;
  end if;


  if to_regclass('public.invoice_payments') is not null then
    execute 'delete from public.invoice_payments where true';
  end if;


  if to_regclass('public.invoice_items') is not null then
    execute 'delete from public.invoice_items where true';
  end if;


  if to_regclass('public.invoices') is not null then
    execute 'delete from public.invoices where true';
    get diagnostics v_invoices = row_count;
  end if;


  -- -------------------------------------------------------
  -- Referrals
  -- -------------------------------------------------------

  if to_regclass('public.referrals') is not null then
    execute 'delete from public.referrals where true';
    get diagnostics v_referrals = row_count;
  end if;


  -- -------------------------------------------------------
  -- Clinical child records
  -- -------------------------------------------------------

  if to_regclass('public.clinical_visit_amendments') is not null then
    execute 'delete from public.clinical_visit_amendments where true';
  end if;


  if to_regclass('public.visit_vitals') is not null then
    execute 'delete from public.visit_vitals where true';
  end if;


  if to_regclass('public.visit_diagnoses') is not null then
    execute 'delete from public.visit_diagnoses where true';
  end if;


  if to_regclass('public.visit_investigations') is not null then
    execute 'delete from public.visit_investigations where true';
  end if;


  if to_regclass('public.visit_medications') is not null then
    execute 'delete from public.visit_medications where true';
  end if;


  if to_regclass('public.clinical_documents') is not null then
    execute 'delete from public.clinical_documents where true';
  end if;


  if to_regclass('public.clinical_visits') is not null then
    execute 'delete from public.clinical_visits where true';
    get diagnostics v_visits = row_count;
  end if;


  -- -------------------------------------------------------
  -- Appointments
  -- -------------------------------------------------------

  if to_regclass('public.appointment_status_history') is not null then
    execute 'delete from public.appointment_status_history where true';
  end if;


  delete from public.appointments
  where true;

  get diagnostics v_appointments = row_count;


  -- -------------------------------------------------------
  -- PATIENT REGISTRY
  -- -------------------------------------------------------

  delete from public.patients
  where true;

  get diagnostics v_patients = row_count;


  -- -------------------------------------------------------
  -- Restart patient numbering from 1.
  -- The next generated MRN becomes OPC-000001.
  -- -------------------------------------------------------

  if to_regclass('public.patient_mrn_seq') is not null then
    perform setval(
      'public.patient_mrn_seq'::regclass,
      1,
      false
    );
  end if;


  return jsonb_build_object(
    'patients_deleted', v_patients,
    'appointments_deleted', v_appointments,
    'clinical_visits_deleted', v_visits,
    'referrals_deleted', v_referrals,
    'booking_income_deleted', v_booking_income,
    'invoices_deleted', v_invoices,
    'next_patient_mrn', 'OPC-000001',
    'doctor_schedules_preserved', true,
    'users_preserved', true
  );

end;
$$;


revoke all
on function public.owner_reset_all_patients_test_data(text)
from public, anon;


grant execute
on function public.owner_reset_all_patients_test_data(text)
to authenticated;


notify pgrst, 'reload schema';


-- VERIFY
select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'owner_reset_all_patients_test_data';

