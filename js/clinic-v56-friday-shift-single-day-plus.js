(() => {
  const C = window.Clinic;
  if (!C || C.__v56FridayShiftSinglePlusLoaded) return;
  C.__v56FridayShiftSinglePlusLoaded = true;

  function addStyles(){
    if(document.getElementById('v56-day-plus-styles')) return;
    const s=document.createElement('style');
    s.id='v56-day-plus-styles';
    s.textContent=`
      .v56-day-plus{
        width:30px;
        height:30px;
        min-width:30px;
        border:1px solid #f59e0b;
        border-radius:9px;
        background:#fff7ed;
        color:#b45309;
        display:grid;
        place-items:center;
        font-size:16px;
        line-height:1;
        cursor:pointer;
        margin-inline-start:auto;
      }
      .v56-day-plus:hover{ background:#ffedd5; }
      .v56-day-plus-wrap{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:8px;
        width:100%;
      }
    `;
    document.head.appendChild(s);
  }

  function isAppointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function cairoToday(){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit'
    }).formatToParts(new Date());

    const val=t=>Number(parts.find(x=>x.type===t)?.value||0);

    return new Date(Date.UTC(
      val('year'),
      val('month')-1,
      val('day'),
      12,0,0
    ));
  }

  function ymd(d){
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function displayDate(d){
    return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
  }

  function saturdayOfWeek(d){
    const x=new Date(d);
    const diff=(x.getUTCDay()+1)%7;
    x.setUTCDate(x.getUTCDate()-diff);
    return x;
  }

  function nextSaturday(d){
    const x=new Date(d);
    const add=(6-x.getUTCDay()+7)%7 || 7;
    x.setUTCDate(x.getUTCDate()+add);
    return x;
  }

  function parseWeekTitle(text){
    const m=String(text||'').match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/
    );
    if(!m) return null;

    return {
      start:`${m[3]}-${m[2]}-${m[1]}`,
      end:`${m[6]}-${m[5]}-${m[4]}`
    };
  }

  function getWeekContainers(){
    const all=[...document.querySelectorAll('section,div,article')];
    const weeks=[];

    for(const el of all){
      const ownText=(el.firstElementChild?.textContent||el.textContent||'').trim();
      const parsed=parseWeekTitle(ownText);
      if(!parsed) continue;

      // Prefer containers that actually have the seven day columns.
      const dates=(el.textContent||'').match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[];
      if(dates.length < 7) continue;

      // Avoid nested duplicates: keep smallest matching container.
      const nested=[...el.children].some(ch=>{
        const t=(ch.textContent||'').trim();
        return parseWeekTitle(t) && ((t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[]).length>=7);
      });
      if(nested) continue;

      weeks.push({el,...parsed});
    }

    return weeks;
  }

  function forceFridayFirstWeek(){
    if(!isAppointmentsPage()) return;

    const today=cairoToday();
    if(today.getUTCDay()!==5) return; // Friday only

    const target=ymd(nextSaturday(today));
    const weeks=getWeekContainers();
    if(!weeks.length) return;

    const targetIndex=weeks.findIndex(w=>w.start===target);
    if(targetIndex<0) return;

    // If target is already first visible week, done.
    if(targetIndex===0) return;

    // Best case: calendar has a real "next/current/jump" controller.
    const jump=
      document.querySelector(
        '#jumpDate,#calendarJumpDate,input[data-jump-date][type="date"]'
      );

    if(jump){
      jump.value=target;
      jump.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }

    // Otherwise hide weeks before target so the coming week becomes first.
    // This is deterministic and does not depend on button IDs.
    weeks.forEach((w,i)=>{
      if(i<targetIndex){
        w.el.style.display='none';
        w.el.dataset.v56FridayHidden='1';
      }else{
        if(w.el.dataset.v56FridayHidden==='1'){
          w.el.style.display='';
          delete w.el.dataset.v56FridayHidden;
        }
      }
    });

    // Focus top of target week once.
    const key='v56-friday-focused-'+ymd(today);
    if(sessionStorage.getItem(key)!=='1'){
      sessionStorage.setItem(key,'1');
      setTimeout(()=>{
        weeks[targetIndex].el.scrollIntoView({
          behavior:'auto',
          block:'start'
        });
      },50);
    }
  }

  function parseDayDate(node){
    const direct=
      node.dataset?.date ||
      node.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)){
      return direct;
    }

    const m=(node.textContent||'').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if(!m) return null;

    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function openExtra(date){
    if(typeof C.openExtraCaseModal==='function'){
      C.openExtraCaseModal({date});
      return;
    }

    const old=document.getElementById('v51ExtraCaseButton');
    if(old){
      old.click();
      setTimeout(()=>{
        const input=document.querySelector('#v54Date,#v52Date,#v51ExtraDate');
        if(input){
          input.value=date;
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },60);
      return;
    }

    C.toast(
      C.lang==='ar'
        ?'تعذر فتح نافذة الحالة الإضافية.'
        :'Could not open extra-case form.',
      'error'
    );
  }

  function removeOldDuplicateButtons(){
    document
      .querySelectorAll(
        '.v53-day-extra-btn,.v54-day-extra-btn,.v54-day-extra-slot'
      )
      .forEach(el=>el.remove());
  }

  function injectOnePlusPerDay(){
    if(!isAppointmentsPage()) return;

    removeOldDuplicateButtons();

    const weekdayRe=/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/i;
    const dateRe=/^\d{2}\/\d{2}\/\d{4}$/;

    // Find weekday labels and use their closest day-column ancestor.
    const textEls=[...document.querySelectorAll('div,span,strong,h3,h4')];

    const dayColumns=[];

    for(const el of textEls){
      const txt=(el.textContent||'').trim();
      if(!weekdayRe.test(txt)) continue;

      let col=el.parentElement;
      let hops=0;

      while(col && hops<5){
        const t=(col.textContent||'').trim();
        const dates=t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[];

        // Day column should have exactly one visible date and not another weekday.
        const weekdayMatches=t.match(/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/gi)||[];

        if(dates.length>=1 && weekdayMatches.length===1){
          break;
        }

        col=col.parentElement;
        hops++;
      }

      if(!col) continue;

      const date=parseDayDate(col);
      if(!date) continue;

      if(!dayColumns.some(x=>x.col===col)){
        dayColumns.push({col,date,weekdayEl:el});
      }
    }

    for(const {col,date,weekdayEl} of dayColumns){
      // Ensure exactly one V56 button in this day column.
      const existing=col.querySelectorAll('.v56-day-plus');
      existing.forEach((b,i)=>{ if(i>0) b.remove(); });
      if(existing.length) continue;

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='v56-day-plus';
      btn.dataset.date=date;
      btn.textContent='＋';
      btn.title=C.lang==='ar'
        ?'إضافة حالة إضافية لهذا اليوم'
        :'Add extra case for this day';
      btn.setAttribute('aria-label',btn.title);

      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        openExtra(date);
      });

      // Put icon in the same top header row as weekday/date.
      let header=weekdayEl.parentElement || col;

      // If header already contains too much slot content, use a tiny wrapper at top of column.
      const headerText=(header.textContent||'');
      if((headerText.match(/\d{2}:\d{2}/g)||[]).length>0){
        header=col;
      }

      if(header===col){
        const wrap=document.createElement('div');
        wrap.className='v56-day-plus-wrap';
        wrap.appendChild(document.createElement('span'));
        wrap.appendChild(btn);
        col.insertBefore(wrap,col.firstChild);
      }else{
        header.appendChild(btn);
      }
    }
  }

  function run(){
    addStyles();
    forceFridayFirstWeek();
    injectOnePlusPerDay();
  }

  const obs=new MutationObserver(()=>{
    clearTimeout(window.__v56Timer);
    window.__v56Timer=setTimeout(run,30);
  });

  obs.observe(document.body,{
    childList:true,
    subtree:true
  });

  run();
})();
