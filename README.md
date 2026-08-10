# Booking success + directions + duplicate push fix

## Replace in GitHub

- `book.html`
- `sw.js`

## Add

- `directions.html`

The package also includes the clinic logo in:
- `assets/alaa-clinic-logo.png`

If that logo already exists in your repo, replacing it is optional.

---

## Booking success screen

After a successful booking the page now automatically scrolls to the
large/middle clinic logo inside the confirmation section instead of jumping
to the top of the whole public booking page.

The location section now has:
- Google Maps button
- `ازاي تروح للعيادة خطوة بخطوة؟` button

The second button opens `directions.html`.

---

## New directions page

The page asks:

- هتيجي من البحر
- شارع أبو قير
- شارع الترام
- شارع بورسعيد

Selecting an option opens a route panel.

For now every route intentionally says:
`قريباً — سيتم إضافة الطريق والمعالم بالتفصيل`

This is ready for us to later fill with exact street-by-street directions and
landmarks.

---

## Duplicate push notifications

IMPORTANT: Replace the ENTIRE existing `sw.js`.

Do NOT append this code to the current service worker.

The clean file contains exactly:
- ONE `push` event listener
- ONE `notificationclick` listener

It also uses a new cache version:
`operation-clinic-v25-single-push-2026-08-10`

After GitHub Pages deploys:

### Desktop
1. Close the clinic tab.
2. Reopen it.
3. Ctrl + Shift + R once.

### iPhone / installed web app
1. Fully close the clinic web app from the app switcher.
2. Reopen it and leave it open for several seconds so the new service worker
   can activate.
3. Close and reopen it once more before testing a booking.

If an old duplicate service worker remains active on the phone after this,
remove the clinic web app from the Home Screen, open the clinic once in Safari,
then add it to the Home Screen again and enable push once.
