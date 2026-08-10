# CLINIC FINAL RECOVERY PACK

This package addresses the five problems together rather than patching them
one-by-one.

## A. Notifications: newest first

`js/clinic-final-live-fixes.js` patches the notification list so the primary
sort is:

1. newest event_time first
2. priority only when times are equal

This fixes old high-priority items appearing above a new booking.

## B. Main app updates automatically after a booking

The live GitHub `app.html` currently does NOT load `realtime-sync.js`, which is
why the previously-created realtime code cannot run.

This pack instead uses `js/clinic-final-live-fixes.js` and adds:
- Supabase Realtime for appointments and patients
- automatic refresh of Appointments/Dashboard/Today/Queue/Reception/Patients/
  Patient Detail/Finance
- an 8-second polling fallback if a Realtime event is missed
- notification drawer refresh
- protection against refreshing while a modal/form is open

Run:
`sql/enable-live-sync.sql`

Then add the new JS in app.html using:
`APP_HTML_BOTTOM_REPLACEMENT.txt`

## C. iPhone double push

The new `sw.js` has:
- exactly one push listener
- synchronous in-memory duplicate blocking (prevents simultaneous race)
- persistent 2-minute duplicate blocking
- fingerprint based on appointment/content, not only server tag
- new cache version v27

The new `js/pwa.js` registers:
`sw.js?v=27-final`
with `updateViaCache: 'none'`.

This is important because the live repository already contains the new
book.html features while the phone was still showing the older success screen,
which indicates stale deployed client code/service-worker state.

## D. Save booking summary as photo

`book.html` contains the actual PNG generator.

The button is moved IMMEDIATELY BELOW the booking summary so it cannot be
missed:

`🖼️ حفظ ملخص الحجز كصورة`

On iPhone it uses the native share sheet when supported.
On desktop it downloads a PNG.

## E. "How to reach the clinic" is now a separate, obvious rectangle

On laptop:
- Location is one rectangle.
- The animated `NEW! جديد` directions feature is a separate rectangle BESIDE it.

On mobile they stack vertically.

The directions card has:
- animated NEW badge
- floating compass
- moving route marker
- shimmer
- animated arrow

It opens `directions.html`.

---

# EXACT INSTALL ORDER

1. Supabase SQL Editor:
   Run `sql/enable-live-sync.sql`

2. GitHub REPLACE:
   - `book.html`
   - `directions.html`
   - `sw.js`
   - `js/pwa.js`

3. GitHub ADD:
   - `js/clinic-final-live-fixes.js`

4. Edit the bottom scripts in `app.html` exactly as shown in:
   `APP_HTML_BOTTOM_REPLACEMENT.txt`

5. Commit everything in ONE commit.

6. Wait for GitHub Pages deployment to finish.

7. Desktop:
   - close all clinic tabs
   - reopen app.html
   - Ctrl+Shift+R once

8. iPhone:
   - fully close the installed clinic app/Safari clinic tab
   - reopen clinic and leave it open 15 seconds
   - fully close it again
   - reopen it once more
   - THEN make one test booking

Do not mix old and new versions of sw.js/pwa.js.
