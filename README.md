# Dr Ahmed — checked-in patients + searchable diagnosis/notes

This patch uses your existing clinical visit system rather than creating a second
medical-record system.

## What changes

### Today's Clinic
When Dr Ahmed clicks HIS patient:

- Booked / confirmed -> opens patient profile only.
- Checked in / waiting -> starts the consultation and opens the editable clinical visit.
- Already with doctor -> reopens the same editable visit.
- Completed -> opens the visit read-only.

Inside the existing clinical visit he already has:
- Diagnosis summary
- Clinical notes
- Chief complaint/history
- Examination
- Work-up
- Treatment plan
- Follow-up
- Structured diagnoses
- Investigations
- Prescription

### Patients search
For doctors, the Patients search box becomes:

`Name / MRN / Mobile / Diagnosis / Notes`

Typing 2+ characters also searches the doctor's OWN clinical records and shows
a Clinical Search result area.

Searches include:
- diagnosis_summary
- chief_complaint
- clinical_notes
- history_present_illness
- examination
- treatment_plan
- follow_up_plan
- structured visit_diagnoses

Click:
- Open patient -> patient profile
- Open visit -> complete saved clinical note, read-only

### Privacy
Dr Ahmed's clinical search only searches visits where:
`clinical_visits.doctor_id = auth.uid()`

It does not give a doctor general access to another doctor's private clinical
notes.

## Install

1. Supabase SQL Editor:
   Run `sql/doctor-clinical-access.sql`

2. GitHub:
   Upload `js/doctor-clinical-workflow.js`

3. app.html:
   Add it immediately after `js/clinical.js` using `APP_HTML_INSERT.txt`

4. Commit and refresh the clinic once.
