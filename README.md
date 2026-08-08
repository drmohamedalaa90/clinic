# Operation Clinic — Owner Logistics Master List

This patch changes Logistics into the requested operational workflow.

## Owner

The Owner controls a permanent **Clinic items** master list.

Each item can contain:
- English name
- Arabic name
- expense category
- usual quantity
- unit
- notes
- display order
- active / inactive

Example items:
- Water bottles
- Paper cups
- Printer paper
- Toner
- Cleaning products
- Tissues
- ECG paper

The owner can add, edit, activate or disable items.

## Secretary

The secretary does NOT type random logistics requests anymore.

She opens:

**Logistics -> Clinic items**

and selects:

**Missing — order**

She enters:
- required quantity
- routine / urgent
- needed-by date
- note

The order is created from the Owner's approved master list.

## Management notification

When the secretary sends a missing-item order:

- Owner
- Manager
- Deputy manager

receive an orange Logistics notification:

**Logistics order awaiting approval**

Management can open Logistics and:
- Approve
- Reject

The existing deficiency notification remains available too.

## Price / Finance

The secretary does NOT enter the purchase price when reporting the missing item.

After management approves the request:

**Finance -> Logistics expenses**

shows the approved item with:

**Enter price**

The secretary records:
- actual price
- payment method
- vendor
- receipt/reference
- date/time
- notes

This calls the existing `record_clinic_expense` workflow, links the financial
expense to the logistics request, and the amount appears in the Finance
expense ledger.

The logistics request then moves to the purchased/paid stage and can be marked
Received / Complete.

## Install

### Supabase

Run the full contents of:

`sql/logistics-master-list.sql`

### GitHub

Replace:
- `js/logistics.js`
- `js/finance.js`
- `js/notifications.js`
- `css/style.css`
- `sw.js`

Then wait for GitHub Pages deployment and press:

`Ctrl + Shift + R`
