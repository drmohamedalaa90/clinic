-- =========================================================
-- OPERATION CLINIC
-- SARA ATTENDANCE CREATED_BY REPAIR
--
-- Current error:
--   null value in column "created_by" of relation
--   "attendance_records" violates not-null constraint
--
-- This replaces the frontend Secretary check-in/check-out functions
-- so the attendance row always has:
--   created_by = Sara's authenticated user UUID
--   updated_by = Sara's authenticated user UUID
--
-- It keeps the previous scheduled_start/scheduled_end repair too.
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
    (
      now()
      at time zone 'Africa/Cairo'
    )::date;

  v_now timestamptz :=
    now();

  v_existing public.attendance_records%rowtype;

  v_result public.attendance_records%rowtype;

  v_schedule public.staff_work_schedules%rowtype;

  v_scheduled_start timestamptz;

  v_scheduled_end timestamptz;

  v_late integer :=
    0;

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

  where staff_id =
    auth.uid()

    and work_date =
      v_today

  order by
    check_in_at desc

  limit 1

  for update;


  if found
     and v_existing.check_in_at
         is not null
  then
    raise exception 'Already checked in today';
  end if;


  select *
  into v_schedule

  from public.staff_work_schedules s

  where s.staff_id =
    auth.uid()

    and s.is_active =
      true

    and s.weekday =
      extract(
        isodow
        from v_today
      )::smallint

    and v_today >=
      s.effective_from

    and (
      s.effective_until
        is null

      or v_today <=
         s.effective_until
    )

  order by
    s.effective_from desc

  limit 1;


  if found then

    v_scheduled_start :=
      (
        v_today
        +
        v_schedule.start_time
      )::timestamp
      at time zone 'Africa/Cairo';


    v_scheduled_end :=
      (
        v_today
        +
        v_schedule.end_time
      )::timestamp
      at time zone 'Africa/Cairo';


    v_late :=
      greatest(
        0,

        floor(
          extract(
            epoch
            from (
              v_now
              -
              v_scheduled_start
            )
          )
          /
          60
        )::integer

        -
        coalesce(
          v_schedule.late_grace_minutes,
          0
        )
      );

  else

    -- No management schedule yet:
    -- still allow Secretary to check in.
    v_scheduled_start :=
      v_now;

    v_scheduled_end :=
      v_now;

    v_late :=
      0;

  end if;


  insert into public.attendance_records (

    staff_id,

    work_date,

    scheduled_start,

    scheduled_end,

    check_in_at,

    late_minutes,

    early_leave_minutes,

    created_by,

    updated_by

  )

  values (

    auth.uid(),

    v_today,

    v_scheduled_start,

    v_scheduled_end,

    v_now,

    v_late,

    0,

    auth.uid(),

    auth.uid()

  )

  returning *
  into v_result;


  return to_jsonb(
    v_result
  );

end;
$$;


revoke all
on function public.frontend_staff_check_in(text)
from public, anon;


grant execute
on function public.frontend_staff_check_in(text)
to authenticated;



create or replace function public.frontend_staff_check_out(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_today date :=
    (
      now()
      at time zone 'Africa/Cairo'
    )::date;

  v_now timestamptz :=
    now();

  v_record public.attendance_records%rowtype;

  v_schedule public.staff_work_schedules%rowtype;

  v_scheduled_end timestamptz;

  v_early integer :=
    0;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;


  select *
  into v_record

  from public.attendance_records

  where staff_id =
    auth.uid()

    and work_date =
      v_today

  order by
    check_in_at desc

  limit 1

  for update;


  if not found
     or v_record.check_in_at
        is null
  then
    raise exception 'Check in first';
  end if;


  if v_record.check_out_at
     is not null
  then
    raise exception 'Already checked out today';
  end if;


  select *
  into v_schedule

  from public.staff_work_schedules s

  where s.staff_id =
    auth.uid()

    and s.is_active =
      true

    and s.weekday =
      extract(
        isodow
        from v_today
      )::smallint

    and v_today >=
      s.effective_from

    and (
      s.effective_until
        is null

      or v_today <=
         s.effective_until
    )

  order by
    s.effective_from desc

  limit 1;


  if found then

    v_scheduled_end :=
      (
        v_today
        +
        v_schedule.end_time
      )::timestamp
      at time zone 'Africa/Cairo';


    v_early :=
      greatest(
        0,

        floor(
          extract(
            epoch
            from (
              v_scheduled_end
              -
              v_now
            )
          )
          /
          60
        )::integer

        -
        coalesce(
          v_schedule.early_leave_grace_minutes,
          0
        )
      );

  else

    v_early :=
      0;

  end if;


  update public.attendance_records

  set
    check_out_at =
      v_now,

    early_leave_minutes =
      v_early,

    updated_by =
      auth.uid()

  where id =
    v_record.id

  returning *
  into v_record;


  return to_jsonb(
    v_record
  );

end;
$$;


revoke all
on function public.frontend_staff_check_out(text)
from public, anon;


grant execute
on function public.frontend_staff_check_out(text)
to authenticated;


notify pgrst, 'reload schema';


-- VERIFY
select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'frontend_staff_check_in',
    'frontend_staff_check_out'
  )
order by routine_name;
