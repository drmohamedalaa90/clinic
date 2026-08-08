# Operation Clinic — Hourly Slots, 4 Patients per Hour

Requested workflow implemented:

## Appointment model

Instead of 15-minute slots:

- 15:00–16:00 = one hour
- 16:00–17:00 = one hour
- 17:00–18:00 = one hour

Each hour contains **4 patient places**.

Example:

15:00–16:00  
1. Ahmed Hassan  
2. Sara Ali  
3. Available  
4. Available  

The hour remains bookable until all four places are occupied.

## Doctor home page

For a doctor login:

**Appointments opens automatically after login.**

Doctor sidebar starts with:

1. Appointments
2. Dashboard
3. Today's Clinic
4. My Queue
5. Patients
6. Referrals
7. My Schedule

Doctors can also create a booking in their own appointment schedule.

## Schedule management

The old slot-duration control is removed from the interface.

Every working-hours rule now means:

**1 hour = up to 4 patients**

Existing working hours and extra/changed clinic rules are migrated to 60-minute slots by the SQL patch.

## Install

### 1. Supabase

Run the full contents of:

`sql/hourly-capacity4.sql`

This is required because the database previously prevented overlapping appointments.

### 2. GitHub

Replace:

- `js/core.js`
- `js/appointments.js`
- `js/schedules.js`
- `css/style.css`
- `sw.js`

### 3. Refresh

Wait for GitHub Pages deployment, then:

`Ctrl + Shift + R`

## Important

The SQL safely changes appointment capacity from **1 to 4 per doctor/hour**.

Cancelled and rescheduled appointments do not consume capacity.
