# V29 CLEAN FIX

This replaces the last patch.

## What it fixes

### Appointment popup
Outside the confirmation modal:
- ONE `Confirm information`
- Check in
- Reschedule
- No-show
- Cancel

There is NO separate Edit booking button outside.

Inside `Confirm information`:
- review patient + appointment information
- `Information is correct`
- `Edit booking`

The editor opens directly from inside the confirmation modal.

The duplicate Confirm button was caused by a MutationObserver race:
multiple async calls started before the old script marked the card as ready.
V29 locks the card BEFORE the database await.

### Laptop auto-update
V29 uses:
- Supabase Realtime INSERT listener
- 3-second appointment polling fallback

When a NEW appointment is detected, the browser performs a real
`window.location.reload()` automatically (deferred only if a modal is open).

### iPhone double push
V29:
- recognizes appointmentId / appointment_id / appointment
- searches the whole payload for a UUID as a final fallback
- de-duplicates the same appointment for 5 minutes
- has an extra 2.5-second booking cooldown when old payloads contain no ID
- registers a fresh service worker URL: `sw.js?v=29-clean`

## Install

Replace:
- `app.html`
- `sw.js`
- `js/pwa.js`
- `js/booking-workflow-hotfix.js`
- `js/appointment-information-confirm.js`
- `js/clinic-final-live-fixes.js`

If you already ran the appointment confirmation SQL, do NOT run it again.
If not, run:
`appointment-information-confirmation.sql`

Commit these files together.
