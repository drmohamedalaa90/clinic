# STEP 6 — Register staff browsers for clinic push notifications

You have already completed the database webhook.

Now the browser/device must register itself before it can receive push.

## A. Edit ONE value first

Open:

`js/push-notifications.js`

Find:

`PASTE_YOUR_VAPID_PUBLIC_KEY_HERE`

Replace it with the PUBLIC VAPID key you generated earlier.

Example only:

`const VAPID_PUBLIC_KEY = 'B....';`

It is safe for the PUBLIC VAPID key to be in GitHub.

DO NOT put:
- VAPID_PRIVATE_KEY
- BOOKING_WEBHOOK_SECRET

in GitHub.

## B. Upload the JS

Upload:

`js/push-notifications.js`

to your GitHub repo.

## C. Modify app.html

After:

`<script src="js/notifications.js"></script>`

add:

`<script src="js/push-notifications.js"></script>`

## D. Modify sw.js

Do not replace your existing service-worker/PWA code.

Copy the entire contents of:

`sw-push-append.js`

and paste it at the VERY BOTTOM of your existing `sw.js`.

Then change your existing service-worker CACHE version/name once, so browsers
download the new service worker.

## E. Deploy and hard refresh

Wait for GitHub Pages deployment.

Then on each staff laptop/browser:

1. Open the clinic.
2. Log in.
3. Ctrl + Shift + R once.
4. A new button beside the bell will say:
   `🔔 Enable push`
   or
   `🔔 تفعيل الإشعارات`
5. Click it.
6. When Chrome/Edge asks for Notifications permission, click Allow.
7. The button should become:
   `✓ Push enabled`

Do this separately for:
- Owner
- Sara
- Manager
- Deputy Manager
- Dr Ahmed

If one person uses both a laptop and phone, enable push separately on each
device/browser.

## F. Before testing a booking

Open Supabase Table Editor → `push_subscriptions`.

You should see one row per registered browser/device.

If you see zero rows, do NOT test the booking yet—the devices are not registered.

When you have at least your Owner browser registered, create ONE new booking and
we'll check the Edge Function logs together.
