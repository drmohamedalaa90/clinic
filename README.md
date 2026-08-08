# Operation Clinic — Patient Demographics Fix

This patch fixes the patient registration and booking errors you showed.

## Changes

### Patient registration
The form is now:

- Arabic name
- English name
- **Year of birth** — not full date of birth
- Gender
- **Mobile**
- Address

Removed from the UI:

- Alternative phone
- Emergency contact

Existing historical values in old database columns are **not deleted**.

### Booking
The booking patient dropdown no longer requests a non-existent `patients.mobile`
column just to display the patient list.

### Clinical screens
Age is calculated from `birth_year`.
For old patients, the system can still fall back to the old `date_of_birth`
value if one exists.

## Installation order

### 1. Supabase
Run the full contents of:

`sql/patient-demographics-fix.sql`

It adds:

- `patients.mobile`
- `patients.birth_year`

and migrates compatible old values if available.

### 2. GitHub
Replace these files:

- `js/core.js`
- `js/patients.js`
- `js/appointments.js`
- `js/clinical.js`
- `sw.js`

### 3. Refresh
After GitHub Pages redeploys:

`Ctrl + Shift + R`

## Important
Do not paste the SQL filename into Supabase.
Open the `.sql` file and paste its actual contents.
