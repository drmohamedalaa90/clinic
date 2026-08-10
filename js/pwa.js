window.addEventListener(
  'load',
  async()=>{

    if(
      !('serviceWorker' in navigator)
      ||
      location.protocol!=='https:'
    ){
      return;
    }


    try{

      const registration =
        await navigator
          .serviceWorker
          .register(
            './sw.js?v=28-one-push-per-appointment',
            {
              scope:'./',
              updateViaCache:'none'
            }
          );


      await registration.update();


      console.info(
        'Clinic service worker:',
        registration.active?.scriptURL
        ||
        registration.waiting?.scriptURL
        ||
        registration.installing?.scriptURL
        ||
        ''
      );

    }
    catch(error){

      console.warn(
        'Service worker registration failed',
        error
      );
    }
  }
);
