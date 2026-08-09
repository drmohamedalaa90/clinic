-- =========================================================
-- OPERATION CLINIC
-- SARA ATTENDANCE — COLUMN-AWARE FINAL FIX
--
-- Current confirmed schema behavior:
--   attendance_records.created_by exists and is NOT NULL
--   attendance_records.updated_by DOES NOT EXIST
--
-- Previous function therefore failed because it tried to write
-- a column that does not exist.
--
-- This version checks the real table columns at runtime and only
-- writes optional audit columns when they actually exist.
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

  v_uid uuid :=
    auth.uid();

  v_today date :=
    (
      now()
      at time zone 'Africa/Cairo'
    )::date;

  v_now timestamptz :=
    now();

  v_schedule public.staff_work_schedules%rowtype;

  v_scheduled_start timestamptz;

  v_scheduled_end timestamptz;

  v_late integer :=
    0;

  v_result jsonb;

  v_has_created_by boolean;

  v_has_updated_by boolean;

begin

  if v_uid is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role(
    'secretary'
  ) then
    raise exception 'Secretary access required';
  end if;


  if exists (
    select 1

    from public.attendance_records a

    where a.staff_id =
      v_uid

      and a.work_date =
        v_today

      and a.check_in_at
        is not null
  ) then
    raise exception 'Already checked in today';
  end if;


  select *
  into v_schedule

  from public.staff_work_schedules s

  where s.staff_id =
    v_uid

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

    -- Until management creates Sara's weekly schedule,
    -- attendance is still allowed.
    v_scheduled_start :=
      v_now;

    v_scheduled_end :=
      v_now;

    v_late :=
      0;

  end if;


  select exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'attendance_records'
      and column_name =
        'created_by'
  )
  into v_has_created_by;


  select exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'attendance_records'
      and column_name =
        'updated_by'
  )
  into v_has_updated_by;


  if (
    v_has_created_by
    and v_has_updated_by
  ) then

    execute '
      insert into public.attendance_records as a (
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
        $1,$2,$3,$4,$5,$6,0,$1,$1
      )
      returning to_jsonb(a)
    '

    into v_result

    using
      v_uid,
      v_today,
      v_scheduled_start,
      v_scheduled_end,
      v_now,
      v_late;


  elsif v_has_created_by then

    execute '
      insert into public.attendance_records as a (
        staff_id,
        work_date,
        scheduled_start,
        scheduled_end,
        check_in_at,
        late_minutes,
        early_leave_minutes,
        created_by
      )
      values (
        $1,$2,$3,$4,$5,$6,0,$1
      )
      returning to_jsonb(a)
    '

    into v_result

    using
      v_uid,
      v_today,
      v_scheduled_start,
      v_scheduled_end,
      v_now,
      v_late;


  else

    execute '
      insert into public.attendance_records as a (
        staff_id,
        work_date,
        scheduled_start,
        scheduled_end,
        check_in_at,
        late_minutes,
        early_leave_minutes
      )
      values (
        $1,$2,$3,$4,$5,$6,0
      )
      returning to_jsonb(a)
    '

    into v_result

    using
      v_uid,
      v_today,
      v_scheduled_start,
      v_scheduled_end,
      v_now,
      v_late;

  end if;


  return v_result;

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

  v_uid uuid :=
    auth.uid();

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

  v_result jsonb;

  v_has_updated_by boolean;

  v_has_updated_at boolean;

begin

  if v_uid is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role(
    'secretary'
  ) then
    raise exception 'Secretary access required';
  end if;


  select *
  into v_record

  from public.attendance_records a

  where a.staff_id =
    v_uid

    and a.work_date =
      v_today

    and a.check_in_at
      is not null

  order by
    a.check_in_at desc

  limit 1

  for update;


  if not found then
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
    v_uid

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

  end if;


  select exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'attendance_records'
      and column_name =
        'updated_by'
  )
  into v_has_updated_by;


  select exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'attendance_records'
      and column_name =
        'updated_at'
  )
  into v_has_updated_at;


  if (
    v_has_updated_by
    and v_has_updated_at
  ) then

    execute '
      update public.attendance_records as a
      set
        check_out_at=$1,
        early_leave_minutes=$2,
        updated_by=$3,
        updated_at=now()
      where id=$4
      returning to_jsonb(a)
    '

    into v_result

    using
      v_now,
      v_early,
      v_uid,
      v_record.id;


  elsif v_has_updated_by then

    execute '
      update public.attendance_records as a
      set
        check_out_at=$1,
        early_leave_minutes=$2,
        updated_by=$3
      where id=$4
      returning to_jsonb(a)
    '

    into v_result

    using
      v_now,
      v_early,
      v_uid,
      v_record.id;


  elsif v_has_updated_at then

    execute '
      update public.attendance_records as a
      set
        check_out_at=$1,
        early_leave_minutes=$2,
        updated_at=now()
      where id=$3
      returning to_jsonb(a)
    '

    into v_result

    using
      v_now,
      v_early,
      v_record.id;


  else

    execute '
      update public.attendance_records as a
      set
        check_out_at=$1,
        early_leave_minutes=$2
      where id=$3
      returning to_jsonb(a)
    '

    into v_result

    using
      v_now,
      v_early,
      v_record.id;

  end if;


  return v_result;

end;
$$;


revoke all
on function public.frontend_staff_check_out(text)
from public, anon;


grant execute
on function public.frontend_staff_check_out(text)
to authenticated;



-- RLS policies call this helper, so authenticated users must be
-- able to execute the helper while RLS still decides whether access
-- is permitted.
do $$
declare
  r record;
begin

  for r in
    select
      p.oid::regprocedure
        as signature

    from pg_proc p

    join pg_namespace n
      on n.oid =
         p.pronamespace

    where n.nspname =
      'private'

      and p.proname =
        'can_manage_attendance'

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


-- Diagnostic only:
-- shows the actual attendance columns so future errors do not need guessing.
select
  column_name,
  data_type,
  is_nullable,
  column_default

from information_schema.columns

where table_schema =
  'public'

  and table_name =
    'attendance_records'

order by ordinal_position;
