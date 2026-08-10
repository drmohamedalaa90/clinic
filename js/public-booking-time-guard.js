(() => {

  function closePassedPublicSlots(){

    const select =
      document.getElementById(
        'clinicSlot'
      );


    if(!select){
      return;
    }


    const now =
      Date.now();


    let removed =
      0;


    [...select.options]
      .forEach(
        option=>{

          if(
            !option.value
            ||
            !option.value.includes(
              '|'
            )
          ){
            return;
          }


          const [
            start
          ] =
            option.value.split(
              '|'
            );


          const stamp =
            new Date(
              start
            ).getTime();


          if(
            Number.isFinite(
              stamp
            )
            &&
            stamp <= now
          ){

            option.remove();

            removed++;
          }
        }
      );


    const usable =
      [...select.options]
        .filter(
          option=>
            option.value
        );


    if(
      !usable.length
      &&
      document
        .getElementById(
          'clinicDate'
        )
        ?.value
    ){

      select.disabled =
        true;


      select.innerHTML = `
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
          'تم إغلاق الساعات التي مر موعد بدايتها. اختر يوماً آخر.';
      }
    }
  }


  const observer =
    new MutationObserver(
      closePassedPublicSlots
    );


  observer.observe(
    document.body,
    {
      childList:
        true,

      subtree:
        true
    }
  );


  setInterval(
    closePassedPublicSlots,
    30000
  );


  closePassedPublicSlots();

})();
