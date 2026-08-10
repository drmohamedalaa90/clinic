-- =========================================================
-- ALAA CLINIC
-- APPOINTMENT INFORMATION CONFIRMATION
-- =========================================================


alter table public.appointments

  add column if not exists
    information_confirmed_at timestamptz,

  add column if not exists
    information_confirmed_by uuid
      references public.profiles(id)
      on delete set null;



create or replace function public.frontend_confirm_appointment_information(
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_appointment public.appointments%rowtype;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
    or private.has_role('doctor')
  ) then

    raise exception
      'Clinic staff access required';

  end if;


  select *

  into v_appointment

  from public.appointments

  where id=
    p_appointment_id

  for update;


  if not found then
    raise exception
      'Appointment not found';
  end if;


  if v_appointment.status not in (
    'booked',
    'confirmed'
  ) then

    raise exception
      'Information can only be confirmed before check-in';

  end if;


  update public.appointments

  set
    information_confirmed_at=
      now(),

    information_confirmed_by=
      auth.uid(),

    updated_at=
      now()

  where id=
    p_appointment_id;


  return jsonb_build_object(
    'success',
      true,

    'appointment_id',
      p_appointment_id,

    'information_confirmed_at',
      now(),

    'information_confirmed_by',
      auth.uid()
  );

end;
$$;


revoke all
on function public.frontend_confirm_appointment_information(uuid)
from public, anon;


grant execute
on function public.frontend_confirm_appointment_information(uuid)
to authenticated;



create or replace function public.frontend_clear_appointment_information_confirmation(
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_status text;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
    or private.has_role('secretary')
  ) then

    raise exception
      'Reception access required';

  end if;


  select status::text

  into v_status

  from public.appointments

  where id=
    p_appointment_id

  for update;


  if not found then
    raise exception
      'Appointment not found';
  end if;


  if v_status not in (
    'booked',
    'confirmed'
  ) then

    raise exception
      'Booking can no longer be edited';

  end if;


  update public.appointments

  set
    information_confirmed_at=
      null,

    information_confirmed_by=
      null,

    updated_at=
      now()

  where id=
    p_appointment_id;


  return jsonb_build_object(
    'success',
      true,

    'appointment_id',
      p_appointment_id
  );

end;
$$;


revoke all
on function public.frontend_clear_appointment_information_confirmation(uuid)
from public, anon;


grant execute
on function public.frontend_clear_appointment_information_confirmation(uuid)
to authenticated;



notify pgrst, 'reload schema';


-- VERIFY
select
  column_name,
  data_type

from information_schema.columns

where table_schema='public'
  and table_name='appointments'
  and column_name in (
    'information_confirmed_at',
    'information_confirmed_by'
  )

order by column_name;
