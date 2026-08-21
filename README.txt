CLINIC V60 — LOGISTICS GALLERY

Upload/replace:
1. app.html
2. js/clinic-v60-logistics-gallery.js
3. the complete assets/logistics/ folder

Then run once in Supabase SQL Editor:
supabase/clinic-v60-logistics-gallery.sql

What changes:
- Logistics displays each item as a photo card with the item name directly below it.
- Owner / Manager / Deputy Manager can add items, edit names/photos/stock, and remove items.
- Remove is a safe soft-delete so old request/purchase history is preserved.
- Existing staff request workflow still uses the V44 request RPC.
- The 18 photographed clinic items are seeded automatically and point to the supplied local image assets.
