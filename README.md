# Clinic hotfix — 09 Aug 2026

This patch is intentionally small and loads after the current clinic modules,
so it does not replace the large clinic codebase.

## Changes

### Booking
- English name is labelled optional.
- Arabic name is required for a new patient.
- The age box has no Example / مثال placeholder.
- Any booking placeholder beginning with Example / مثال is removed.

### Login Arabic title
- Arabic title becomes: إدارة العيادة
- Subtitle becomes: نظام إدارة العيادة
- Doctor names become: د أحمد علاء / د محمد علاء

### Sara attendance
Run:
`sql/sara-attendance-column-aware-fix.sql`

The fix is column-aware:
- created_by is written because the current table requires it.
- updated_by is written ONLY if that column exists.
- checkout also checks which audit columns actually exist.

This directly addresses:
`column "updated_by" of relation "attendance_records" does not exist`

### Performance
The hotfix reduces avoidable network traffic:
- Doctor list is cached in memory for 5 minutes instead of being fetched on every booking popup.
- Dashboard silent auto-refresh changes from 12 sec to 30 sec.
- Silent dashboard refresh no longer re-fetches notifications.
- Notifications keep their existing independent 60-sec refresh.
- Dashboard background refresh pauses while the browser tab is hidden.

## Upload

1. Run the SQL in Supabase.
2. Upload/replace:
   - index.html
   - app.html
   - js/login-hotfix.js
   - js/clinic-hotfix.js
3. Wait for GitHub Pages deployment.
4. Press Ctrl + Shift + R once.
