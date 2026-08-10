-- =========================================================
-- ALAA CLINIC
-- REALTIME BOOKING SYNC
--
-- Makes appointment changes available to connected clinic browsers.
-- Safe to run even if the tables are already in supabase_realtime.
-- =========================================================


do $$
begin

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then

    alter publication supabase_realtime
      add table public.appointments;

  end if;


  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'patients'
  ) then

    alter publication supabase_realtime
      add table public.patients;

  end if;

end
$$;


-- VERIFY
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
