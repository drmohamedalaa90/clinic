# Operation Clinic — Saturday Week + DD/MM/YYYY Patch

Requested changes:

1. Arabic translation of `Clinic Management` is now:
   `إدارة العيادة`

2. Clinic week display now begins:
   Saturday → Sunday → Monday → Tuesday → Wednesday → Thursday → Friday

3. Displayed dates use:
   `DD/MM/YYYY`

Examples:
- `08/08/2026`
- `08/08/2026 → 31/12/2026`
- Top bar: `Saturday, 08/08/2026`
- Arabic top bar: `السبت، 08/08/2026`

## Replace these files in GitHub

- `app.html`
- `js/core.js`
- `js/schedules.js`
- `js/attendance.js`
- `js/finance.js`
- `js/patients.js`
- `js/notifications.js`
- `sw.js`

No SQL is required for this patch.

After committing:
1. wait for GitHub Pages deployment;
2. open the clinic;
3. press `Ctrl + Shift + R`.

Note: HTML date-picker fields still use the browser's native date input internally. Saved values remain ISO dates in Supabase, while all normal displayed dates are formatted as DD/MM/YYYY.
