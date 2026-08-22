(() => {
  const C = window.Clinic;
  if (!C || C.__v91ExtraCasesLoaded) return;
  C.__v91ExtraCasesLoaded = true;

  const ACTIVE_PAGES = new Set(['appointments','doctor-appointments']);
  const HIDDEN = new Set(['cancelled','rescheduled']);
  const t = (en, ar) => C.lang === 'ar' ? ar : en;

  function addStyles(){
    if(document.getElementById('v91-extra-style')) return;
    const s=document.createElement('style');
    s.id='v91-extra-style';
    s.textContent=`
      .v86-extra-day-list,.v88-extra-day-list,.v89-extra-day-list,.v90-extra-block{
        display:none!important
      }

      .v91-extra-card{
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        margin-top:10px;
        border:1px solid #dbe4ee;
        border-radius:14px;
        background:#fff;
        overflow:hidden;
      }

      .v91-extra-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px 12px;
        border-bottom:1px solid #e6edf5;
      }

      .v91-extra-head-left{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .v91-extra-head strong{
        color:#10233c;
        font-size:13px;
        font-weight:900;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .v91-extra-head small{
        color:#718096;
        font-size:9px;
      }

      .v91-extra-pill{
        flex:0 0 auto;
        padding:4px 8px;
        border-radius:999px;
        border:1px solid #fed7aa;
        background:#fff7ed;
        color:#b45309;
        font-size:10px;
        font-weight:900;
      }

      .v91-extra-row{
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
        display:grid;
        grid-template-columns:28px minmax(0,1fr);
        gap:8px;
        align-items:center;
        padding:10px 12px;
        border:0;
        border-bottom:1px solid #edf2f7;
        background:#fff;
        color:inherit;
        text-align:start;
        cursor:pointer;
      }

      .v91-extra-row:last-child{border-bottom:0}
      .v91-extra-row:hover{background:#f8fbff}

      .v91-extra-number{
        width:28px;height:28px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:#f1f5f9;
        color:#475569;
        font-size:11px;
        font-weight:900;
      }

      .v91-extra-copy{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .v91-extra-copy strong{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#10233c;
        font-size:11px;
        font-weight:850;
      }

      .v91-extra-copy small{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#718096;
        font-size:9px;
      }

      .v91-extra-time{color:#b45309;font-weight:850}
      .v91-extra-status{color:#0f766e;font-weight:850}

      .v91-actions{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }

      .v91-actions button{width:100%;min-width:0}

      [dir="rtl"] .v91-extra-row{text-align:right}

      @media(max-width:600px){
        .v91-extra-head{padding:9px 10px}
        .v91-extra-row{
          padding:9px 10px;
          grid-template-columns:26px minmax(0,1fr);
          gap:7px
        }
        .v91-extra-number{width:26px;height:26px}
      }
    `;
    document.head.appendChild(s);
  }

  function cairoDateOf(iso){
    try{
      const p=new Intl.DateTimeFormat('en-CA',{
        timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date(iso));
      const g=x=>p.find(v=>v.type===x)?.value||'';
      return `${g('year')}-${g('month')}-${g('day')}`;
    }catch{return '';}
  }

  function fmtTime(iso){
    try{
      return new Intl.DateTimeFormat(C.lang==='ar'?'ar-EG':'en-US',{
        timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',hour12:true
      }).format(new Date(iso));
    }catch{return '';}
  }

  function normalizeDigits(s=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(s).replace(/[٠-٩]/g,ch=>String(ar.indexOf(ch)));
  }

  function visibleDate(card){
    const x=normalizeDigits(card.querySelector('.scheduler-day-header')?.textContent||'');
    let m=x.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;

    const months={'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12};
    for(const [name,n] of Object.entries(months)){
      m=x.match(new RegExp('(\\d{1,2})\\s+'+name+'\\s+(\\d{4})'));
      if(m) return `${m[2]}-${String(n).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
    }
    return null;
  }

  function dayCards(){
    return [...document.querySelectorAll('.scheduler-day-card')]
      .map(card=>({card,date:visibleDate(card)}))
      .filter(x=>x.date);
  }

  function doctorId(){
    if(C.currentPage==='doctor-appointments') return C.user?.id||'';
    return document.getElementById('calendarDoctor')?.value || C.doctors?.[0]?.id || '';
  }

  function statusLabel(s){
    const en={booked:'Booked',confirmed:'Confirmed',arrived:'Arrived',waiting:'Waiting',with_doctor:'With doctor',completed:'Completed',no_show:'No-show'};
    const ar={booked:'محجوز',confirmed:'مؤكد',arrived:'وصل',waiting:'انتظار',with_doctor:'مع الطبيب',completed:'مكتمل',no_show:'لم يحضر'};
    return (C.lang==='ar'?ar:en)[s]||s||'';
  }

  function canonical(value){
    const ms=Date.parse(value||'');
    return Number.isFinite(ms)?new Date(ms).toISOString():'';
  }

  function normalHourIntervals(card){
    const set=new Set();

    card.querySelectorAll('[data-start][data-end]').forEach(el=>{
      const s=canonical(el.dataset.start);
      const e=canonical(el.dataset.end);
      if(s&&e) set.add(`${s}|${e}`);
    });

    // Fallback: derive rendered hourly headers if seat datasets were disabled/closed.
    const date=visibleDate(card);
    if(date){
      card.querySelectorAll('.hour-capacity-card .hour-capacity-head strong').forEach(el=>{
        const text=(el.textContent||'').trim();
        const m=text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
        if(m){
          const toIso=(h,min)=>{
            const d=new Date(`${date}T${String(+h).padStart(2,'0')}:${min}:00+03:00`);
            return d.toISOString();
          };
          set.add(`${toIso(m[1],m[2])}|${toIso(m[3],m[4])}`);
        }
      });
    }

    return set;
  }

  function isExtra(a, normalIntervals){
    if(!a || HIDDEN.has(String(a.status||''))) return false;

    const source=String(a.booking_source||'').toLowerCase();
    if(source.includes('extra') || source.includes('overbook')) return true;

    const s=canonical(a.scheduled_start);
    const e=canonical(a.scheduled_end);
    if(!s||!e) return false;

    // Free-time appointments (e.g. 18:30) are extras even if an older
    // database build stored a different booking_source.
    return normalIntervals.size>0 && !normalIntervals.has(`${s}|${e}`);
  }

  async function loadAppointments(doctor,dates){
    const sorted=[...dates].sort();
    const from=`${sorted[0]}T00:00:00+03:00`;
    const end=new Date(`${sorted.at(-1)}T23:59:59+03:00`);
    end.setTime(end.getTime()+86400000);

    let q=await C.sb
      .from('appointments')
      .select(`*,patient:patients(id,medical_record_number,english_name,arabic_name,mobile,birth_year)`)
      .eq('doctor_id',doctor)
      .gte('scheduled_start',from)
      .lt('scheduled_start',end.toISOString())
      .order('scheduled_start');

    if(!q.error) return q.data||[];

    const fallback=await C.sb
      .from('appointments')
      .select('*')
      .eq('doctor_id',doctor)
      .gte('scheduled_start',from)
      .lt('scheduled_start',end.toISOString())
      .order('scheduled_start');

    if(fallback.error) throw fallback.error;

    const rows=fallback.data||[];
    const ids=[...new Set(rows.map(x=>x.patient_id).filter(Boolean))];
    let map=new Map();

    if(ids.length){
      const p=await C.sb.from('patients')
        .select('id,medical_record_number,english_name,arabic_name,mobile,birth_year')
        .in('id',ids);
      if(!p.error) map=new Map((p.data||[]).map(x=>[x.id,x]));
    }

    return rows.map(a=>({...a,patient:map.get(a.patient_id)||{}}));
  }

  function reception(){
    return C.isReception?.() || C.hasRole?.('owner') || C.hasRole?.('manager') ||
      C.hasRole?.('deputy_manager') || C.hasRole?.('secretary');
  }

  async function rpc(name,args,success){
    const {error}=await C.sb.rpc(name,args);
    if(error) return C.toast(error.message,'error');
    C.closeModal();
    C.toast(success);
    C.route(C.currentPage);
  }

  function edit(a){
    const fn=window.ClinicBookingWorkflow?.showEditBookingModal;
    if(!fn) return C.toast(t('Could not open booking editor.','تعذر فتح تعديل الحجز.'),'error');
    C.closeModal();
    fn(a.id);
  }

  function confirmInfo(a){
    C.closeModal();
    const ghost=document.createElement('button');
    ghost.type='button';
    ghost.dataset.appointmentId=a.id;
    ghost.style.cssText='position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    setTimeout(()=>ghost.remove(),250);
  }

  function checkIn(a){
    C.showModal({
      title:t('Confirm patient arrival','تأكيد حضور المريض'),
      body:`
        <form id="v91Checkin" class="form-grid">
          <label>${t('Fees (EGP)','الرسوم (جنيه)')}
            <input id="v91Fee" class="control" type="number" min="0" step="1" required>
          </label>
          <label>${t('Payment method','طريقة الدفع')}
            <select id="v91Pay" class="control">
              <option value="cash">${t('Cash','نقدي')}</option>
              <option value="instapay">InstaPay</option>
              <option value="card">${t('Card','بطاقة')}</option>
              <option value="bank_transfer">${t('Bank transfer','تحويل بنكي')}</option>
              <option value="other">${t('Other','أخرى')}</option>
            </select>
          </label>
          <div class="form-actions full-span">
            <button class="primary-button compact">${t('Confirm arrival','تأكيد الحضور')}</button>
          </div>
        </form>`,
      onOpen:root=>{
        root.querySelector('#v91Checkin').onsubmit=async e=>{
          e.preventDefault();
          await rpc('frontend_check_in_with_fee',{
            p_id:a.id,
            p_fee:Number(root.querySelector('#v91Fee').value||0),
            p_payment_method:root.querySelector('#v91Pay').value,
            p_note:null
          },t('Checked in.','تم تسجيل الوصول.'));
        };
      }
    });
  }

  function actions(a){
    const p=a.patient||{};
    const can=reception();

    C.showModal({
      title:t('Extra case','حالة إضافية'),
      body:`
        <div class="appointment-detail-card">
          <div class="appointment-detail-patient">
            <span class="eyebrow">${C.escape(p.medical_record_number||a.appointment_number||'')}</span>
            <h3>${C.escape(p.english_name||p.arabic_name||t('Patient','مريض'))}</h3>
            <p class="muted">${C.escape(fmtTime(a.scheduled_start))} • ${C.escape(statusLabel(a.status))}</p>
          </div>
          <div class="v91-actions">
            ${['booked','confirmed'].includes(a.status)?`
              <button class="secondary-button compact" data-a="confirm">${t('Confirm information','تأكيد البيانات')}</button>
              ${can?`
                <button class="secondary-button compact" data-a="edit">${t('Edit booking','تعديل الحجز')}</button>
                <button class="secondary-button compact" data-a="checkin">${t('Check in','تسجيل الوصول')}</button>
                <button class="secondary-button compact" data-a="noshow">${t('No-show','لم يحضر')}</button>
                <button class="danger-button compact" data-a="cancel">${t('Cancel','إلغاء')}</button>
              `:''}
            `:''}
            ${a.status==='arrived'&&can?`
              <button class="primary-button compact" data-a="send">${t('Send to doctor','إرسال للطبيب')}</button>
            `:''}
          </div>
        </div>`,
      onOpen:root=>{
        root.querySelector('[data-a="confirm"]')?.addEventListener('click',()=>confirmInfo(a));
        root.querySelector('[data-a="edit"]')?.addEventListener('click',()=>edit(a));
        root.querySelector('[data-a="checkin"]')?.addEventListener('click',()=>checkIn(a));
        root.querySelector('[data-a="noshow"]')?.addEventListener('click',()=>rpc('frontend_mark_no_show',{p_id:a.id,p_reason:null},t('Marked no-show.','تم تسجيل عدم الحضور.')));
        root.querySelector('[data-a="cancel"]')?.addEventListener('click',()=>{
          const reason=prompt(t('Cancellation reason','سبب الإلغاء'));
          if(reason) rpc('frontend_cancel_appointment',{p_id:a.id,p_reason:reason},t('Appointment cancelled.','تم إلغاء الموعد.'));
        });
        root.querySelector('[data-a="send"]')?.addEventListener('click',()=>rpc('frontend_send_to_doctor',{p_id:a.id},t('Sent to doctor.','تم إرسال المريض للطبيب.')));
      }
    });
  }

  function render(day,rows){
    day.card.querySelectorAll('.v91-extra-card').forEach(x=>x.remove());
    if(!rows.length) return;

    const block=document.createElement('section');
    block.className='v91-extra-card';
    block.innerHTML=`
      <div class="v91-extra-head">
        <span class="v91-extra-head-left">
          <strong>${t('Extra cases','الحالات الإضافية')}</strong>
          <small>${rows.length} ${t(rows.length===1?'patient':'patients','مريض')}</small>
        </span>
        <span class="v91-extra-pill">${rows.length}</span>
      </div>
      ${rows.map((a,i)=>{
        const p=a.patient||{};
        const name=p.english_name||p.arabic_name||t('Patient','مريض');
        return `
          <button class="v91-extra-row" type="button" data-id="${C.escape(a.id)}">
            <span class="v91-extra-number">${i+1}</span>
            <span class="v91-extra-copy">
              <strong>${C.escape(name)}</strong>
              <small>
                <span class="v91-extra-time">${C.escape(fmtTime(a.scheduled_start))}</span>
                • <span class="v91-extra-status">${C.escape(statusLabel(a.status))}</span>
                ${p.mobile?` • ${C.escape(p.mobile)}`:''}
              </small>
            </span>
          </button>`;
      }).join('')}
    `;

    const stack=day.card.querySelector('.scheduler-slot-stack');
    if(stack) stack.insertAdjacentElement('afterend',block);
    else day.card.appendChild(block);

    const map=new Map(rows.map(a=>[a.id,a]));
    block.querySelectorAll('[data-id]').forEach(btn=>{
      btn.onclick=()=>actions(map.get(btn.dataset.id));
    });
  }

  let busy=false;
  let again=false;

  async function refresh(){
    if(!ACTIVE_PAGES.has(C.currentPage)) return;
    const cards=dayCards();
    if(!cards.length) return;

    const doctor=doctorId();
    if(!doctor) return;

    if(busy){again=true;return;}
    busy=true;

    try{
      const dates=[...new Set(cards.map(x=>x.date))];
      const rows=await loadAppointments(doctor,dates);

      for(const day of cards){
        const normals=normalHourIntervals(day.card);
        const extras=rows.filter(a=>
          cairoDateOf(a.scheduled_start)===day.date &&
          isExtra(a,normals)
        );
        render(day,extras);
      }
    }catch(e){
      console.warn('V91 extra cases:',e);
    }finally{
      busy=false;
      if(again){again=false;queueMicrotask(refresh);}
    }
  }

  addStyles();

  let raf=0;
  new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(refresh);
  }).observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true});

  document.addEventListener('change',e=>{
    if(['calendarDoctor','calendarWeekCount'].includes(e.target?.id)) requestAnimationFrame(refresh);
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.app-lang-btn,#calendarPrevious,#calendarNext,#calendarToday,[data-mini-date]')){
      requestAnimationFrame(refresh);
    }
  });

  requestAnimationFrame(refresh);
})();
