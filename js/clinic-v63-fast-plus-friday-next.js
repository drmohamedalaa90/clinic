(() => {
  const C = window.Clinic;
  if (!C || C.__v63FastCalendarLoaded) return;
  C.__v63FastCalendarLoaded = true;

  const doc = document;
  let fridayClickInFlight = false;

  const DAY_NAMES = [
    'Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday',
    'السبت','الأحد','الاحد','الإثنين','الاثنين','الثلاثاء',
    'الأربعاء','الاربعاء','الخميس','الجمعة'
  ];

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const DAY_RE = new RegExp('^(' + DAY_NAMES.map(esc).join('|') + ')$','i');
  const ANY_DAY_RE = new RegExp('(' + DAY_NAMES.map(esc).join('|') + ')','gi');

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

    const g=t=>p.find(x=>x.type===t)?.value||'';

    return {
      year:Number(g('year')),
      month:Number(g('month')),
      day:Number(g('day')),
      weekday:g('weekday')
    };
  }

  function todayDate(){
    const p=cairoParts();
    return new Date(Date.UTC(p.year,p.month-1,p.day,12));
  }

  function nextSaturday(date){
    const d=new Date(date);
    const add=(6-d.getUTCDay()+7)%7 || 7;
    d.setUTCDate(d.getUTCDate()+add);
    return d;
  }

  function ymd(d){
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function dmyToYmd(text=''){
    const m=String(text).match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  function addStyles(){
    if(doc.getElementById('v63-fast-plus-style')) return;

    const s=doc.createElement('style');
    s.id='v63-fast-plus-style';
    s.textContent=`
      .v63-day-head{
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
        width:100% !important;
      }
      .v63-day-plus{
        width:28px;height:28px;min-width:28px;
        padding:0;margin:0;
        border:1px solid #f59e0b;
        border-radius:9px;
        background:#fff7ed;
        color:#b45309;
        display:inline-grid;
        place-items:center;
        line-height:1;
        font-size:15px;
        cursor:pointer;
        flex:0 0 auto;
      }
      .v63-day-plus:hover{background:#ffedd5}
    `;
    doc.head.appendChild(s);
  }

  function cleanOldPlus(){
    doc.querySelectorAll(
      '.v53-day-extra-btn,.v54-day-extra-btn,.v54-day-extra-slot,'+
      '.v56-day-plus,.v56-day-plus-wrap,.v57-day-plus,.v58-day-plus,'+
      '.v59-day-plus,.v60-day-plus,.v62-day-plus'
    ).forEach(el=>el.remove());
  }

  function parseDayDate(col){
    const direct =
      col.dataset?.date ||
      col.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

    return dmyToYmd(col.textContent||'');
  }

  function findDayColumns(){
    const labels=[...doc.querySelectorAll('div,span,strong,h3,h4')]
      .filter(el=>DAY_RE.test((el.textContent||'').trim()));

    const out=[];

    for(const label of labels){
      let col=label.parentElement;
      let hops=0;

      while(col && hops<6){
        const text=(col.textContent||'').trim();
        const dayCount=(text.match(ANY_DAY_RE)||[]).length;
        const hasDate=/\b\d{2}\/\d{2}\/\d{4}\b/.test(text);

        if(dayCount===1 && hasDate) break;

        col=col.parentElement;
        hops++;
      }

      if(!col) continue;

      const date=parseDayDate(col);
      if(!date) continue;

      if(!out.some(x=>x.col===col)) out.push({col,label,date});
    }

    return out;
  }

  function openExtra(date){
    if(typeof C.openExtraCaseModal==='function'){
      C.openExtraCaseModal({date});
      return;
    }

    const top=doc.getElementById('v51ExtraCaseButton');
    if(top){
      top.click();
      setTimeout(()=>{
        const input=doc.querySelector('#v62Date,#v54Date,#v52Date,#v51ExtraDate');
        if(input){
          input.value=date;
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },20);
    }
  }

  function injectPlusImmediately(){
    if(!isAppointmentsPage()) return;

    cleanOldPlus();

    for(const {col,label,date} of findDayColumns()){
      if(col.querySelector('.v63-day-plus')) continue;

      let row=label.parentElement;

      if(!row || row===col || /\d{1,2}:\d{2}/.test(row.textContent||'')){
        row=doc.createElement('div');
        row.className='v63-day-head';
        label.parentNode.insertBefore(row,label);
        row.appendChild(label);
      }else{
        row.classList.add('v63-day-head');
      }

      const btn=doc.createElement('button');
      btn.type='button';
      btn.className='v63-day-plus';
      btn.textContent='＋';
      btn.title=C.lang==='ar'
        ?'إضافة حالة إضافية لهذا اليوم'
        :'Add extra case for this day';

      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        openExtra(date);
      });

      row.appendChild(btn);
    }
  }

  function firstWeekStart(){
    const candidates=[...doc.querySelectorAll('h1,h2,h3,strong,div')]
      .map(el=>({el,text:(el.textContent||'').trim()}))
      .filter(x=>/^\d{2}\/\d{2}\/\d{4}\s*[–-]\s*\d{2}\/\d{2}\/\d{4}$/.test(x.text));

    if(!candidates.length) return null;

    return dmyToYmd(candidates[0].text);
  }

  function findNextButton(){
    return [...doc.querySelectorAll('button')].find(btn=>{
      const t=(btn.textContent||'').replace(/\s+/g,' ').trim();
      return /^Next\b/i.test(t) || /^التالي\b/.test(t);
    });
  }

  function ensureFridayNextWeek(){
    if(!isAppointmentsPage()) return;
    if(cairoParts().weekday!=='Fri') return;

    const target=ymd(nextSaturday(todayDate()));
    const current=firstWeekStart();

    // Calendar not rendered yet.
    if(!current) return;

    // Already correct.
    if(current===target){
      fridayClickInFlight=false;
      return;
    }

    // Prevent repeated rapid clicks during rerender.
    if(fridayClickInFlight) return;

    const next=findNextButton();
    if(!next) return;

    fridayClickInFlight=true;
    next.click();

    setTimeout(()=>{
      fridayClickInFlight=false;
      ensureFridayNextWeek();
    },100);
  }

  function run(){
    if(!isAppointmentsPage()) return;

    injectPlusImmediately();
    ensureFridayNextWeek();
  }

  addStyles();

  // Run very early and repeatedly during the first render.
  [0,10,20,40,80,140,220,350,500,800,1200].forEach(ms=>{
    setTimeout(run,ms);
  });

  new MutationObserver(()=>{
    clearTimeout(window.__v63ObsTimer);
    window.__v63ObsTimer=setTimeout(run,5);
  }).observe(doc.body,{
    childList:true,
    subtree:true
  });

  doc.addEventListener('click',e=>{
    if(e.target.closest('.app-lang-btn')){
      setTimeout(run,20);
      setTimeout(run,100);
    }
  });

  run();
})();
