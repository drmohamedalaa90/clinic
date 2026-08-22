CLINIC V89 — EXTRA CASE UI + ACTIONS + SPEED

Replace app.html and upload:
js/clinic-v89-extra-cases-fast-actions.js

No SQL is needed after V87.

Changes:
- Extra case card is fully contained inside the day column.
- Compact two-line layout avoids badge/name collision.
- Click the extra case to get the normal workflow actions:
  Confirm information, Edit booking, Check in, No-show, Cancel,
  and Send to doctor after arrival.
- Uses the existing booking editor and existing appointment RPCs.
- Loads as soon as scheduler day cards render (requestAnimationFrame),
  instead of waiting 350–1000 ms.
- Fetches appointment + patient in one Supabase request when the relationship is available.
