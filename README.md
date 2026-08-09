# Operation Clinic — Calendar / Attendance / Title Fix

## 1. Public patient confirmation: clinic location

A ready-to-paste location section is included as:

`public-booking-location-snippet.txt`

I did not invent the clinic address. Send the exact Google Maps link + Arabic
address + directions and the location block can be filled with the real values.

## 2. Main app brand

The duplicate lower `إدارة العيادة` subtitle is hidden. Only one clinic title
remains.

## 3. Calendar

### Main appointment week
Arabic returns to the requested visual order:
- Saturday is the FIRST day
- Saturday appears on the RIGHT
- Saturday remains blue-highlighted

### Small "اذهب إلى" calendar
The browser-native date picker has been replaced for this control with a custom
clinic date picker.

Its week explicitly starts:
Saturday → Sunday → Monday → Tuesday → Wednesday → Thursday → Friday

In Arabic, Saturday is shown on the RIGHT.

This is necessary because Chrome/Windows does not let the website reliably
change the first day of the native `<input type="date">` calendar.

## 4. Sara attendance — hard fix

Run:

`sql/sara-attendance-hard-fix.sql`

The patch:
- gives safe defaults to required schedule/audit fields
- recreates frontend_staff_check_in
- recreates frontend_staff_check_out
- always writes created_by / updated_by
- always writes scheduled_start / scheduled_end
- keeps check-in working even before a management schedule is configured
- repairs EXECUTE permission required by attendance RLS

The final SQL query lists any unexpected legacy NOT NULL column that still has
no default. Ideally it returns zero rows.

## GitHub files

Replace:
- js/appointments.js
- js/attendance.js
- css/style.css
- sw.js

Then wait for GitHub Pages and press Ctrl + Shift + R.
