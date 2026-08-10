# Live booking updates

This patch makes the logged-in clinic site update automatically when an
appointment is inserted, updated, cancelled, rescheduled, checked in, etc.

It works regardless of where the booking/change originated:

- public `book.html`
- secretary
- owner
- manager / deputy
- internal clinic booking window

The browser listens directly to Supabase Realtime `postgres_changes`.

## Pages refreshed automatically

- Dashboard
- Appointments
- Doctor appointments
- Today's Clinic
- Queue
- Reception
- Patients
- Patient detail
- Finance

The notification drawer count is refreshed too.

## Important UX behavior

If a user is currently typing inside a modal, realtime will NOT destroy the
form. The refresh is deferred until the modal closes.

If the browser tab is in the background, the refresh is deferred until the
user returns to it.

## Install

1. Run:
   `sql/enable-realtime-bookings.sql`

2. Upload:
   `js/realtime-sync.js`

3. Add to `app.html`:
   `<script src="js/realtime-sync.js"></script>`

4. Commit and refresh the clinic once.

No service-worker change is required for this feature.
