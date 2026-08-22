(() => {
  const C=window.Clinic;
  if(!C || C.__v93ExtraCasesLoaded) return;
  C.__v93ExtraCasesLoaded=true;

  const PAGES=new Set(['appointments','doctor-appointments']);
  const t=(en,ar)=>C.lang==='ar'?ar:en;

  const style=document.createElement('style');
  style.textContent=`
    .v86-extra-day-list,.v88-extra-day-list,.v89-extra-day-list,.v90-extra-block,.v91-extra-card{display:none!important}
    .v93-extra-card{width:100%;box-sizing:border-box;margin-top:10px;border:1px solid #dbe4ee;border-radius:14px;background:#fff;overflow:hidden}
    .v93-extra-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #e6edf5}
    .v93-extra-head strong{font-size:13px;font-weight:900;color:#10233c}
    .v93-extra-head small{display:block;margin-top:2px;font-size:9px;color:#718096}
    .v93-extra-pill{padding:4px 8px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#b45309;font-size:10px;font-weight:900}
    .v93-extra-row{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #edf2f7;background:#fff;padding:10px 12px;display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;text-align:start;cursor:pointer}
    .v93-extra-row:last-child{border-bottom:0}.v93-extra-row:hover{background:#f8fbff}
    .v93-num{width:28px;height:28px;border-radius:9px;background:#f1f5f9;color:#475569;display:grid;place-items:center;font-size:11px;font-weight:900}
    .v93-copy{min-width:0;display:grid;gap:2px}.v93-copy strong,.v93-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .v93-copy strong{font-size:11px;color:#10233c}.v93-copy small{font-size:9px;color:#718096}
    .v93-time{color:#b45309;font-weight:850}.v93-status{color:#0f766e;font-weight:850}
    .v93-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v93-actions button{width:100%}
    [dir=rtl] .v93-extra-row{text-align:right}
  `;
  document.head.appendChild(style);

  function cairoDate(iso){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
    const g=k=>parts.find(x=>x.type===k)?.value||'';
    return `${g('year')}-${g('month')}-${g('day')}`;
  }

  function time(iso){
    return new Intl.DateTimeFormat(C.lang==='ar'?'ar-EG':'en-US',{timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(iso));
  }

  function status(s){
    const en={booked:'Booked',confirmed:'Confirmed',arrived:'Arrived',waiting:'Waiting',with_doctor:'With doctor',completed:'Completed',no_show:'No-show'};
    const ar={booked:'محجوز',confirmed:'مؤكد',arrived:'وصل',waiting:'انتظار',with_doctor:'مع الطبيب',completed:'مكتمل',no_show:'لم يحضر'};
    return (C.lang==='ar'?ar:en)[s]||s||'';
  }

  function dayDate(card){
    const el=card.querySelector('[data-date]');
    if(el?.dataset.date) return el.dataset.date;
    const st=card.querySelector('[data-start]')?.dataset.start;
    return st?cairoDate(st):null;
  }

  function cards(){
    return [...document.querySelectorAll('.scheduler-day-card')].map(card=>({card,date:dayDate(card)})).filter(x=>x.date);
  }

  function doctor(){
    if(C.currentPage==='doctor-appointments') return C.user?.id||'';
    return document.getElementById('calendarDoctor')?.value||C.doctors?.[0]?.id||'';
  }

  function canReception(){
    return C.isReception?.()||C.hasRole?.('owner')||C.hasRole?.('manager')||C.hasRole?.('deputy_manager')||C.hasRole?.('secretary');
  }

  async function rpc(name,args,msg){
    const {error}=await C.sb.rpc(name,args);
    if(error) return C.toast(error.message,'error');
    C.closeModal(); C.toast(msg); C.route(C.currentPage);
  }

  function checkin(a){
    C.showModal({
      title:t('Confirm patient arrival','تأكيد حضور المريض'),
      body:`<form id="v93Check" class="form-grid">
        <label>${t('Fees (EGP)','الرسوم (جنيه)')}<input id="v93Fee" class="control" type="number" min="0" step="1" required></label>
        <label>${t('Payment method','طريقة الدفع')}<select id="v93Pay" class="control"><option value="cash">${t('Cash','نقدي')}</option><option value="instapay">InstaPay</option><option value="card">${t('Card','بطاقة')}</option><option value="bank_transfer">${t('Bank transfer','تحويل بنكي')}</option><option value="other">${t('Other','أخرى')}</option></select></label>
        <div class="form-actions full-span"><button class="primary-button compact">${t('Confirm arrival','تأكيد الحضور')}</button></div>
      </form>`,
      onOpen:r=>r.querySelector('#v93Check').onsubmit=async e=>{
        e.preventDefault();
        await rpc('frontend_check_in_with_fee',{p_id:a.id,p_fee:Number(r.querySelector('#v93Fee').value||0),p_payment_method:r.querySelector('#v93Pay').value,p_note:null},t('Checked in.','تم تسجيل الوصول.'));
      }
    });
  }

  function open(a){
    const can=canReception();
    C.showModal({
      title:t('Extra case','حالة إضافية'),
      body:`<div class="appointment-detail-card">
        <div class="appointment-detail-patient"><span class="eyebrow">${C.escape(a.medical_record_number||a.appointment_number||'')}</span><h3>${C.escape(a.english_name||a.arabic_name||t('Patient','مريض'))}</h3><p class="muted">${C.escape(time(a.scheduled_start))} • ${C.escape(status(a.status))}</p></div>
        <div class="v93-actions">
          ${['booked','confirmed'].includes(a.status)&&can?`
          <button class="secondary-button compact" data-x="edit">${t('Edit booking','تعديل الحجز')}</button>
          <button class="secondary-button compact" data-x="checkin">${t('Check in','تسجيل الوصول')}</button>
          <button class="secondary-button compact" data-x="noshow">${t('No-show','لم يحضر')}</button>
          <button class="danger-button compact" data-x="cancel">${t('Cancel','إلغاء')}</button>`:''}
          ${a.status==='arrived'&&can?`<button class="primary-button compact" data-x="send">${t('Send to doctor','إرسال للطبيب')}</button>`:''}
        </div></div>`,
      onOpen:r=>{
        r.querySelector('[data-x=edit]')?.addEventListener('click',()=>{C.closeModal();window.ClinicBookingWorkflow?.showEditBookingModal?.(a.id)});
        r.querySelector('[data-x=checkin]')?.addEventListener('click',()=>checkin(a));
        r.querySelector('[data-x=noshow]')?.addEventListener('click',()=>rpc('frontend_mark_no_show',{p_id:a.id,p_reason:null},t('Marked no-show.','تم تسجيل عدم الحضور.')));
        r.querySelector('[data-x=cancel]')?.addEventListener('click',()=>{const reason=prompt(t('Cancellation reason','سبب الإلغاء'));if(reason)rpc('frontend_cancel_appointment',{p_id:a.id,p_reason:reason},t('Appointment cancelled.','تم إلغاء الموعد.'))});
        r.querySelector('[data-x=send]')?.addEventListener('click',()=>rpc('frontend_send_to_doctor',{p_id:a.id},t('Sent to doctor.','تم إرسال المريض للطبيب.')));
      }
    });
  }

  function render(day,rows){
    day.card.querySelectorAll('.v93-extra-card').forEach(x=>x.remove());
    if(!rows.length) return;
    const block=document.createElement('section');
    block.className='v93-extra-card';
    block.innerHTML=`<div class="v93-extra-head"><div><strong>${t('Extra cases','الحالات الإضافية')}</strong><small>${rows.length} ${t(rows.length===1?'patient':'patients','مريض')}</small></div><span class="v93-extra-pill">${rows.length}</span></div>
    ${rows.map((a,i)=>`<button type="button" class="v93-extra-row" data-extra="${C.escape(a.id)}"><span class="v93-num">${i+1}</span><span class="v93-copy"><strong>${C.escape(a.english_name||a.arabic_name||t('Patient','مريض'))}</strong><small><span class="v93-time">${C.escape(time(a.scheduled_start))}</span> • <span class="v93-status">${C.escape(status(a.status))}</span>${a.mobile?` • ${C.escape(a.mobile)}`:''}</small></span></button>`).join('')}`;
    const stack=day.card.querySelector('.scheduler-slot-stack');
    (stack||day.card).insertAdjacentElement(stack?'afterend':'beforeend',block);
    const map=new Map(rows.map(a=>[a.id,a]));
    block.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>open(map.get(b.dataset.extra)));
  }

  let busy=false,pending=false;
  async function refresh(){
    if(!PAGES.has(C.currentPage)) return;
    const ds=cards(),doc=doctor();
    if(!ds.length||!doc) return;
    if(busy){pending=true;return}
    busy=true;
    try{
      const dates=ds.map(x=>x.date).sort();
      const {data,error}=await C.sb.rpc('frontend_get_extra_cases_for_range',{p_doctor:doc,p_from:dates[0],p_to:dates.at(-1)});
      if(error) throw error;
      const rows=data||[];
      ds.forEach(day=>render(day,rows.filter(a=>cairoDate(a.scheduled_start)===day.date)));
    }catch(e){
      console.error('V93 authoritative extra cases failed',e);
    }finally{
      busy=false;if(pending){pending=false;queueMicrotask(refresh)}
    }
  }

  let raf=0;
  new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(refresh)}).observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(['calendarDoctor','calendarWeekCount'].includes(e.target?.id))requestAnimationFrame(refresh)});
  requestAnimationFrame(refresh);
})();