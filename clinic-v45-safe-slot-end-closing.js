(() => {

  /*
   * CLINIC V45 — SAFE STAFF SLOT CLOSING
   *
   * IMPORTANT:
   * REMOVE clinic-v42-slot-close-at-end.js from app.html.
   *
   * This patch uses the REAL data-end timestamp already rendered
   * by appointments.js on each empty seat.
   *
   * Rule:
   * 16:00–17:00 remains bookable until 17:00 exactly.
   * It closes only when Date.now() >= data-end.
   *
   * We DO NOT parse visible labels.
   * We DO NOT remove data-end.
   * We DO NOT guess timezone.
   */

  const C = window.Clinic;

  if (!C) {
    return;
  }


  function applySlotEndRule() {

    if (C.currentPage !== 'appointments') {
      return;
    }


    const now = Date.now();


    document
      .querySelectorAll(
        '.hour-patient-seat.empty[data-end]'
      )
      .forEach(seat => {

        const endValue =
          seat.dataset.end;


        const endMs =
          new Date(
            endValue
          ).getTime();


        if (!Number.isFinite(endMs)) {
          return;
        }


        const strong =
          seat.querySelector(
            '.seat-copy strong'
          );


        const small =
          seat.querySelector(
            '.seat-copy small'
          );


        if (now >= endMs) {

          /*
           * Hour officially ended.
           */
          seat.disabled = true;

          seat.dataset.v45Ended =
            '1';

          /*
           * Keep data-end/data-start intact.
           * Only remove booking activation.
           */
          delete seat.dataset.bookSlot;


          if (strong) {
            strong.textContent =
              C.lang === 'ar'
                ? 'مغلق'
                : 'Closed';
          }


          if (small) {
            small.textContent =
              C.lang === 'ar'
                ? 'انتهت الساعة'
                : 'Hour ended';
          }

        } else {

          /*
           * Hour has NOT officially ended.
           *
           * Example:
           * 16:14 inside 16:00–17:00 => OPEN.
           */
          seat.disabled = false;

          seat.dataset.bookSlot =
            '1';

          delete seat.dataset.v45Ended;


          if (strong) {
            strong.textContent =
              C.lang === 'ar'
                ? 'متاح'
                : 'Available';
          }


          if (small) {
            small.textContent =
              C.lang === 'ar'
                ? 'حجز مريض'
                : 'Book patient';
          }
        }
      });
  }


  /*
   * Appointments page re-renders after booking,
   * realtime changes, week navigation, etc.
   */
  let queued = false;


  const observer =
    new MutationObserver(() => {

      if (queued) {
        return;
      }


      queued = true;


      requestAnimationFrame(() => {

        queued = false;

        applySlotEndRule();
      });
    });


  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );


  /*
   * Automatically close at the exact hour end even if
   * nobody manually refreshes the page.
   */
  setInterval(
    applySlotEndRule,
    5000
  );


  applySlotEndRule();

})();
