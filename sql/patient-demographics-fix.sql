-- =========================================================
-- OPERATION CLINIC
-- PATIENT DEMOGRAPHICS FIX
--
-- Requested:
-- 1) Keep only one Mobile field
-- 2) Use Year of Birth instead of full Date of Birth in the UI
-- 3) Remove Alternative phone from the UI
-- 4) Remove Emergency contact from the UI
--
-- This migration is intentionally non-destructive:
-- old DOB / alternative / emergency columns, if they exist,
-- are NOT dropped so historical data is not lost.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Ensure the patient table has the fields the frontend uses
-- ---------------------------------------------------------
alter table public.patients
  add column if not exists mobile text;

alter table public.patients
  add column if not exists birth_year smallint;


-- ---------------------------------------------------------
-- 2. Migrate an existing phone value into "mobile" if the
--    project previously used another common column name.
-- ---------------------------------------------------------
do $$
declare
  v_column text;
begin
  foreach v_column in array array[
    'phone',
    'phone_number',
    'mobile_number',
    'telephone'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patients'
        and column_name = v_column
    ) then
      execute format(
        'update public.patients
         set mobile = coalesce(nullif(trim(mobile), ''''), nullif(trim(%I::text), ''''))
         where mobile is null or trim(mobile) = ''''',
        v_column
      );
    end if;
  end loop;
end;
$$;


-- ---------------------------------------------------------
-- 3. Populate Year of Birth from old Date of Birth,
--    but only where Year of Birth is still empty.
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'date_of_birth'
  ) then
    execute $migration$
      update public.patients
      set birth_year = extract(year from date_of_birth)::smallint
      where birth_year is null
        and date_of_birth is not null
    $migration$;
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 4. Reasonable validation for birth year
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_birth_year_reasonable'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_birth_year_reasonable
      check (
        birth_year is null
        or birth_year between 1900 and 2100
      );
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 5. Useful indexes
-- ---------------------------------------------------------
create index if not exists patients_mobile_idx
  on public.patients(mobile);

create index if not exists patients_birth_year_idx
  on public.patients(birth_year);


-- ---------------------------------------------------------
-- 6. Ask PostgREST to refresh schema metadata immediately
-- ---------------------------------------------------------
notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- 7. Verify
-- ---------------------------------------------------------
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'patients'
  and column_name in (
    'mobile',
    'birth_year',
    'date_of_birth',
    'alternative_mobile',
    'alternative_phone',
    'emergency_contact'
  )
order by column_name;
