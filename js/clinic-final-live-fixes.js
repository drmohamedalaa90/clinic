(() => {

  const LIVE_PAGES =
    new Set([
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
  let pollTimer = null;
  let lastAppointmentSignature = null;
  let started = false;


  function clinic(){
    return window.Clinic || null;
  }


  function modalIsOpen(){
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
        (
          new Date(
            b.time || 0
          ).getTime()
          -
          new Date(
            a.time || 0
          ).getTime()
        )
        ||
        (
          Number(
            b.priority || 0
          )
          -
          Number(
            a.priority || 0
          )
        )
    );


    N.render?.();

    N.renderDashboard?.();
  }


  function patchNotifications(){

    const N =
      window.ClinicNotifications;


    if(
      !N
      ||
      N.__newestFirstPatched
    ){
      return;
    }


    N.__newestFirstPatched =
      true;


    const originalRefresh =
      N.refresh.bind(
        N
      );


    N.refresh =
      async function(...args){

        const result =
          await originalRefresh(
            ...args
          );


        sortNotificationsNewestFirst();


        return result;
      };


    /*
     * If the drawer had already loaded before this patch,
     * re-sort immediately.
     */
    sortNotificationsNewestFirst();
  }


  async function refreshCurrentPage(){

    const C =
      clinic();


    if(
      !C?.user?.id
      ||
      !C.currentPage
      ||
      !LIVE_PAGES.has(
        C.currentPage
      )
    ){
      return;
    }


    if(
      document.hidden
      ||
      modalIsOpen()
    ){

      pendingRefresh =
        true;

      return;
    }


    pendingRefresh =
      false;


    const saved =
      C.loadRouteState?.();


    const page =
      saved?.page
      ||
      C.currentPage;


    const params =
      saved?.params
      ||
      {};


    try{

      await C.route(
        page,
        params
      );

    }
    catch(error){

      console.error(
        'Clinic live refresh failed',
        error
      );
    }
  }


  function scheduleRefresh(){

    clearTimeout(
      refreshTimer
    );


    refreshTimer =
      setTimeout(
        async()=>{

          try{

            await window
              .ClinicNotifications
              ?.refresh?.();

          }
          catch(error){

            console.warn(
              'Notification live refresh failed',
              error
            );
          }


          sortNotificationsNewestFirst();


          await refreshCurrentPage();

        },
        350
      );
  }


  async function waitForClinic(){

    for(
      let attempt=0;
      attempt<80;
      attempt++
    ){

      if(
        clinic()?.user?.id
        &&
        clinic()?.sb
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


  async function latestAppointmentSignature(){

    const C =
      clinic();


    if(!C?.sb){
      return null;
    }


    /*
     * RLS naturally limits this to appointments that the logged-in
     * staff member is allowed to see.
     */
    const {
      data,
      error
    } =
      await C.sb
        .from(
          'appointments'
        )
        .select(
          'id,status,updated_at,created_at'
        )
        .order(
          'updated_at',
          {
            ascending:false,
            nullsFirst:false
          }
        )
        .limit(
          1
        );


    if(error){

      /*
       * Old DB builds may not expose updated_at consistently.
       * Fall back to created_at.
       */
      const fallback =
        await C.sb
          .from(
            'appointments'
          )
          .select(
            'id,status,created_at'
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


      if(fallback.error){
        return null;
      }


      const row =
        fallback.data?.[0];


      return row
        ? `${row.id}|${row.status}|${row.created_at}`
        : 'empty';
    }


    const row =
      data?.[0];


    return row
      ? `${row.id}|${row.status}|${row.updated_at || row.created_at}`
      : 'empty';
  }


  async function runPollingFallback(){

    try{

      const signature =
        await latestAppointmentSignature();


      if(
        signature
        &&
        lastAppointmentSignature===null
      ){

        lastAppointmentSignature =
          signature;

      }
      else if(
        signature
        &&
        signature!==lastAppointmentSignature
      ){

        lastAppointmentSignature =
          signature;

        console.info(
          'Clinic polling detected an appointment change'
        );


        scheduleRefresh();
      }


      /*
       * Also keep the bell/drawer fresh even if a DB realtime event
       * was missed.
       */
      await window
        .ClinicNotifications
        ?.refresh?.();


      sortNotificationsNewestFirst();

    }
    catch(error){

      console.warn(
        'Clinic polling fallback failed',
        error
      );
    }
  }


  function startPolling(){

    clearInterval(
      pollTimer
    );


    /*
     * Realtime should normally be instant.
     * This 8-second poll is only a safety net.
     */
    pollTimer =
      setInterval(
        runPollingFallback,
        8000
      );


    runPollingFallback();
  }


  function subscribeRealtime(){

    const C =
      clinic();


    if(!C?.sb){
      return;
    }


    if(channel){

      C.sb.removeChannel(
        channel
      );

      channel =
        null;
    }


    channel =
      C.sb
        .channel(
          `clinic-final-live-${C.user.id}-${Date.now()}`
        )

        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'appointments'
          },
          payload=>{

            console.info(
              'LIVE appointment event',
              payload.eventType,
              payload.new?.id
              ||
              payload.old?.id
              ||
              ''
            );


            scheduleRefresh();
          }
        )

        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'patients'
          },
          payload=>{

            console.info(
              'LIVE patient event',
              payload.eventType,
              payload.new?.id
              ||
              payload.old?.id
              ||
              ''
            );


            scheduleRefresh();
          }
        )

        .subscribe(
          status=>{

            console.info(
              'Clinic realtime:',
              status
            );


            if(
              status==='CHANNEL_ERROR'
              ||
              status==='TIMED_OUT'
              ||
              status==='CLOSED'
            ){

              setTimeout(
                subscribeRealtime,
                2500
              );
            }
          }
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


    patchNotifications();

    await window
      .ClinicNotifications
      ?.refresh?.();

    sortNotificationsNewestFirst();


    subscribeRealtime();

    startPolling();
  }


  document.addEventListener(
    'visibilitychange',
    ()=>{

      if(!document.hidden){

        if(pendingRefresh){
          scheduleRefresh();
        }

        runPollingFallback();
      }
    }
  );


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

      clearInterval(
        pollTimer
      );


      if(
        channel
        &&
        clinic()?.sb
      ){

        clinic().sb.removeChannel(
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


  window.ClinicFinalLiveFixes = {
    start,
    refresh:
      scheduleRefresh,
    sortNotificationsNewestFirst
  };

})();
