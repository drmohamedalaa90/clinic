(() => {

  /*
   * CLINIC V42
   * STAFF APPOINTMENT SLOT CLOSING PATCH
   *
   * Rule:
   * A current-day hourly slot closes at SLOT END.
   *
   * Example:
   * 15:00-16:00 stays bookable until 16:00.
   *
   * This is intentionally a small overlay instead of replacing
   * the very large appointments.js file.
   */

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function canBook(){

    /*
     * Preserve the practical staff booking roles already used
     * in the clinic application.
     */
    return Boolean(
      C.isManagement?.()
      ||
      C.hasRole?.(
        'secretary'
      )
      ||
      C.isDoctor?.()
    );
  }


  function cairoToday(){

    return C.cairoDate();
  }


  function parseDisplayedDate(
    value
  ){

    const text =
      String(
        value
        ||
        ''
      )
      .trim();


    /*
     * Existing appointment scheduler displays DD/MM/YYYY.
     */
    const match =
      text.match(
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/
      );


    if(!match){
      return null;
    }


    const day =
      String(
        match[1]
      ).padStart(
        2,
        '0'
      );


    const month =
      String(
        match[2]
      ).padStart(
        2,
        '0'
      );


    const year =
      match[3];


    return `${year}-${month}-${day}`;
  }


  function parseDisplayedTimes(
    value
  ){

    const text =
      String(
        value
        ||
        ''
      )
      .replace(
        /–|—/g,
        '-'
      );


    const times =
      text.match(
        /\b\d{1,2}:\d{2}\b/g
      );


    if(
      !times
      ||
      times.length < 2
    ){
      return null;
    }


    return {
      start:
        times[0],
      end:
        times[1]
    };
  }


  function makeCairoIso(
    date,
    time
  ){

    return `${date}T${time}:00+03:00`;
  }


  function patchScheduler(){

    if(
      C.currentPage !==
        'appointments'
      ||
      !canBook()
    ){
      return;
    }


    const today =
      cairoToday();


    document
      .querySelectorAll(
        '.scheduler-day-card'
      )
      .forEach(
        dayCard=>{

          const header =
            dayCard.querySelector(
              '.scheduler-day-header'
            );


          const dateText =
            header
              ?.querySelector(
                'span:not(.today-chip)'
              )
              ?.textContent
            ||
            '';


          const date =
            parseDisplayedDate(
              dateText
            );


          if(!date){
            return;
          }


          /*
           * Past calendar days remain closed.
           * Future days remain open according to normal capacity.
           * Only TODAY needs this end-time correction.
           */
          if(date !== today){
            return;
          }


          dayCard
            .querySelectorAll(
              '.hour-capacity-card'
            )
            .forEach(
              hourCard=>{

                const timeText =
                  hourCard
                    .querySelector(
                      '.hour-capacity-head strong'
                    )
                    ?.textContent
                  ||
                  '';


                const times =
                  parseDisplayedTimes(
                    timeText
                  );


                if(!times){
                  return;
                }


                const slotStart =
                  makeCairoIso(
                    date,
                    times.start
                  );


                const slotEnd =
                  makeCairoIso(
                    date,
                    times.end
                  );


                const endMs =
                  new Date(
                    slotEnd
                  ).getTime();


                if(
                  !Number.isFinite(
                    endMs
                  )
                ){
                  return;
                }


                const ended =
                  endMs <=
                  Date.now();


                hourCard
                  .querySelectorAll(
                    '.hour-patient-seat.empty'
                  )
                  .forEach(
                    seat=>{

                      /*
                       * Do not re-open a capacity-full seat.
                       */
                      const capacityText =
                        hourCard
                          .querySelector(
                            '.capacity-pill'
                          )
                          ?.textContent
                        ||
                        '';


                      const full =
                        hourCard
                          .classList
                          .contains(
                            'full'
                          )
                        ||
                        hourCard
                          .querySelector(
                            '.capacity-pill.full'
                          )
                        ||
                        /\b0\s+(left|متبقي)\b/i
                          .test(
                            capacityText
                          );


                      if(full){

                        seat.disabled =
                          true;

                        return;
                      }


                      const strong =
                        seat.querySelector(
                          '.seat-copy strong'
                        );


                      const small =
                        seat.querySelector(
                          '.seat-copy small'
                        );


                      if(ended){

                        seat.disabled =
                          true;


                        seat.removeAttribute(
                          'data-book-slot'
                        );


                        seat.removeAttribute(
                          'data-date'
                        );


                        seat.removeAttribute(
                          'data-start'
                        );


                        seat.removeAttribute(
                          'data-end'
                        );


                        if(strong){

                          strong.textContent =
                            C.lang==='ar'
                              ? 'مغلق'
                              : 'Closed';
                        }


                        if(small){

                          small.textContent =
                            C.lang==='ar'
                              ? 'انتهت الساعة'
                              : 'Slot ended';
                        }

                      }
                      else{

                        /*
                         * Slot has started but has NOT ended:
                         * keep remaining seats bookable.
                         */
                        seat.disabled =
                          false;


                        seat.dataset
                          .bookSlot =
                            '1';


                        seat.dataset
                          .date =
                            date;


                        seat.dataset
                          .start =
                            slotStart;


                        seat.dataset
                          .end =
                            slotEnd;


                        if(strong){

                          strong.textContent =
                            C.lang==='ar'
                              ? 'متاح'
                              : 'Available';
                        }


                        if(small){

                          small.textContent =
                            C.lang==='ar'
                              ? 'حجز مريض'
                              : 'Book patient';
                        }
                      }
                    }
                  );
              }
            );
        }
      );
  }


  /*
   * Appointment week re-renders often.
   * Re-apply after those DOM changes.
   */
  let pending =
    false;


  const observer =
    new MutationObserver(
      ()=>{

        if(pending){
          return;
        }


        pending =
          true;


        requestAnimationFrame(
          ()=>{

            pending =
              false;


            patchScheduler();
          }
        );
      }
    );


  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );


  /*
   * When 16:00 arrives, the 15:00-16:00 remaining seats
   * should close without needing a manual page refresh.
   */
  setInterval(
    patchScheduler,
    15000
  );


  patchScheduler();

})();
