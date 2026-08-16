(() => {
  const navEntry =
    window.performance
      ?.getEntriesByType?.('navigation')
      ?.[0];

  const isReload =
    navEntry?.type === 'reload'
    ||
    window.performance?.navigation?.type === 1;

  // The live-booking updater performs a real browser reload when a new
  // appointment arrives. Only act on a reload, so normal in-app navigation
  // is left untouched.
  if (!isReload) {
    return;
  }

  const appointmentPages =
    new Set([
      'appointments',
      'doctor-appointments'
    ]);

  let observer = null;
  let finished = false;

  function focusCurrentWeek() {
    if (finished) {
      return true;
    }

    const C = window.Clinic;

    if (
      !C
      ||
      !appointmentPages.has(C.currentPage)
    ) {
      return false;
    }

    const todayChip =
      document.querySelector(
        '#twoWeekScheduler .today-chip'
      );

    const currentWeek =
      todayChip
        ?.closest(
          '.scheduler-week-section'
        );

    if (!currentWeek) {
      return false;
    }

    finished = true;

    const topbarHeight =
      document
        .querySelector('.topbar')
        ?.getBoundingClientRect()
        .height
      || 0;

    currentWeek.style.scrollMarginTop =
      `${Math.ceil(topbarHeight + 12)}px`;

    requestAnimationFrame(() => {
      currentWeek.scrollIntoView({
        behavior:'auto',
        block:'start',
        inline:'nearest'
      });
    });

    observer?.disconnect();
    return true;
  }

  function start() {
    if (focusCurrentWeek()) {
      return;
    }

    observer =
      new MutationObserver(
        focusCurrentWeek
      );

    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    // Do not leave a page-wide observer running if this reload restored
    // some other section of the clinic app.
    window.setTimeout(
      () => observer?.disconnect(),
      10000
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once:true }
    );
  }
  else {
    start();
  }
})();
