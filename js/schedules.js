(function(){
  const weekdayNames = {
    en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    ar: ['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد']
  };

  function weekdayLabel(n){ return weekdayNames[Clinic.lang][Number(n)-1] || n; }

  async function renderScheduleRows(doctorId, editable=false){
    const { data, error } = await Clinic.sb.from('doctor_working_hours').select('*').eq('doctor_id',doctorId).order('weekday').order('start_time');
    if (error) return `<div class="empty-state">${Clinic.escape(error.message)}</div>`;
    if (!data?.length) return `<div class="empty-state">${Clinic.lang==='ar'?'لا توجد ساعات عمل مسجلة بعد.':'No working hours saved yet.'}</div>`;
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${Clinic.lang==='ar'?'اليوم':'Day'}</th><th>${Clinic.lang==='ar'?'من':'From'}</th><th>${Clinic.lang==='ar'?'إلى':'To'}</th><th>${Clinic.lang==='ar'?'مدة الحجز':'Slot'}</th><th>${Clinic.lang==='ar'?'ساري من':'Effective'}</th><th>${Clinic.lang==='ar'?'الحالة':'Status'}</th>${editable?'<th></th>':''}</tr></thead><tbody>
      ${data.map(r=>`<tr><td><strong>${weekdayLabel(r.weekday)}</strong></td><td>${r.start_time?.slice(0,5)||'—'}</td><td>${r.end_time?.slice(0,5)||'—'}</td><td>${r.slot_minutes||'—'} min</td><td>${r.effective_from||'—'}${r.effective_until?` → ${r.effective_until}`:''}</td><td>${r.is_active===false?Clinic.statusPill('inactive'):Clinic.statusPill('active')}</td>${editable?`<td><button class="table-action danger-outline" data-disable-schedule="${r.id}" data-active="${r.is_active!==false}">${r.is_active===false?(Clinic.lang==='ar'?'تفعيل':'Activate'):(Clinic.lang==='ar'?'تعطيل':'Disable')}</button></td>`:''}</tr>`).join('')}
    </tbody></table></div>`;
  }

  async function renderExceptions(doctorId, management=false){
    const { data, error } = await Clinic.sb.from('doctor_schedule_exceptions').select('*').eq('doctor_id',doctorId).gte('exception_date',Clinic.cairoDate()).order('exception_date').limit(30);
    if (error) return `<div class="empty-state">${Clinic.escape(error.message)}</div>`;
    if (!data?.length) return `<div class="empty-state">${Clinic.lang==='ar'?'لا توجد تغييرات قادمة.':'No upcoming schedule exceptions.'}</div>`;
    return `<div class="stack-list">${data.map(x=>`<article class="list-card"><div><div class="list-title">${Clinic.escape((x.exception_type||'').replaceAll('_',' '))}</div><div class="muted">${x.exception_date} ${x.is_all_day?'• all day':`${x.start_time?.slice(0,5)||''} ${x.end_time?`→ ${x.end_time.slice(0,5)}`:''}`}</div>${x.note?`<div class="small-note">${Clinic.escape(x.note)}</div>`:''}</div><div class="list-actions">${Clinic.statusPill(x.status)}${management&&x.status==='pending'?`<button class="table-action success-outline" data-review-exception="${x.id}" data-action="approved">✓</button><button class="table-action danger-outline" data-review-exception="${x.id}" data-action="rejected">✕</button>`:''}</div></article>`).join('')}</div>`;
  }

  window.ClinicPages['schedules'] = async function(){
    const C=Clinic; if(!C.isManagement()){ return C.route('my-schedule'); }
    C.setTitle(C.t('schedules')); await C.loadDoctors(true);
    const docs=C.doctors;
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">MANAGEMENT</span><h2>${C.lang==='ar'?'إدارة جداول الأطباء':'Doctor schedule management'}</h2><p class="muted">${C.lang==='ar'?'ساعات العمل الأساسية والتغييرات حسب التاريخ.':'Regular hours and date-specific exceptions.'}</p></div>
      <div class="toolbar-actions"><select id="scheduleDoctor" class="control">${docs.map(d=>`<option value="${d.id}">${C.escape(d.display_name||d.username)}</option>`).join('')}</select><button id="addWorkingHours" class="primary-button compact">+ ${C.lang==='ar'?'ساعات عمل':'Working hours'}</button><button id="addException" class="secondary-button">+ ${C.lang==='ar'?'تغيير / اعتذار':'Exception'}</button></div></section>
      <section class="content-card"><div class="section-head"><h3>${C.lang==='ar'?'الساعات الأسبوعية':'Weekly hours'}</h3></div><div id="workingHoursArea"></div></section>
      <section class="content-card"><div class="section-head"><h3>${C.lang==='ar'?'التغييرات القادمة':'Upcoming exceptions'}</h3></div><div id="exceptionsArea"></div></section>`;

    const doctorSelect=document.getElementById('scheduleDoctor');
    async function refresh(){
      document.getElementById('workingHoursArea').innerHTML=await renderScheduleRows(doctorSelect.value,true);
      document.getElementById('exceptionsArea').innerHTML=await renderExceptions(doctorSelect.value,true);
      bindRowActions();
    }
    function bindRowActions(){
      document.querySelectorAll('[data-disable-schedule]').forEach(btn=>btn.onclick=async()=>{
        const active=btn.dataset.active==='true';
        const {error}=await C.sb.from('doctor_working_hours').update({is_active:!active}).eq('id',btn.dataset.disableSchedule);
        if(error) return C.toast(error.message,'error'); C.toast(C.lang==='ar'?'تم تحديث الجدول':'Schedule updated'); refresh();
      });
      document.querySelectorAll('[data-review-exception]').forEach(btn=>btn.onclick=async()=>{
        const {error}=await C.sb.from('doctor_schedule_exceptions').update({status:btn.dataset.action,reviewed_by:C.user.id,reviewed_at:new Date().toISOString()}).eq('id',btn.dataset.reviewException);
        if(error) return C.toast(error.message,'error'); C.toast(C.lang==='ar'?'تم تحديث الطلب':'Request updated'); refresh();
      });
    }
    doctorSelect.onchange=refresh;
    document.getElementById('addWorkingHours').onclick=()=>C.showModal({title:C.lang==='ar'?'إضافة ساعات عمل':'Add working hours',body:`
      <form id="workingHoursForm" class="form-grid">
        <label>${C.lang==='ar'?'اليوم':'Weekday'}<select name="weekday" class="control">${weekdayNames[C.lang].map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select></label>
        <label>${C.lang==='ar'?'من':'Start'}<input name="start_time" type="time" class="control" required></label>
        <label>${C.lang==='ar'?'إلى':'End'}<input name="end_time" type="time" class="control" required></label>
        <label>${C.lang==='ar'?'مدة الموعد':'Slot minutes'}<select name="slot_minutes" class="control">${[10,15,20,30,45,60].map(v=>`<option value="${v}" ${v===20?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>${C.lang==='ar'?'ساري من':'Effective from'}<input name="effective_from" type="date" value="${C.cairoDate()}" class="control" required></label>
        <label>${C.lang==='ar'?'حتى':'Effective until'}<input name="effective_until" type="date" class="control"></label>
        <label class="full-span">${C.lang==='ar'?'ملاحظات':'Notes'}<textarea name="notes" class="control"></textarea></label>
        <div class="form-actions full-span"><button class="primary-button compact" type="submit">${C.lang==='ar'?'حفظ':'Save'}</button></div>
      </form>`,onOpen:(root)=>{
        root.querySelector('#workingHoursForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={doctor_id:doctorSelect.value,weekday:Number(f.get('weekday')),start_time:f.get('start_time'),end_time:f.get('end_time'),slot_minutes:Number(f.get('slot_minutes')),effective_from:f.get('effective_from'),effective_until:f.get('effective_until')||null,is_active:true,notes:f.get('notes')||null,created_by:C.user.id};
        const {error}=await C.sb.from('doctor_working_hours').insert(payload);if(error)return C.toast(error.message,'error');C.closeModal();C.toast(C.lang==='ar'?'تم حفظ ساعات العمل':'Working hours saved');refresh();};
      }});
    document.getElementById('addException').onclick=()=>C.showModal({title:C.lang==='ar'?'تغيير على الجدول':'Schedule exception',body:`
      <form id="exceptionForm" class="form-grid">
        <label>${C.lang==='ar'?'النوع':'Type'}<select name="exception_type" class="control"><option value="apology">Apology</option><option value="vacation">Vacation</option><option value="emergency_cancellation">Emergency cancellation</option><option value="extra_clinic">Extra clinic</option><option value="blocked_period">Blocked period</option><option value="changed_hours">Changed hours</option></select></label>
        <label>${C.lang==='ar'?'التاريخ':'Date'}<input name="exception_date" type="date" value="${C.cairoDate()}" class="control" required></label>
        <label class="inline-check"><input name="is_all_day" type="checkbox" checked> ${C.lang==='ar'?'طوال اليوم':'All day'}</label>
        <label>${C.lang==='ar'?'من':'Start'}<input name="start_time" type="time" class="control"></label>
        <label>${C.lang==='ar'?'إلى':'End'}<input name="end_time" type="time" class="control"></label>
        <label>${C.lang==='ar'?'مدة الموعد':'Slot minutes'}<input name="slot_minutes" type="number" min="5" max="180" value="20" class="control"></label>
        <label class="full-span">${C.lang==='ar'?'ملاحظة':'Note'}<textarea name="note" class="control"></textarea></label>
        <div class="form-actions full-span"><button class="primary-button compact">${C.lang==='ar'?'حفظ واعتماد':'Save & approve'}</button></div>
      </form>`,onOpen:(root)=>{
        root.querySelector('#exceptionForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const all=f.get('is_all_day')==='on';const type=f.get('exception_type');const payload={doctor_id:doctorSelect.value,exception_date:f.get('exception_date'),exception_type:type,is_all_day:all,start_time:all?null:(f.get('start_time')||null),end_time:all?null:(f.get('end_time')||null),slot_minutes:['extra_clinic','changed_hours'].includes(type)?Number(f.get('slot_minutes')||20):null,status:'approved',note:f.get('note')||null,requested_by:C.user.id,reviewed_by:C.user.id,reviewed_at:new Date().toISOString()};
        const {error}=await C.sb.from('doctor_schedule_exceptions').insert(payload);if(error)return C.toast(error.message,'error');C.closeModal();C.toast(C.lang==='ar'?'تم حفظ التغيير':'Exception saved');refresh();};
      }});
    refresh();
  };

  window.ClinicPages['my-schedule'] = async function(){
    const C=Clinic; C.setTitle(C.t('mySchedule'));
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">${C.lang==='ar'?'جدولي':'MY SCHEDULE'}</span><h2>${C.lang==='ar'?'ساعات العمل والطلبات':'Working hours & requests'}</h2></div><button id="requestException" class="primary-button compact">+ ${C.lang==='ar'?'طلب تغيير / اعتذار':'Request change'}</button></section>
      <section class="content-card"><h3>${C.lang==='ar'?'الساعات الأسبوعية':'Weekly hours'}</h3><div id="myHours"></div></section>
      <section class="content-card"><h3>${C.lang==='ar'?'التغييرات والطلبات القادمة':'Upcoming changes & requests'}</h3><div id="myExceptions"></div></section>`;
    async function refresh(){document.getElementById('myHours').innerHTML=await renderScheduleRows(C.user.id,false);document.getElementById('myExceptions').innerHTML=await renderExceptions(C.user.id,false);}
    document.getElementById('requestException').onclick=()=>C.showModal({title:C.lang==='ar'?'طلب تغيير الجدول':'Request schedule change',body:`<form id="doctorExceptionForm" class="form-grid">
      <label>${C.lang==='ar'?'النوع':'Type'}<select name="exception_type" class="control"><option value="apology">Apology</option><option value="vacation">Vacation</option><option value="emergency_cancellation">Emergency cancellation</option><option value="extra_clinic">Extra clinic</option><option value="blocked_period">Blocked period</option><option value="changed_hours">Changed hours</option></select></label>
      <label>${C.lang==='ar'?'التاريخ':'Date'}<input name="exception_date" type="date" min="${C.cairoDate()}" class="control" required></label>
      <label class="inline-check"><input name="is_all_day" type="checkbox" checked> ${C.lang==='ar'?'طوال اليوم':'All day'}</label>
      <label>${C.lang==='ar'?'من':'Start'}<input name="start_time" type="time" class="control"></label><label>${C.lang==='ar'?'إلى':'End'}<input name="end_time" type="time" class="control"></label>
      <label>${C.lang==='ar'?'مدة الموعد':'Slot minutes'}<input name="slot_minutes" type="number" value="20" class="control"></label><label class="full-span">${C.lang==='ar'?'السبب / الملاحظة':'Reason / note'}<textarea name="note" class="control" required></textarea></label><div class="form-actions full-span"><button class="primary-button compact">${C.lang==='ar'?'إرسال الطلب':'Send request'}</button></div></form>`,onOpen:(root)=>{
        root.querySelector('#doctorExceptionForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),all=f.get('is_all_day')==='on',type=f.get('exception_type');const payload={doctor_id:C.user.id,exception_date:f.get('exception_date'),exception_type:type,is_all_day:all,start_time:all?null:(f.get('start_time')||null),end_time:all?null:(f.get('end_time')||null),slot_minutes:['extra_clinic','changed_hours'].includes(type)?Number(f.get('slot_minutes')||20):null,status:'pending',note:f.get('note')||null,requested_by:C.user.id};const {error}=await C.sb.from('doctor_schedule_exceptions').insert(payload);if(error)return C.toast(error.message,'error');C.closeModal();C.toast(C.lang==='ar'?'تم إرسال الطلب':'Request sent');refresh();window.ClinicNotifications?.refresh?.();};
      }});
    refresh();
  };
})();
