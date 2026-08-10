(() => {

  // =========================================================
  // IMPORTANT:
  // Paste ONLY your PUBLIC VAPID key below.
  // Never put the private VAPID key in GitHub.
  // =========================================================

  const VAPID_PUBLIC_KEY =
    'BEuGMqiPq8ehEUJL1uxpWR_U5D5uu0dTxH-_sVz0B2exi0PIPy5ykfbj_sza2JFsVP19V1spwbSdTadeoFHMSvA';


  function clinic() {
    return window.Clinic || null;
  }


  function supabaseClient() {
    return (
      window.Clinic?.sb
      ||
      window.supabaseClient
      ||
      null
    );
  }


  function isArabic() {
    return (
      document.documentElement.lang === 'ar'
      ||
      document.documentElement.dir === 'rtl'
      ||
      window.Clinic?.lang === 'ar'
    );
  }


  function text(ar,en) {
    return isArabic()
      ? ar
      : en;
  }


  function urlBase64ToUint8Array(
    base64String
  ) {

    const padding =
      '='.repeat(
        (
          4
          -
          base64String.length % 4
        )
        % 4
      );


    const base64 =
      (
        base64String
        + padding
      )
      .replace(/-/g,'+')
      .replace(/_/g,'/');


    const rawData =
      atob(base64);


    return Uint8Array.from(
      [...rawData].map(
        char=>
          char.charCodeAt(0)
      )
    );
  }


  function toast(message,type='success') {

    if (
      window.Clinic?.toast
    ) {

      window.Clinic.toast(
        message,
        type
      );

      return;
    }


    alert(message);
  }


  async function waitForClinicUser() {

    for (
      let i=0;
      i<40;
      i++
    ) {

      if (
        window.Clinic?.user?.id
      ) {
        return true;
      }


      await new Promise(
        resolve=>
          setTimeout(
            resolve,
            250
          )
      );
    }


    return false;
  }


  async function saveSubscription(
    subscription
  ) {

    const client =
      supabaseClient();


    if (!client) {
      throw new Error(
        'Supabase client unavailable'
      );
    }


    const json =
      subscription.toJSON();


    if (
      !json.endpoint
      ||
      !json.keys?.p256dh
      ||
      !json.keys?.auth
    ) {

      throw new Error(
        'Invalid browser push subscription'
      );
    }


    const {
      error
    } =
      await client.rpc(
        'save_push_subscription',
        {
          p_endpoint:
            json.endpoint,

          p_p256dh:
            json.keys.p256dh,

          p_auth_key:
            json.keys.auth,

          p_user_agent:
            navigator.userAgent
        }
      );


    if (error) {
      throw error;
    }
  }


  async function getCurrentSubscription() {

    const registration =
      await navigator
        .serviceWorker
        .ready;


    return registration
      .pushManager
      .getSubscription();
  }


  async function refreshButton() {

    const button =
      document.getElementById(
        'enablePushNotifications'
      );


    if (!button) {
      return;
    }


    if (
      !('Notification' in window)
      ||
      !('serviceWorker' in navigator)
      ||
      !('PushManager' in window)
    ) {

      button.textContent =
        text(
          'الإشعارات غير مدعومة',
          'Push unsupported'
        );

      button.disabled =
        true;

      return;
    }


    if (
      Notification.permission ===
      'denied'
    ) {

      button.textContent =
        text(
          '🔕 الإشعارات محظورة',
          '🔕 Push blocked'
        );

      button.disabled =
        true;

      return;
    }


    try {

      const subscription =
        await getCurrentSubscription();


      if (
        Notification.permission ===
          'granted'
        &&
        subscription
      ) {

        button.textContent =
          text(
            '✓ الإشعارات مفعلة',
            '✓ Push enabled'
          );

        button.classList.add(
          'push-enabled'
        );

        return;
      }

    }
    catch(error) {

      console.warn(
        'Push state check failed',
        error
      );
    }


    button.textContent =
      text(
        '🔔 تفعيل الإشعارات',
        '🔔 Enable push'
      );

    button.classList.remove(
      'push-enabled'
    );

    button.disabled =
      false;
  }


  async function enablePush() {

    if (
      VAPID_PUBLIC_KEY ===
        'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'
      ||
      VAPID_PUBLIC_KEY.length < 30
    ) {

      toast(
        text(
          'ضع VAPID_PUBLIC_KEY في ملف push-notifications.js أولاً.',
          'Paste your VAPID_PUBLIC_KEY into push-notifications.js first.'
        ),
        'error'
      );

      return;
    }


    if (
      !('Notification' in window)
      ||
      !('serviceWorker' in navigator)
      ||
      !('PushManager' in window)
    ) {

      toast(
        text(
          'هذا المتصفح لا يدعم إشعارات الويب.',
          'This browser does not support web push.'
        ),
        'error'
      );

      return;
    }


    const permission =
      await Notification
        .requestPermission();


    if (
      permission !== 'granted'
    ) {

      toast(
        text(
          'لم يتم السماح بالإشعارات.',
          'Notification permission was not granted.'
        ),
        'error'
      );

      await refreshButton();

      return;
    }


    const registration =
      await navigator
        .serviceWorker
        .ready;


    let subscription =
      await registration
        .pushManager
        .getSubscription();


    if (!subscription) {

      subscription =
        await registration
          .pushManager
          .subscribe({

            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY
              )
          });
    }


    await saveSubscription(
      subscription
    );


    toast(
      text(
        'تم تفعيل إشعارات العيادة على هذا الجهاز.',
        'Clinic push notifications enabled on this device.'
      )
    );


    await refreshButton();
  }


  function createButton() {

    if (
      document.getElementById(
        'enablePushNotifications'
      )
    ) {
      return;
    }


    const bell =
      document.getElementById(
        'notificationButton'
      );


    if (!bell) {
      return;
    }


    const button =
      document.createElement(
        'button'
      );


    button.id =
      'enablePushNotifications';


    button.type =
      'button';


    button.className =
      'notification-button push-enable-button';


    button.title =
      text(
        'تفعيل إشعارات العيادة',
        'Enable clinic push notifications'
      );


    button.addEventListener(
      'click',
      async()=>{

        button.disabled =
          true;

        try {

          await enablePush();

        }
        catch(error) {

          console.error(
            'Push enable failed',
            error
          );


          toast(
            error?.message
            ||
            text(
              'تعذر تفعيل الإشعارات.',
              'Could not enable push notifications.'
            ),
            'error'
          );

        }
        finally {

          await refreshButton();
        }
      }
    );


    bell.insertAdjacentElement(
      'afterend',
      button
    );


    refreshButton();
  }


  async function silentlyResaveExistingSubscription() {

    if (
      Notification.permission !==
        'granted'
    ) {
      return;
    }


    const subscription =
      await getCurrentSubscription();


    if (subscription) {

      await saveSubscription(
        subscription
      );
    }
  }


  async function start() {

    const loggedIn =
      await waitForClinicUser();


    if (!loggedIn) {
      return;
    }


    createButton();


    try {

      await silentlyResaveExistingSubscription();

    }
    catch(error) {

      console.warn(
        'Existing push subscription refresh failed',
        error
      );
    }
  }


  window.ClinicPush = {
    enable:
      enablePush,

    refresh:
      refreshButton
  };


  if (
    document.readyState ===
      'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      start
    );

  }
  else {

    start();
  }

})();
