(() => {
  const C = window.Clinic;
  if (!C) return;

  const GRACE_MS = 2 * 60 * 60 * 1000;

  function parseMs(value) {
    const ms = new Date(value || '').getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function groupKey(seat) {
    return `${seat.dataset.date || ''}|${seat.dataset.doctor || seat.dataset.doctorId || ''}`;
  }

  function clinicGraceEndsByGroup() {
    const groups = new Map();

    document
      .querySelectorAll('.hour-patient-seat[data-date][data-end]')
      .forEach(seat => {
        const endMs = parseMs(seat.dataset.end);
        if (endMs === null) return;

        const key = groupKey(seat);
        const current = groups.get(key);
        if (current == null || endMs > current) groups.set(key, endMs);
      });

    groups.forEach((clinicEndMs, key) => {
      groups.set(key, clinicEndMs + GRACE_MS);
    });

    return groups;
  }

  function applyClinicGraceRule() {
    if (C.currentPage !== 'appointments' && C.currentPage !== 'doctor-appointments') return;

    const now = Date.now();
    const graceByGroup = clinicGraceEndsByGroup();

    document
      .querySelectorAll('.hour-patient-seat.empty[data-date][data-start][data-end]')
      .forEach(seat => {
        const graceEndMs = graceByGroup.get(groupKey(seat));
        if (!Number.isFinite(graceEndMs)) return;

        const closed = now > graceEndMs;

        if (!closed) {
          seat.disabled = false;
          seat.dataset.bookSlot = '1';
          seat.classList.remove('v31-slot-closed');
          delete seat.dataset.v31ClosedLabel;
          delete seat.dataset.v45Ended;

          seat.querySelectorAll('.v31-slot-closed-label').forEach(x => x.remove());

          const strong = seat.querySelector('.seat-copy strong');
          const small = seat.querySelector('.seat-copy small');

          if (strong) strong.textContent = C.lang === 'ar' ? 'متاح' : 'Available';
          if (small) small.textContent = C.lang === 'ar' ? 'حجز مريض' : 'Book patient';
        } else {
          seat.disabled = true;
          delete seat.dataset.bookSlot;
          seat.classList.add('v31-slot-closed');

          if (!seat.querySelector('.v31-slot-closed-label')) {
            const badge = document.createElement('small');
            badge.className = 'v31-slot-closed-label';
            badge.textContent = C.lang === 'ar' ? 'مغلق' : 'Closed';
            seat.appendChild(badge);
          }
        }
      });
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyClinicGraceRule();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(applyClinicGraceRule, 5000);
  applyClinicGraceRule();
})();
