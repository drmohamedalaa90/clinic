# Owner Patient Controls + Secretary Schedule Editing

This patch adds the two requested Owner controls.

## Patients

On the Patients table, Owner now sees:

- Open
- Book
- Edit
- Delete

Edit allows:
- Arabic name
- English name
- year of birth
- gender
- mobile / WhatsApp
- residency area
- address

A reason for edit is mandatory.

Delete:
- is Owner-only
- asks for a reason and confirmation
- removes the patient's linked TEST appointments and known linked test records
- preserves a snapshot in `owner_patient_change_log`

The same Edit/Delete controls are also available inside the patient's profile.

## Secretary schedule

Attendance → Sara → Today → Weekly schedule

Owner now sees an **Edit** button beside every schedule row.

Edit allows:
- weekday
- start time
- end time
- late grace
- early-leave grace
- effective from
- effective until
- active / inactive
- notes

The existing `save_staff_work_schedule` RPC is used, passing the selected
schedule id, so this edits the row instead of creating a duplicate.

## Install

### Supabase
Run:
`sql/owner-patient-edit-delete.sql`

### GitHub
Replace:
- `js/patients.js`
- `js/attendance.js`

Then wait for GitHub Pages and press Ctrl + Shift + R.
