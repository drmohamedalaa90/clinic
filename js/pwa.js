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

      /*
       * Changing this URL forces Safari/Chrome to evaluate a genuinely
       * new worker instead of continuing to use an older cached sw.js.
       */
      const registration =
        await navigator
          .serviceWorker
          .register(
            './sw.js?v=27-final',
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
