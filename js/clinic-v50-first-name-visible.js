(() => {
  const selector =
    '#twoWeekScheduler .hour-patient-seat.occupied .seat-copy strong';

  let queued = false;

  function applyFirstNameVisibility() {
    document
      .querySelectorAll(selector)
      .forEach(name => {
        // Let the patient's own text decide LTR/RTL. This is important when
        // the clinic interface is English but the patient's name is Arabic:
        // text-overflow will then truncate from the END of the name instead
        // of hiding its beginning / first name.
        name.setAttribute('dir', 'auto');
        name.style.textAlign = 'start';
        name.style.unicodeBidi = 'plaintext';

        const fullName =
          String(name.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();

        if (fullName) {
          name.title = fullName;
        }
      });
  }

  function queueApply() {
    if (queued) return;
    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      applyFirstNameVisibility();
    });
  }

  const observer =
    new MutationObserver(queueApply);

  function start() {
    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    applyFirstNameVisibility();
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
