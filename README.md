# Owner — delete Sara attendance during test period

## What this adds

On the Owner account, Attendance → Today now shows a red:

**Delete test record / حذف سجل الاختبار**

button beside every daily attendance row.

You can delete Sara's check-in/out record from ANY day in the displayed
attendance history.

After deletion:
- the day disappears from Sara's attendance history
- if it is today, Sara can check in again
- the deleted row is preserved in `attendance_test_deletions` as a test-period
  audit snapshot

Managers / Deputy / Secretary do NOT get the delete button.

## Install

1. Run:
   `sql/owner-delete-attendance-test-record.sql`

2. Replace:
   `js/attendance.js`

3. Wait for GitHub Pages deployment and press Ctrl + Shift + R.
