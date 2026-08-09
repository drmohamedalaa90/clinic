# Operation Clinic — 11 UI / Attendance / Booking Fixes

## Implemented

1. Arabic doctor names:
   - Dr Ahmed Alaa -> د أحمد علاء
   - Dr Mohamed Alaa -> د محمد علاء
   Centralized in core.js and applied to doctor dropdowns/profile display.

2. Arabic dates are written naturally:
   - الأحد 8 أغسطس 2026
   Calendar cells use weekday + long Arabic date.
   Booking date also has a long-date line under the date input.

3. Escape closes:
   - modal windows
   - notification drawer
   - mobile sidebar

4. Birth year is removed from the NEW-PATIENT booking window.
   Only Age in years is entered.
   The system converts age to birth_year at save time, so stored age keeps
   updating automatically in future years.

5. Existing-patient search birth year is deliberately very faint.
   Age is displayed more prominently.

6. Check-in fee box no longer starts with 0.
   It starts empty with an Enter fee placeholder.

7. Sara attendance:
   The exact created_by NOT NULL error is fixed.
   Check-in writes created_by and updated_by using Sara's authenticated UUID.
   The previous scheduled_start/scheduled_end fix is preserved.

8. Appointment calendar:
   Saturday is forced to be the LEFT-most column even in Arabic RTL.
   Saturday has a light BLUE background and blue accent.

9. Patient search is dynamic.
   Typing the first character triggers results automatically; results continue
   updating as more characters are entered. The Search button still works.

10. Visit type removed from the RIGHT appointment-details half.

11. Visit type added to the LEFT patient half as:
   - كشف
   - استشارة

   The database continues using its existing technical values to avoid a
   migration that could break prior appointments.

## Install

### Supabase
Run:
`sql/sara-attendance-created-by-fix.sql`

### GitHub
Replace:
- js/core.js
- js/appointments.js
- js/attendance.js
- css/style.css
- sw.js

Then wait for GitHub Pages deployment and press Ctrl + Shift + R once.
