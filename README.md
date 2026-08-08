# Operation Clinic — Appointment-First Two-Week Scheduler

This patch implements the requested workflow.

## What changed

### 1. Appointments are now the operational starting point

Sidebar order for booking-capable users is now:

1. Dashboard
2. **Appointments**
3. **Patients**
4. Reception
5. ...

Patient registration is no longer a necessary first step.

### 2. Patient data is entered during booking

Click an available time interval.

The booking window contains:

- Arabic name
- English name
- Year of birth
- Gender
- Mobile
- Address
- Appointment type
- Notes

The patient is created automatically and becomes visible in the **Patients**
window after the booking is saved.

There is also an **Existing patient** tab for follow-up bookings.

### 3. Appointment window is now a two-week scheduler

The screen displays:

- current clinic week, Saturday → Friday
- next clinic week, Saturday → Friday
- each slot as a time interval, for example:
  `15:00 – 15:15`
- available slots
- booked slots with patient name
- apology / vacation / emergency cancellation
- today's date
- appointment status

Click an available interval to book.

### 4. Schedule page no longer depends on fragile direct table reads

The schedule screen now uses controlled Supabase RPC functions for:

- reading working hours
- reading exceptions
- saving working hours
- activation / deactivation
- adding management exceptions
- doctor requests
- management approval/rejection

If a doctor's current account truly has no saved schedule, the page now says
that explicitly instead of rendering a blank white section.

## Install

### Step 1 — Supabase

Run the **FULL CONTENTS** of:

`sql/appointment-first-scheduler.sql`

The final result also shows:

`working_hour_rows`

for every current doctor.

This diagnostic is important after the recent doctor-account reassignment:
it will tell you exactly which current login owns the old saved schedule.

### Step 2 — GitHub

Replace:

- `js/core.js`
- `js/appointments.js`
- `js/schedules.js`
- `css/style.css`
- `sw.js`

### Step 3 — Refresh

Wait for GitHub Pages deployment and press:

`Ctrl + Shift + R`

## Important schedule note

If the schedule page now says:

`No working hours are saved for this doctor`

that is not a rendering failure.

The SQL verification table will show which doctor account owns the saved
working-hour rows. Because the doctor accounts were reassigned earlier,
old schedules may still belong to the old authentication UUID.
