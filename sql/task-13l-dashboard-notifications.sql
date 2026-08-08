-- =========================================================
-- OPERATION CLINIC
-- TASK 13L — ROLE-AWARE DASHBOARD NOTIFICATIONS
--
-- Adds:
-- • persistent per-user read/unread state
-- • categorized dashboard notification feed
-- • global approved doctor-apology alerts
-- • logistics "deficiency" flag visible to all active staff
-- • bookings / finance / referrals / attendance alerts
-- =========================================================

-- ---------------------------------------------------------
-- 1. LOGISTICS DEFICIENCY FLAG
-- ---------------------------------------------------------
alter table public.logistics_requests
  add column if not exists is_deficiency boolean not null default false,
  add column if not exists deficiency_note text,
  add column if not exists deficiency_marked_at timestamptz,
  add column if not exists deficiency_marked_by uuid
    references public.profiles(id) on delete set null;

create index if not exists logistics_deficiency_idx
  on public.logistics_requests(is_deficiency, status, updated_at desc)
  where is_deficiency = true;


-- ---------------------------------------------------------
-- 2. PERSISTENT READ / UNREAD STATE
-- ---------------------------------------------------------
create table if not exists public.user_notification_reads (
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

create index if not exists user_notification_reads_time_idx
  on public.user_notification_reads(user_id, read_at desc);

alter table public.user_notification_reads enable row level security;

revoke all on public.user_notification_reads from public, anon, authenticated;


-- ---------------------------------------------------------
-- 3. MARK / CLEAR LOGISTICS DEFICIENCY
-- Secretary + Owner + Manager + Deputy Manager
-- ---------------------------------------------------------
create or replace function public.set_logistics_deficiency(
  p_request_id uuid,
  p_is_deficiency boolean,
  p_note text default null
)
returns public.logistics_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.logistics_requests%rowtype;
begin
  if auth.uid() is null or not private.can_manage_finance() then
    raise exception 'Clinic operations access required';
  end if;

  select *
  into v
  from public.logistics_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Logistics request not found';
  end if;

  if p_is_deficiency
     and v.status in ('completed','rejected','cancelled')
  then
    raise exception 'A closed logistics request cannot be marked as a deficiency';
  end if;

  update public.logistics_requests
  set
    is_deficiency = coalesce(p_is_deficiency, false),
    deficiency_note =
      case
        when coalesce(p_is_deficiency, false)
          then nullif(trim(p_note), '')
        else null
      end,
    deficiency_marked_at =
      case
        when coalesce(p_is_deficiency, false)
          then now()
        else null
      end,
    deficiency_marked_by =
      case
        when coalesce(p_is_deficiency, false)
          then auth.uid()
        else null
      end,
    updated_at = now()
  where id = p_request_id
  returning * into v;

  return v;
end;
$$;

revoke all on function public.set_logistics_deficiency(uuid,boolean,text)
from public, anon;

grant execute on function public.set_logistics_deficiency(uuid,boolean,text)
to authenticated;


-- ---------------------------------------------------------
-- 4. ROLE-AWARE NOTIFICATION FEED
--
-- Categories:
-- booking
-- finance
-- logistics
-- apology
-- referral
-- attendance
-- ---------------------------------------------------------
create or replace function public.get_dashboard_notifications(
  p_limit integer default 60
)
returns table (
  notification_key text,
  category text,
  priority integer,
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  event_time timestamptz,
  target_page text,
  entity_id uuid,
  is_read boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_is_doctor boolean := false;
  v_is_management boolean := false;
  v_is_reception boolean := false;
  v_is_secretary boolean := false;
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 100));
  v_today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.is_active = true
  )
  into v_is_staff;

  if not v_is_staff then
    raise exception 'Active clinic staff account required';
  end if;

  v_is_doctor := private.has_role('doctor');
  v_is_secretary := private.has_role('secretary');

  v_is_management :=
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager');

  v_is_reception := v_is_management or v_is_secretary;

  return query
  with feed as (

    -- =====================================================
    -- A. APPROVED APOLOGIES / CANCELLATIONS
    -- Visible to ALL active clinic members.
    -- =====================================================
    select
      (
        'apology:' || se.id::text || ':' ||
        se.status::text || ':' ||
        coalesce(extract(epoch from se.reviewed_at)::bigint::text, '0')
      )::text as notification_key,

      'apology'::text as category,

      case se.exception_type::text
        when 'emergency_cancellation' then 100
        when 'apology' then 96
        when 'vacation' then 92
        else 86
      end::integer as priority,

      case se.exception_type::text
        when 'emergency_cancellation' then 'Emergency clinic cancellation'
        when 'vacation' then 'Doctor unavailable'
        when 'changed_hours' then 'Clinic hours changed'
        else 'Doctor apology'
      end::text as title_en,

      case se.exception_type::text
        when 'emergency_cancellation' then 'إلغاء طارئ للعيادة'
        when 'vacation' then 'الطبيب غير متاح'
        when 'changed_hours' then 'تم تغيير مواعيد العيادة'
        else 'اعتذار الطبيب'
      end::text as title_ar,

      (
        coalesce(dp.display_name, 'Doctor') ||
        ' • ' ||
        to_char(se.exception_date, 'DD Mon YYYY') ||
        case
          when se.start_time is not null and se.end_time is not null
            then ' • ' || to_char(se.start_time, 'HH24:MI') ||
                 '–' || to_char(se.end_time, 'HH24:MI')
          else ''
        end
      )::text as body_en,

      (
        coalesce(dp.display_name, 'الطبيب') ||
        ' • ' ||
        to_char(se.exception_date, 'YYYY-MM-DD') ||
        case
          when se.start_time is not null and se.end_time is not null
            then ' • ' || to_char(se.start_time, 'HH24:MI') ||
                 '–' || to_char(se.end_time, 'HH24:MI')
          else ''
        end
      )::text as body_ar,

      coalesce(se.reviewed_at, se.created_at)::timestamptz as event_time,

      case
        when v_is_management then 'schedules'
        when v_is_doctor and se.doctor_id = v_uid then 'my-schedule'
        else 'dashboard'
      end::text as target_page,

      se.id::uuid as entity_id

    from public.doctor_schedule_exceptions se
    join public.profiles dp
      on dp.id = se.doctor_id
    where se.status = 'approved'
      and se.exception_type::text in (
        'apology',
        'vacation',
        'emergency_cancellation',
        'changed_hours'
      )
      and se.exception_date between (v_today - 1) and (v_today + 30)


    union all


    -- =====================================================
    -- B. PENDING APOLOGY / SCHEDULE REQUESTS
    -- Management only.
    -- =====================================================
    select
      ('apology-request:' || se.id::text)::text,
      'apology'::text,
      90::integer,
      'Schedule request awaiting review'::text,
      'طلب جدول / اعتذار بانتظار المراجعة'::text,
      (
        coalesce(dp.display_name, 'Doctor') ||
        ' • ' ||
        replace(se.exception_type::text, '_', ' ') ||
        ' • ' ||
        to_char(se.exception_date, 'DD Mon YYYY')
      )::text,
      (
        coalesce(dp.display_name, 'الطبيب') ||
        ' • ' ||
        replace(se.exception_type::text, '_', ' ') ||
        ' • ' ||
        to_char(se.exception_date, 'YYYY-MM-DD')
      )::text,
      se.created_at::timestamptz,
      'schedules'::text,
      se.id::uuid
    from public.doctor_schedule_exceptions se
    join public.profiles dp
      on dp.id = se.doctor_id
    where v_is_management
      and se.status = 'pending'
      and se.created_at >= now() - interval '14 days'


    union all


    -- =====================================================
    -- C. DOCTOR'S OWN REJECTED SCHEDULE REQUEST
    -- =====================================================
    select
      (
        'apology-decision:' || se.id::text || ':' ||
        se.status::text || ':' ||
        coalesce(extract(epoch from se.reviewed_at)::bigint::text, '0')
      )::text,
      'apology'::text,
      82::integer,
      'Schedule request rejected'::text,
      'تم رفض طلب الجدول / الاعتذار'::text,
      (
        replace(se.exception_type::text, '_', ' ') ||
        ' • ' || to_char(se.exception_date, 'DD Mon YYYY') ||
        coalesce(' • ' || nullif(se.note, ''), '')
      )::text,
      (
        replace(se.exception_type::text, '_', ' ') ||
        ' • ' || to_char(se.exception_date, 'YYYY-MM-DD') ||
        coalesce(' • ' || nullif(se.note, ''), '')
      )::text,
      coalesce(se.reviewed_at, se.created_at)::timestamptz,
      'my-schedule'::text,
      se.id::uuid
    from public.doctor_schedule_exceptions se
    where v_is_doctor
      and se.doctor_id = v_uid
      and se.status = 'rejected'
      and coalesce(se.reviewed_at, se.created_at) >= now() - interval '14 days'


    union all


    -- =====================================================
    -- D. LOGISTICS DEFICIENCIES
    -- Visible to ALL active clinic members.
    -- No financial figures are exposed here.
    -- =====================================================
    select
      (
        'logistics-deficiency:' || lr.id::text || ':' ||
        extract(epoch from lr.updated_at)::bigint::text
      )::text,
      'logistics'::text,
      case when lr.urgency = 'urgent' then 98 else 88 end::integer,
      'Logistics deficiency'::text,
      'نقص / مشكلة لوجستية'::text,
      (
        lr.item_name ||
        ' • ' ||
        replace(lr.status::text, '_', ' ') ||
        coalesce(' • ' || nullif(lr.deficiency_note, ''), '')
      )::text,
      (
        lr.item_name ||
        ' • ' ||
        replace(lr.status::text, '_', ' ') ||
        coalesce(' • ' || nullif(lr.deficiency_note, ''), '')
      )::text,
      coalesce(lr.deficiency_marked_at, lr.updated_at, lr.requested_at)::timestamptz,
      case when v_is_reception then 'logistics' else 'dashboard' end::text,
      lr.id::uuid
    from public.logistics_requests lr
    where lr.is_deficiency = true
      and lr.status not in ('completed','rejected','cancelled')


    union all


    -- =====================================================
    -- E. BOOKINGS / RECEPTION EVENTS
    -- Reception sees all.
    -- Doctors see only their own appointments.
    -- =====================================================
    select
      ('booking:' || h.id::text)::text,
      'booking'::text,
      case h.new_status::text
        when 'waiting' then 99
        when 'arrived' then 94
        when 'cancelled' then 84
        when 'rescheduled' then 82
        when 'no_show' then 80
        when 'booked' then 72
        when 'confirmed' then 68
        else 60
      end::integer,

      case h.new_status::text
        when 'booked' then 'New booking'
        when 'confirmed' then 'Booking confirmed'
        when 'arrived' then 'Patient arrived'
        when 'waiting' then 'Patient waiting'
        when 'with_doctor' then 'Consultation started'
        when 'completed' then 'Consultation completed'
        when 'cancelled' then 'Booking cancelled'
        when 'rescheduled' then 'Booking rescheduled'
        when 'no_show' then 'Patient no-show'
        else 'Booking update'
      end::text,

      case h.new_status::text
        when 'booked' then 'حجز جديد'
        when 'confirmed' then 'تم تأكيد الحجز'
        when 'arrived' then 'وصل المريض'
        when 'waiting' then 'المريض في الانتظار'
        when 'with_doctor' then 'بدأ الكشف'
        when 'completed' then 'اكتمل الكشف'
        when 'cancelled' then 'تم إلغاء الحجز'
        when 'rescheduled' then 'تم تغيير موعد الحجز'
        when 'no_show' then 'المريض لم يحضر'
        else 'تحديث الحجز'
      end::text,

      (
        coalesce(nullif(pt.english_name, ''), nullif(pt.arabic_name, ''), a.appointment_number) ||
        ' • ' ||
        coalesce(dp.display_name, 'Doctor') ||
        ' • ' ||
        to_char(a.scheduled_start at time zone 'Africa/Cairo', 'DD Mon HH24:MI')
      )::text,

      (
        coalesce(nullif(pt.arabic_name, ''), nullif(pt.english_name, ''), a.appointment_number) ||
        ' • ' ||
        coalesce(dp.display_name, 'الطبيب') ||
        ' • ' ||
        to_char(a.scheduled_start at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI')
      )::text,

      h.changed_at::timestamptz,

      case
        when v_is_doctor and not v_is_reception then
          case when h.new_status = 'waiting' then 'queue' else 'doctor-appointments' end
        else
          'reception'
      end::text,

      a.id::uuid

    from public.appointment_status_history h
    join public.appointments a
      on a.id = h.appointment_id
    join public.profiles dp
      on dp.id = a.doctor_id
    left join public.patients pt
      on pt.id = a.patient_id
    where h.changed_at >= now() - interval '7 days'
      and (
        v_is_reception
        or
        (v_is_doctor and a.doctor_id = v_uid)
      )


    union all


    -- =====================================================
    -- F. FINANCE — PAYMENT RECEIVED
    -- Finance/reception roles only.
    -- =====================================================
    select
      ('finance-payment:' || ip.id::text)::text,
      'finance'::text,
      64::integer,
      'Payment received'::text,
      'تم استلام دفعة'::text,
      (
        i.invoice_number ||
        ' • ' ||
        trim(to_char(ip.amount, 'FM999999990.00')) ||
        ' EGP • ' ||
        replace(ip.payment_method::text, '_', ' ')
      )::text,
      (
        i.invoice_number ||
        ' • ' ||
        trim(to_char(ip.amount, 'FM999999990.00')) ||
        ' EGP • ' ||
        replace(ip.payment_method::text, '_', ' ')
      )::text,
      ip.received_at::timestamptz,
      'finance'::text,
      i.id::uuid
    from public.invoice_payments ip
    join public.invoices i
      on i.id = ip.invoice_id
    where v_is_reception
      and ip.is_voided = false
      and ip.received_at >= now() - interval '7 days'


    union all


    -- =====================================================
    -- G. FINANCE — OUTSTANDING BALANCE
    -- =====================================================
    select
      (
        'finance-balance:' || i.id::text || ':' ||
        extract(epoch from i.updated_at)::bigint::text
      )::text,
      'finance'::text,
      70::integer,
      'Outstanding invoice balance'::text,
      'رصيد فاتورة مستحق'::text,
      (
        i.invoice_number ||
        ' • Balance ' ||
        trim(to_char(i.balance_due, 'FM999999990.00')) ||
        ' EGP'
      )::text,
      (
        i.invoice_number ||
        ' • المتبقي ' ||
        trim(to_char(i.balance_due, 'FM999999990.00')) ||
        ' EGP'
      )::text,
      i.updated_at::timestamptz,
      'finance'::text,
      i.id::uuid
    from public.invoices i
    where v_is_reception
      and i.status in ('open','partially_paid')
      and i.balance_due > 0
      and i.updated_at >= now() - interval '14 days'


    union all


    -- =====================================================
    -- H. REFERRALS — involved doctors only
    -- =====================================================
    select
      (
        'referral:' || r.id::text || ':' || r.status::text || ':' ||
        extract(epoch from r.updated_at)::bigint::text
      )::text,
      'referral'::text,
      case
        when r.status = 'pending' and r.urgency = 'urgent' then 97
        when r.status = 'pending' then 83
        when r.status = 'completed' then 78
        else 66
      end::integer,

      case r.status::text
        when 'pending' then
          case when r.urgency = 'urgent' then 'Urgent referral' else 'New referral' end
        when 'accepted' then 'Referral accepted'
        when 'in_progress' then 'Referral in progress'
        when 'completed' then 'Referral completed'
        when 'rejected' then 'Referral rejected'
        else 'Referral update'
      end::text,

      case r.status::text
        when 'pending' then
          case when r.urgency = 'urgent' then 'تحويل عاجل' else 'تحويل جديد' end
        when 'accepted' then 'تم قبول التحويل'
        when 'in_progress' then 'التحويل قيد المراجعة'
        when 'completed' then 'اكتمل التحويل'
        when 'rejected' then 'تم رفض التحويل'
        else 'تحديث التحويل'
      end::text,

      (
        coalesce(nullif(pt.english_name, ''), nullif(pt.arabic_name, ''), 'Patient') ||
        ' • ' ||
        coalesce(fd.display_name, 'Doctor') ||
        ' → ' ||
        coalesce(td.display_name, 'Doctor')
      )::text,

      (
        coalesce(nullif(pt.arabic_name, ''), nullif(pt.english_name, ''), 'المريض') ||
        ' • ' ||
        coalesce(fd.display_name, 'الطبيب') ||
        ' ←→ ' ||
        coalesce(td.display_name, 'الطبيب')
      )::text,

      r.updated_at::timestamptz,
      'referrals'::text,
      r.id::uuid

    from public.referrals r
    join public.profiles fd on fd.id = r.from_doctor_id
    join public.profiles td on td.id = r.to_doctor_id
    left join public.patients pt on pt.id = r.patient_id
    where v_is_doctor
      and (r.from_doctor_id = v_uid or r.to_doctor_id = v_uid)
      and r.updated_at >= now() - interval '14 days'


    union all


    -- =====================================================
    -- I. ATTENDANCE / LEAVE
    -- Management: pending leave.
    -- Secretary: own reviewed leave.
    -- =====================================================
    select
      ('attendance-leave-pending:' || lr.id::text)::text,
      'attendance'::text,
      58::integer,
      'Leave request awaiting review'::text,
      'طلب إجازة بانتظار المراجعة'::text,
      (
        coalesce(p.display_name, 'Staff') ||
        ' • ' ||
        to_char(lr.start_date, 'DD Mon YYYY') ||
        ' → ' ||
        to_char(lr.end_date, 'DD Mon YYYY')
      )::text,
      (
        coalesce(p.display_name, 'الموظف') ||
        ' • ' ||
        to_char(lr.start_date, 'YYYY-MM-DD') ||
        ' → ' ||
        to_char(lr.end_date, 'YYYY-MM-DD')
      )::text,
      lr.requested_at::timestamptz,
      'attendance'::text,
      lr.id::uuid
    from public.staff_leave_requests lr
    join public.profiles p on p.id = lr.staff_id
    where v_is_management
      and lr.status = 'pending'
      and lr.requested_at >= now() - interval '30 days'


    union all


    select
      (
        'attendance-leave-decision:' || lr.id::text || ':' ||
        lr.status::text || ':' ||
        coalesce(extract(epoch from lr.reviewed_at)::bigint::text, '0')
      )::text,
      'attendance'::text,
      56::integer,
      case when lr.status = 'approved'
        then 'Leave approved'
        else 'Leave rejected'
      end::text,
      case when lr.status = 'approved'
        then 'تمت الموافقة على الإجازة'
        else 'تم رفض الإجازة'
      end::text,
      (
        to_char(lr.start_date, 'DD Mon YYYY') ||
        ' → ' ||
        to_char(lr.end_date, 'DD Mon YYYY')
      )::text,
      (
        to_char(lr.start_date, 'YYYY-MM-DD') ||
        ' → ' ||
        to_char(lr.end_date, 'YYYY-MM-DD')
      )::text,
      coalesce(lr.reviewed_at, lr.updated_at)::timestamptz,
      'attendance'::text,
      lr.id::uuid
    from public.staff_leave_requests lr
    where v_is_secretary
      and lr.staff_id = v_uid
      and lr.status in ('approved','rejected')
      and coalesce(lr.reviewed_at, lr.updated_at) >= now() - interval '30 days'

  )

  select
    f.notification_key,
    f.category,
    f.priority,
    f.title_en,
    f.title_ar,
    f.body_en,
    f.body_ar,
    f.event_time,
    f.target_page,
    f.entity_id,
    exists (
      select 1
      from public.user_notification_reads nr
      where nr.user_id = v_uid
        and nr.notification_key = f.notification_key
    ) as is_read
  from feed f
  order by
    f.priority desc,
    f.event_time desc
  limit v_limit;
end;
$$;

revoke all on function public.get_dashboard_notifications(integer)
from public, anon;

grant execute on function public.get_dashboard_notifications(integer)
to authenticated;


-- ---------------------------------------------------------
-- 5. MARK ONE NOTIFICATION READ
-- ---------------------------------------------------------
create or replace function public.mark_dashboard_notification_read(
  p_notification_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_notification_key), '') is null then
    raise exception 'Notification key is required';
  end if;

  insert into public.user_notification_reads(
    user_id,
    notification_key,
    read_at
  )
  values (
    auth.uid(),
    trim(p_notification_key),
    now()
  )
  on conflict (user_id, notification_key)
  do update set read_at = excluded.read_at;
end;
$$;

revoke all on function public.mark_dashboard_notification_read(text)
from public, anon;

grant execute on function public.mark_dashboard_notification_read(text)
to authenticated;


-- ---------------------------------------------------------
-- 6. MARK MANY / ALL CURRENT NOTIFICATIONS READ
-- ---------------------------------------------------------
create or replace function public.mark_dashboard_notifications_read(
  p_notification_keys text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_notification_keys is null
     or cardinality(p_notification_keys) = 0
  then
    return 0;
  end if;

  insert into public.user_notification_reads(
    user_id,
    notification_key,
    read_at
  )
  select
    auth.uid(),
    trim(k),
    now()
  from unnest(p_notification_keys) as k
  where nullif(trim(k), '') is not null
  on conflict (user_id, notification_key)
  do update set read_at = excluded.read_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_dashboard_notifications_read(text[])
from public, anon;

grant execute on function public.mark_dashboard_notifications_read(text[])
to authenticated;


-- ---------------------------------------------------------
-- DONE
-- ---------------------------------------------------------
