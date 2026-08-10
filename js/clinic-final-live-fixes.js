(() => {

  let channel = null;
  let pollTimer = null;
  let reloadTimer = null;
  let lastAppointmentId = null;
  let pendingReload = false;
  let started = false;


  function C(){
    return window.Clinic || null;
  }


  function modalOpen(){

    const root =
      document.getElementById(
        'modalRoot'
      );


    return Boolean(
      root
      &&
      !root.classList.contains(
        'hidden'
      )
    );
  }


  function sortNotificationsNewestFirst(){

    const N =
      window.ClinicNotifications;


    if(
      !N
      ||
      !Array.isArray(
        N.items
      )
    ){
      return;
    }


    N.items.sort(
      (a,b)=>
        new Date(
          b.time || 0
        ).getTime()
        -
        new Date(
          a.time || 0
        ).getTime()
    );


    N.render?.();
    N.renderDashboard?.();
  }


  function patchNotificationRefresh(){

    const N =
      window.ClinicNotifications;


    if(
      !N
      ||
      N.__v29NewestFirst
    ){
      return;
    }


    N.__v29NewestFirst =
      true;


    const original =
      N.refresh.bind(
        N
      );


    N.refresh =
      async (...args)=>{

        const result =
          await original(
            ...args
          );


        sortNotificationsNewestFirst();


        return result;
      };


    sortNotificationsNewestFirst();
  }


  function hardReloadSoon(){

    clearTimeout(
      reloadTimer
    );


    reloadTimer =
      setTimeout(
        ()=>{

          if(
            document.hidden
            ||
            modalOpen()
          ){

            pendingReload =
              true;

            return;
          }


          /*
           * User specifically requested that a new appointment updates
           * the laptop page automatically. A real browser reload is more
           * reliable than trying to guess the current SPA route.
           */
          window.location.reload();

        },
        500
      );
  }


  async function latestAppointment(){

    const clinic =
      C();


    if(
      !clinic?.sb
      ||
      !clinic?.user?.id
    ){
      return null;
    }


    const {
      data,
      error
    } =
      await clinic.sb
        .from(
          'appointments'
        )
        .select(
          'id,created_at'
        )
        .order(
          'created_at',
          {
            ascending:false
          }
        )
        .limit(
          1
        );


    if(error){

      console.warn(
        'V29 appointment poll failed',
        error
      );

      return null;
    }


    return data?.[0] || null;
  }


  async function poll(){

    const latest =
      await latestAppointment();


    if(!latest){
      return;
    }


    if(
      lastAppointmentId===null
    ){

      lastAppointmentId =
        latest.id;

      return;
    }


    if(
      latest.id
      !==
      lastAppointmentId
    ){

      lastAppointmentId =
        latest.id;


      console.info(
        'V29 detected new appointment:',
        latest.id
      );


      hardReloadSoon();
    }


    try{

      await window
        .ClinicNotifications
        ?.refresh?.();

      sortNotificationsNewestFirst();

    }
    catch(error){

      console.warn(
        'V29 notification refresh failed',
        error
      );
    }
  }


  async function waitForClinic(){

    for(
      let i=0;
      i<120;
      i++
    ){

      if(
        C()?.user?.id
        &&
        C()?.sb
      ){
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


  function subscribe(){

    const clinic =
      C();


    if(!clinic?.sb){
      return;
    }


    if(channel){

      clinic.sb.removeChannel(
        channel
      );
    }


    channel =
      clinic.sb
        .channel(
          `clinic-v29-live-${clinic.user.id}`
        )
        .on(
          'postgres_changes',
          {
            event:'INSERT',
            schema:'public',
            table:'appointments'
          },
          payload=>{

            const id =
              payload.new?.id;


            if(id){

              lastAppointmentId =
                id;
            }


            console.info(
              'V29 realtime new appointment:',
              id || ''
            );


            hardReloadSoon();
          }
        )
        .subscribe(
          status=>
            console.info(
              'V29 realtime status:',
              status
            )
        );
  }


  async function start(){

    if(started){
      return;
    }


    const ready =
      await waitForClinic();


    if(!ready){
      return;
    }


    started =
      true;


    patchNotificationRefresh();


    const latest =
      await latestAppointment();


    lastAppointmentId =
      latest?.id || null;


    subscribe();


    pollTimer =
      setInterval(
        poll,
        3000
      );
  }


  document.addEventListener(
    'visibilitychange',
    ()=>{

      if(
        !document.hidden
        &&
        pendingReload
        &&
        !modalOpen()
      ){

        pendingReload =
          false;

        window.location.reload();
      }
    }
  );


  const observer =
    new MutationObserver(
      ()=>{

        if(
          pendingReload
          &&
          !modalOpen()
        ){

          pendingReload =
            false;

          window.location.reload();
        }
      }
    );


  function observeModal(){

    const root =
      document.getElementById(
        'modalRoot'
      );


    if(root){

      observer.observe(
        root,
        {
          attributes:true,
          attributeFilter:[
            'class'
          ],
          childList:true
        }
      );
    }
  }


  window.addEventListener(
    'beforeunload',
    ()=>{

      clearInterval(
        pollTimer
      );


      if(
        channel
        &&
        C()?.sb
      ){

        C().sb.removeChannel(
          channel
        );
      }
    }
  );


  if(
    document.readyState==='loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      ()=>{

        observeModal();
        start();
      }
    );

  }
  else{

    observeModal();
    start();
  }

})();
