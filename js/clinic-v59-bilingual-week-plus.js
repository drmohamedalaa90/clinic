(() => {
  const C = window.Clinic;
  if (!C || C.__v59BilingualWeekLoaded) return;
  C.__v59BilingualWeekLoaded = true;

  const doc = document;

  const DAY_NAMES = [
    'Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday',
    'السبت','الأحد','الاحد','الإثنين','الاثنين','الثلاثاء','الأربعاء','الاربعاء','الخميس','الجمعة'
  ];

  const DAY_RE = new RegExp(
    '^(' + DAY_NAMES.map(x => x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')$',
    'i'
  );

  const ANY_DAY_RE = new RegExp(
    '(' + DAY_NAMES.map(x => x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')',
    'gi'
  );

  function cairoParts(){
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      weekday:'short'
    }).formatToParts(new Date());

    const get = type => parts.find(x=>x.type===type)?.value || '';

    return {
      year:Number(get('year')),
      month:Number(get('month')),
      day:Number(get('day')),
      weekday:get('weekday')
    };
  }

  function isFriday(){
    return cairoParts().weekday === 'Fri';
  }

  function cairoToday(){
    const p=cairoParts();
    return new Date(Date.UTC(p.year,p.month-1,p.day,12,0,0));
  }

  function nextSaturday(d){
    const x=new Date(d);
    const add=(6-x.getUTCDay()+7)%7 || 7;
    x.setUTCDate(x.getUTCDate()+add);
    return x;
  }

  function ymd(d){
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth()+1).padStart(2,'0'),
      String(d.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function dmy(d){
    return [
      String(d.getUTCDate()).padStart(2,'0'),
      String(d.getUTCMonth()+1).padStart(2,'0'),
      d.getUTCFullYear()
    ].join('/');
  }

  function appointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function reveal(){
    doc.documentElement.classList.remove('clinic-v59-friday-boot');
  }

  function normalizeArabicDigits(s=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(s).replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)));
  }

  function parseVisibleDate(text=''){
    const t=normalizeArabicDigits(text);

    let m=t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if(m) return `${m[3]}-${m[2]}-${m[1]}`;

    // Arabic localized format: 21 أغسطس 2026
    const months = {
      'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,'يونيو':6,
      'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,
      'نوفمبر':11,'ديسمبر':12
    };

    for(const [name,num] of Object.entries(months)){
      const re=new RegExp('(\\d{1,2})\\s+'+name+'\\s+(\\d{4})');
      m=t.match(re);
      if(m){
        return `${m[2]}-${String(num).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
      }
    }

    return null;
  }

  function parseWeekRange(text=''){
    const t=normalizeArabicDigits(text);

    // English numeric header
    let m=t.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/
    );
    if(m){
      return {
        start:`${m[3]}-${m[2]}-${m[1]}`,
        end:`${m[6]}-${m[5]}-${m[4]}`
      };
    }

    // Arabic header can be rendered as localized dates, so derive from
    // first and last actual day headers inside the week container.
    return null;
  }

  function weekContainers(){
    const els=[...doc.querySelectorAll('section,article,div')];
    const out=[];

    for(const el of els){
      const txt=(el.textContent||'').trim();

      let range=parseWeekRange(txt);

      if(!range){
        const dayLabels=[...el.querySelectorAll('div,span,strong,h3,h4')]
          .filter(x=>DAY_RE.test((x.textContent||'').trim()));

        if(dayLabels.length < 7) continue;

        const dates=[];
        for(const label of dayLabels){
          let node=label.parentElement;
          let hops=0;
          let found=null;

          while(node && hops<5 && !found){
            found=parseVisibleDate(node.textContent||'');
            node=node.parentElement;
            hops++;
          }

          if(found && !dates.includes(found)) dates.push(found);
        }

        if(dates.length < 7) continue;

        range={
          start:dates[0],
          end:dates[dates.length-1]
        };
      }

      const nested=[...el.children].some(ch=>{
        const t=(ch.textContent||'').trim();
        return !!parseWeekRange(t);
      });

      if(nested && parseWeekRange(txt)) continue;

      out.push({el,...range});
    }

    // dedupe same DOM region / same start
    const unique=[];
    for(const item of out){
      if(!unique.some(x=>x.el===item.el || x.start===item.start && x.el.contains(item.el))) {
        unique.push(item);
      }
    }

    return unique;
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

    const target=ymd(nextSaturday(cairoToday()));

    // Works in both languages because input type=date value is ISO.
    const jump=doc.querySelector(
      '#jumpDate,#calendarJumpDate,input[data-jump-date][type="date"]'
    );

    if(jump && jump.value!==target){
      jump.value=target;
      jump.dispatchEvent(new Event('change',{bubbles:true}));
    }

    const weeks=weekContainers();
    if(!weeks.length) return false;

    const idx=weeks.findIndex(w=>w.start===target);
    if(idx<0) return false;

    weeks.forEach((w,i)=>{
      if(i<idx){
        w.el.style.display='none';
        w.el.dataset.v59FridayHidden='1';
      }else if(w.el.dataset.v59FridayHidden==='1'){
        w.el.style.display='';
        delete w.el.dataset.v59FridayHidden;
      }
    });

    reveal();
    return true;
  }

  function addStyles(){
    if(doc.getElementById('v59-style')) return;

    const s=doc.createElement('style');
    s.id='v59-style';
    s.textContent=`
      .v59-day-title-row{
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
        width:100% !important;
      }

      .v59-day-plus{
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

      .v59-day-plus:hover{
        background:#ffedd5;
      }

      [dir="rtl"] .v59-day-title-row{
        flex-direction:row;
      }
    `;

    doc.head.appendChild(s);
  }

  function removeLegacy(){
    doc.querySelectorAll(
      '.v53-day-extra-btn,'+
      '.v54-day-extra-btn,'+
      '.v54-day-extra-slot,'+
      '.v56-day-plus,'+
      '.v56-day-plus-wrap,'+
      '.v57-day-plus,'+
      '.v58-day-plus'
    ).forEach(x=>x.remove());
  }

  function parseDateFromColumn(col){
    const direct=
      col.dataset?.date ||
      col.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)){
      return direct;
    }

    return parseVisibleDate(col.textContent||'');
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
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },50);

      return;
    }

    C.toast(
      C.lang==='ar'
        ?'تعذر فتح نافذة الحالة الإضافية.'
        :'Could not open extra-case form.',
      'error'
    );
  }

  function findDayColumns(){
    const labels=[...doc.querySelectorAll('div,span,strong,h3,h4')]
      .filter(el=>DAY_RE.test((el.textContent||'').trim()));

    const out=[];

    for(const label of labels){
      let col=label.parentElement;
      let hops=0;

      while(col && hops<6){
        const t=(col.textContent||'').trim();
        const dayMatches=t.match(ANY_DAY_RE)||[];

        if(dayMatches.length===1 && parseVisibleDate(t)){
          break;
        }

        col=col.parentElement;
        hops++;
      }

      if(!col) continue;

      const date=parseDateFromColumn(col);
      if(!date) continue;

      if(!out.some(x=>x.col===col)){
        out.push({col,label,date});
      }
    }

    return out;
  }

  function injectPlus(){
    if(!appointmentsPage()) return;

    removeLegacy();

    for(const {col,label,date} of findDayColumns()){
      if(col.querySelector('.v59-day-plus')) continue;

      let row=label.parentElement;

      if(
        !row ||
        row===col ||
        /\d{1,2}:\d{2}/.test(normalizeArabicDigits(row.textContent||''))
      ){
        row=doc.createElement('div');
        row.className='v59-day-title-row';

        label.parentNode.insertBefore(row,label);
        row.appendChild(label);
      }else{
        row.classList.add('v59-day-title-row');
      }

      const btn=doc.createElement('button');
      btn.type='button';
      btn.className='v59-day-plus';
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

    const shifted=forceFridayWeek();

    if(shifted){
      injectPlus();
    }
  }

  let timer;

  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(run,20);
  }).observe(doc.body,{
    childList:true,
    subtree:true
  });

  // Re-run when language changes because DOM labels change from EN to AR / back.
  doc.addEventListener('click',e=>{
    if(e.target.closest('.app-lang-btn')){
      setTimeout(run,80);
      setTimeout(run,250);
    }
  });

  run();

  setTimeout(()=>{
    forceFridayWeek();
    reveal();
    injectPlus();
  },1800);
})();
