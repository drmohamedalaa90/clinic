CLINIC V70 — RADICAL CONSOLIDATED FIX

This replaces the chain of V51/V55/V61/V62/V63/V64 front-end patches with ONE
front-end patch.

THE 3 FIXES
===========
1. ONE + extra-case icon beside EVERY day.
   Clicking it opens Extra Case with:
   - Existing patient
   - + New patient

2. On Friday (Africa/Cairo), the appointments page changes ONCE to the COMING
   Saturday week using the Jump-to date field.
   No repeated Next clicks.
   No 2028 runaway.
   No blank-page hiding.

3. "Mark all as read" uses ONE server RPC.
   It:
   - attempts to update the live notification table(s)
   - always stores a persistent read-through timestamp per user
   - applies only to the signed-in user

INSTALL — IMPORTANT
===================
1. Keep the original V51 SQL installed because it contains:
   - frontend_book_extra_case(...)
   - frontend_get_extra_case_summary(...)

2. Run:
   sql/clinic-v70-radical-fix.sql

3. Upload:
   js/clinic-v70-radical-fix.js

4. Replace app.html with the included app.html.

5. REMOVE / DO NOT LOAD all these old front-end patch scripts:
   - clinic-v51-extra-cases.js
   - clinic-v55-mark-all-notifications-read.js
   - clinic-v61-mark-all-notifications-read.js
   - clinic-v62-booking-fix.js
   - clinic-v63-fast-plus-friday-next.js
   - clinic-v64-stable-friday.js
   - all V53/V54/V56/V57/V58/V59/V60 calendar patches

6. Ctrl+F5.

The point of V70 is to stop multiple patches fighting over the same DOM/calendar.
