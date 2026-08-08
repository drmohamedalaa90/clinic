(function(){
  const statusActions = {
    booked: ['confirm','cancel','reschedule'],
    confirmed: ['checkin','cancel','reschedule','noshow'],
    arrived: ['send','cancel'],
    waiting: [],
    with_doctor: [],
    completed: [],
    cancelled: [],
    no_show: [],
    rescheduled: []
  };

  async function patientOptions(selected){
    const {data,error}=await Clinic.sb.from('patients').select('id,medical_record_number,english_name,arabic_name').eq('is_active',true).order('created_at',{ascending:false}).limit(150);
    if(error) return `<option value="">${Clinic.escape(error.message)}</option>`;
    return `<option value="">${Clinic.lang==='ar'?'اختر المريض':'Select patient'}</option>${(data||[]).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${Clinic.escape(p.medical_record_number)} — ${Clinic.escape(p.english_name||p.arabic_name||'Patient')}</option>`).join('')}`;
  }

  async function showBookingModal(prefill={}){
    const C=Clinic; await C.loadDoctors(true);
    const patients=await patientOptions(prefill.patientId);
    C.showModal({title:C.lang==='ar'?'حجز موعد':'Book appointment',wide:true,body:`
      <form id="bookingForm" class="form-grid">
        <label class="full-span">${C.lang==='ar'?'المريض':'Patient'}<select id="bookingPatient" name="patient_id" class="control" required>${patients}</select></label>
        <label>${C.lang==='ar'?'الطبيب':'Doctor'}<select id="bookingDoctor" name="doctor_id" class="control" required><option value="">—</option>${C.doctors.map(d=>`<option value="${d.id}" ${d.id===prefill.doctorId?'selected':''}>${C.escape(d.display_name||d.username)}</option>`).join('')}</select></label>
        <label>${C.lang==='ar'?'التاريخ':'Date'}<input id="bookingDate" name="date" type="date" min="${C.cairoDate()}" value="${prefill.date||C.cairoDate()}" class="control" required></label>
        <label>${C.lang==='ar'?'نوع الزيارة':'Type'}<select name="appointment_type" class="control"><option value="new">New</option><option value="follow_up">Follow-up</option></select></label>
        <label>${C.lang==='ar'?'الوقت المتاح':'Available slot'}<select id="bookingSlot" name="slot" class="control" required><option value="">${C.lang==='ar'?'اختر الطبيب والتاريخ':'Choose doctor & date'}</option></select></label>
        <label class="full-span">${C.lang==='ar'?'ملاحظات إدارية':'Notes'}<textarea name="notes" class="control"></textarea></label>
        <div id="slotHint" class="full-span small-note"></div>
        <div class="form-actions full-span"><button class="primary-button compact" type="submit">${C.lang==='ar'?'تأكيد الحجز':'Book appointment'}</button></div>
      </form>`,onOpen:(root)=>{
        const doctor=root.querySelector('#bookingDoctor'),date=root.querySelector('#bookingDate'),slot=root.querySelector('#bookingSlot'),hint=root.querySelector('#slotHint');
        async function loadSlots(){
          if(!doctor.value||!date.value){slot.innerHTML='<option value="">—</option>';return;}
          slot.innerHTML=`<option>${C.lang==='ar'?'جاري التحميل...':'Loading...'}</option>`;
          const {data,error}=await C.sb.rpc('frontend_get_available_slots',{p_doctor:doctor.value,p_day:date.value});
          if(error){slot.innerHTML='<option value="">No slots</option>';hint.textContent=error.message;return;}
          const rows=data||[]; slot.innerHTML=`<option value="">${rows.length?(C.lang==='ar'?'اختر الوقت':'Select time'):(C.lang==='ar'?'لا توجد مواعيد متاحة':'No available slots')}</option>${rows.map(x=>`<option value="${x.slot_start}|${x.slot_end}">${C.formatTime(x.slot_start)} → ${C.formatTime(x.slot_end)}</option>`).join('')}`;
          hint.textContent=rows.length?`${rows.length} ${C.lang==='ar'?'موعد متاح':'available slots'}`:'';
        }
        doctor.onchange=loadSlots; date.onchange=loadSlots; if(doctor.value)loadSlots();
        root.querySelector('#bookingForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const parts=(f.get('slot')||'').split('|');if(parts.length!==2)return C.toast(C.lang==='ar'?'اختر موعداً متاحاً':'Choose an available slot','error');
          const {data,error}=await C.sb.rpc('frontend_book_appointment',{p_patient:f.get('patient_id'),p_doctor:f.get('doctor_id'),p_start:parts[0],p_end:parts[1],p_type:f.get('appointment_type'),p_note:f.get('notes')||null});
          if(error)return C.toast(error.message,'error');C.closeModal();C.toast(C.lang==='ar'?'تم الحجز':'Appointment booked');C.route(C.currentPage==='appointments'?'appointments':'reception');window.ClinicNotifications?.refresh?.();};
      }});
  }

  async function fetchDayAppointments({doctorId=null,date=null}={}){
    const C=Clinic,d=date||C.cairoDate();const start=`${d}T00:00:00+03:00`,end=`${d}T23:59:59+03:00`;
    let q=C.sb.from('appointments').select('*').gte('scheduled_start',start).lte('scheduled_start',end).order('scheduled_start');
    if(doctorId)q=q.eq('doctor_id',doctorId);
    const {data,error}=await q;if(error)throw error;return data||[];
  }

  async function attachPatientNames(appts){
    const ids=[...new Set(appts.map(a=>a.patient_id).filter(Boolean))];if(!ids.length)return new Map();
    const {data}=await Clinic.sb.from('patients').select('id,medical_record_number,english_name,arabic_name').in('id',ids);
    return new Map((data||[]).map(p=>[p.id,p]));
  }

  async function action(id, kind){
    const C=Clinic; let result;
    if(kind==='confirm') result=await C.sb.rpc('frontend_confirm_appointment',{p_id:id});
    if(kind==='checkin') result=await C.sb.rpc('frontend_check_in_appointment',{p_id:id});
    if(kind==='send') result=await C.sb.rpc('frontend_send_to_doctor',{p_id:id});
    if(kind==='noshow') result=await C.sb.rpc('frontend_mark_no_show',{p_id:id,p_reason:null});
    if(kind==='cancel'){
      const reason=prompt(C.lang==='ar'?'سبب الإلغاء':'Cancellation reason');if(!reason)return;
      result=await C.sb.rpc('frontend_cancel_appointment',{p_id:id,p_reason:reason});
    }
    if(result?.error)return C.toast(result.error.message,'error');C.toast(C.lang==='ar'?'تم تحديث الموعد':'Appointment updated');window.ClinicNotifications?.refresh?.();C.route(C.currentPage);
  }

  async function reschedule(id,doctorId){
    const C=Clinic;C.showModal({title:C.lang==='ar'?'إعادة جدولة':'Reschedule',body:`<form id="rescheduleForm" class="form-grid"><label>${C.lang==='ar'?'التاريخ الجديد':'New date'}<input id="rescheduleDate" type="date" min="${C.cairoDate()}" value="${C.cairoDate()}" class="control" required></label><label>${C.lang==='ar'?'الوقت':'Slot'}<select id="rescheduleSlot" class="control" required></select></label><label class="full-span">${C.lang==='ar'?'السبب':'Reason'}<textarea id="rescheduleReason" class="control" required></textarea></label><div class="form-actions full-span"><button class="primary-button compact">${C.lang==='ar'?'تأكيد':'Confirm'}</button></div></form>`,onOpen:(root)=>{
      const date=root.querySelector('#rescheduleDate'),slot=root.querySelector('#rescheduleSlot');async function load(){const {data,error}=await C.sb.rpc('frontend_get_available_slots',{p_doctor:doctorId,p_day:date.value});slot.innerHTML=error?`<option>${C.escape(error.message)}</option>`:`<option value="">—</option>${(data||[]).map(x=>`<option value="${x.slot_start}|${x.slot_end}">${C.formatTime(x.slot_start)}</option>`).join('')}`;}date.onchange=load;load();
      root.querySelector('#rescheduleForm').onsubmit=async e=>{e.preventDefault();const parts=slot.value.split('|'),reason=root.querySelector('#rescheduleReason').value.trim();if(parts.length!==2||!reason)return;const {error}=await C.sb.rpc('frontend_reschedule_appointment',{p_id:id,p_start:parts[0],p_end:parts[1],p_reason:reason});if(error)return C.toast(error.message,'error');C.closeModal();C.toast(C.lang==='ar'?'تمت إعادة الجدولة':'Appointment rescheduled');C.route(C.currentPage);};
    }});
  }

  async function renderAppointmentsPage({patientId=null,openBooking=false,doctorOnly=false}={}){
    const C=Clinic;C.setTitle(doctorOnly?C.t('appointments'):C.t('appointments'));await C.loadDoctors(true);
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">${doctorOnly?'MY':'BOOKING'}</span><h2>${doctorOnly?(C.lang==='ar'?'مواعيدي':'My appointments'):(C.lang==='ar'?'المواعيد والحجز':'Appointments & booking')}</h2></div>${C.isReception()&&!doctorOnly?`<button id="newBooking" class="primary-button compact">+ ${C.lang==='ar'?'حجز جديد':'New booking'}</button>`:''}</section>
      <section class="content-card"><div class="filter-row"><input id="apptDate" type="date" value="${C.cairoDate()}" class="control">${C.isReception()&&!doctorOnly?`<select id="apptDoctor" class="control"><option value="">${C.lang==='ar'?'كل الأطباء':'All doctors'}</option>${C.doctors.map(d=>`<option value="${d.id}">${C.escape(d.display_name||d.username)}</option>`).join('')}</select>`:''}<button id="refreshAppts" class="secondary-button">${C.lang==='ar'?'تحديث':'Refresh'}</button></div><div id="appointmentsArea" class="space-top"></div></section>`;
    async function refresh(){const date=document.getElementById('apptDate').value;const doctor=doctorOnly?C.user.id:(document.getElementById('apptDoctor')?.value||null);const appts=await fetchDayAppointments({doctorId:doctor,date});const pm=await attachPatientNames(appts);const area=document.getElementById('appointmentsArea');if(!appts.length){area.innerHTML=`<div class="empty-state">${C.lang==='ar'?'لا توجد مواعيد.':'No appointments.'}</div>`;return;}area.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>${C.lang==='ar'?'الوقت':'Time'}</th><th>${C.lang==='ar'?'المريض':'Patient'}</th>${!doctorOnly?`<th>${C.lang==='ar'?'الطبيب':'Doctor'}</th>`:''}<th>${C.lang==='ar'?'النوع':'Type'}</th><th>${C.lang==='ar'?'الحالة':'Status'}</th>${C.isReception()&&!doctorOnly?'<th></th>':''}</tr></thead><tbody>${appts.map(a=>{const p=pm.get(a.patient_id)||{};const acts=statusActions[a.status]||[];return`<tr><td><strong>${C.formatTime(a.scheduled_start)}</strong></td><td>${C.escape(p.english_name||p.arabic_name||'Patient')}<div class="subline">${C.escape(p.medical_record_number||'')}</div></td>${!doctorOnly?`<td>${C.escape(C.doctorName(a.doctor_id))}</td>`:''}<td>${C.escape(a.appointment_type||a.type||'—')}</td><td>${C.statusPill(a.status)}</td>${C.isReception()&&!doctorOnly?`<td class="action-cell">${acts.map(k=>k==='reschedule'?`<button class="table-action" data-reschedule="${a.id}" data-doctor="${a.doctor_id}">${C.lang==='ar'?'إعادة جدولة':'Reschedule'}</button>`:`<button class="table-action ${k==='cancel'?'danger-outline':''}" data-appt-action="${k}" data-id="${a.id}">${({confirm:'Confirm',checkin:'Check in',send:'Send',noshow:'No show',cancel:'Cancel'})[k]}</button>`).join('')}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;
      area.querySelectorAll('[data-appt-action]').forEach(b=>b.onclick=()=>action(b.dataset.id,b.dataset.apptAction));area.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>reschedule(b.dataset.reschedule,b.dataset.doctor));}
    document.getElementById('refreshAppts').onclick=refresh;document.getElementById('apptDate').onchange=refresh;document.getElementById('apptDoctor')&&(document.getElementById('apptDoctor').onchange=refresh);if(document.getElementById('newBooking'))document.getElementById('newBooking').onclick=()=>showBookingModal({patientId});refresh();if(openBooking)setTimeout(()=>showBookingModal({patientId}),50);
  }

  window.ClinicPages['appointments']=renderAppointmentsPage;
  window.ClinicPages['doctor-appointments']=params=>renderAppointmentsPage({...params,doctorOnly:true});

  window.ClinicPages['reception']=async function(){
    const C=Clinic;if(!C.isReception())return C.route('dashboard');C.setTitle(C.t('reception'));await C.loadDoctors(true);
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">LIVE</span><h2>${C.lang==='ar'?'مكتب الاستقبال':'Reception desk'}</h2><p class="muted">${C.lang==='ar'?'تأكيد الوصول وإرسال المريض للطبيب.':'Confirm arrivals and send patients to the doctor.'}</p></div><button id="receptionBook" class="primary-button compact">+ ${C.lang==='ar'?'حجز جديد':'New booking'}</button></section>
      <section class="content-card"><div class="filter-row"><input id="receptionDate" type="date" value="${C.cairoDate()}" class="control"><select id="receptionDoctor" class="control"><option value="">${C.lang==='ar'?'كل الأطباء':'All doctors'}</option>${C.doctors.map(d=>`<option value="${d.id}">${C.escape(d.display_name||d.username)}</option>`).join('')}</select><button id="receptionRefresh" class="secondary-button">${C.lang==='ar'?'تحديث':'Refresh'}</button></div><div id="receptionArea" class="space-top"></div></section>`;
    async function refresh(){const appts=await fetchDayAppointments({date:document.getElementById('receptionDate').value,doctorId:document.getElementById('receptionDoctor').value||null});const pm=await attachPatientNames(appts);document.getElementById('receptionArea').innerHTML=appts.length?`<div class="queue-board">${appts.map(a=>{const p=pm.get(a.patient_id)||{};const acts=statusActions[a.status]||[];return`<article class="queue-row"><div class="queue-time">${C.formatTime(a.scheduled_start)}</div><div class="queue-patient"><strong>${C.escape(p.english_name||p.arabic_name||'Patient')}</strong><span>${C.escape(p.medical_record_number||'')} • ${C.escape(C.doctorName(a.doctor_id))}</span></div><div>${C.statusPill(a.status)}</div><div class="queue-actions">${acts.map(k=>k==='reschedule'?`<button class="table-action" data-reschedule="${a.id}" data-doctor="${a.doctor_id}">↻</button>`:`<button class="table-action ${k==='cancel'?'danger-outline':''}" data-appt-action="${k}" data-id="${a.id}">${({confirm:'Confirm',checkin:'Check in',send:'Send',noshow:'No show',cancel:'Cancel'})[k]}</button>`).join('')}</div></article>`}).join('')}</div>`:`<div class="empty-state">${C.lang==='ar'?'لا توجد مواعيد اليوم.':'No appointments for this day.'}</div>`;document.querySelectorAll('[data-appt-action]').forEach(b=>b.onclick=()=>action(b.dataset.id,b.dataset.apptAction));document.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>reschedule(b.dataset.reschedule,b.dataset.doctor));}
    document.getElementById('receptionBook').onclick=()=>showBookingModal();document.getElementById('receptionRefresh').onclick=refresh;document.getElementById('receptionDate').onchange=refresh;document.getElementById('receptionDoctor').onchange=refresh;refresh();
  };

  window.ClinicPages['today-clinic']=async function(){
    const C=Clinic;C.setTitle(C.t('todayClinic'));const appts=await fetchDayAppointments({doctorId:C.user.id,date:C.cairoDate()}),pm=await attachPatientNames(appts);
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">${C.lang==='ar'?'اليوم':'TODAY'}</span><h2>${C.lang==='ar'?'عيادة اليوم':"Today's clinic"}</h2></div><button class="secondary-button" id="openQueueBtn">${C.lang==='ar'?'قائمة الانتظار':'My Queue'}</button></section><section class="content-card">${appts.length?`<div class="timeline-list">${appts.map(a=>{const p=pm.get(a.patient_id)||{};return`<article><div class="timeline-time">${C.formatTime(a.scheduled_start)}</div><div class="timeline-dot"></div><div><strong>${C.escape(p.english_name||p.arabic_name||'Patient')}</strong><div class="muted">${C.escape(p.medical_record_number||'')} • ${C.escape(a.appointment_type||a.type||'')}</div></div><div>${C.statusPill(a.status)}</div></article>`}).join('')}</div>`:`<div class="empty-state">${C.lang==='ar'?'لا توجد حجوزات اليوم.':'No appointments today.'}</div>`}</section>`;document.getElementById('openQueueBtn').onclick=()=>C.route('queue');
  };
})();
