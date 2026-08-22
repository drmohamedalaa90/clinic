(() => {
  const C = window.Clinic;
  if (!C || window.__clinicV95AppointmentDisplayFix) return;
  window.__clinicV95AppointmentDisplayFix = true;

  const PAGES = new Set(['appointments','doctor-appointments']);
  const HIDDEN = new Set(['cancelled','rescheduled']);
  const ARABIC_RE = /[\u0600-\u06FF]/;
  const tr = (en, ar) => C.lang === 'ar' ? ar : en;

  function ensureStyles(){
    if(document.getElementById('clinic-v95-appointment-display-style')) return;
    const style = document.createElement('style');
    style.id = 'clinic-v95-appointment-display-style';
    style.textContent = `
      #twoWeekScheduler .hour-patient-seat.occupied .seat-copy{
        min-width:0!important;
        overflow:hidden!important;
      }
      #twoWeekScheduler .hour-patient-seat.occupied .seat-copy strong{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        overflow:hidden!important;
        white-space:nowrap!important;
        text-overflow:ellipsis!important;
      }
      #twoWeekScheduler .hour-patient-seat.occupied .seat-copy strong[data-v95-arabic="1"]{
        direction:rtl!important;
        text-align:right!important;
        unicode-bidi:plaintext!important;
      }
      #twoWeekScheduler .hour-patient-seat.occupied .seat-copy strong[data-v95-arabic="0"]{
        direction:ltr!important;
        text-align:left!important;
        unicode-bidi:plaintext!important;
      }

      .v86-extra-day-list,.v88-extra-day-list,.v89-extra-day-list,
      .v90-extra-block,.v91-extra-card,.v93-extra-card,.v94-extra-card{
        display:none!important;
      }

      .v95-extra-card{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        box-sizing:border-box!important;
        margin:10px 0 0!important;
        border:1px solid #fed7aa!important;
        border-radius:14px!important;
        background:#fffaf5!important;
        overflow:hidden!important;
        position:relative!important;
        z-index:2!important;
      }
      .v95-extra-head{
        display:flex;align-items:center;justify-content:space-between;
        gap:8px;padding:9px 11px;border-bottom:1px solid #ffedd5;
      }
      .v95-extra-head strong{font-size:12px;font-weight:900;color:#9a3412}
      .v95-extra-count{
        min-width:24px;height:24px;padding:0 7px;border-radius:999px;
        display:grid;place-items:center;background:#ffedd5;color:#9a3412;
        font-size:10px;font-weight:900;
      }
      .v95-extra-row{
        width:100%;max-width:100%;min-width:0;box-sizing:border-box;
        display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;
        align-items:center;padding:9px 10px;border:0;border-bottom:1px solid #ffedd5;
        background:#fffaf5;color:inherit;cursor:pointer;text-align:start;
      }
      .v95-extra-row:last-child{border-bottom:0}
      .v95-extra-row:hover{background:#fff7ed}
      .v95-extra-num{
        width:28px;height:28px;border-radius:9px;display:grid;place-items:center;
        background:#ffedd5;color:#9a3412;font-size:10px;font-weight:900;
      }
      .v95-extra-copy{display:grid;gap:2px;min-width:0;overflow:hidden}
      .v95-extra-name{
        display:block;min-width:0;max-width:100%;overflow:hidden;
        white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:900;
        color:#10233c;
      }
      .v95-extra-name[data-v95-arabic="1"]{direction:rtl;text-align:right;unicode-bidi:plaintext}
      .v95-extra-name[data-v95-arabic="0"]{direction:ltr;text-align:left;unicode-bidi:plaintext}
      .v95-extra-meta{
        min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
        color:#718096;font-size:9px;
      }
      .v95-extra-time{color:#b45309;font-weight:850}
      .v95-extra-status{color:#0f766e;font-weight:850}
      .v95-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .v95-actions button{width:100%;min-width:0}

      #twoWeekScheduler .scheduler-day-card{
        height:auto!important;
        max-height:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeDigits(s=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(s).replace(/[٠-٩]/g,c=>String(ar.indexOf(c)));
  }

  function cairoYmd(value){
    if(!value) return '';
    try{
      const p = new Intl.DateTimeFormat('en-CA',{
        timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date(value));
      const get = key => p.find(x=>x.type===key)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch{return '';}
  }

  function parseCardDate(card){
    const direct = card.dataset?.date || card.querySelector('[data-date]')?.dataset?.date;
    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

    const start = card.querySelector('[data-start]')?.dataset?.start;
    const fromStart = cairoYmd(start);
    if(fromStart) return fromStart;

    const text = normalizeDigits(card.querySelector('.scheduler-day-header')?.textContent || card.textContent || '');
    let m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;

    m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;

    return '';
  }

  function fmtTime(value){
    try{
      return new Intl.DateTimeFormat(C.lang==='ar'?'ar-EG':'en-US',{
        timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',hour12:true
      }).format(new Date(value));
    }catch{return '';}
  }

  function statusLabel(s){
    const en={booked:'Booked',confirmed:'Confirmed',arrived:'Arrived',waiting:'Waiting',
      with_doctor:'With doctor',completed:'Completed',no_show:'No-show'};
    const ar={booked:'محجوز',confirmed:'مؤكد',arrived:'وصل',waiting:'انتظار',
      with_doctor:'مع الطبيب',completed:'مكتمل',no_show:'لم يحضر'};
    return (C.lang==='ar'?ar:en)[s] || s || '';
  }

  function fixNames(root=document){
    root.querySelectorAll?.('#twoWeekScheduler .hour-patient-seat.occupied .seat-copy strong').forEach(name=>{
      const full=String(name.textContent||'').replace(/\s+/g,' ').trim();
      if(!full) return;
      const arabic=ARABIC_RE.test(full);
      name.dataset.v95Arabic=arabic?'1':'0';
      name.setAttribute('dir',arabic?'rtl':'ltr');
      name.title=full;
    });
  }

  function dayCards(){
    return [...document.querySelectorAll('#twoWeekScheduler .scheduler-day-card, .scheduler-day-card')]
      .map(card=>({card,date:parseCardDate(card)}))
      .filter(x=>x.date);
  }

  function doctorId(){
    const select = document.getElementById('calendarDoctor') ||
      document.querySelector('#doctorSelect,select[data-doctor-select]');
    if(select?.value) return select.value;
    if(C.currentPage==='doctor-appointments' && C.user?.id) return C.user.id;
    return C.doctors?.[0]?.id || '';
  }

  async function loadExtras(doc, dates){
    if(!doc || !dates.length) return [];
    const sorted=[...dates].sort();
    const from=`${sorted[0]}T00:00:00+03:00`;
    const last=new Date(`${sorted.at(-1)}T23:59:59+03:00`);
    last.setTime(last.getTime()+86400000);

    const q=await C.sb.from('appointments')
      .select('*')
      .eq('doctor_id',doc)
      .eq('booking_source','extra_case')
      .gte('scheduled_start',from)
      .lt('scheduled_start',last.toISOString())
      .order('scheduled_start',{ascending:true});

    if(q.error) throw q.error;

    const rows=(q.data||[]).filter(a=>!HIDDEN.has(String(a.status||'')));
    const ids=[...new Set(rows.map(a=>a.patient_id).filter(Boolean))];
    let patients=new Map();

    if(ids.length){
      const p=await C.sb.from('patients')
        .select('id,medical_record_number,english_name,arabic_name,mobile,birth_year')
        .in('id',ids);

      if(!p.error) patients=new Map((p.data||[]).map(x=>[x.id,x]));
    }

    return rows.map(a=>({...a,patient:patients.get(a.patient_id)||{}}));
  }

  function canReception(){
    return C.isReception?.() || C.hasRole?.('owner') || C.hasRole?.('manager') ||
      C.hasRole?.('deputy_manager') || C.hasRole?.('secretary');
  }

  async function rpc(name,args,msg){
    const {error}=await C.sb.rpc(name,args);
    if(error){ C.toast(error.message,'error'); return; }
    C.closeModal();
    C.toast(msg);
    C.route(C.currentPage);
  }

  function checkIn(a){
    C.showModal({
      title:tr('Confirm patient arrival','تأكيد حضور المريض'),
      body:`<form id="v95Checkin" class="form-grid">
        <label>${tr('Fees (EGP)','الرسوم (جنيه)')}<input id="v95Fee" class="control" type="number" min="0" step="1" required></label>
        <label>${tr('Payment method','طريقة الدفع')}<select id="v95Pay" class="control">
          <option value="cash">${tr('Cash','نقدي')}</option><option value="instapay">InstaPay</option>
          <option value="card">${tr('Card','بطاقة')}</option><option value="bank_transfer">${tr('Bank transfer','تحويل بنكي')}</option>
          <option value="other">${tr('Other','أخرى')}</option></select></label>
        <div class="form-actions full-span"><button class="primary-button compact">${tr('Confirm arrival','تأكيد الحضور')}</button></div>
      </form>`,
      onOpen:root=>{
        root.querySelector('#v95Checkin').onsubmit=async e=>{
          e.preventDefault();
          await rpc('frontend_check_in_with_fee',{
            p_id:a.id,p_fee:Number(root.querySelector('#v95Fee').value||0),
            p_payment_method:root.querySelector('#v95Pay').value,p_note:null
          },tr('Checked in.','تم تسجيل الوصول.'));
        };
      }
    });
  }

  function openExtra(a){
    if(!a) return;
    const p=a.patient||{};
    const can=canReception();
    const name=p.english_name||p.arabic_name||tr('Patient','مريض');

    C.showModal({
      title:tr('Extra case','حالة إضافية'),
      body:`<div class="appointment-detail-card">
        <div class="appointment-detail-patient">
          <span class="eyebrow">${C.escape(p.medical_record_number||a.appointment_number||'')}</span>
          <h3>${C.escape(name)}</h3>
          <p class="muted">${C.escape(fmtTime(a.scheduled_start))} • ${C.escape(statusLabel(a.status))}</p>
        </div>
        <div class="v95-actions">
          ${['booked','confirmed'].includes(a.status)&&can?`
            <button class="secondary-button compact" data-v95="edit">${tr('Edit booking','تعديل الحجز')}</button>
            <button class="secondary-button compact" data-v95="checkin">${tr('Check in','تسجيل الوصول')}</button>
            <button class="secondary-button compact" data-v95="noshow">${tr('No-show','لم يحضر')}</button>
            <button class="danger-button compact" data-v95="cancel">${tr('Cancel','إلغاء')}</button>`:''}
          ${a.status==='arrived'&&can?`<button class="primary-button compact" data-v95="send">${tr('Send to doctor','إرسال للطبيب')}</button>`:''}
        </div>
      </div>`,
      onOpen:root=>{
        root.querySelector('[data-v95="edit"]')?.addEventListener('click',()=>{
          C.closeModal(); window.ClinicBookingWorkflow?.showEditBookingModal?.(a.id);
        });
        root.querySelector('[data-v95="checkin"]')?.addEventListener('click',()=>checkIn(a));
        root.querySelector('[data-v95="noshow"]')?.addEventListener('click',()=>rpc(
          'frontend_mark_no_show',{p_id:a.id,p_reason:null},tr('Marked no-show.','تم تسجيل عدم الحضور.')
        ));
        root.querySelector('[data-v95="cancel"]')?.addEventListener('click',()=>{
          const reason=prompt(tr('Cancellation reason','سبب الإلغاء'));
          if(reason) rpc('frontend_cancel_appointment',{p_id:a.id,p_reason:reason},
            tr('Appointment cancelled.','تم إلغاء الموعد.'));
        });
        root.querySelector('[data-v95="send"]')?.addEventListener('click',()=>rpc(
          'frontend_send_to_doctor',{p_id:a.id},tr('Sent to doctor.','تم إرسال المريض للطبيب.')
        ));
      }
    });
  }

  function renderExtras(day, rows){
    day.card.querySelectorAll('.v95-extra-card').forEach(x=>x.remove());
    if(!rows.length) return;

    const block=document.createElement('section');
    block.className='v95-extra-card';
    block.dataset.date=day.date;

    block.innerHTML=`
      <div class="v95-extra-head">
        <strong>＋ ${tr('Extra cases','الحالات الإضافية')}</strong>
        <span class="v95-extra-count">${rows.length}</span>
      </div>
      ${rows.map((a,i)=>{
        const p=a.patient||{};
        const name=p.english_name||p.arabic_name||tr('Patient','مريض');
        const arabic=ARABIC_RE.test(name);
        return `<button type="button" class="v95-extra-row" data-v95-id="${C.escape(a.id)}">
          <span class="v95-extra-num">${i+1}</span>
          <span class="v95-extra-copy">
            <strong class="v95-extra-name" data-v95-arabic="${arabic?'1':'0'}" dir="${arabic?'rtl':'ltr'}">${C.escape(name)}</strong>
            <small class="v95-extra-meta">
              <span class="v95-extra-time">${C.escape(fmtTime(a.scheduled_start))}</span>
              • <span class="v95-extra-status">${C.escape(statusLabel(a.status))}</span>
              ${p.mobile?` • ${C.escape(p.mobile)}`:''}
            </small>
          </span>
        </button>`;
      }).join('')}`;

    const stack=day.card.querySelector('.scheduler-slot-stack');
    if(stack) stack.insertAdjacentElement('afterend',block);
    else day.card.appendChild(block);

    const map=new Map(rows.map(a=>[String(a.id),a]));
    block.querySelectorAll('[data-v95-id]').forEach(btn=>{
      btn.onclick=()=>openExtra(map.get(btn.dataset.v95Id));
    });
  }

  let refreshBusy=false;
  let refreshAgain=false;

  async function refreshExtras(){
    if(!PAGES.has(C.currentPage)) return;
    const cards=dayCards();
    const doc=doctorId();
    if(!cards.length || !doc) return;

    if(refreshBusy){
      refreshAgain=true;
      return;
    }

    refreshBusy=true;

    try{
      const dates=[...new Set(cards.map(x=>x.date))];
      const rows=await loadExtras(doc,dates);

      cards.forEach(day=>{
        renderExtras(
          day,
          rows.filter(a=>cairoYmd(a.scheduled_start)===day.date)
        );
      });
    }catch(err){
      console.error('V95 extra cases render failed',err);
    }finally{
      refreshBusy=false;
      if(refreshAgain){
        refreshAgain=false;
        queueMicrotask(refreshExtras);
      }
    }
  }

  let raf=0;
  function queue(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      ensureStyles();
      fixNames();
      refreshExtras();
    });
  }

  function start(){
    ensureStyles();
    fixNames();
    refreshExtras();

    new MutationObserver(queue).observe(
      document.getElementById('mainContent')||document.body,
      {childList:true,subtree:true}
    );

    document.addEventListener('change',e=>{
      if(['calendarDoctor','calendarWeekCount'].includes(e.target?.id)) queue();
    });

    window.addEventListener('focus',queue);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();
