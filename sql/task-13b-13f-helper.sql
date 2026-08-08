-- =========================================================
-- OPERATION CLINIC — FRONTEND HELPER PATCH
-- Tasks 13B–13F
-- Run once in Supabase SQL Editor BEFORE using the V2 package.
-- It does not replace the existing security model; it exposes stable,
-- frontend-friendly RPC parameter names and a safe doctor list.
-- =========================================================

create or replace function public.list_active_doctors()
returns table (
  id uuid,
  display_name text,
  username text,
  photo_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.photo_url
  from public.profiles p
  where p.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id
        and ur.role = 'doctor'
    )
    and auth.uid() is not null
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.is_active = true
    )
  order by coalesce(p.display_name, p.username, p.email);
$$;

revoke all on function public.list_active_doctors() from public, anon;
grant execute on function public.list_active_doctors() to authenticated;

-- ---------- Available slots ----------
create or replace function public.frontend_get_available_slots(
  p_doctor uuid,
  p_day date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  local_start time,
  local_end time,
  slot_minutes integer,
  source text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.get_available_slots(p_doctor, p_day);
$$;
revoke all on function public.frontend_get_available_slots(uuid,date) from public, anon;
grant execute on function public.frontend_get_available_slots(uuid,date) to authenticated;

-- ---------- Appointments ----------
create or replace function public.frontend_book_appointment(
  p_patient uuid,
  p_doctor uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_type text,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select to_jsonb(x) from public.book_appointment(p_patient,p_doctor,p_start,p_end,p_type,p_note) x;
$$;

create or replace function public.frontend_cancel_appointment(p_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.cancel_appointment(p_id,p_reason) x; $$;

create or replace function public.frontend_reschedule_appointment(p_id uuid,p_start timestamptz,p_end timestamptz,p_reason text)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.reschedule_appointment(p_id,p_start,p_end,p_reason) x; $$;

create or replace function public.frontend_confirm_appointment(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.confirm_appointment(p_id) x; $$;

create or replace function public.frontend_check_in_appointment(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.check_in_appointment(p_id) x; $$;

create or replace function public.frontend_send_to_doctor(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.send_to_doctor(p_id) x; $$;

create or replace function public.frontend_mark_no_show(p_id uuid,p_reason text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.mark_appointment_no_show(p_id,p_reason) x; $$;

create or replace function public.frontend_start_consultation(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.start_consultation(p_id) x; $$;

create or replace function public.frontend_complete_consultation(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.complete_consultation(p_id) x; $$;

-- ---------- Clinical visit ----------
create or replace function public.frontend_open_clinical_visit(p_appointment uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.open_clinical_visit(p_appointment) x; $$;

create or replace function public.frontend_save_clinical_visit(p_visit uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.save_clinical_visit(p_visit,p_payload) x; $$;

create or replace function public.frontend_finalize_clinical_visit(p_visit uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.finalize_clinical_visit(p_visit) x; $$;

create or replace function public.frontend_add_clinical_amendment(p_visit uuid,p_text text)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.add_clinical_amendment(p_visit,p_text) x; $$;

-- ---------- Referrals ----------
create or replace function public.frontend_create_referral(
  p_visit uuid,
  p_to_doctor uuid,
  p_reason text,
  p_urgency text default 'routine',
  p_question text default null,
  p_note text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.create_referral(p_visit,p_to_doctor,p_reason,p_urgency,p_question,p_note) x; $$;

create or replace function public.frontend_accept_referral(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.accept_referral(p_id) x; $$;

create or replace function public.frontend_reject_referral(p_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.reject_referral(p_id,p_reason) x; $$;

create or replace function public.frontend_start_referral(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.start_referral(p_id) x; $$;

create or replace function public.frontend_complete_referral(p_id uuid,p_response text)
returns jsonb language sql security invoker set search_path = ''
as $$ select to_jsonb(x) from public.complete_referral(p_id,p_response) x; $$;

-- ---------- Clinical document ----------
create or replace function public.frontend_register_clinical_document(
  p_visit uuid,
  p_path text,
  p_filename text,
  p_mime text default null,
  p_bytes bigint default null,
  p_type text default null,
  p_note text default null,
  p_result uuid default null
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select to_jsonb(x) from public.register_clinical_document(p_visit,p_path,p_filename,p_mime,p_bytes,p_type,p_note,p_result) x;
$$;

-- ---------- Income summary ----------
create or replace function public.frontend_income_summary(p_from date,p_to date)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select to_jsonb(x) from public.get_income_summary(p_from,p_to) x; $$;

revoke all on function public.frontend_book_appointment(uuid,uuid,timestamptz,timestamptz,text,text) from public,anon;
revoke all on function public.frontend_cancel_appointment(uuid,text) from public,anon;
revoke all on function public.frontend_reschedule_appointment(uuid,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.frontend_confirm_appointment(uuid) from public,anon;
revoke all on function public.frontend_check_in_appointment(uuid) from public,anon;
revoke all on function public.frontend_send_to_doctor(uuid) from public,anon;
revoke all on function public.frontend_mark_no_show(uuid,text) from public,anon;
revoke all on function public.frontend_start_consultation(uuid) from public,anon;
revoke all on function public.frontend_complete_consultation(uuid) from public,anon;
revoke all on function public.frontend_open_clinical_visit(uuid) from public,anon;
revoke all on function public.frontend_save_clinical_visit(uuid,jsonb) from public,anon;
revoke all on function public.frontend_finalize_clinical_visit(uuid) from public,anon;
revoke all on function public.frontend_add_clinical_amendment(uuid,text) from public,anon;
revoke all on function public.frontend_create_referral(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.frontend_accept_referral(uuid) from public,anon;
revoke all on function public.frontend_reject_referral(uuid,text) from public,anon;
revoke all on function public.frontend_start_referral(uuid) from public,anon;
revoke all on function public.frontend_complete_referral(uuid,text) from public,anon;
revoke all on function public.frontend_register_clinical_document(uuid,text,text,text,bigint,text,text,uuid) from public,anon;
revoke all on function public.frontend_income_summary(date,date) from public,anon;

grant execute on function public.frontend_book_appointment(uuid,uuid,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.frontend_cancel_appointment(uuid,text) to authenticated;
grant execute on function public.frontend_reschedule_appointment(uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.frontend_confirm_appointment(uuid) to authenticated;
grant execute on function public.frontend_check_in_appointment(uuid) to authenticated;
grant execute on function public.frontend_send_to_doctor(uuid) to authenticated;
grant execute on function public.frontend_mark_no_show(uuid,text) to authenticated;
grant execute on function public.frontend_start_consultation(uuid) to authenticated;
grant execute on function public.frontend_complete_consultation(uuid) to authenticated;
grant execute on function public.frontend_open_clinical_visit(uuid) to authenticated;
grant execute on function public.frontend_save_clinical_visit(uuid,jsonb) to authenticated;
grant execute on function public.frontend_finalize_clinical_visit(uuid) to authenticated;
grant execute on function public.frontend_add_clinical_amendment(uuid,text) to authenticated;
grant execute on function public.frontend_create_referral(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.frontend_accept_referral(uuid) to authenticated;
grant execute on function public.frontend_reject_referral(uuid,text) to authenticated;
grant execute on function public.frontend_start_referral(uuid) to authenticated;
grant execute on function public.frontend_complete_referral(uuid,text) to authenticated;
grant execute on function public.frontend_register_clinical_document(uuid,text,text,text,bigint,text,text,uuid) to authenticated;
grant execute on function public.frontend_income_summary(date,date) to authenticated;

-- Verification
select routine_name
from information_schema.routines
where routine_schema='public'
  and (routine_name='list_active_doctors' or routine_name like 'frontend_%')
order by routine_name;
