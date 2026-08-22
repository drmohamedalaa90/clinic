CLINIC V86 — EXTRA CASE FIX

Files:
1) app.html              -> replace repository app.html
2) clinic-v86-extra-case-day-list.js
   -> upload to js/clinic-v86-extra-case-day-list.js
3) clinic-v86-extra-case-enum-fix.sql
   -> run ONCE in the CLINIC Supabase SQL Editor

What this fixes:
- Removes the appointment_type enum/text error when booking an extra case.
- Keeps Examination = new and Consultation = follow_up.
- Shows extra/free-time cases in a separate block BELOW each day's normal hourly schedule.
- Existing hourly seats remain unchanged.
- Cancelled/rescheduled cases are not shown in the extra block.

Important:
The SQL step is required because the error shown in the screenshot is generated inside the database RPC, not in the browser.
