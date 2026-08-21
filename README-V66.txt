CLINIC V66 — RADICAL STABILITY FIX

This is NOT another patch on V64. It removes the risky implementation completely.

REPLACE EXACTLY THESE 4 FILES:
1. app.html
2. js/core.js
3. js/clinic-v66-stable-critical-alerts.js
4. sw.js

DO NOT upload V64 or V65 again.
NO SQL is needed.

WHAT WAS CHANGED
- V64 is removed from app.html completely.
- V65 is removed from app.html completely.
- Logistics visibility is now built directly into core.js for every authenticated role.
  There is no MutationObserver and no navigation monkey-patching.
- V62 remains responsible for the orange sidebar warning, realtime critical state,
  notification integration, and the popup every time Logistics opens.
- V66 only adds:
  * compact no-horizontal-scroll critical popup styling
  * one critical warning on first app entry per Cairo day
- sw.js cache version was changed to V66 so devices stop reusing the old cached code.
- core.js is loaded with ?v=66 for an additional cache bust.

AFTER UPLOAD
1. Replace all four files.
2. Close the clinic app completely.
3. Reopen it.
4. If the installed PWA is still showing the old build once, close/reopen again.
   The new service worker will delete the old cache during activation.
