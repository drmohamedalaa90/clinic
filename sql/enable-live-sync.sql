-- =========================================================
-- ALAA CLINIC — LIVE APPOINTMENT/PATIENT SYNC
-- Safe to run more than once.
-- =========================================================

do $$
begin

  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='appointments'
  ) then

    alter publication supabase_realtime
      add table public.appointments;

  end if;


  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='patients'
  ) then

    alter publication supabase_realtime
      add table public.patients;

  end if;

end
$$;


select
  pubname,
  schemaname,
  tablename

from pg_publication_tables

where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in (
    'appointments',
    'patients'
  )

order by tablename;
