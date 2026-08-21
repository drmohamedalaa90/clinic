(() => {
  const C = window.Clinic;
  if (!C) return;

  // Replace any older V51/V52 extra-case launcher with this UI.
  C.__v52ExtraCasesLoaded = true;

  function ensureStyles(){
    if(document.getElementById('v54-extra-case-ui-styles')) return;
    const s=document.createElement('style');
    s.id='v54-extra-case-ui-styles';
    s.textContent=`
      .v54-extra-modal{display:grid;gap:18px}
      .v54-extra-banner{
        display:flex;align-items:center;justify-content:space-between;gap:14px;
        border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;
        border-radius:14px;padding:14px 16px
      }
      .v54-extra-count{font-weight:900;background:#ffedd5;border-radius:999px;padding:7px 11px}
      .v54-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .v54-grid label,.v54-extra-modal>label{display:grid;gap:7px;font-size:13px;font-weight:750}
      .v54-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .v54-mode{
        min-height:50px;border:1px solid var(--border);border-radius:12px;background:#fff;
        color:var(--text);font-weight:850;cursor:pointer
      }
      .v54-mode.active{
        border-color:var(--primary);background:var(--primary-soft);color:var(--primary)
      }
      .v54-panel{display:none}
      .v54-panel.active{display:grid;gap:14px}
      .v54-results{max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:13px;background:#fff}
      .v54-choice{width:100%;border:0;border-bottom:1px solid var(--border);background:#fff;padding:12px 13px;text-align:start;display:grid;gap:3px}
      .v54-choice:last-child{border-bottom:0}
      .v54-choice.selected,.v54-choice:hover{background:var(--primary-soft)}
      .v54-choice small{font-size:11px;color:var(--muted)}
      .v54-hint{font-size:11px;color:var(--muted);line-height:1.6}
      @media(max-width:700px){.v54-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  async function searchPatients(term=''){
    let q=C.sb.from('patients')
      .select('id,medical_record_number,english_name,arabic_name,birth_year,mobile,address,gender')
      .eq('is_active',true)
      .order('created_at',{ascending:false})
      .limit(80);

    const t=String(term||'').trim();
    if(t){
      const safe=t.replaceAll(',',' ');
      q=q.or(
        `medical_record_number.ilike.%${safe}%`+
        `,arabic_name.ilike.%${safe}%`+
        `,english_name.ilike.%${safe}%`+
        `,mobile.ilike.%${safe}%`
      );
    }

    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function getSummary(doctorId,day){
    const {data,error}=await C.sb.rpc(
      'frontend_get_extra_case_summary',
      {p_doctor:doctorId,p_day:day}
    );
    if(error) throw error;
    return data||{count:0,remaining:10,limit:10};
  }

  async function openExtraCaseModal(prefill={}){
    await C.loadDoctors(true);

    const doctorOnly=C.currentPage==='doctor-appointments';
    const defaultDoctorId=
      prefill.doctorId ||
      (doctorOnly ? C.user?.id : '') ||
      document.querySelector('#doctorSelect,#calendarDoctor,select[data-doctor-select]')?.value ||
      C.doctors?.[0]?.id ||
      '';

    const today=C.cairoDate();
    const selectedDate=prefill.date||today;

    C.showModal({
      title:C.lang==='ar'?'إضافة حالة إضافية':'Add extra case',
      wide:true,
      body:`
        <form id="v54ExtraForm" class="v54-extra-modal">
          <div class="v54-extra-banner">
            <div>
              <strong>${C.lang==='ar'
                ?'الحالة الإضافية لا تتبع الساعات أو حد 4 مرضى لكل ساعة'
                :'Extra case ignores normal slots and the 4-patient/hour limit'}</strong>
              <div class="v54-hint">${C.lang==='ar'
                ?'الحد الأقصى 10 حالات إضافية لكل طبيب في اليوم.'
                :'Maximum 10 extra cases per doctor per day.'}</div>
            </div>
            <span id="v54Count" class="v54-extra-count">0 / 10</span>
          </div>

          <div class="v54-grid">
            <label>
              ${C.lang==='ar'?'الطبيب':'Doctor'}
              <select id="v54Doctor" class="control" ${doctorOnly?'disabled':''}>
                ${C.doctors.map(d=>`
                  <option value="${d.id}" ${d.id===defaultDoctorId?'selected':''}>
                    ${C.escape(C.doctorName(d.id))}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'التاريخ':'Date'}
              <input id="v54Date" type="date" min="${today}" value="${selectedDate}" class="control" required>
            </label>

            <label>
              ${C.lang==='ar'?'وقت تقريبي حر':'Free approximate time'}
              <input id="v54Time" type="time" value="${prefill.time||'14:00'}" class="control" required>
              <small class="v54-hint">${C.lang==='ar'
                ?'لا يلزم أن يطابق أي ساعة في الجدول.'
                :'It does not need to match any clinic slot.'}</small>
            </label>

            <label>
              ${C.lang==='ar'?'نوع الزيارة':'Visit type'}
              <select id="v54Type" class="control">
                <option value="new">${C.lang==='ar'?'كشف':'Examination'}</option>
                <option value="follow_up">${C.lang==='ar'?'استشارة':'Consultation'}</option>
              </select>
            </label>
          </div>

          <div class="v54-mode-row">
            <button type="button" class="v54-mode active" data-v54-mode="existing">
              ${C.lang==='ar'?'مريض موجود':'Existing patient'}
            </button>
            <button type="button" class="v54-mode" data-v54-mode="new">
              + ${C.lang==='ar'?'مريض جديد':'New patient'}
            </button>
          </div>

          <section id="v54Existing" class="v54-panel active">
            <label>
              ${C.lang==='ar'?'ابحث عن المريض':'Choose patient'}
              <input id="v54Search" class="control"
                placeholder="${C.lang==='ar'?'الاسم / MRN / الموبايل':'Name / MRN / mobile'}">
            </label>
            <input id="v54PatientId" type="hidden">
            <div id="v54Results" class="v54-results"></div>
          </section>

          <section id="v54New" class="v54-panel">
            <div class="v54-grid">
              <label>
                ${C.lang==='ar'?'الاسم بالعربية':'Arabic name'}
                <input id="v54ArabicName" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'الاسم بالإنجليزية':'English name'}
                <input id="v54EnglishName" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'سنة الميلاد':'Birth year'}
                <input id="v54BirthYear" type="number" min="1900"
                  max="${new Date().getFullYear()}" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'النوع':'Gender'}
                <select id="v54Gender" class="control">
                  <option value="">—</option>
                  <option value="male">${C.lang==='ar'?'ذكر':'Male'}</option>
                  <option value="female">${C.lang==='ar'?'أنثى':'Female'}</option>
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'الموبايل':'Mobile'}
                <input id="v54Mobile" inputmode="tel" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'العنوان':'Address'}
                <input id="v54Address" class="control">
              </label>
            </div>
          </section>

          <label>
            ${C.lang==='ar'?'ملاحظات الحجز':'Booking notes'}
            <textarea id="v54Note" class="control" rows="3"></textarea>
          </label>

          <div class="form-actions">
            <button id="v54Submit" type="submit" class="primary-button compact">
              ${C.lang==='ar'?'حجز كحالة إضافية':'Book as extra case'}
            </button>
          </div>
        </form>
      `,
      onOpen:(root)=>{
        const form=root.querySelector('#v54ExtraForm');
        const doctor=root.querySelector('#v54Doctor');
        const date=root.querySelector('#v54Date');
        const time=root.querySelector('#v54Time');
        const type=root.querySelector('#v54Type');
        const note=root.querySelector('#v54Note');
        const count=root.querySelector('#v54Count');
        const submit=root.querySelector('#v54Submit');
        const existing=root.querySelector('#v54Existing');
        const newly=root.querySelector('#v54New');
        const search=root.querySelector('#v54Search');
        const results=root.querySelector('#v54Results');
        const patientId=root.querySelector('#v54PatientId');

        let mode='existing';

        function setMode(next){
          mode=next;
          root.querySelectorAll('[data-v54-mode]').forEach(b=>
            b.classList.toggle('active',b.dataset.v54Mode===mode)
          );
          existing.classList.toggle('active',mode==='existing');
          newly.classList.toggle('active',mode==='new');
        }

        root.querySelectorAll('[data-v54-mode]').forEach(b=>
          b.addEventListener('click',()=>setMode(b.dataset.v54Mode))
        );

        async function refreshSummary(){
          try{
            const s=await getSummary(doctor.value,date.value);
            count.textContent=`${s.count||0} / 10`;
            submit.disabled=Number(s.remaining||0)<=0;
            submit.textContent=submit.disabled
              ? (C.lang==='ar'?'تم الوصول للحد اليومي (10)':'Daily limit reached (10)')
              : (C.lang==='ar'?'حجز كحالة إضافية':'Book as extra case');
          }catch(e){ console.warn(e); }
        }

        async function renderPatients(){
          results.innerHTML=`<div class="muted" style="padding:12px">${C.lang==='ar'?'جاري البحث...':'Searching...'}</div>`;
          try{
            const rows=await searchPatients(search.value);
            results.innerHTML=rows.length
              ? rows.map(p=>`
                  <button type="button" class="v54-choice" data-patient="${p.id}">
                    <strong>${C.escape(p.english_name||p.arabic_name||'Patient')}</strong>
                    <small>${C.escape([
                      p.medical_record_number,
                      p.mobile,
                      p.birth_year ? String(p.birth_year) : ''
                    ].filter(Boolean).join(' • '))}</small>
                  </button>
                `).join('')
              : `<div class="muted" style="padding:12px">
                  ${C.lang==='ar'
                    ?'لا يوجد مريض مطابق — اختر "مريض جديد".'
                    :'No matching patient — choose "New patient".'}
                 </div>`;

            results.querySelectorAll('[data-patient]').forEach(b=>
              b.addEventListener('click',()=>{
                patientId.value=b.dataset.patient;
                results.querySelectorAll('.v54-choice').forEach(x=>x.classList.remove('selected'));
                b.classList.add('selected');
              })
            );
          }catch(e){
            results.innerHTML=`<div style="padding:12px;color:#b91c1c">${C.escape(e.message)}</div>`;
          }
        }

        let timer;
        search.addEventListener('input',()=>{
          clearTimeout(timer);
          timer=setTimeout(renderPatients,220);
        });

        doctor.addEventListener('change',refreshSummary);
        date.addEventListener('change',refreshSummary);

        form.addEventListener('submit',async e=>{
          e.preventDefault();

          submit.disabled=true;
          const old=submit.textContent;
          submit.textContent=C.lang==='ar'?'جاري الحجز...':'Booking...';

          let rpc;

          if(mode==='existing'){
            if(!patientId.value){
              submit.disabled=false;
              submit.textContent=old;
              return C.toast(
                C.lang==='ar'
                  ?'اختر المريض أولاً أو اختر "مريض جديد".'
                  :'Choose a patient first or select "New patient".',
                'error'
              );
            }

            rpc=await C.sb.rpc('frontend_book_extra_case',{
              p_patient:patientId.value,
              p_doctor:doctor.value,
              p_day:date.value,
              p_time:time.value||'14:00',
              p_type:type.value||'new',
              p_note:note.value.trim()||null
            });
          }else{
            const ar=root.querySelector('#v54ArabicName').value.trim();
            const en=root.querySelector('#v54EnglishName').value.trim();
            if(!ar && !en){
              submit.disabled=false;
              submit.textContent=old;
              return C.toast(
                C.lang==='ar'?'اكتب اسم المريض الجديد.':'Enter the new patient name.',
                'error'
              );
            }

            const by=root.querySelector('#v54BirthYear').value;

            rpc=await C.sb.rpc('frontend_create_patient_and_book_extra_case',{
              p_doctor:doctor.value,
              p_day:date.value,
              p_time:time.value||'14:00',
              p_type:type.value||'new',
              p_note:note.value.trim()||null,
              p_arabic_name:ar||null,
              p_english_name:en||null,
              p_birth_year:by?Number(by):null,
              p_gender:root.querySelector('#v54Gender').value||null,
              p_mobile:root.querySelector('#v54Mobile').value.trim()||null,
              p_address:root.querySelector('#v54Address').value.trim()||null
            });
          }

          if(rpc.error){
            submit.disabled=false;
            submit.textContent=old;
            return C.toast(rpc.error.message,'error');
          }

          C.closeModal();
          C.toast(C.lang==='ar'?'تم حجز الحالة الإضافية.':'Extra case booked.');
          setTimeout(()=>window.location.reload(),300);
        });

        renderPatients();
        refreshSummary();
      }
    });
  }

  // expose one canonical launcher for V54 day buttons
  C.openExtraCaseModal = openExtraCaseModal;

  ensureStyles();

  // Rewire the existing top extra-case button if present.
  function wireTopButton(){
    const btn=document.getElementById('v51ExtraCaseButton');
    if(!btn || btn.dataset.v54Wired==='1') return;
    btn.dataset.v54Wired='1';

    const clone=btn.cloneNode(true);
    clone.dataset.v54Wired='1';
    clone.addEventListener('click',()=>openExtraCaseModal());
    btn.replaceWith(clone);
  }

  new MutationObserver(wireTopButton).observe(document.body,{childList:true,subtree:true});
  wireTopButton();
})();
