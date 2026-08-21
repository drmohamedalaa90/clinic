CLINIC V62 — BOOKING FIX

This package fixes all 3 requested items:

1) ONE + icon BESIDE every day name
   - English and Arabic
   - including days with no normal clinic slots

2) Clicking + lets you choose:
   - Existing patient
   - + New patient
   The new-patient form is inside the same Extra Case booking window.

3) On Friday (Africa/Cairo):
   - the appointments page automatically advances to the COMING Saturday week
   - it does not intentionally hide the whole page, so there is no blank-page risk

INSTALL
=======
A. Run:
   sql/clinic-v62-new-patient-extra-case.sql
   once in Supabase (after V51 SQL).

B. Upload:
   js/clinic-v62-booking-fix.js

C. Replace app.html with the included app.html.

D. REMOVE any old V53/V54/V56/V57/V58/V59/V60 day/week scripts if you manually added them elsewhere.

E. Ctrl+F5.
