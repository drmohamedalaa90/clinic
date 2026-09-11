(() => {
  const C = window.Clinic;
  if (!C) return;

  // 1) Do not poll dashboard notifications from background/hidden tabs.
  // Also collapse concurrent refreshes into one request.
  const N = window.ClinicNotifications;
  if (N && typeof N.refresh === 'function' && !N.__v96Guarded) {
    const originalRefresh = N.refresh.bind(N);
    let inFlight = null;

    N.refresh = async function(...args) {
      if (document.hidden) return;
      if (inFlight) return inFlight;

      inFlight = Promise.resolve()
        .then(() => originalRefresh(...args))
        .finally(() => { inFlight = null; });

      return inFlight;
    };

    N.__v96Guarded = true;
  }

  // 2) The Messenger-style chat pages were refreshing every ~3.5 s.
  // On Nano compute this is unnecessarily aggressive, especially with
  // multiple staff devices. Intercept only chat polling intervals created
  // after this guard loads and enforce a 15 s minimum. Other clinic timers
  // are left unchanged.
  const nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = function(callback, delay, ...rest) {
    let effectiveDelay = Number(delay || 0);

    try {
      const source = Function.prototype.toString.call(callback);
      const isChatPoll =
        source.includes('clinic-chat-thread') ||
        source.includes('clinic-team-chat') ||
        source.includes('Chat refresh failed') ||
        source.includes('Team chat refresh failed');

      if (isChatPoll && effectiveDelay > 0 && effectiveDelay < 15000) {
        effectiveDelay = 15000;
      }
    } catch (_) {}

    return nativeSetInterval(callback, effectiveDelay, ...rest);
  };

  // 3) When the app becomes visible again, refresh notifications once.
  // This replaces wasted hidden-tab polling with one useful catch-up read.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      window.ClinicNotifications?.refresh?.().catch?.(() => {});
    }
  });

  console.info('Clinic V96 load guard active');
})();
