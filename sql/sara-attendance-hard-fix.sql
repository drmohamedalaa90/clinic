-- =========================================================
-- OPERATION CLINIC
-- SARA ATTENDANCE — HARD FIX
--
-- This replaces the Secretary check-in path and also adds safe
-- defaults to the required attendance audit/schedule columns.
--
-- It is intended to stop the repeated:
--   null value in column "..." of attendance_records
-- errors once and for all for the known required fields.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Defensive defaults on the attendance table.
--    These make even an older insert path safe.
-- ---------------------------------------------------------

do $$
begin

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='scheduled_start'
  ) then
    execute '
      alter table public.attendance_records
      alter column scheduled_start
      set default now()
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='scheduled_end'
  ) then
    execute '
      alter table public.attendance_records
      alter column scheduled_end
      set default now()
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='created_by'
  ) then
    execute '
      alter table public.attendance_records
      alter column created_by
      set default auth.uid()
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='updated_by'
  ) then
    execute '
      alter table public.attendance_records
      alter column updated_by
      set default auth.uid()
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='late_minutes'
  ) then
    execute '
      alter table public.attendance_records
      alter column late_minutes
      set default 0
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='early_leave_minutes'
  ) then
    execute '
      alter table public.attendance_records
      alter column early_leave_minutes
      set default 0
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='created_at'
  ) then
    execute '
      alter table public.attendance_records
      alter column created_at
      set default now()
    ';
  end if;


  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='attendance_records'
      and column_name='updated_at'
  ) then
    execute '
      alter table public.attendance_records
      alter column updated_at
      set default now()
    ';
  end if;

end $$;



-- ---------------------------------------------------------
-- 2. Secretary CHECK IN.
-- ---------------------------------------------------------

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

  v_row public.attendance_records%rowtype;

begin

  if v_uid is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;


  if exists (
    select 1
    from public.attendance_records a
    where a.staff_id = v_uid
      and a.work_date = v_today
      and a.check_in_at is not null
  ) then
    raise exception 'Already checked in today';
  end if;


  select *
  into v_schedule

  from public.staff_work_schedules s

  where s.staff_id = v_uid
    and s.is_active = true
    and s.weekday =
      extract(
        isodow
        from v_today
      )::smallint
    and v_today >= s.effective_from
    and (
      s.effective_until is null
      or v_today <= s.effective_until
    )

  order by s.effective_from desc

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

    -- No schedule configured yet:
    -- allow attendance without inventing a lateness penalty.
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

    v_uid,

    v_today,

    v_scheduled_start,

    v_scheduled_end,

    v_now,

    v_late,

    0,

    v_uid,

    v_uid

  )

  returning *
  into v_row;


  return to_jsonb(
    v_row
  );

end;
$$;


revoke all
on function public.frontend_staff_check_in(text)
from public, anon;


grant execute
on function public.frontend_staff_check_in(text)
to authenticated;



-- ---------------------------------------------------------
-- 3. Secretary CHECK OUT.
-- ---------------------------------------------------------

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

  v_row public.attendance_records%rowtype;

  v_schedule public.staff_work_schedules%rowtype;

  v_scheduled_end timestamptz;

  v_early integer :=
    0;

begin

  if v_uid is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('secretary') then
    raise exception 'Secretary access required';
  end if;


  select *
  into v_row

  from public.attendance_records a

  where a.staff_id = v_uid
    and a.work_date = v_today
    and a.check_in_at is not null

  order by a.check_in_at desc

  limit 1

  for update;


  if not found then
    raise exception 'Check in first';
  end if;


  if v_row.check_out_at is not null then
    raise exception 'Already checked out today';
  end if;


  select *
  into v_schedule

  from public.staff_work_schedules s

  where s.staff_id = v_uid
    and s.is_active = true
    and s.weekday =
      extract(
        isodow
        from v_today
      )::smallint
    and v_today >= s.effective_from
    and (
      s.effective_until is null
      or v_today <= s.effective_until
    )

  order by s.effective_from desc

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


  update public.attendance_records

  set
    check_out_at =
      v_now,

    early_leave_minutes =
      v_early,

    updated_by =
      v_uid,

    updated_at =
      now()

  where id =
    v_row.id

  returning *
  into v_row;


  return to_jsonb(
    v_row
  );

end;
$$;


revoke all
on function public.frontend_staff_check_out(text)
from public, anon;


grant execute
on function public.frontend_staff_check_out(text)
to authenticated;



-- ---------------------------------------------------------
-- 4. The existing attendance RLS helper must be executable
--    by authenticated requests because RLS policies call it.
-- ---------------------------------------------------------

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



-- ---------------------------------------------------------
-- 5. DIAGNOSTIC:
--    This should ideally return ZERO unexpected required
--    columns. If it returns a row, screenshot it once and
--    we will know exactly what legacy constraint remains.
-- ---------------------------------------------------------

select
  column_name,
  data_type,
  udt_name,
  column_default

from information_schema.columns

where table_schema =
  'public'

  and table_name =
    'attendance_records'

  and is_nullable =
    'NO'

  and column_default
      is null

  and column_name not in (
    'id',
    'staff_id',
    'work_date',
    'check_in_at'
  )

order by ordinal_position;
