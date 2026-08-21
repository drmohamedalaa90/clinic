(() => {
  const C = window.Clinic;
  if (!C || C.__v64StableFridayLoaded) return;
  C.__v64StableFridayLoaded = true;

  const doc = document;
  let fridayApplied = false;
  let timer = null;

  function isAppointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function cairoParts(){
    const p = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      weekday:'short'
    }).formatToParts(new Date());

    const get=t=>p.find(x=>x.type===t)?.value||'';

    return {
      year:Number(get('year')),
      month:Number(get('month')),
      day:Number(get('day')),
      weekday:get('weekday')
    };
  }

  function nextSaturdayIso(){
    const p=cairoParts();
    const d=new Date(Date.UTC(p.year,p.month-1,p.day,12,0,0));
    const add=(6-d.getUTCDay()+7)%7 || 7;
    d.setUTCDate(d.getUTCDate()+add);

    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth()+1).padStart(2,'0'),
      String(d.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function findJumpInput(){
    const explicit=doc.querySelector(
      '#jumpDate,#calendarJumpDate,input[data-jump-date][type="date"]'
    );

    if(explicit) return explicit;

    const dateInputs=[...doc.querySelectorAll('input[type="date"]')];

    return dateInputs.find(input=>{
      const wrap=input.closest('label,div,section') || input.parentElement;
      const text=(wrap?.textContent||'').toLowerCase();

      return (
        text.includes('jump') ||
        text.includes('اذهب')
      );
    }) || null;
  }

  function applyFridayOnce(){
    if(fridayApplied) return;
    if(!isAppointmentsPage()) return;
    if(cairoParts().weekday!=='Fri') return;

    const input=findJumpInput();
    if(!input) return;

    const target=nextSaturdayIso();

    // Guard against any accidental loop.
    fridayApplied=true;

    // Set the COMING Saturday exactly once.
    input.value=target;

    input.dispatchEvent(
      new Event('input',{bubbles:true})
    );

    input.dispatchEvent(
      new Event('change',{bubbles:true})
    );
  }

  function run(){
    if(!isAppointmentsPage()) return;

    // V62 owns the + buttons and new/existing patient modal.
    // V64 only handles the Friday initial week change.
    applyFridayOnce();
  }

  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(run,20);
  }).observe(
    doc.body,
    {
      childList:true,
      subtree:true
    }
  );

  // short finite startup checks only — NO repeated Next clicking
  [0,40,100,200,400,700].forEach(ms=>setTimeout(run,ms));

  run();
})();
