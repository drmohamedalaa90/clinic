(() => {
  const C = window.Clinic;
  if (!C || C.__v58ZeroFlashFridayLoaded) return;
  C.__v58ZeroFlashFridayLoaded = true;

  const doc = document;

  function cairoParts(){
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      weekday:'short'
    }).formatToParts(new Date());

    const get = type =>
      parts.find(x=>x.type===type)?.value || '';

    return {
      year:Number(get('year')),
      month:Number(get('month')),
      day:Number(get('day')),
      weekday:get('weekday')
    };
  }

  function cairoTodayDate(){
    const p=cairoParts();
    return new Date(Date.UTC(
      p.year,
      p.month-1,
      p.day,
      12,0,0
    ));
  }

  function ymd(d){
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth()+1).padStart(2,'0'),
      String(d.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function nextSaturday(d){
    const x=new Date(d);
    const add=(6-x.getUTCDay()+7)%7 || 7;
    x.setUTCDate(x.getUTCDate()+add);
    return x;
  }

  function isFriday(){
    return cairoParts().weekday==='Fri';
  }

  function appointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function reveal(){
    doc.documentElement.classList.remove('clinic-v58-friday-boot');
  }

  function parseWeekRange(text){
    const m=String(text||'').match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/
    );

    if(!m) return null;

    return {
      start:`${m[3]}-${m[2]}-${m[1]}`,
      end:`${m[6]}-${m[5]}-${m[4]}`
    };
  }

  function weekContainers(){
    const els=[...doc.querySelectorAll('section,article,div')];
    const out=[];

    for(const el of els){
      const txt=(el.textContent||'').trim();
      const range=parseWeekRange(txt);
      if(!range) continue;

      const dates=txt.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[];
      if(dates.length<7) continue;

      const nested=[...el.children].some(ch=>{
        const t=(ch.textContent||'').trim();
        return !!parseWeekRange(t) &&
          (t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[]).length>=7;
      });

      if(nested) continue;

      out.push({el,...range});
    }

    return out;
  }

  function setJumpDate(target){
    const jump=doc.querySelector(
      '#jumpDate,'+
      '#calendarJumpDate,'+
      'input[data-jump-date][type="date"]'
    );

    if(!jump) return false;

    if(jump.value!==target){
      jump.value=target;
      jump.dispatchEvent(
        new Event('change',{bubbles:true})
      );
    }

    return true;
  }

  function forceFridayWeek(){
    if(!isFriday()){
      reveal();
      return true;
    }

    if(!appointmentsPage()){
      reveal();
      return true;
    }

    const target=ymd(nextSaturday(cairoTodayDate()));

    // First, set calendar state to next Saturday as early as possible.
    setJumpDate(target);

    const weeks=weekContainers();
    if(!weeks.length) return false;

    const idx=weeks.findIndex(w=>w.start===target);
    if(idx<0) return false;

    // Remove/hide every older week before revealing the page.
    weeks.forEach((w,i)=>{
      if(i<idx){
        w.el.style.display='none';
        w.el.dataset.v58Hidden='1';
      }else if(w.el.dataset.v58Hidden==='1'){
        w.el.style.display='';
        delete w.el.dataset.v58Hidden;
      }
    });

    reveal();
    return true;
  }

  function addStyles(){
    if(doc.getElementById('v58-day-plus-style')) return;

    const style=doc.createElement('style');
    style.id='v58-day-plus-style';
    style.textContent=`
      .v58-day-title-row{
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
      }

      .v58-day-plus{
        width:28px;
        height:28px;
        min-width:28px;
        padding:0;
        margin:0;
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

      .v58-day-plus:hover{
        background:#ffedd5;
      }
    `;

    doc.head.appendChild(style);
  }

  function removeLegacyButtons(){
    doc.querySelectorAll(
      '.v53-day-extra-btn,'+
      '.v54-day-extra-btn,'+
      '.v54-day-extra-slot,'+
      '.v56-day-plus,'+
      '.v56-day-plus-wrap,'+
      '.v57-day-plus'
    ).forEach(x=>x.remove());
  }

  function parseDate(node){
    const direct =
      node.dataset?.date ||
      node.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)){
      return direct;
    }

    const m=(node.textContent||'')
      .match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);

    if(!m) return null;

    return `${m[3]}-${m[2]}-${m[1]}`;
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
        const input=doc.querySelector(
          '#v54Date,#v52Date,#v51ExtraDate'
        );

        if(input){
          input.value=date;
          input.dispatchEvent(
            new Event('change',{bubbles:true})
          );
        }
      },50);
    }
  }

  function injectPlus(){
    if(!appointmentsPage()) return;

    removeLegacyButtons();

    const weekday=/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/i;
    const labels=[...doc.querySelectorAll('div,span,strong,h3,h4')];

    for(const label of labels){
      const text=(label.textContent||'').trim();
      if(!weekday.test(text)) continue;

      let col=label.parentElement;
      let hops=0;

      while(col && hops<6){
        const t=(col.textContent||'').trim();
        const days=t.match(/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/gi)||[];
        const dates=t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[];

        if(days.length===1 && dates.length>=1) break;

        col=col.parentElement;
        hops++;
      }

      if(!col) continue;

      const date=parseDate(col);
      if(!date) continue;

      const existing=col.querySelector('.v58-day-plus');
      if(existing) continue;

      let row=label.parentElement;

      if(
        !row ||
        row===col ||
        /\d{2}:\d{2}/.test(row.textContent||'')
      ){
        row=doc.createElement('div');
        row.className='v58-day-title-row';

        label.parentNode.insertBefore(row,label);
        row.appendChild(label);
      }else{
        row.classList.add('v58-day-title-row');
      }

      const btn=doc.createElement('button');
      btn.type='button';
      btn.className='v58-day-plus';
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

  function run(){
    addStyles();

    const ready=forceFridayWeek();

    if(ready){
      injectPlus();
    }
  }

  let timer;

  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(run,15);
  }).observe(
    doc.body,
    {
      childList:true,
      subtree:true
    }
  );

  run();

  // Safety only: never keep UI hidden forever on an unexpected render failure.
  setTimeout(()=>{
    forceFridayWeek();
    reveal();
    injectPlus();
  },1800);
})();
