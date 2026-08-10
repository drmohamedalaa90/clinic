(() => {

  const REFRESH_PAGES = new Set([
    'dashboard',
    'appointments',
    'doctor-appointments',
    'today-clinic',
    'queue',
    'reception',
    'patients',
    'patient-detail',
    'finance'
  ]);

  let channel = null;
  let refreshTimer = null;
  let pendingRefresh = false;
  let started = false;


  function C() {
    return window.Clinic || null;
  }


  function modalIsOpen() {
    const root =
      document.getElementById(
        'modalRoot'
      );

    return Boolean(
      root &&
      !root.classList.contains(
        'hidden'
      )
    );
  }


  async function refreshCurrentPage() {

    const clinic = C();

    if (
      !clinic?.user?.id
      ||
      !clinic.currentPage
      ||
      !REFRESH_PAGES.has(
        clinic.currentPage
      )
    ) {
      return;
    }


    if (
      document.hidden
      ||
      modalIsOpen()
    ) {

      pendingRefresh = true;

      return;
    }


    pendingRefresh = false;


    const saved =
      clinic.loadRouteState?.();


    const page =
      saved?.page ||
      clinic.currentPage;


    const params =
      saved?.params ||
      {};


    try {

      await clinic.route(
        page,
        params
      );

    }
    catch(error) {

      console.error(
        'Realtime page refresh failed',
        error
      );
    }
  }


  function scheduleRefresh() {

    clearTimeout(
      refreshTimer
    );


    refreshTimer =
      setTimeout(
        async()=>{

          window
            .ClinicNotifications
            ?.refresh?.();


          await refreshCurrentPage();

        },
        450
      );
  }


  function onAppointmentChange(payload) {

    console.info(
      'Realtime appointment change',
      payload.eventType,
      payload.new?.id ||
      payload.old?.id ||
      ''
    );


    scheduleRefresh();
  }


  function onPatientChange(payload) {

    const clinic = C();


    if (
      !clinic ||
      ![
        'patients',
        'patient-detail',
        'appointments',
        'doctor-appointments',
        'today-clinic',
        'queue',
        'reception'
      ].includes(
        clinic.currentPage
      )
    ) {
      return;
    }


    console.info(
      'Realtime patient change',
      payload.eventType,
      payload.new?.id ||
      payload.old?.id ||
      ''
    );


    scheduleRefresh();
  }


  async function waitForLogin() {

    for (
      let i=0;
      i<60;
      i++
    ) {

      if (
        C()?.user?.id
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


  async function start() {

    if(started){
      return;
    }


    const loggedIn =
      await waitForLogin();


    if(!loggedIn){
      return;
    }


    const clinic =
      C();


    if(
      !clinic?.sb
    ){
      return;
    }


    started = true;


    channel =
      clinic.sb
        .channel(
          `clinic-live-${clinic.user.id}`
        )

        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'appointments'
          },
          onAppointmentChange
        )

        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'patients'
          },
          onPatientChange
        )

        .subscribe(
          (
            status,
            error
          )=>{

            if(
              status==='SUBSCRIBED'
            ){

              console.info(
                'Clinic realtime connected'
              );

              return;
            }


            if(error){

              console.error(
                'Clinic realtime error',
                status,
                error
              );
            }
          }
        );
  }


  document.addEventListener(
    'visibilitychange',
    ()=>{

      if(
        !document.hidden
        &&
        pendingRefresh
      ){

        scheduleRefresh();
      }
    }
  );


  /*
   * If a booking/edit modal was open while a realtime event arrived,
   * refresh immediately after the modal is closed rather than destroying
   * the user's in-progress form.
   */
  const modalObserver =
    new MutationObserver(
      ()=>{

        if(
          pendingRefresh
          &&
          !modalIsOpen()
        ){

          scheduleRefresh();
        }
      }
    );


  function observeModal(){

    const root =
      document.getElementById(
        'modalRoot'
      );


    if(!root){
      return;
    }


    modalObserver.observe(
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


  window.addEventListener(
    'beforeunload',
    ()=>{

      if(
        channel &&
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


  window.ClinicRealtime = {
    start,
    refresh:
      scheduleRefresh
  };

})();
