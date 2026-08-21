CLINIC V61 — LOGISTICS CONTROL

Upload/replace:
1. app.html
2. js/clinic-v61-logistics-control.js
3. keep the existing V60 JS and assets/logistics folder already uploaded

Then run ONCE in Supabase SQL Editor:
supabase/clinic-v61-logistics-control.sql

What V61 adds:
- Compact Add Item button in the header instead of the large full-width bar
- Summary filters: All / Low stock / Out / Equipment
- Search box + category filters
- Minimum-stock setting per consumable
- Green / orange / red stock status
- Quick -1 / +1 stock controls for admins
- Consumable vs Equipment distinction
- Equipment status: Working / Needs maintenance / Broken
- Next maintenance date
- Purchase request button with quantity + estimated cost + note
- Per-item stock history
- Admin can still edit name/photo, add items, and remove items

Notes:
- This package intentionally does NOT auto-write into Finance because the Finance table structure must be matched exactly to your current clinic build before creating expenses automatically.
- V60 remains loaded first; V61 overrides only the Logistics page.

FIX: Removed reference to profiles.full_name because that column is not present in the current clinic schema.
