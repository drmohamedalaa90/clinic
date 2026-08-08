# Operation Clinic — Patient Reset + Doctor Today/Tomorrow Home

## 1. Owner can reset ALL patients

Patients now has an Owner-only:

**Reset all patients**

It requires typing:

`RESET PATIENTS`

It clears all test patient-linked data first, then patients, and restarts the
patient MRN sequence.

The NEXT patient will be:

`OPC-000001`

Preserved:
- users / roles
- doctor working schedules
- schedule exceptions
- service price list
- logistics
- attendance

Because appointments, visits, referrals and patient invoices depend on patient
records, those patient-linked test records are removed too.

## 2. Doctor home page = Today's Clinic

After a Doctor logs in, the app now opens:

**Today's Clinic**

instead of Appointments.

Doctor sidebar starts with:
1. Today's Clinic
2. Appointments
3. My Queue
4. Patients
5. Referrals
6. My Schedule
7. Dashboard
8. My Profile

## 3. Today's Clinic stays active until 2 hours after clinic end

Example:
- clinic ends 18:00
- Today's Clinic remains the active doctor home through 20:00

After the 2-hour period, the same home page moves the focus to tomorrow.

## 4. Tomorrow's Clinic is always inside the doctor home page

The doctor can see:
- today's booked patients by hour
- status
- booked / waiting / completed counts
- tomorrow's clinic
- tomorrow's booked patients by hour

If today's clinic has already ended plus two hours, the page shows a brief
"Today's clinic has ended" card and puts Tomorrow's Clinic in focus.

## Install

### Supabase
Run the full contents of:

`sql/owner-reset-all-patients.sql`

### GitHub
Replace:
- `js/core.js`
- `js/patients.js`
- `js/appointments.js`
- `css/style.css`
- `sw.js`

Then wait for GitHub Pages and press:

`Ctrl + Shift + R`
