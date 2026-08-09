# Operation Clinic — Round 2 Five Fixes

This package addresses the five items from the 09/08/2026 review.

## 1. Calendar — all weeks

Appointments is no longer limited to only the current two weeks.

The calendar now has:

- Previous
- Current week
- Next
- Jump to any date

The existing two-week block remains, but the block can be shifted indefinitely
backward or forward, so old and future weeks are accessible.

## 2. Home dashboard — live / cancellation-correct

A new Supabase RPC calculates the dashboard from the database every time.

Cancelled/rescheduled appointments are no longer counted as active today's
appointments.

Today's income comes from non-voided booking income actually received today.

While the Dashboard is open it refreshes approximately every 12 seconds, so:
- cancellation
- check-in
- waiting/completed status
- today's income
- pending logistics

do not remain stale.

## 3. Sara home page

Secretary users now enter directly into:

Appointments / Booking

after login.

Her side menu also starts with Appointments. Dashboard remains available later
in the menu.

## 4. Owner — all historical patients/bookings

Owner navigation gets:

Admin Records / السجلات الإدارية

It displays:
- all historical appointments
- all historical patients
- search by patient / MRN / appointment number / mobile

Owner can individually:
- edit a patient
- edit appointment doctor/date/time/type/status
- delete one test appointment
- delete one test patient and its linked test records

Edit and delete actions require a reason and are written to the audit log when
the audit table is present.

The old bulk test resets remain unchanged.

## 5. Sara attendance repair

The screenshot error:

`permission denied for function can_manage_attendance`

is addressed in SQL.

The patch:
- grants the attendance RLS helper the EXECUTE privilege required by its own
  RLS policies
- exposes a secure Today attendance RPC
- stops the frontend from directly querying today's attendance row
- adds dedicated Secretary self-service check-in/check-out RPCs
- removes the failing direct RLS read from the Today card

Sara's desktop Check In / Check Out controls are shown even when a weekly
schedule has not yet been configured. If no schedule exists, she can still
check in/out and late/early minutes remain zero. Mobile remains view-only.

## Install

### Supabase

Run the entire file:

`sql/clinic-round2-five-fixes.sql`

### GitHub

Replace:

- `js/core.js`
- `js/appointments.js`
- `js/dashboard.js`
- `js/attendance.js`
- `js/patients.js`
- `css/style.css`
- `sw.js`

No app.html change is needed because dashboard.js and patients.js are already
loaded by your current app.html.

After GitHub Pages deploys, press:

`Ctrl + Shift + R`
