# ALAA CLINIC V31 — Workflow / Chat / Fees / Doctor Finance

This patch is designed around the current live GitHub code as reviewed on
10 Aug 2026.

## Fixes

1. Dr Ahmed clinical workflow
   - Confirmation is required before check-in.
   - Check-in automatically places the patient in the assigned doctor's queue.
   - No separate "Send to doctor" step is needed for new check-ins.
   - Clicking a checked-in patient from Today's Clinic opens/starts the clinical visit.
   - Diagnosis summary and clinical notes are editable while the visit is a draft.
   - New one-click `Save & close consultation` saves, finalizes and completes the visit.
   - Diagnosis/notes become searchable later from Patients.

2. Internal chat
   - Doctors can chat with doctors and the secretary.
   - Secretary can chat with doctors.
   - Owner has a read-only audit view of every conversation.

3. Past slots
   - Database rejects bookings/reschedules whose slot start already passed.
   - Internal appointment UI disables/removes passed slots.
   - Public booking helper removes passed slots from self-booking.

4. Check-in fees
   - كشف / Examination = 350 EGP
   - استشارة / Follow-up consultation = 150 EGP
   - Fee field is pre-filled automatically.
   - If changed, a reason becomes mandatory.
   - Database also rejects a non-standard initial fee without a reason.
   - Existing Finance fee-edit workflow already requires an edit reason.

5. Doctor finance
   - Doctors get a Finance menu.
   - Doctor view is READ ONLY and shows only that doctor's own cases/income.
   - Day / month / all-time filters.

6. Appointment workflow shown in Appointment Details
   - Booked
   - Confirm information
   - Check-in
   - Consultation
   - Close

## Install

### 1. Supabase
Run:
`sql/clinic-v31-workflow.sql`

Run it once as one block.

### 2. GitHub
Upload:
- `js/clinic-workflow-v31.js`
- `js/public-booking-time-guard.js`

### 3. app.html
Either replace with the supplied `app.html`, or follow `APP_HTML_INSERT.txt`.

### 4. book.html
Follow `BOOK_HTML_INSERT.txt` to load the public time guard.

### 5. Commit
Commit all changed files together.

### 6. Refresh
Desktop: Ctrl + Shift + R once.
Phones/tablets: fully close and reopen the clinic PWA/site once.

## Important workflow after V31

Appointment created
→ patient arrives
→ Confirm information
→ Check in + fee
→ automatically enters assigned doctor's queue
→ doctor opens patient
→ writes diagnosis / notes
→ Save & close consultation
→ status Completed
→ visit remains searchable in Patients
