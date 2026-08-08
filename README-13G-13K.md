# Operation Clinic — Tasks 13G–13K

This package extends the working Tasks 13B–13F frontend.

## Included

- 13G Finance UI: invoices, services, payments, daily cash closing
- 13H Logistics UI: requests, approvals, clinic expenses
- 13I Attendance & Bonus UI: check in/out, leave, schedules, monthly summary, bonus rules
- 13J Profile / Users / Settings / Technical Administration
- 13K Reports, owner audit log, CSV export, PWA manifest/service worker/mobile polish

## Before uploading the frontend

1. In Supabase Storage create a **private** bucket named `profile-photos`.
2. In Supabase SQL Editor open `sql/task-13g-13k-helper.sql`, copy the **contents of the file**, and Run it.
3. Do not paste the file path itself into SQL Editor.

## Then upload to GitHub

Replace the existing repository files with the contents of this package. Keep `index.html` and `app.html` at the repository root.

After GitHub Pages redeploys, refresh the site. If a stale version is visible, use Ctrl+Shift+R once.

## Passwords

No clinic user passwords are included in this repository package. Authentication passwords remain in Supabase Auth only.

## Storage

`profile-photos` is private. The SQL patch adds `storage.objects` RLS policies. The browser uses authenticated uploads and short-lived signed URLs for display.
