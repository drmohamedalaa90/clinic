# Operation Clinic — Fees on Patient Arrival

This corrects the previous fee workflow.

## Correct process

Booking:
- patient details
- doctor
- hour
- appointment type
- notes
- **NO FEE**

When the patient physically arrives:

Reception clicks:

**Confirm arrival**

A second window appears:

- Fees (EGP)
- Payment method
- Optional finance note

After pressing Confirm arrival:

1. appointment becomes `arrived`
2. the fee is saved
3. Finance -> Income updates

This is done in one database transaction.

## Finance and Logistics

This package keeps the corrected `app.html` that actually loads:

- finance.js
- logistics.js
- attendance.js
- reports.js
- admin.js
- pwa.js

That was the reason those sidebar pages previously stayed as placeholders.

## Install

1. Run:
   `sql/fees-on-arrival.sql`

2. Replace in GitHub:
   - app.html
   - js/appointments.js
   - js/finance.js
   - js/logistics.js
   - js/attendance.js
   - js/reports.js
   - js/admin.js
   - js/pwa.js
   - css/style.css
   - sw.js

3. Commit and, after GitHub Pages redeploys, press:
   `Ctrl + Shift + R`
