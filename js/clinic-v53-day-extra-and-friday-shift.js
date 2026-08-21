(() => {
  const C = window.Clinic;
  if (!C || C.__v53DayExtraLoaded) return;
  C.__v53DayExtraLoaded = true;

  function addStyles(){
    if(document.getElementById('v53-day-extra-styles')) return;

    const style=document.createElement('style');
    style.id='v53-day-extra-styles';
    style.textContent=`
      .v53-day-extra-btn{
        width:30px;
        height:30px;
        min-width:30px;
        border:1px solid #f59e0b;
        border-radius:9px;
        background:#fff7ed;
        color:#b45309;
        display:inline-grid;
        place-items:center;
        font-size:16px;
        line-height:1;
        cursor:pointer;
        box-shadow:0 1px 2px rgba(15,23,42,.05);
      }
      .v53-day-extra-btn:hover{
        background:#ffedd5;
      }
      .v53-day-extra-btn[disabled]{
        opacity:.45;
        cursor:not-allowed;
      }
      .v53-day-header-actions{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }
      .v53-day-extra-wrap{
        display:flex;
        align-items:center;
        gap:6px;
      }
    `;
    document.head.appendChild(style);
  }

  function isAppointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function cairoDateObj(){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit'
    }).formatToParts(new Date());

    const get=t=>Number(parts.find(x=>x.type===t)?.value||0);

    return new Date(Date.UTC(
      get('year'),
      get('month')-1,
      get('day'),
      12,0,0
    ));
  }

  function ymd(date){
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth()+1).padStart(2,'0'),
      String(date.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function addDays(date,n){
    const d=new Date(date);
    d.setUTCDate(d.getUTCDate()+n);
    return d;
  }

  function saturdayStart(date){
    const d=new Date(date);
    const dow=d.getUTCDay(); // Sun=0..Sat=6
    const daysSinceSaturday=(dow+1)%7;
    d.setUTCDate(d.getUTCDate()-daysSinceSaturday);
    return d;
  }

  function nextSaturdayFrom(date){
    const d=new Date(date);
    const dow=d.getUTCDay();
    const add=(6-dow+7)%7 || 7;
    d.setUTCDate(d.getUTCDate()+add);
    return d;
  }

  function shouldFridayShift(){
    const now=cairoDateObj();
    return now.getUTCDay()===5; // Friday
  }

  function shiftToNextWeekOnFriday(){
    if(!isAppointmentsPage() || !shouldFridayShift()) return;

    const key='v53-friday-shift-'+ymd(cairoDateObj());
    if(sessionStorage.getItem(key)==='1') return;

    const nextSat=ymd(nextSaturdayFrom(cairoDateObj()));

    // Try the known jump/date controls used by the appointments page.
    const jump=
      document.querySelector(
        '#jumpDate, #calendarJumpDate, input[type="date"][data-jump-date]'
      );

    if(jump){
      jump.value=nextSat;
      jump.dispatchEvent(new Event('change',{bubbles:true}));
      sessionStorage.setItem(key,'1');
      return;
    }

    // Fallback: if Clinic has route/date state, prefer updating it.
    if(C.calendarStartDate!==undefined){
      C.calendarStartDate=nextSat;
    }

    // Click "Next" only when the page currently begins with this week's Saturday.
    const weekTitles=[...document.querySelectorAll('h2,h3,strong')]
      .map(x=>x.textContent?.trim()||'')
      .filter(Boolean);

    const thisSat=ymd(saturdayStart(cairoDateObj()));
    const thisSatDisplay=thisSat.split('-').reverse().join('/');

    if(weekTitles.some(t=>t.includes(thisSatDisplay))){
      const nextBtn=
        document.querySelector(
          '#nextWeek, [data-next-week], button'
        );

      const candidates=[...document.querySelectorAll('button')];
      const byText=candidates.find(
        b=>/next/i.test(b.textContent||'')
      );

      (nextBtn?.matches?.('#nextWeek,[data-next-week]')?nextBtn:byText)?.click?.();
      sessionStorage.setItem(key,'1');
    }
  }

  function dayDateFromColumn(dayCol){
    if(!dayCol) return null;

    // Prefer explicit data-date if present.
    const direct=
      dayCol.dataset?.date ||
      dayCol.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)){
      return direct;
    }

    // Parse dd/mm/yyyy visible in the header.
    const text=dayCol.textContent||'';
    const m=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if(m){
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    return null;
  }

  function doctorForCurrentPage(){
    if(C.currentPage==='doctor-appointments'){
      return C.user?.id||'';
    }

    return (
      document.querySelector(
        '#doctorSelect, #calendarDoctor, select[data-doctor-select]'
      )?.value
      ||
      C.doctors?.[0]?.id
      ||
      ''
    );
  }

  function openExtraCaseForDay(day){
    // Reuse V52's existing button/modal if available.
    const globalBtn=document.getElementById('v51ExtraCaseButton');
    if(globalBtn){
      globalBtn.click();

      // Fill date after modal opens.
      setTimeout(()=>{
        const dateInput=
          document.querySelector('#v52Date, #v51ExtraDate');
        if(dateInput){
          dateInput.value=day;
          dateInput.dispatchEvent(new Event('change',{bubbles:true}));
        }

        const doctor=doctorForCurrentPage();
        const doctorSelect=
          document.querySelector('#v52Doctor, #v51ExtraDoctor');

        if(doctorSelect && doctor){
          doctorSelect.value=doctor;
          doctorSelect.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },60);

      return;
    }

    C.toast(
      C.lang==='ar'
        ?'تعذر فتح نافذة الحالة الإضافية.'
        :'Could not open the extra-case form.',
      'error'
    );
  }

  function injectDayButtons(){
    if(!isAppointmentsPage()) return;

    // Identify day columns by visible weekday/date headers.
    const all=[...document.querySelectorAll('div,section,article')];

    const candidates=all.filter(el=>{
      if(el.dataset?.v53Checked==='1') return false;

      const text=(el.textContent||'').trim();

      return (
        /\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i.test(text)
        &&
        /\b\d{2}\/\d{2}\/\d{4}\b/.test(text)
        &&
        el.querySelector('strong,h3,h4')
      );
    });

    for(const col of candidates){
      col.dataset.v53Checked='1';

      const day=dayDateFromColumn(col);
      if(!day) continue;

      // Find the smallest plausible header region.
      let header=
        [...col.children].find(ch=>{
          const t=(ch.textContent||'');
          return (
            /\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i.test(t)
            &&
            /\b\d{2}\/\d{2}\/\d{4}\b/.test(t)
          );
        });

      if(!header) header=col;

      if(header.querySelector('.v53-day-extra-btn')) continue;

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='v53-day-extra-btn';
      btn.title=
        C.lang==='ar'
          ?'إضافة حالة إضافية لهذا اليوم'
          :'Add extra case for this day';
      btn.setAttribute('aria-label',btn.title);
      btn.textContent='＋';

      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        openExtraCaseForDay(day);
      });

      header.appendChild(btn);
    }
  }

  function run(){
    addStyles();
    shiftToNextWeekOnFriday();
    injectDayButtons();
  }

  const observer=new MutationObserver(run);
  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  run();
})();
