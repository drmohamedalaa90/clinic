# Schedule Restore Fix

The previous Saturday-week patch introduced a JavaScript runtime error in `js/schedules.js`: the page called `sortClinicWeek()` and `weekdayOptions()` before those functions had actually been added to the file.

That is why the **Weekly hours** and **Upcoming changes & requests** sections became blank. Your Supabase schedule data was not deleted.

## Replace in GitHub

- `js/schedules.js`
- `sw.js`

No SQL is required.

After GitHub Pages redeploys, press `Ctrl + Shift + R`.

The schedule will return and the week will display as:

Saturday → Sunday → Monday → Tuesday → Wednesday → Thursday → Friday

Dates continue to display as DD/MM/YYYY.
