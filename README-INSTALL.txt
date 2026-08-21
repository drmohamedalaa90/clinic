CLINIC V63

Fixes the two remaining visible problems:

1) + icon appears much earlier
   V63 is loaded immediately after appointments.js / extra-case logic instead of
   after all the large PDF/chat/Excel scripts.

2) Friday really advances the calendar
   V63 checks the actual FIRST visible week.
   If Friday's old week is still first, it clicks NEXT and checks again until
   the coming Saturday week is first.

V62 remains responsible for the extra-case modal with:
- Existing patient
- + New patient

INSTALL
=======
1. Keep V51 and V62 SQL already installed.
2. Upload js/clinic-v63-fast-plus-friday-next.js
3. Replace app.html with the included app.html.
4. Remove old V53/V54/V56/V57/V58/V59/V60 scripts if any remain.
5. Ctrl+F5.
