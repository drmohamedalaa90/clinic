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
        await navigator.serviceWorker.register(
          './sw.js?v=29-clean',
          {
            scope:'./',
            updateViaCache:'none'
          }
        );


      await registration.update();


      console.info(
        'V29 service worker:',
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
        'V29 service worker update failed',
        error
      );
    }
  }
);
