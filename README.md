# Operation Clinic — Schedule Delete + Finance Period Filters

## 1. Owner: delete one or multiple days from Sara's schedule

Attendance → Sara → Today → Weekly schedule

Owner now sees a checkbox beside every schedule day.

You can select:
- one day
- several days
- all displayed schedule rows if needed

Then press:

**Delete selected days / حذف الأيام المحددة**

A reason is mandatory.

Before deletion, each removed schedule row is copied to:
`staff_schedule_test_deletions`

Managers, Deputy Manager and Sara do not receive this delete control.

---

## 2. Finance: Day / Month / All time

At the top of Finance there is now one global period control:

- **Day / يوم**
- **Month / شهر**
- **All time / الإجمالي**

When Day is selected, choose a date.

When Month is selected, choose a month.

When All time is selected, the whole available finance history is shown.

The selected period applies to:

- Checked-in cases
- Booking income
- Clinic/logistics expense ledger
- Invoices
- Income summary
- Cash summary
- InstaPay summary
- Expense total
- Net total

Approved logistics orders that are still waiting for a purchase price remain
visible regardless of the period because they are an active operational task.

Services and Cash Closing stay as their existing configuration/workflow tabs.

---

## Install

### Supabase

Run:

`sql/owner-delete-staff-schedule-days.sql`

### GitHub

Replace:

- `js/attendance.js`
- `js/finance.js`
- `css/style.css`
- `sw.js`

Then wait for GitHub Pages deployment and press:

`Ctrl + Shift + R`
