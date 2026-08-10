# Appointment Confirm + Edit + Live Refresh + Push V28

This pack fixes the exact three problems visible in the current live repository.

## Why Edit is missing

The repository already contains:
`js/booking-workflow-hotfix.js`

That file adds **Edit booking** before check-in.

But the current live `app.html` does NOT load it.

The replacement `app.html` in this pack loads it immediately after
`appointments.js`.

## New: Confirm information

Before check-in the appointment popup now has:

- **Confirm information**
- **Edit booking**
- Check in
- Reschedule
- No-show
- Cancel

Confirm information opens the registered patient + appointment information for
staff review.

After confirmation the appointment shows:
`✓ Information confirmed`

If Edit booking is opened afterward, the confirmation is cleared and the
information should be reviewed again.

Run:
`sql/appointment-information-confirmation.sql`

## Why laptop does not update automatically

The repository already contains:
`js/clinic-final-live-fixes.js`

It subscribes to Supabase Realtime AND has an 8-second polling fallback.

But the current live `app.html` does NOT load that script.

Therefore it cannot run.

The replacement `app.html` loads it.

Your Supabase `appointments` and `patients` tables must also be enabled in the
`supabase_realtime` publication (this was part of the previous SQL patch).

## Why the iPhone can still show two pushes

The current client already has:
- one active iPhone subscription
- one `push` listener
- client-side deduplication

But V27 identifies duplicates using:
`appointment ID + title + body`

and only recognizes the payload field `appointmentId`.

So if the backend sends the same booking twice with:
- slightly different title/body, OR
- the appointment UUID under `appointment` or `appointment_id`

the two payloads can evade the current duplicate guard.

V28 changes the rule to:

**ONE appointment UUID = ONE visible notification per device**

It recognizes:
- `appointmentId`
- `appointment_id`
- `appointment`
- the same keys nested under `data`

and de-duplicates using ONLY that appointment UUID.

## INSTALL ORDER

1. Supabase → SQL Editor:
   run `sql/appointment-information-confirmation.sql`

2. GitHub REPLACE:
   - `app.html`
   - `sw.js`
   - `js/pwa.js`

3. GitHub ADD/REPLACE:
   - `js/appointment-information-confirm.js`
   - `js/booking-workflow-hotfix.js`
   - `js/clinic-final-live-fixes.js`

4. Commit everything together.

5. Desktop:
   - close clinic tabs
   - reopen app.html
   - Ctrl+Shift+R once

6. iPhone:
   - fully close clinic PWA
   - reopen for 15 seconds
   - fully close again
   - reopen
   - make ONE new test booking

## EXPECTED APPOINTMENT POPUP

Before check-in:

`Confirm information | Edit booking | Check in | Reschedule | No-show | Cancel`

After information confirmation:

`✓ Information confirmed | Edit booking | Check in | Reschedule | No-show | Cancel`
