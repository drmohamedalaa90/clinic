CLINIC V82 — RESTORE NEW PATIENT IN EXTRA CASE

Replace:
1. app.html
2. js/clinic-v82-extra-case-new-patient.js

NO SQL.

What changes:
- Adds two clear choices in Add Extra Case:
  * Existing patient
  * + New patient
- New patient form includes:
  Arabic name, English name, birth year, gender, mobile, address.
- New patient is created in the normal patients table first.
- Then the same existing frontend_book_extra_case RPC books the extra case.
- Existing-patient search by name / MRN / mobile remains.
- No new backend function is required.
