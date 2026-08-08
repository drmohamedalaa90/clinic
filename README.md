# Operation Clinic — Direct Check-in + Owner Test Reset

This patch applies the corrected appointment flow.

## After booking

There is NO confirmation step.

A booked appointment immediately shows these actions in this order:

1. Check in
2. Reschedule
3. No-show
4. Cancel

When reception clicks **Check in**, the fee window opens:

- Fees (EGP)
- Payment method
- Optional finance note

After saving:
- appointment becomes Arrived
- fee appears in Finance -> Income

## Owner-only test reset

The Owner account gets two destructive test-period tools.

### Appointments -> Reset appointments

Requires typing:

`RESET APPOINTMENTS`

It clears test appointment data and appointment-linked workflow records while preserving:

- Patients
- Doctor working-hours schedules

Because booking income is attached to appointments, appointment reset also clears those linked booking-income entries.

### Finance -> Reset finance

Requires typing:

`RESET FINANCE`

It clears:

- Booking income
- Invoice payments
- Invoice items
- Invoices
- Cash closings
- Clinic expenses

It preserves:

- Patients
- Appointments
- Service / price list
- Logistics requests

Both reset functions are enforced as **Owner-only in Supabase**, not merely hidden in the frontend.

## Install

1. Run the full contents of:
   `sql/owner-test-reset.sql`

2. Replace in GitHub:
   - `js/appointments.js`
   - `js/finance.js`
   - `css/style.css`
   - `sw.js`

The included `app.html` and supporting modules are unchanged copies of the current working package, so you do not need to replace them unless you want to upload the whole patch folder.

3. Wait for GitHub Pages deployment and press:
   `Ctrl + Shift + R`
