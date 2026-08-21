CLINIC V67 — SIMPLIFIED LOGISTICS ALERTS

REPLACE:
1. app.html
2. js/clinic-v62-critical-logistics-electricity.js
3. js/clinic-v67-simplified-logistics-alerts.js
4. sw.js

RUN ONCE IN SUPABASE:
supabase/clinic-v67-all-team-purchase.sql

CHANGES:
- No extra first-login/day critical popup.
- One critical alert only when Logistics is opened.
- If Logistics is left and opened again while an item remains Critical, it alerts again.
- ALL active clinic members can press Bought and enter:
  quantity, amount paid, payment method and note.
- Saving a purchase increases stock, clears Critical state, stores history,
  and records the amount in Finance expenses.
