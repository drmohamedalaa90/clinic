# Operation Clinic — Navigation / Calendar / Attendance / Age

## Included changes

1. **Refresh stays on the same page**
   - F5 / browser refresh restores the current app page and route parameters.
   - Explicit Logout clears this state so a new login starts at the normal role home.

2. **Saturday-start calendar**
   - Calendar data is anchored to Saturday.
   - Saturday has a distinct pale-green column.
   - The `Jump to` date box is larger.

3. **Weeks per page**
   - New selector: 1 / 2 / 3 / 4 weeks.
   - The old `First week / Second week` labels are removed.
   - Each displayed week is identified only by its Saturday-Friday date range.
   - Previous / Next moves by the selected number of weeks.

4. **Sara check-in repaired**
   - Fixes the `scheduled_start` NOT NULL database error.
   - If a work schedule exists, expected start/end are used.
   - If no work schedule exists yet, check-in still works with zero late/early deduction.

5. **Sara laptop sign-in reminder**
   - On a fresh Secretary login from laptop, if not checked in, a popup reminds her.
   - She can press `Check in now` directly from the popup.
   - No reminder on mobile layout.

6. **Age in years during booking**
   - Internal booking now has `Age in years`.
   - Example in 2026: Age 36 → Birth year 1990.
   - Changing birth year also updates age.

## Install

### Supabase
Run:
`sql/secretary-checkin-scheduled-start-fix.sql`

### GitHub
Replace:
- `js/core.js`
- `js/appointments.js`
- `js/attendance.js`
- `css/style.css`
- `sw.js`

Then wait for GitHub Pages and press `Ctrl + Shift + R`.
