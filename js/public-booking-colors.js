(function () {
  const PUBLIC_CLASS = 'public-form-booking';

  async function colorPublicBookings() {
    const C = window.Clinic;
    if (!C?.sb) return;

    const buttons = [
      ...document.querySelectorAll(
        '.hour-patient-seat.occupied[data-appointment-id]'
      )
    ];

    if (!buttons.length) return;

    const ids = [
      ...new Set(
        buttons
          .map(x => x.dataset.appointmentId)
          .filter(Boolean)
      )
    ];

    if (!ids.length) return;

    const { data, error } = await C.sb
      .from('appointments')
      .select('id,booking_source')
      .in('id', ids);

    if (error) {
      console.warn(
        'Could not identify public-form bookings:',
        error
      );
      return;
    }

    const publicIds = new Set(
      (data || [])
        .filter(x => x.booking_source === 'public')
        .map(x => x.id)
    );

    buttons.forEach(button => {
      button.classList.toggle(
        PUBLIC_CLASS,
        publicIds.has(button.dataset.appointmentId)
      );
    });
  }

  let timer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(
      colorPublicBookings,
      80
    );
  });

  function start() {
    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    colorPublicBookings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start
    );
  } else {
    start();
  }
})();