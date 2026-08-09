-- =========================================================
-- OPERATION CLINIC
-- OWNER: DELETE ONE SARA ATTENDANCE RECORD DURING TEST PERIOD
--
-- Owner only.
-- Deletes one attendance row from any date.
-- Keeps a small deletion log with the original row snapshot.
-- =========================================================


create table if not exists public.attendance_test_deletions (

  id uuid primary key
    default gen_random_uuid(),

  attendance_record_id uuid not null,

  staff_id uuid not null,

  work_date date not null,

  deleted_record jsonb not null,

  reason text,

  deleted_by uuid not null
    references public.profiles(id)
    on delete restrict,

  deleted_at timestamptz not null
    default now()
);


alter table public.attendance_test_deletions
enable row level security;


revoke all
on public.attendance_test_deletions
from public, anon, authenticated;


grant select
on public.attendance_test_deletions
to authenticated;


drop policy if exists
  "Owner view attendance test deletions"
on public.attendance_test_deletions;


create policy
  "Owner view attendance test deletions"

on public.attendance_test_deletions

for select
to authenticated

using (
  private.has_role('owner')
);



create or replace function public.owner_delete_attendance_test_record(

  p_attendance_id uuid,

  p_reason text default
    'Owner test-period cleanup'

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_row public.attendance_records%rowtype;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  select *
  into v_row

  from public.attendance_records

  where id =
    p_attendance_id

  for update;


  if not found then
    raise exception 'Attendance record not found';
  end if;


  insert into public.attendance_test_deletions (

    attendance_record_id,

    staff_id,

    work_date,

    deleted_record,

    reason,

    deleted_by

  )

  values (

    v_row.id,

    v_row.staff_id,

    v_row.work_date,

    to_jsonb(v_row),

    nullif(
      trim(p_reason),
      ''
    ),

    auth.uid()

  );


  delete from public.attendance_records

  where id =
    p_attendance_id;


  return jsonb_build_object(

    'deleted',
      true,

    'attendance_record_id',
      v_row.id,

    'staff_id',
      v_row.staff_id,

    'work_date',
      v_row.work_date

  );

end;
$$;


revoke all
on function public.owner_delete_attendance_test_record(
  uuid,
  text
)
from public, anon;


grant execute
on function public.owner_delete_attendance_test_record(
  uuid,
  text
)
to authenticated;


notify pgrst, 'reload schema';


-- Optional verification:
select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name =
    'owner_delete_attendance_test_record';
