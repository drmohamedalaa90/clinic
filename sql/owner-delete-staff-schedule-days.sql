-- =========================================================
-- OPERATION CLINIC
-- OWNER — DELETE ONE OR MULTIPLE STAFF SCHEDULE DAYS
--
-- Intended for the current test/configuration period.
--
-- Owner can select one or more rows from Sara's Weekly Schedule
-- and remove them together.
--
-- A deletion snapshot is kept for audit/recovery reference.
-- =========================================================


create table if not exists public.staff_schedule_test_deletions (

  id uuid primary key
    default gen_random_uuid(),

  schedule_id uuid not null,

  staff_id uuid not null,

  deleted_schedule jsonb not null,

  reason text not null,

  deleted_by uuid not null
    references public.profiles(id)
    on delete restrict,

  deleted_at timestamptz not null
    default now(),

  constraint staff_schedule_test_delete_reason_required
    check (
      nullif(
        trim(reason),
        ''
      ) is not null
    )
);


alter table public.staff_schedule_test_deletions
enable row level security;


revoke all
on public.staff_schedule_test_deletions
from public, anon, authenticated;


grant select
on public.staff_schedule_test_deletions
to authenticated;


drop policy if exists
  "Owner view staff schedule test deletions"
on public.staff_schedule_test_deletions;


create policy
  "Owner view staff schedule test deletions"

on public.staff_schedule_test_deletions

for select
to authenticated

using (
  private.has_role('owner')
);



create or replace function public.owner_delete_staff_schedule_days(

  p_schedule_ids uuid[],

  p_reason text

)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_id uuid;

  v_schedule public.staff_work_schedules%rowtype;

  v_deleted_count integer :=
    0;

begin

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;


  if not private.has_role('owner') then
    raise exception 'Owner access required';
  end if;


  if p_schedule_ids is null
     or cardinality(p_schedule_ids)=0
  then
    raise exception 'Select at least one schedule day';
  end if;


  if nullif(
    trim(p_reason),
    ''
  ) is null then
    raise exception 'Delete reason is required';
  end if;


  foreach v_id
  in array p_schedule_ids
  loop

    select *
    into v_schedule

    from public.staff_work_schedules

    where id =
      v_id

    for update;


    if not found then
      continue;
    end if;


    insert into public.staff_schedule_test_deletions (

      schedule_id,

      staff_id,

      deleted_schedule,

      reason,

      deleted_by

    )

    values (

      v_schedule.id,

      v_schedule.staff_id,

      to_jsonb(v_schedule),

      trim(p_reason),

      auth.uid()

    );


    delete from public.staff_work_schedules

    where id =
      v_schedule.id;


    v_deleted_count :=
      v_deleted_count+1;

  end loop;


  return jsonb_build_object(

    'deleted',
      true,

    'deleted_count',
      v_deleted_count

  );

end;
$$;


revoke all
on function public.owner_delete_staff_schedule_days(
  uuid[],
  text
)
from public, anon;


grant execute
on function public.owner_delete_staff_schedule_days(
  uuid[],
  text
)
to authenticated;


notify pgrst, 'reload schema';


-- Verification
select
  routine_name

from information_schema.routines

where routine_schema='public'
  and routine_name=
    'owner_delete_staff_schedule_days';
