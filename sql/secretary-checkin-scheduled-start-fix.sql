-- =========================================================
-- OPERATION CLINIC
-- SECRETARY CHECK-IN NOT-NULL REPAIR
--
-- Fixes:
-- null value in column "scheduled_start" of relation
-- "attendance_records" violates not-null constraint
-- =========================================================

create or replace function public.frontend_staff_check_in(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date :=
    (now() at time zone 'Africa/Cairo')::date;

  v_now timestamptz :=
    now();

  v_existing public.attendance_records%rowtype;
  v_result public.attendance_records%rowtype;
  v_schedule public.staff_work_schedules%rowtype;

  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;

  v_late integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;

  select *
  into v_existing
  from public.attendance_records
  where staff_id = auth.uid()
    and work_date = v_today
  order by check_in_at desc
  limit 1
  for update;

  if found
     and v_existing.check_in_at is not null
  then
    raise exception 'Already checked in today';
  end if;

  select *
  into v_schedule
  from public.staff_work_schedules s
  where s.staff_id = auth.uid()
    and s.is_active = true
    and s.weekday = extract(isodow from v_today)::smallint
    and v_today >= s.effective_from
    and (
      s.effective_until is null
      or v_today <= s.effective_until
    )
  order by s.effective_from desc
  limit 1;

  if found then
    v_scheduled_start :=
      (v_today + v_schedule.start_time)::timestamp
      at time zone 'Africa/Cairo';

    v_scheduled_end :=
      (v_today + v_schedule.end_time)::timestamp
      at time zone 'Africa/Cairo';

    v_late := greatest(
      0,
      floor(
        extract(
          epoch
          from (v_now - v_scheduled_start)
        ) / 60
      )::integer
      -
      coalesce(
        v_schedule.late_grace_minutes,
        0
      )
    );
  else
    -- No weekly schedule yet:
    -- use the actual check-in moment as a neutral required anchor.
    v_scheduled_start := v_now;
    v_scheduled_end := v_now;
    v_late := 0;
  end if;

  insert into public.attendance_records (
    staff_id,
    work_date,
    scheduled_start,
    scheduled_end,
    check_in_at,
    late_minutes,
    early_leave_minutes
  )
  values (
    auth.uid(),
    v_today,
    v_scheduled_start,
    v_scheduled_end,
    v_now,
    v_late,
    0
  )
  returning *
  into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all
on function public.frontend_staff_check_in(text)
from public, anon;

grant execute
on function public.frontend_staff_check_in(text)
to authenticated;


do $$
declare
  r record;
begin
  for r in
    select
      p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'frontend_staff_check_out',
        'frontend_get_staff_attendance_today'
      )
  loop
    execute
      'grant execute on function '
      ||
      r.signature
      ||
      ' to authenticated';
  end loop;
end $$;


notify pgrst, 'reload schema';


select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_staff_check_in',
    'frontend_staff_check_out',
    'frontend_get_staff_attendance_today'
  )
order by routine_name;
