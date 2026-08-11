(() => {

  const C = window.Clinic;

  if (!C) {
    return;
  }

  function applyCorrectClosingRule() {

    if (C.currentPage !== 'appointments') {
      return;
    }

    const now = Date.now();

    document
      .querySelectorAll(
        '.hour-patient-seat.empty[data-end]'
      )
      .forEach(seat => {

        const endMs =
          new Date(
            seat.dataset.end
          ).getTime();

        if (!Number.isFinite(endMs)) {
          return;
        }

        const hasEnded =
          now >= endMs;

        const strong =
          seat.querySelector(
            '.seat-copy strong'
          );

        const small =
          seat.querySelector(
            '.seat-copy small'
          );

        seat.classList.remove(
          'v31-slot-closed'
        );

        seat
          .querySelectorAll(
            '.v31-slot-closed-label'
          )
          .forEach(
            node => node.remove()
          );

        delete seat.dataset.v31ClosedLabel;

        if (hasEnded) {

          seat.disabled = true;

          seat.classList.add(
            'v46-slot-ended'
          );

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

          seat.disabled = false;

          seat.classList.remove(
            'v46-slot-ended'
          );

          seat.dataset.bookSlot =
            '1';

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

  let queued = false;

  const observer =
    new MutationObserver(() => {

      if (queued) {
        return;
      }

      queued = true;

      requestAnimationFrame(() => {

        queued = false;

        applyCorrectClosingRule();
      });
    });

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'disabled'
      ]
    }
  );

  setInterval(
    applyCorrectClosingRule,
    5000
  );

  applyCorrectClosingRule();

})();
