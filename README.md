# Operation Clinic — Dashboard Notifications Patch (Task 13L)

This patch adds the requested role-aware **Notifications** block to every member dashboard.

## What changes

- Orange unread notification counter in the top bell.
- Orange unread notification counter beside the **Notifications** title on the dashboard.
- Persistent read/unread state per user (works across devices).
- Dashboard notification classifications:
  - Bookings
  - Finance
  - Logistics issue / deficiency
  - Apology / doctor unavailability
  - Referrals
  - Attendance / leave
- Approved doctor apologies/cancellations are visible to all active clinic members.
- Logistics requests can be explicitly marked **DEFICIENCY**.
- Active logistics deficiencies are visible to all active clinic members.
- Booking, finance, referral and attendance notifications remain role-aware.
- Opening the notification drawer no longer silently marks everything as read.
- Individual notification click = read.
- **Mark all as read** button available on dashboard.

## Install

1. In Supabase SQL Editor, run the full contents of:

   `sql/task-13l-dashboard-notifications.sql`

2. Replace these files in GitHub:

   - `js/notifications.js`
   - `js/dashboard.js`
   - `js/logistics.js`
   - `css/style.css`
   - `sw.js`

3. Commit the changes.

4. Wait for GitHub Pages to redeploy.

5. Open the clinic and perform a hard refresh (`Ctrl + Shift + R`).

## How to mark a logistics issue as a deficiency

Go to **Logistics**.

For a new request, check:

`Mark as deficiency`

For an existing open request, click:

`Mark deficiency`

That request will immediately appear as an important dashboard notification for all active clinic members. It does not expose the financial amount to doctors or other members who do not have finance access.

## Apology behavior

An approved schedule exception of type:

- apology
- vacation
- emergency cancellation
- changed hours

is surfaced in the dashboard notification feed.

Pending schedule/apology requests remain management-only until approved.
