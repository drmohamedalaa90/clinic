window.addEventListener('load', async () => {

  if (
    !('serviceWorker' in navigator) ||
    location.protocol !== 'https:'
  ) {
    return;
  }

  try {

    const registration =
      await navigator.serviceWorker.register(
        './sw.js?v=30-safe-public-booking',
        {
          scope: './',
          updateViaCache: 'none'
        }
      );

    await registration.update();

    console.info(
      'V30 service worker:',
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      ''
    );

  } catch (error) {

    console.warn(
      'V30 service worker update failed',
      error
    );
  }
});
