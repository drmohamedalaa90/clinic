(() => {

  /*
   * CLINIC V42
   * PUBLIC BOOKING TIME GUARD
   *
   * IMPORTANT RULE:
   * A 15:00-16:00 clinic slot remains bookable until 16:00.
   * It is NOT closed merely because 15:00 has passed.
   *
   * This file is a COMPLETE replacement for:
   * js/public-booking-time-guard.js
   */

  let running = false;


  function closePassedPublicSlots(){

    if(running){
      return;
    }


    const slotSelect =
      document.getElementById(
        'clinicSlot'
      );


    const dateSelect =
      document.getElementById(
        'clinicDate'
      );


    if(
      !slotSelect
      ||
      !dateSelect
      ||
      !dateSelect.value
    ){
      return;
    }


    /*
     * Real slot values are:
     * SLOT_START|SLOT_END
     *
     * Do not touch the selector while book.html is still
     * displaying a temporary Loading... option.
     */
    const realOptions =
      Array.from(
        slotSelect.options
      )
      .filter(
        option=>
          option.value
          &&
          option.value.includes(
            '|'
          )
      );


    if(!realOptions.length){
      return;
    }


    running = true;


    try{

      const now =
        Date.now();


      realOptions.forEach(
        option=>{

          const parts =
            option.value.split(
              '|'
            );


          if(parts.length !== 2){
            return;
          }


          const slotEnd =
            parts[1];


          const closingTime =
            new Date(
              slotEnd
            ).getTime();


          /*
           * CLOSE ONLY WHEN SLOT END HAS PASSED.
           *
           * 15:00-16:00:
           * 15:01 -> open
           * 15:30 -> open
           * 15:59 -> open
           * 16:00 -> closed
           */
          if(
            Number.isFinite(
              closingTime
            )
            &&
            closingTime <= now
          ){

            option.remove();
          }
        }
      );


      const remaining =
        Array.from(
          slotSelect.options
        )
        .filter(
          option=>
            option.value
            &&
            option.value.includes(
              '|'
            )
        );


      if(!remaining.length){

        if(
          slotSelect.dataset
            .v42ClosingState
          !==
          'closed'
        ){

          slotSelect.dataset
            .v42ClosingState =
              'closed';


          slotSelect.disabled =
            true;


          slotSelect.innerHTML = `
            <option value="">
              انتهت المواعيد المتاحة لهذا اليوم
            </option>
          `;


          const message =
            document.getElementById(
              'availabilityMessage'
            );


          if(message){

            message.textContent =
              'تم إغلاق الساعات التي انتهى موعدها. اختر يوماً أو ساعة أخرى.';
          }
        }

      }
      else{

        slotSelect.dataset
          .v42ClosingState =
            'open';


        slotSelect.disabled =
          false;
      }

    }
    finally{

      running = false;
    }
  }


  function start(){

    const slotSelect =
      document.getElementById(
        'clinicSlot'
      );


    if(!slotSelect){

      setTimeout(
        start,
        250
      );

      return;
    }


    /*
     * Watch the slot selector ONLY.
     * Do not observe the whole document.
     */
    const observer =
      new MutationObserver(
        ()=>{
          requestAnimationFrame(
            closePassedPublicSlots
          );
        }
      );


    observer.observe(
      slotSelect,
      {
        childList:true
      }
    );


    setInterval(
      closePassedPublicSlots,
      15000
    );


    closePassedPublicSlots();
  }


  if(
    document.readyState ===
      'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      start,
      {
        once:true
      }
    );

  }
  else{

    start();
  }

})();
