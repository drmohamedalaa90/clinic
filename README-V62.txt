CLINIC V62 — CRITICAL LOGISTICS + ELECTRICITY

UPLOAD:
1) app.html
2) js/clinic-v62-critical-logistics-electricity.js

THEN RUN ONCE:
supabase/clinic-v62-critical-logistics-electricity.sql

REQUIRES:
- V60 already installed
- V61 FIXED already installed successfully

V62 BEHAVIOR:
- The small image badge is no longer the number "1".
  Normal item = green ✓ Enough.
  Manually critical item = pulsing red 🚨 CRITICAL.
- Any active clinic user can mark an item Critical.
- Critical items create:
  * an orange ⚠ icon beside Logistics in the sidebar
  * an added critical item in the notification drawer
  * a red popup EVERY TIME Logistics is opened by anyone
- The popup continues until new stock is recorded.
- Owner / Manager / Deputy / Secretary can press Bought:
  * enter quantity
  * enter exact money paid
  * select payment method
  * stock is increased
  * Critical status is automatically cleared
  * purchase is written to clinic_inventory_purchases
  * money is automatically inserted into clinic_expenses and therefore appears in Finance as an expense
- Adds an Electricity card with a free Unsplash electricity-meter image.
- Every Saturday, when the Secretary logs in:
  * if the weekly Electricity note has not been entered yet, a reminder popup appears
  * the secretary records a note and optional meter reading
  * all previous electricity notes remain viewable from the Electricity card

IMPORTANT:
The SQL is transactional. If any error occurs, send the exact Supabase error screenshot before changing anything else.
