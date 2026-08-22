CLINIC V84 — SECRETARY LOGISTICS REAL FIX

Replace:
1. app.html
2. js/clinic-v84-secretary-logistics-real-fix.js

No SQL.

ROOT CAUSE:
V83 checked C.hasRole('secretary') immediately while the JavaScript file loaded.
At that time core.js had not loaded the user's roles yet, so C.roles was empty and
V83 exited permanently. That is why the page looked exactly unchanged.

V84 does NOT check the role at script-load time.
It checks the role only when Logistics is actually opened, after authentication
and roles are loaded.

Secretary receives the full photo-first Logistics view:
- status badges
- stock
- equipment state
- critical state
- search
- category filters
- Request to buy

No Add/Edit/Remove admin controls are shown.
