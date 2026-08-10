# Alaa Clinic — Booking & Patient Workflow V2

This package handles all four requests together.

## 1. Duplicate push notifications — FIXED AT THE SOURCE

The currently deployed `sw.js` contains TWO separate `push` event listeners
(and TWO `notificationclick` listeners).

That is why one server push can create two visible notifications on the same
mobile device.

Replace the whole current `sw.js` with the `sw.js` in this package.

The replacement has:
- exactly ONE `push` listener
- exactly ONE `notificationclick` listener
- one booking tag per appointment
- `renotify: false`

Do NOT append the new code to the old sw.js. Replace the old file completely.

---

## 2. Public `book.html`

The patient is first asked:

**هل هذه أول زيارة للعيادة؟**

Choices:
- **مريض جديد**
- **زرت العيادة من قبل**

### New patient
Completes the normal demographic form and chooses date/time.

If the phone is already registered, the database blocks creation of a duplicate
patient and tells them to use the returning-patient path.

### Returning patient
Enters the SAME registered WhatsApp/mobile number.

For privacy, the public page does NOT reveal the complete patient record.
It confirms a masked match and then the patient chooses ONLY:
- date
- time

If more than one patient record shares the same phone number, year of birth is
requested to disambiguate.

A 15-minute opaque booking token links the public booking to the correct secured
patient record without exposing the patient UUID or full demographics.

---

## 3. Internal clinic booking — PHONE FIRST

Upload:

`js/booking-workflow-hotfix.js`

Then add it to `app.html` immediately after `js/appointments.js`.

Whenever the internal booking window opens:
- phone/mobile is the first lookup
- if the phone exists, the existing patient is selected automatically
- the MRN is shown internally
- **Open file** opens that patient's existing record
- if there are multiple patients with the same phone, staff choose the correct
  record
- if the phone is new, the New Patient form is selected and the phone is
  prefilled

---

## 4. Edit any booking BEFORE check-in

For Owner / Manager / Deputy Manager / Secretary:

Appointment Details now receives:

**Edit booking / تعديل بيانات الحجز**

It can revise:
- mobile / WhatsApp
- Arabic name
- optional English name
- birth year
- gender
- residency area
- address
- visit type
- booking notes

Date/time continues to use the existing **Reschedule** action so appointment
history remains clear.

Every pre-check-in edit is copied to `booking_precheckin_edits`.

Once checked in, booking data cannot be edited through this workflow.

---

## 5. Check-in automatically sends the patient file to the doctor

The updated `frontend_check_in_with_fee()` now does this in one transaction:

1. patient is checked in
2. fee/income is recorded
3. appointment is automatically sent to the assigned doctor's queue
4. status becomes `waiting`
5. patient ID + MRN remain attached to the appointment

The doctor already sees the patient's MRN on Today's Clinic / queue and can open
the patient file by clicking the patient.

Therefore the separate **Send to doctor** click after check-in is no longer
needed.

---

# INSTALL ORDER

## Supabase

Run:

`sql/booking-patient-workflow-v2.sql`

## GitHub

Replace:
- `book.html`
- `sw.js`

Upload:
- `js/booking-workflow-hotfix.js`

Then modify `app.html` using:
- `APP_HTML_INSERT.txt`

## IMPORTANT after replacing sw.js

Wait for GitHub Pages deployment.

On each device:
1. close the clinic tab/app
2. reopen it
3. hard refresh once on desktop
4. on iPhone/PWA, fully close and reopen the installed web app

The clean service worker must replace the previous version that had two push
listeners.
