CLINIC V85 — LOGISTICS PURCHASE + ELECTRICITY -> FINANCE

Replace:
1. app.html
2. js/clinic-v85-logistics-purchase-electricity-finance.js

Run ONCE in Supabase:
supabase/clinic-v85-logistics-purchase-electricity-finance.sql

Secretary Logistics:
- Request to buy remains available.
- Bought button allows:
  quantity bought
  amount paid
  payment method
  purchase note
- Saving Bought:
  adds stock
  clears Critical state
  saves purchase history
  automatically creates a Finance expense.

Electricity:
- Electricity card gets "Saturday note / amount".
- On Saturday, the secretary/team member can write or EDIT:
  note
  meter reading
  amount paid
  payment method
- If an amount is entered, it is automatically a Finance expense.
- Editing the same Saturday updates the same expense instead of duplicating it.

The Finance integration uses the existing clinic_expenses table fields already used by the clinic's V44 Finance logic.
