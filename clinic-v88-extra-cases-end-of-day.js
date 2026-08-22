(() => {
  const C = window.Clinic;
  if (!C) return;

  const PAGES = new Set(['appointments','doctor-appointments']);
  const HIDDEN = new Set(['cancelled','rescheduled']);

  function txt(en, ar){ return C.lang==='ar' ? ar : en; }

  function addStyles(){
    if(document.getElementById('v88-extra-day-list-style')) return;
    const s=document.createElement('style');
    s.id='v88-extra-day-list-style';
    s.textContent=`
      .v88-extra-day-list{
        margin-top:10px;
        padding-top:10px;
        border-top:1px dashed #f59e0b;
        display:grid;
        gap:7px
      }
      .v88-extra-day-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        color:#b45309;
        font-size:12px;
        font-weight:900
      }
      .v88-extra-day-count{
        min-width:24px;
        height:24px;
        padding:0 7px;
        border-radius:999px;
        background:#fff7ed;
        border:1px solid #fed7aa;
        display:inline-grid;
        place-items:center;
        font-size:11px
      }
      .v88-extra-card{
        width:100%;
        border:1px solid #fed7aa;
        background:#fffaf4;
        border-radius:11px;
        padding:9px 10px;
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        text-align:start
      }
      .v88-extra-time{
        min-width:64px;
        font-weight:900;
        color:#9a3412;
        white-space:nowrap;
        font-size:12px
      }
      .v88-extra-patient{
        min-width:0;
        display:grid;
        gap:2px
      }
      .v88-extra-patient strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:12px;
        color:var(--text)
      }
      .v88-extra-patient small{
        color:var(--muted);
        font-size:10px
      }
      .v88-extra-badge{
        padding:4px 7px;
        border-radius:999px;
        background:#ffedd5;
        color:#9a3412;
        font-size:10px;
        font-weight:850;
        white-space:nowrap
      }
      [dir='rtl'] .v88-extra-card{direction:rtl}
      @media(max-width:600px){
        .v88-extra-card{grid-template-columns:auto minmax(0,1fr)}
        .v88-extra-badge{grid-column:1/-1;justify-self:start}
      }
    `;
    document.head.appendChild(s);
  }

  function localYmd(iso){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{
        timeZone:'Africa/Cairo',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).formatToParts(new Date(iso));
      const get=t=>parts.find(x=>x.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch{return '';}
  }

  function formatTime(iso){
    try{
      return new Intl.DateTimeFormat(
        C.lang==='ar'?'ar-EG':'en-US',
        {
          timeZone:'Africa/Cairo',
          hour:'numeric',
          minute:'2-digit',
          hour12:true
        }
      ).format(new Date(iso));
    }catch{return '';}
  }

  function doctorId(){
    if(C.currentPage==='doctor-appointments') return C.user?.id||'';
    return document.getElementById('calendarDoctor')?.value || C.doctors?.[0]?.id || '';
  }

  function normalizeDigits(s=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(s).replace(/[٠-٩]/g,ch=>String(ar.indexOf(ch)));
  }

  function parseDate(text=''){
    const t=normalizeDigits(text);

    let m=t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m){
      return `${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
    }

    const months={
      'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,'يونيو':6,
      'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,
      'نوفمبر':11,'ديسمبر':12
    };

    for(const [name,num] of Object.entries(months)){
      m=t.match(new RegExp('(\\d{1,2})\\s+'+name+'\\s+(\\d{4})'));
      if(m){
        return `${m[2]}-${String(num).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
      }
    }

    return null;
  }

  function visibleDays(){
    return [...document.querySelectorAll('.scheduler-day-card')]
      .map(card=>{
        const header=card.querySelector('.scheduler-day-header');
        return {
          card,
          date:parseDate(header?.textContent||'')
        };
      })
      .filter(x=>x.date);
  }

  async function fetchExtras(doctor,dates){
    if(!doctor||!dates.length) return [];

    const first=[...dates].sort()[0];
    const last=[...dates].sort().at(-1);

    const from=`${first}T00:00:00+03:00`;
    const next=new Date(`${last}T23:59:59+03:00`);
    next.setTime(next.getTime()+24*60*60*1000);

    const {data,error}=await C.sb
      .from('appointments')
      .select('*')
      .eq('doctor_id',doctor)
      .eq('booking_source','extra_case')
      .gte('scheduled_start',from)
      .lt('scheduled_start',next.toISOString())
      .order('scheduled_start');

    if(error) throw error;

    return (data||[]).filter(a=>
      !HIDDEN.has(String(a.status||'')) &&
      dates.includes(localYmd(a.scheduled_start))
    );
  }

  async function patientMap(rows){
    const ids=[...new Set(rows.map(x=>x.patient_id).filter(Boolean))];
    if(!ids.length) return new Map();

    const {data,error}=await C.sb
      .from('patients')
      .select('id,medical_record_number,english_name,arabic_name,mobile')
      .in('id',ids);

    if(error) return new Map();

    return new Map((data||[]).map(p=>[p.id,p]));
  }

  function statusLabel(status){
    const en={
      booked:'Booked',
      confirmed:'Confirmed',
      arrived:'Arrived',
      waiting:'Waiting',
      with_doctor:'With doctor',
      completed:'Completed',
      no_show:'No-show'
    };
    const ar={
      booked:'محجوز',
      confirmed:'مؤكد',
      arrived:'وصل',
      waiting:'انتظار',
      with_doctor:'مع الطبيب',
      completed:'مكتمل',
      no_show:'لم يحضر'
    };
    return (C.lang==='ar'?ar:en)[status]||status||'';
  }

  function render(day,rows,patients){
    day.card.querySelectorAll('.v86-extra-day-list,.v88-extra-day-list')
      .forEach(x=>x.remove());

    if(!rows.length) return;

    const wrap=document.createElement('section');
    wrap.className='v88-extra-day-list';

    wrap.innerHTML=`
      <div class="v88-extra-day-title">
        <span>＋ ${txt('Extra cases','الحالات الإضافية')}</span>
        <span class="v88-extra-day-count">${rows.length}</span>
      </div>

      ${rows.map(a=>{
        const p=patients.get(a.patient_id)||{};
        const name=p.english_name||p.arabic_name||txt('Patient','مريض');
        const meta=[p.medical_record_number,p.mobile].filter(Boolean).join(' • ');

        return `
          <div class="v88-extra-card">
            <span class="v88-extra-time">${C.escape(formatTime(a.scheduled_start))}</span>

            <span class="v88-extra-patient">
              <strong>${C.escape(name)}</strong>
              <small>${C.escape(meta||txt('Extra booking','حجز إضافي'))}</small>
            </span>

            <span class="v88-extra-badge">
              ${C.escape(statusLabel(a.status))}
            </span>
          </div>
        `;
      }).join('')}
    `;

    const stack=day.card.querySelector('.scheduler-slot-stack');

    if(stack){
      stack.insertAdjacentElement('afterend',wrap);
    }else{
      day.card.appendChild(wrap);
    }
  }

  let busy=false;

  async function refresh(){
    if(!PAGES.has(C.currentPage)||busy) return;

    const days=visibleDays();
    if(!days.length) return;

    const doctor=doctorId();
    if(!doctor) return;

    busy=true;

    try{
      const dates=[...new Set(days.map(x=>x.date))];
      const extras=await fetchExtras(doctor,dates);
      const patients=await patientMap(extras);

      for(const day of days){
        render(
          day,
          extras.filter(a=>localYmd(a.scheduled_start)===day.date),
          patients
        );
      }
    }catch(e){
      console.warn('V88 extra cases display:',e);
    }finally{
      busy=false;
    }
  }

  addStyles();

  let timer;

  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(refresh,160);
  }).observe(
    document.getElementById('mainContent')||document.body,
    {childList:true,subtree:true}
  );

  document.addEventListener('change',e=>{
    if(['calendarDoctor','calendarWeekCount'].includes(e.target?.id)){
      setTimeout(refresh,120);
    }
  });

  document.addEventListener('click',e=>{
    if(e.target.closest(
      '.app-lang-btn,#calendarPrevious,#calendarNext,#calendarToday,[data-mini-date]'
    )){
      setTimeout(refresh,220);
    }
  });

  window.addEventListener('focus',()=>setTimeout(refresh,100));

  setTimeout(refresh,350);
  setTimeout(refresh,1000);
})();
