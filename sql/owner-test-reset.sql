-- =========================================================
-- OPERATION CLINIC
-- DIRECT CHECK-IN + OWNER TEST RESET TOOLS
--
-- Booking actions:
--   Check in | Reschedule | No-show | Cancel
--
-- Owner-only test-period reset:
--   • Reset all appointment/test scheduling data
--   • Reset all finance transaction data
--
-- Patient registry and doctor working-hours schedules are preserved.
-- Service price list is preserved.
-- =========================================================


-- =========================================================
-- 1. OWNER RESET — APPOINTMENTS / TEST CLINICAL FLOW
-- =========================================================

create or replace function public.owner_reset_appointments_test_data(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointments integer := 0;
  v_status_history integer := 0;
  v_income integer := 0;
  v_visits integer := 0;
  v_referrals integer := 0;
begin

  if auth.uid() is null
     or not private.has_role('owner')
  then
    raise exception 'Owner access required';
  end if;


  if p_confirmation <> 'RESET APPOINTMENTS' then
    raise exception
      'Confirmation text must be exactly RESET APPOINTMENTS';
  end if;


  -- Booking income is linked one-to-one to appointments.
  if to_regclass('public.booking_income') is not null then
    execute 'delete from public.booking_income';
    get diagnostics v_income = row_count;
  end if;


  -- Keep invoice records if present, but detach them from test appointments.
  if to_regclass('public.invoices') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'invoices'
         and column_name = 'appointment_id'
     )
  then
    execute '
      update public.invoices
      set appointment_id = null
      where appointment_id is not null
    ';
  end if;


  -- Referrals can point to visits/appointments depending on installed schema.
  if to_regclass('public.referrals') is not null then

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'referrals'
        and column_name = 'appointment_id'
    ) then
      execute '
        delete from public.referrals
        where appointment_id is not null
      ';
      get diagnostics v_referrals = row_count;
    end if;

  end if;


  -- Delete children of clinical visits first when those optional tables exist.
  if to_regclass('public.clinical_visits') is not null then

    if to_regclass('public.clinical_visit_amendments') is not null then
      execute '
        delete from public.clinical_visit_amendments a
        using public.clinical_visits v
        where a.visit_id = v.id
      ';
    end if;


    if to_regclass('public.visit_vitals') is not null then
      execute '
        delete from public.visit_vitals x
        using public.clinical_visits v
        where x.visit_id = v.id
      ';
    end if;


    if to_regclass('public.visit_diagnoses') is not null then
      execute '
        delete from public.visit_diagnoses x
        using public.clinical_visits v
        where x.visit_id = v.id
      ';
    end if;


    if to_regclass('public.visit_investigations') is not null then
      execute '
        delete from public.visit_investigations x
        using public.clinical_visits v
        where x.visit_id = v.id
      ';
    end if;


    if to_regclass('public.visit_medications') is not null then
      execute '
        delete from public.visit_medications x
        using public.clinical_visits v
        where x.visit_id = v.id
      ';
    end if;


    if to_regclass('public.clinical_documents') is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'clinical_documents'
           and column_name = 'visit_id'
       )
    then
      execute '
        delete from public.clinical_documents x
        using public.clinical_visits v
        where x.visit_id = v.id
      ';
    end if;


    -- If referrals point to clinical visits, clear the test referrals first.
    if to_regclass('public.referrals') is not null then

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'referrals'
          and column_name = 'clinical_visit_id'
      ) then
        execute '
          delete from public.referrals
          where clinical_visit_id is not null
        ';
      end if;


      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'referrals'
          and column_name = 'source_visit_id'
      ) then
        execute '
          delete from public.referrals
          where source_visit_id is not null
        ';
      end if;

    end if;


    execute 'delete from public.clinical_visits';
    get diagnostics v_visits = row_count;

  end if;


  if to_regclass('public.appointment_status_history') is not null then
    execute 'delete from public.appointment_status_history';
    get diagnostics v_status_history = row_count;
  end if;


  delete from public.appointments;
  get diagnostics v_appointments = row_count;


  return jsonb_build_object(
    'appointments_deleted', v_appointments,
    'status_history_deleted', v_status_history,
    'booking_income_deleted', v_income,
    'clinical_visits_deleted', v_visits,
    'referrals_deleted', v_referrals,
    'patients_preserved', true,
    'doctor_schedules_preserved', true
  );

end;
$$;


revoke all
on function public.owner_reset_appointments_test_data(text)
from public, anon;

grant execute
on function public.owner_reset_appointments_test_data(text)
to authenticated;



-- =========================================================
-- 2. OWNER RESET — FINANCE TRANSACTION DATA
--
-- Preserves:
--   • patients
--   • appointments
--   • clinic_services / price list
--   • logistics requests themselves
--
-- Clears:
--   • booking income
--   • invoice payments/items/invoices
--   • cash closings
--   • clinic expenses
-- =========================================================

create or replace function public.owner_reset_finance_test_data(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_income integer := 0;
  v_payments integer := 0;
  v_items integer := 0;
  v_invoices integer := 0;
  v_closings integer := 0;
  v_expenses integer := 0;
begin

  if auth.uid() is null
     or not private.has_role('owner')
  then
    raise exception 'Owner access required';
  end if;


  if p_confirmation <> 'RESET FINANCE' then
    raise exception
      'Confirmation text must be exactly RESET FINANCE';
  end if;


  if to_regclass('public.invoice_payments') is not null then
    execute 'delete from public.invoice_payments';
    get diagnostics v_payments = row_count;
  end if;


  if to_regclass('public.invoice_items') is not null then
    execute 'delete from public.invoice_items';
    get diagnostics v_items = row_count;
  end if;


  if to_regclass('public.invoices') is not null then
    execute 'delete from public.invoices';
    get diagnostics v_invoices = row_count;
  end if;


  if to_regclass('public.booking_income') is not null then
    execute 'delete from public.booking_income';
    get diagnostics v_booking_income = row_count;
  end if;


  if to_regclass('public.cash_closings') is not null then
    execute 'delete from public.cash_closings';
    get diagnostics v_closings = row_count;
  end if;


  if to_regclass('public.clinic_expenses') is not null then
    execute 'delete from public.clinic_expenses';
    get diagnostics v_expenses = row_count;
  end if;


  return jsonb_build_object(
    'booking_income_deleted', v_booking_income,
    'invoice_payments_deleted', v_payments,
    'invoice_items_deleted', v_items,
    'invoices_deleted', v_invoices,
    'cash_closings_deleted', v_closings,
    'clinic_expenses_deleted', v_expenses,
    'service_price_list_preserved', true
  );

end;
$$;


revoke all
on function public.owner_reset_finance_test_data(text)
from public, anon;

grant execute
on function public.owner_reset_finance_test_data(text)
to authenticated;



-- =========================================================
-- 3. REFRESH + VERIFY
-- =========================================================

notify pgrst, 'reload schema';


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'owner_reset_appointments_test_data',
    'owner_reset_finance_test_data'
  )
order by routine_name;
