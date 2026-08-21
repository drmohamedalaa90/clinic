(() => {
  const C = window.Clinic;
  if (!C || C.__v51ExtraCasesLoaded) return;
  C.__v51ExtraCasesLoaded = true;

  const pages = new Set(['appointments','doctor-appointments']);

  const style = document.createElement('style');
  style.textContent = `
    .v51-extra-btn{min-height:54px;padding:0 20px;border:1px solid #f59e0b;border-radius:14px;background:#fff7ed;color:#b45309;font-weight:850;white-space:nowrap}
    .v51-extra-btn:hover{background:#ffedd5}
    .v51-extra-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .v51-extra-grid label,.v51-extra-form>label{display:grid;gap:7px;font-size:13px;font-weight:750}
    .v51-extra-form{display:grid;gap:16px}
    .v51-extra-banner{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px;border:1px solid #fed7aa;border-radius:14px;background:#fff7ed;color:#9a3412}
    .v51-extra-count{font-weight:900;background:#ffedd5;padding:7px 11px;border-radius:999px;white-space:nowrap}
    .v51-patients{max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:13px;background:#fff}
    .v51-patient{width:100%;border:0;border-bottom:1px solid var(--border);background:#fff;padding:12px;text-align:start;display:grid;gap:3px}
    .v51-patient:hover,.v51-patient.selected{background:var(--primary-soft)}
    .v51-patient small{color:var(--muted);font-size:11px}
    @media(max-width:700px){.v51-extra-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  async function searchPatients(term=''){
    let q = C.sb.from('patients')
      .select('id,medical_record_number,english_name,arabic_name,birth_year,mobile')
      .eq('is_active',true)
      .order('created_at',{ascending:false})
      .limit(60);

    const t = term.trim();
    if(t){
      const s = t.replaceAll(',',' ');
      q = q.or(`medical_record_number.ilike.%${s}%,arabic_name.ilike.%${s}%,english_name.ilike.%${s}%,mobile.ilike.%${s}%`);
    }
    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function openModal(){
    await C.loadDoctors(true);
    const doctorOnly = C.currentPage==='doctor-appointments';
    const defaultDoctor = doctorOnly ? C.user.id : (C.doctors?.[0]?.id||'');
    const today = C.cairoDate();

    C.showModal({
      title:C.lang==='ar'?'إضافة حالة إضافية':'Add extra case',
      wide:true,
      body:`
        <form id="v51ExtraForm" class="v51-extra-form">
          <div class="v51-extra-banner">
            <div><strong>${C.lang==='ar'?'الحالات الإضافية لا تتبع الساعات ولا حد 4 مرضى/ساعة':'Extra cases ignore normal slots and the 4-patient/hour limit'}</strong></div>
            <span id="v51ExtraCount" class="v51-extra-count">0 / 10</span>
          </div>

          <div class="v51-extra-grid">
            <label>${C.lang==='ar'?'الطبيب':'Doctor'}
              <select id="v51Doctor" class="control" ${doctorOnly?'disabled':''}>
                ${C.doctors.map(d=>`<option value="${d.id}" ${d.id===defaultDoctor?'selected':''}>${C.escape(C.doctorName(d.id))}</option>`).join('')}
              </select>
            </label>
            <label>${C.lang==='ar'?'التاريخ':'Date'}
              <input id="v51Date" class="control" type="date" min="${today}" value="${today}" required>
            </label>
            <label>${C.lang==='ar'?'وقت تقريبي حر':'Free approximate time'}
              <input id="v51Time" class="control" type="time" value="12:00" required>
            </label>
            <label>${C.lang==='ar'?'نوع الزيارة':'Visit type'}
              <select id="v51Type" class="control"><option value="new">${C.lang==='ar'?'كشف':'Examination'}</option><option value="follow_up">${C.lang==='ar'?'استشارة':'Consultation'}</option></select>
            </label>
          </div>

          <label>${C.lang==='ar'?'اختر المريض':'Choose patient'}
            <input id="v51PatientSearch" class="control" placeholder="${C.lang==='ar'?'الاسم / MRN / الموبايل':'Name / MRN / mobile'}">
          </label>
          <input id="v51PatientId" type="hidden">
          <div id="v51Patients" class="v51-patients"></div>

          <label>${C.lang==='ar'?'ملاحظة (اختياري)':'Note (optional)'}
            <textarea id="v51Note" class="control" rows="3"></textarea>
          </label>

          <div class="form-actions"><button id="v51Submit" class="primary-button compact" type="submit">${C.lang==='ar'?'حجز كحالة إضافية':'Book as extra case'}</button></div>
        </form>
      `,
      onOpen:(root)=>{
        const form=root.querySelector('#v51ExtraForm');
        const doctor=root.querySelector('#v51Doctor');
        const date=root.querySelector('#v51Date');
        const time=root.querySelector('#v51Time');
        const type=root.querySelector('#v51Type');
        const search=root.querySelector('#v51PatientSearch');
        const patientId=root.querySelector('#v51PatientId');
        const patients=root.querySelector('#v51Patients');
        const count=root.querySelector('#v51ExtraCount');
        const submit=root.querySelector('#v51Submit');
        const note=root.querySelector('#v51Note');

        async function refreshCount(){
          const {data,error}=await C.sb.rpc('frontend_get_extra_case_summary',{p_doctor:doctor.value,p_day:date.value});
          if(error){console.warn(error);return;}
          count.textContent=`${data?.count||0} / 10`;
          submit.disabled=Number(data?.remaining||0)<=0;
        }

        async function renderPatients(){
          patients.innerHTML='<div class="muted" style="padding:12px">...</div>';
          try{
            const rows=await searchPatients(search.value);
            patients.innerHTML=rows.length?rows.map(p=>`
              <button type="button" class="v51-patient" data-patient="${p.id}">
                <strong>${C.escape(p.english_name||p.arabic_name||'Patient')}</strong>
                <small>${C.escape([p.medical_record_number,p.mobile,p.birth_year].filter(Boolean).join(' • '))}</small>
              </button>`).join(''):'<div class="muted" style="padding:12px">No matching patient</div>';
            patients.querySelectorAll('[data-patient]').forEach(b=>b.onclick=()=>{
              patientId.value=b.dataset.patient;
              patients.querySelectorAll('.v51-patient').forEach(x=>x.classList.remove('selected'));
              b.classList.add('selected');
            });
          }catch(e){patients.innerHTML=`<div style="padding:12px;color:#b91c1c">${C.escape(e.message)}</div>`;}
        }

        let timer=null;
        search.oninput=()=>{clearTimeout(timer);timer=setTimeout(renderPatients,250);};
        doctor.onchange=refreshCount;
        date.onchange=refreshCount;

        form.onsubmit=async(e)=>{
          e.preventDefault();
          if(!patientId.value) return C.toast(C.lang==='ar'?'اختر المريض أولاً.':'Choose a patient first.','error');
          submit.disabled=true;
          const old=submit.textContent;
          submit.textContent=C.lang==='ar'?'جاري الحجز...':'Booking...';
          const {data,error}=await C.sb.rpc('frontend_book_extra_case',{
            p_patient:patientId.value,
            p_doctor:doctor.value,
            p_day:date.value,
            p_time:time.value||'12:00',
            p_type:type.value||'new',
            p_note:note.value.trim()||null
          });
          if(error){submit.disabled=false;submit.textContent=old;return C.toast(error.message,'error');}
          C.closeModal();
          C.toast(C.lang==='ar'?`تم حجز الحالة الإضافية (${data?.extra_count||''}/10).`:`Extra case booked (${data?.extra_count||''}/10).`);
          setTimeout(()=>window.location.reload(),350);
        };

        renderPatients();
        refreshCount();
      }
    });
  }

  function inject(){
    if(!pages.has(C.currentPage)) return;
    const newBooking=document.getElementById('newBooking');
    if(!newBooking||document.getElementById('v51ExtraCaseButton')) return;
    const b=document.createElement('button');
    b.id='v51ExtraCaseButton';
    b.type='button';
    b.className='v51-extra-btn';
    b.textContent=C.lang==='ar'?'+ حالة إضافية':'+ Extra case';
    b.onclick=openModal;
    newBooking.insertAdjacentElement('afterend',b);
  }

  new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});
  inject();
})();
