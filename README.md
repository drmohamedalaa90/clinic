# Operation Clinic — Fees + Finance Income + Missing Pages Fix

This patch fixes two separate issues.

## 1. Fees inside booking

The booking window now contains:

- Fees (EGP)
- Payment method:
  - Cash
  - InstaPay
  - Card
  - Bank transfer
  - Other

If Fees > 0, the booking and income record are saved together in one
database transaction.

The amount appears automatically in:

Finance → Income

with patient, doctor, date, amount and payment method.

## 2. Why Finance and Logistics were still placeholders

The pages were already written, but `app.html` never loaded these JavaScript
modules:

- `finance.js`
- `logistics.js`
- `attendance.js`
- `reports.js`
- `admin.js`
- `pwa.js`

So the sidebar existed, but ClinicPages had no renderer for those entries and
the app fell back to the placeholder page.

This patch fixes the wiring.

Finance, Logistics, Attendance, Reports, Profile / Users / Technical pages
will now actually load their existing frontend modules.

## Install

### Step 1 — Supabase
Run the FULL CONTENTS of:

`sql/booking-fees-income.sql`

Expected verification:
- table: `booking_income`
- four functions:
  - frontend_book_existing_patient_with_fee
  - frontend_create_patient_and_book_with_fee
  - frontend_booking_income_summary
  - void_booking_income

### Step 2 — GitHub
Replace:

- `app.html`
- `js/appointments.js`
- `js/finance.js`
- `js/logistics.js`
- `js/attendance.js`
- `js/reports.js`
- `js/admin.js`
- `js/pwa.js`
- `css/style.css`
- `sw.js`

### Step 3 — Refresh
Wait for GitHub Pages deployment and press:

Ctrl + Shift + R

## Important
A fee of 0 creates the booking without an income entry.
Any fee above 0 is recorded under Finance → Income.
