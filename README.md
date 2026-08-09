# Operation Clinic — Five Requested Changes

This patch contains the five requested updates.

## 1. Arabic clinic name

`Operation Clinic` now displays in Arabic as:

**إدارة العيادة**

## 2. Sara attendance

Secretary attendance now includes:

- Check in
- Check out
- Check-in time
- Check-out time
- Duration in clinic
- Daily attendance history
- Weekly work schedule

Check-in / check-out buttons are shown only on laptop/desktop layout
(`>= 900px`). On mobile Sara sees her attendance information but cannot use
the attendance buttons.

Owner, Manager and Deputy Manager can open Attendance, choose the secretary,
see the weekly schedule, daily history, and manually adjust records.

## 3. Compact laptop booking popup

The internal booking window is now laid out in two columns on laptop:

- Appointment details + notes on one side
- Patient details on the other

Spacing, input height and headings are reduced on laptop so the normal booking
flow fits without vertical scrolling on ordinary laptop screens.

Mobile remains single-column.

## 4. Finance: all checked-in cases

Finance gets a first tab:

**Checked-in cases**

Every appointment with `checked_in_at` appears there even if the case later
moves to Waiting, With Doctor or Completed.

Each row shows:

- Patient
- Doctor
- Check-in date/time
- Current status
- Fee
- Payment method
- Last edit reason

Each row has **Edit**.

Editing:
- can change fee
- can change payment method
- can change finance note
- MUST include a reason

Every edit is saved in `booking_income_edits` with old/new values, user and
timestamp.

The existing Owner-only **Reset finance** control is preserved.

## 5. Duplicate booking notifications

The SQL:
- removes duplicate appointment status-history triggers
- creates exactly one canonical trigger
- removes existing duplicate status-history rows

The frontend also performs defensive booking de-duplication.

## 6. Checked-in color

Appointment status `arrived` / checked-in is now **red**, not violet.

## Installation

### Supabase

Run the full contents of:

`sql/clinic-five-changes.sql`

### GitHub

Replace:

- `js/core.js`
- `js/appointments.js`
- `js/attendance.js`
- `js/finance.js`
- `js/notifications.js`
- `css/style.css`
- `sw.js`

Then commit, wait for GitHub Pages deployment, and press:

`Ctrl + Shift + R`
