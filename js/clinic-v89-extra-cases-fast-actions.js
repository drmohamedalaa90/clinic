(() => {
  const C = window.Clinic;
  if (!C || C.__v89ExtraCasesLoaded) return;
  C.__v89ExtraCasesLoaded = true;

  const PAGES = new Set(['appointments','doctor-appointments']);
  const HIDDEN = new Set(['cancelled','rescheduled']);

  const t = (en,ar) => C.lang==='ar' ? ar : en;

  function styles(){
    if(document.getElementById('v89-extra-style')) return;
    const s=document.createElement('style');
    s.id='v89-extra-style';
    s.textContent=`
      .v88-extra-day-list,.v86-extra-day-list{display:none!important}
      .v89-extra-day-list{
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        margin-top:10px;
        padding-top:10px;
        border-top:1px dashed #f59e0b;
        display:grid;
        gap:7px;
        overflow:hidden
      }
      .v89-extra-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:6px;
        min-width:0;
        color:#b45309;
        font-size:11px;
        font-weight:900
      }
      .v89-extra-count{
        flex:0 0 auto;
        min-width:22px;height:22px;padding:0 6px;
        display:inline-grid;place-items:center;
        border:1px solid #fed7aa;border-radius:999px;
        background:#fff7ed;font-size:10px
      }
      .v89-extra-card{
        width:100%;max-width:100%;min-width:0;box-sizing:border-box;
        border:1px solid #fed7aa;border-radius:11px;
        background:#fffaf4;padding:8px 9px;
        display:grid;gap:5px;
        cursor:pointer;text-align:start;color:inherit
      }
      .v89-extra-card:hover{background:#fff7ed}
      .v89-extra-top{
        min-width:0;display:flex;align-items:center;
        justify-content:space-between;gap:6px
      }
      .v89-extra-time{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:#9a3412;font-size:11px;font-weight:900
      }
      .v89-extra-badge{
        flex:0 0 auto;max-width:70px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        padding:3px 6px;border-radius:999px;
        background:#ffedd5;color:#9a3412;
        font-size:9px;font-weight:850
      }
      .v89-extra-name{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:var(--text);font-size:11px;font-weight:850
      }
      .v89-extra-meta{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:var(--muted);font-size:9px
      }
      .v89-action-grid{
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px
      }
      .v89-action-grid button{width:100%;min-width:0}
      [dir="rtl"] .v89-extra-card{text-align:right}
    `;
    document.head.appendChild(s);
  }

  function localYmd(iso){
    try{
      const p=new Intl.DateTimeFormat('en-CA',{
        timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date(iso));
      const g=x=>p.find(y=>y.type===x)?.value||'';
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
    return String(s).replace(/[٠-٩]/g,c=>String(ar.indexOf(c)));
  }

  function parseDate(text=''){
    const x=normalizeDigits(text);
    let m=x.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
    const months={'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12};
    for(const [name,n] of Object.entries(months)){
      m=x.match(new RegExp('(\\d{1,2})\\s+'+name+'\\s+(\\d{4})'));
      if(m) return `${m[2]}-${String(n).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
    }
    return null;
  }

  function days(){
    return [...document.querySelectorAll('.scheduler-day-card')].map(card=>({
      card,date:parseDate(card.querySelector('.scheduler-day-header')?.textContent||'')
    })).filter(x=>x.date);
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

  async function fetchExtras(doctor, dates){
    if(!doctor || !dates.length) return [];
    const sorted=[...dates].sort();
    const from=`${sorted[0]}T00:00:00+03:00`;
    const last=new Date(`${sorted.at(-1)}T23:59:59+03:00`);
    last.setTime(last.getTime()+86400000);

    // One request only: appointment + patient relation.
    let r=await C.sb.from('appointments')
      .select('*,patient:patients(id,medical_record_number,english_name,arabic_name,mobile,birth_year)')
      .eq('doctor_id',doctor)
      .eq('booking_source','extra_case')
      .gte('scheduled_start',from)
      .lt('scheduled_start',last.toISOString())
      .order('scheduled_start');

    if(r.error){
      // Safe fallback for installations where relation alias is unavailable.
      const simple=await C.sb.from('appointments')
        .select('*')
        .eq('doctor_id',doctor)
        .eq('booking_source','extra_case')
        .gte('scheduled_start',from)
        .lt('scheduled_start',last.toISOString())
        .order('scheduled_start');
      if(simple.error) throw simple.error;

      const rows=simple.data||[];
      const ids=[...new Set(rows.map(x=>x.patient_id).filter(Boolean))];
      let map=new Map();
      if(ids.length){
        const p=await C.sb.from('patients')
          .select('id,medical_record_number,english_name,arabic_name,mobile,birth_year')
          .in('id',ids);
        if(!p.error) map=new Map((p.data||[]).map(x=>[x.id,x]));
      }
      r={data:rows.map(a=>({...a,patient:map.get(a.patient_id)||{}}))};
    }

    return (r.data||[]).filter(a=>
      !HIDDEN.has(String(a.status||'')) &&
      dates.includes(localYmd(a.scheduled_start))
    );
  }

  function canReceptionActions(){
    return C.isReception?.() || C.hasRole?.('owner') || C.hasRole?.('manager') ||
      C.hasRole?.('deputy_manager') || C.hasRole?.('secretary');
  }

  async function doRpc(name,args,success){
    const {error}=await C.sb.rpc(name,args);
    if(error) return C.toast(error.message,'error');
    C.closeModal();
    C.toast(success);
    C.route(C.currentPage);
  }

  function editBooking(a){
    const editor=window.ClinicBookingWorkflow?.showEditBookingModal;
    if(!editor) return C.toast(t('Could not open booking editor.','تعذر فتح تعديل الحجز.'),'error');
    C.closeModal();
    editor(a.id);
  }

  function confirmInfo(a){
    C.closeModal();
    // Reuse the existing confirmation system by exposing an appointment-style click.
    const ghost=document.createElement('button');
    ghost.type='button';
    ghost.dataset.appointmentId=a.id;
    ghost.style.display='none';
    document.body.appendChild(ghost);
    ghost.click();
    setTimeout(()=>ghost.remove(),100);
  }

  function checkIn(a){
    C.showModal({
      title:t('Confirm patient arrival','تأكيد حضور المريض'),
      body:`
        <form id="v89Checkin" class="form-grid">
          <label>${t('Fees (EGP)','الرسوم (جنيه)')}
            <input id="v89Fee" class="control" type="number" min="0" step="1" required>
          </label>
          <label>${t('Payment method','طريقة الدفع')}
            <select id="v89Pay" class="control">
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
        root.querySelector('#v89Checkin').onsubmit=async e=>{
          e.preventDefault();
          await doRpc('frontend_check_in_with_fee',{
            p_id:a.id,
            p_fee:Number(root.querySelector('#v89Fee').value||0),
            p_payment_method:root.querySelector('#v89Pay').value,
            p_note:null
          },t('Checked in.','تم تسجيل الوصول.'));
        };
      }
    });
  }

  function cancel(a){
    const reason=prompt(t('Cancellation reason','سبب الإلغاء'));
    if(!reason) return;
    doRpc('frontend_cancel_appointment',{p_id:a.id,p_reason:reason},t('Appointment cancelled.','تم إلغاء الموعد.'));
  }

  function noShow(a){
    doRpc('frontend_mark_no_show',{p_id:a.id,p_reason:null},t('Marked no-show.','تم تسجيل عدم الحضور.'));
  }

  function sendDoctor(a){
    doRpc('frontend_send_to_doctor',{p_id:a.id},t('Sent to doctor.','تم إرسال المريض للطبيب.'));
  }

  function openActions(a){
    const p=a.patient||{};
    const reception=canReceptionActions();
    C.showModal({
      title:t('Extra case','حالة إضافية'),
      body:`
        <div class="appointment-detail-card">
          <div class="appointment-detail-patient">
            <span class="eyebrow">${C.escape(p.medical_record_number||a.appointment_number||'')}</span>
            <h3>${C.escape(p.english_name||p.arabic_name||t('Patient','مريض'))}</h3>
            <p class="muted">${C.escape(fmtTime(a.scheduled_start))} • ${C.escape(statusLabel(a.status))}</p>
          </div>
          <div class="v89-action-grid">
            ${['booked','confirmed'].includes(a.status) ? `
              <button class="secondary-button compact" data-v89="confirm">${t('Confirm information','تأكيد البيانات')}</button>
              ${reception?`<button class="secondary-button compact" data-v89="edit">${t('Edit booking','تعديل الحجز')}</button>`:''}
              ${reception?`<button class="secondary-button compact" data-v89="checkin">${t('Check in','تسجيل الوصول')}</button>`:''}
              ${reception?`<button class="secondary-button compact" data-v89="noshow">${t('No-show','لم يحضر')}</button>`:''}
              ${reception?`<button class="danger-button compact" data-v89="cancel">${t('Cancel','إلغاء')}</button>`:''}
            `:''}
            ${a.status==='arrived' && reception ? `
              <button class="primary-button compact" data-v89="send">${t('Send to doctor','إرسال للطبيب')}</button>
            `:''}
          </div>
        </div>`,
      onOpen:root=>{
        root.querySelector('[data-v89="confirm"]')?.addEventListener('click',()=>confirmInfo(a));
        root.querySelector('[data-v89="edit"]')?.addEventListener('click',()=>editBooking(a));
        root.querySelector('[data-v89="checkin"]')?.addEventListener('click',()=>checkIn(a));
        root.querySelector('[data-v89="noshow"]')?.addEventListener('click',()=>noShow(a));
        root.querySelector('[data-v89="cancel"]')?.addEventListener('click',()=>cancel(a));
        root.querySelector('[data-v89="send"]')?.addEventListener('click',()=>sendDoctor(a));
      }
    });
  }

  function render(day, rows){
    day.card.querySelectorAll('.v89-extra-day-list').forEach(x=>x.remove());
    if(!rows.length) return;

    const wrap=document.createElement('section');
    wrap.className='v89-extra-day-list';
    wrap.innerHTML=`
      <div class="v89-extra-title">
        <span>＋ ${t('Extra cases','الحالات الإضافية')}</span>
        <span class="v89-extra-count">${rows.length}</span>
      </div>
      ${rows.map(a=>{
        const p=a.patient||{};
        const name=p.english_name||p.arabic_name||t('Patient','مريض');
        const meta=[p.medical_record_number,p.mobile].filter(Boolean).join(' • ');
        return `
          <button type="button" class="v89-extra-card" data-v89-id="${C.escape(a.id)}">
            <span class="v89-extra-top">
              <span class="v89-extra-time">${C.escape(fmtTime(a.scheduled_start))}</span>
              <span class="v89-extra-badge">${C.escape(statusLabel(a.status))}</span>
            </span>
            <span class="v89-extra-name">${C.escape(name)}</span>
            <span class="v89-extra-meta">${C.escape(meta||t('Extra booking','حجز إضافي'))}</span>
          </button>`;
      }).join('')}
    `;
    const stack=day.card.querySelector('.scheduler-slot-stack');
    (stack||day.card).insertAdjacentElement(stack?'afterend':'beforeend',wrap);

    const map=new Map(rows.map(a=>[a.id,a]));
    wrap.querySelectorAll('[data-v89-id]').forEach(btn=>{
      btn.onclick=()=>openActions(map.get(btn.dataset.v89Id));
    });
  }

  let busy=false, queued=false, signature='';

  async function refresh(force=false){
    if(!PAGES.has(C.currentPage)) return;
    const visible=days();
    if(!visible.length) return;
    const doctor=doctorId();
    if(!doctor) return;

    const sig=doctor+'|'+visible.map(x=>x.date).join(',');
    if(!force && busy){ queued=true; return; }

    busy=true;
    try{
      const dates=[...new Set(visible.map(x=>x.date))];
      const extras=await fetchExtras(doctor,dates);
      for(const day of visible){
        render(day,extras.filter(a=>localYmd(a.scheduled_start)===day.date));
      }
      signature=sig;
    }catch(e){
      console.warn('V89 extra cases:',e);
    }finally{
      busy=false;
      if(queued){queued=false;setTimeout(()=>refresh(true),10);}
    }
  }

  styles();

  // Fast: react as soon as the scheduler day cards are inserted.
  let raf=0;
  new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>refresh(false));
  }).observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true});

  document.addEventListener('change',e=>{
    if(['calendarDoctor','calendarWeekCount'].includes(e.target?.id)) setTimeout(()=>refresh(true),0);
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('.app-lang-btn,#calendarPrevious,#calendarNext,#calendarToday,[data-mini-date]')){
      setTimeout(()=>refresh(true),0);
    }
  });

  setTimeout(()=>refresh(true),0);
})();
