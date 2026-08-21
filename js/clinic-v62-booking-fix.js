(() => {
  const C = window.Clinic;
  if (!C || C.__v62BookingFixLoaded) return;
  C.__v62BookingFixLoaded = true;

  const doc = document;
  let fridayShiftDone = false;
  let observerTimer = null;

  const DAY_NAMES = [
    'Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday',
    'السبت','الأحد','الاحد','الإثنين','الاثنين','الثلاثاء',
    'الأربعاء','الاربعاء','الخميس','الجمعة'
  ];

  const MONTHS_AR = {
    'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,
    'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,
    'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12
  };

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  const DAY_RE = new RegExp(
    '^(' + DAY_NAMES.map(escRe).join('|') + ')$',
    'i'
  );

  const ANY_DAY_RE = new RegExp(
    '(' + DAY_NAMES.map(escRe).join('|') + ')',
    'gi'
  );

  function isAppointmentsPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function cairoParts(){
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:'Africa/Cairo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      weekday:'short'
    }).formatToParts(new Date());

    const get = type =>
      parts.find(x=>x.type===type)?.value || '';

    return {
      year:Number(get('year')),
      month:Number(get('month')),
      day:Number(get('day')),
      weekday:get('weekday')
    };
  }

  function cairoToday(){
    const p=cairoParts();
    return new Date(Date.UTC(
      p.year,
      p.month-1,
      p.day,
      12,0,0
    ));
  }

  function ymd(date){
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth()+1).padStart(2,'0'),
      String(date.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function nextSaturday(date){
    const d=new Date(date);
    const add=(6-d.getUTCDay()+7)%7 || 7;
    d.setUTCDate(d.getUTCDate()+add);
    return d;
  }

  function normalizeArabicDigits(text=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(text).replace(
      /[٠-٩]/g,
      ch=>String(ar.indexOf(ch))
    );
  }

  function parseVisibleDate(text=''){
    const t=normalizeArabicDigits(text);

    let m=t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if(m){
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    for(const [name,num] of Object.entries(MONTHS_AR)){
      const re=new RegExp(
        '(\\d{1,2})\\s+'+escRe(name)+'\\s+(\\d{4})'
      );

      m=t.match(re);

      if(m){
        return `${m[2]}-${String(num).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
      }
    }

    return null;
  }

  function addStyles(){
    if(doc.getElementById('v62-booking-styles')) return;

    const s=doc.createElement('style');
    s.id='v62-booking-styles';
    s.textContent=`
      .v62-day-name-row{
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
        width:100% !important;
      }

      .v62-day-plus{
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
        font-size:15px;
        line-height:1;
        cursor:pointer;
        flex:0 0 auto;
      }

      .v62-day-plus:hover{
        background:#ffedd5;
      }

      .v62-extra-modal{
        display:grid;
        gap:16px;
      }

      .v62-extra-banner{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:14px 16px;
        border:1px solid #fed7aa;
        background:#fff7ed;
        border-radius:14px;
        color:#9a3412;
      }

      .v62-extra-count{
        flex:0 0 auto;
        border-radius:999px;
        background:#ffedd5;
        padding:7px 11px;
        font-weight:900;
      }

      .v62-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
      }

      .v62-grid label,
      .v62-extra-modal > label{
        display:grid;
        gap:7px;
        font-size:13px;
        font-weight:750;
      }

      .v62-patient-mode{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .v62-mode-button{
        min-height:48px;
        border:1px solid var(--border);
        border-radius:12px;
        background:#fff;
        color:var(--text);
        font-weight:850;
        cursor:pointer;
      }

      .v62-mode-button.active{
        border-color:var(--primary);
        background:var(--primary-soft);
        color:var(--primary);
      }

      .v62-patient-panel{
        display:none;
      }

      .v62-patient-panel.active{
        display:grid;
        gap:14px;
      }

      .v62-results{
        max-height:250px;
        overflow:auto;
        border:1px solid var(--border);
        border-radius:13px;
        background:#fff;
      }

      .v62-patient-choice{
        width:100%;
        border:0;
        border-bottom:1px solid var(--border);
        background:#fff;
        padding:12px 13px;
        text-align:start;
        display:grid;
        gap:3px;
        cursor:pointer;
      }

      .v62-patient-choice:last-child{
        border-bottom:0;
      }

      .v62-patient-choice:hover,
      .v62-patient-choice.selected{
        background:var(--primary-soft);
      }

      .v62-patient-choice small{
        color:var(--muted);
        font-size:11px;
      }

      .v62-hint{
        color:var(--muted);
        font-size:11px;
        line-height:1.5;
      }

      @media(max-width:700px){
        .v62-grid{
          grid-template-columns:1fr;
        }
      }
    `;

    doc.head.appendChild(s);
  }

  function removeLegacyDayButtons(){
    doc.querySelectorAll(
      '.v53-day-extra-btn,'+
      '.v54-day-extra-btn,'+
      '.v54-day-extra-slot,'+
      '.v56-day-plus,'+
      '.v56-day-plus-wrap,'+
      '.v57-day-plus,'+
      '.v58-day-plus,'+
      '.v59-day-plus,'+
      '.v60-day-plus'
    ).forEach(el=>el.remove());
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

  function findDayColumns(){
    const labels=[...doc.querySelectorAll(
      'div,span,strong,h3,h4'
    )].filter(
      el=>DAY_RE.test((el.textContent||'').trim())
    );

    const out=[];

    for(const label of labels){
      let col=label.parentElement;
      let hops=0;

      while(col && hops<6){
        const text=(col.textContent||'').trim();
        const dayMatches=text.match(ANY_DAY_RE)||[];

        if(
          dayMatches.length===1 &&
          parseVisibleDate(text)
        ){
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

  async function searchPatients(term=''){
    let q=C.sb
      .from('patients')
      .select(
        'id,medical_record_number,english_name,arabic_name,birth_year,mobile'
      )
      .eq('is_active',true)
      .order('created_at',{ascending:false})
      .limit(60);

    const text=String(term||'').trim();

    if(text){
      const safe=text.replaceAll(',',' ');

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

  async function getExtraSummary(doctorId,day){
    const {data,error}=await C.sb.rpc(
      'frontend_get_extra_case_summary',
      {
        p_doctor:doctorId,
        p_day:day
      }
    );

    if(error) throw error;

    return data||{
      count:0,
      remaining:10,
      limit:10
    };
  }

  function selectedDoctorId(){
    if(C.currentPage==='doctor-appointments'){
      return C.user?.id||'';
    }

    return (
      doc.querySelector(
        '#doctorSelect,#calendarDoctor,select[data-doctor-select]'
      )?.value
      ||
      C.doctors?.[0]?.id
      ||
      ''
    );
  }

  async function openExtraCaseModal(prefill={}){
    await C.loadDoctors(true);

    const doctorOnly=
      C.currentPage==='doctor-appointments';

    const doctorId=
      prefill.doctorId ||
      selectedDoctorId();

    const day=
      prefill.date ||
      C.cairoDate();

    C.showModal({
      title:
        C.lang==='ar'
          ? 'إضافة حالة إضافية'
          : 'Add extra case',

      wide:true,

      body:`
        <form id="v62ExtraForm" class="v62-extra-modal">

          <div class="v62-extra-banner">
            <div>
              <strong>
                ${
                  C.lang==='ar'
                    ? 'الحالة الإضافية لا تتبع مواعيد الساعات العادية'
                    : 'Extra case does not use the normal hourly slots'
                }
              </strong>

              <div class="v62-hint">
                ${
                  C.lang==='ar'
                    ? 'حتى 10 حالات إضافية لكل طبيب في اليوم.'
                    : 'Up to 10 extra cases per doctor per day.'
                }
              </div>
            </div>

            <span id="v62Count" class="v62-extra-count">
              0 / 10
            </span>
          </div>

          <div class="v62-grid">

            <label>
              ${C.lang==='ar'?'الطبيب':'Doctor'}

              <select
                id="v62Doctor"
                class="control"
                ${doctorOnly?'disabled':''}
              >
                ${C.doctors.map(d=>`
                  <option
                    value="${d.id}"
                    ${d.id===doctorId?'selected':''}
                  >
                    ${C.escape(C.doctorName(d.id))}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'التاريخ':'Date'}

              <input
                id="v62Date"
                class="control"
                type="date"
                value="${day}"
                min="${C.cairoDate()}"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'?'وقت تقريبي':'Approximate time'}

              <input
                id="v62Time"
                class="control"
                type="time"
                value="14:00"
                required
              >

              <small class="v62-hint">
                ${
                  C.lang==='ar'
                    ? 'لا يلزم أن يطابق أي فترة في جدول العيادة.'
                    : 'Does not need to match a clinic slot.'
                }
              </small>
            </label>

            <label>
              ${C.lang==='ar'?'نوع الزيارة':'Visit type'}

              <select
                id="v62Type"
                class="control"
              >
                <option value="new">
                  ${C.lang==='ar'?'كشف':'Examination'}
                </option>

                <option value="follow_up">
                  ${C.lang==='ar'?'استشارة':'Consultation'}
                </option>
              </select>
            </label>

          </div>

          <div class="v62-patient-mode">

            <button
              type="button"
              class="v62-mode-button active"
              data-v62-mode="existing"
            >
              ${
                C.lang==='ar'
                  ? 'مريض مسجل'
                  : 'Existing patient'
              }
            </button>

            <button
              type="button"
              class="v62-mode-button"
              data-v62-mode="new"
            >
              + ${
                C.lang==='ar'
                  ? 'مريض جديد'
                  : 'New patient'
              }
            </button>

          </div>

          <section
            id="v62ExistingPanel"
            class="v62-patient-panel active"
          >

            <label>
              ${C.lang==='ar'?'اختر المريض':'Choose patient'}

              <input
                id="v62PatientSearch"
                class="control"
                autocomplete="off"
                placeholder="${
                  C.lang==='ar'
                    ? 'الاسم / رقم الملف / الموبايل'
                    : 'Name / MRN / mobile'
                }"
              >
            </label>

            <input
              id="v62PatientId"
              type="hidden"
            >

            <div
              id="v62PatientResults"
              class="v62-results"
            ></div>

          </section>

          <section
            id="v62NewPanel"
            class="v62-patient-panel"
          >

            <div class="v62-grid">

              <label>
                ${C.lang==='ar'?'الاسم بالعربية':'Arabic name'}
                <input
                  id="v62ArabicName"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'?'الاسم بالإنجليزية':'English name'}
                <input
                  id="v62EnglishName"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'?'سنة الميلاد':'Birth year'}
                <input
                  id="v62BirthYear"
                  class="control"
                  type="number"
                  min="1900"
                  max="${new Date().getFullYear()}"
                >
              </label>

              <label>
                ${C.lang==='ar'?'النوع':'Gender'}
                <select
                  id="v62Gender"
                  class="control"
                >
                  <option value="">—</option>
                  <option value="male">
                    ${C.lang==='ar'?'ذكر':'Male'}
                  </option>
                  <option value="female">
                    ${C.lang==='ar'?'أنثى':'Female'}
                  </option>
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'الموبايل':'Mobile'}
                <input
                  id="v62Mobile"
                  class="control"
                  inputmode="tel"
                >
              </label>

              <label>
                ${C.lang==='ar'?'العنوان':'Address'}
                <input
                  id="v62Address"
                  class="control"
                >
              </label>

            </div>

          </section>

          <label>
            ${C.lang==='ar'?'ملاحظات الحجز':'Booking notes'}

            <textarea
              id="v62Note"
              class="control"
              rows="3"
            ></textarea>
          </label>

          <div class="form-actions">
            <button
              id="v62Submit"
              type="submit"
              class="primary-button compact"
            >
              ${
                C.lang==='ar'
                  ? 'حجز الحالة الإضافية'
                  : 'Book extra case'
              }
            </button>
          </div>

        </form>
      `,

      onOpen:(root)=>{
        const form=root.querySelector('#v62ExtraForm');
        const doctor=root.querySelector('#v62Doctor');
        const date=root.querySelector('#v62Date');
        const time=root.querySelector('#v62Time');
        const type=root.querySelector('#v62Type');
        const count=root.querySelector('#v62Count');
        const submit=root.querySelector('#v62Submit');
        const note=root.querySelector('#v62Note');

        const existingPanel=
          root.querySelector('#v62ExistingPanel');

        const newPanel=
          root.querySelector('#v62NewPanel');

        const search=
          root.querySelector('#v62PatientSearch');

        const patientId=
          root.querySelector('#v62PatientId');

        const results=
          root.querySelector('#v62PatientResults');

        let mode='existing';

        function setMode(next){
          mode=next;

          root.querySelectorAll(
            '[data-v62-mode]'
          ).forEach(btn=>{
            btn.classList.toggle(
              'active',
              btn.dataset.v62Mode===next
            );
          });

          existingPanel.classList.toggle(
            'active',
            next==='existing'
          );

          newPanel.classList.toggle(
            'active',
            next==='new'
          );
        }

        root.querySelectorAll(
          '[data-v62-mode]'
        ).forEach(btn=>{
          btn.addEventListener(
            'click',
            ()=>setMode(btn.dataset.v62Mode)
          );
        });

        async function refreshSummary(){
          try{
            const summary=
              await getExtraSummary(
                doctor.value,
                date.value
              );

            count.textContent=
              `${summary.count||0} / 10`;

            const full=
              Number(summary.remaining||0)<=0;

            submit.disabled=full;

            submit.textContent=
              full
                ? (
                    C.lang==='ar'
                      ? 'تم الوصول للحد اليومي (10)'
                      : 'Daily limit reached (10)'
                  )
                : (
                    C.lang==='ar'
                      ? 'حجز الحالة الإضافية'
                      : 'Book extra case'
                  );
          }
          catch(error){
            console.warn(
              'V62 extra summary failed',
              error
            );
          }
        }

        async function renderPatients(){
          results.innerHTML=
            `<div class="muted" style="padding:12px">
              ${
                C.lang==='ar'
                  ? 'جاري البحث...'
                  : 'Searching...'
              }
            </div>`;

          try{
            const rows=
              await searchPatients(
                search.value
              );

            results.innerHTML=
              rows.length
                ? rows.map(p=>`
                    <button
                      type="button"
                      class="v62-patient-choice"
                      data-v62-patient="${p.id}"
                    >
                      <strong>
                        ${C.escape(
                          p.english_name ||
                          p.arabic_name ||
                          'Patient'
                        )}
                      </strong>

                      <small>
                        ${C.escape(
                          [
                            p.medical_record_number,
                            p.mobile,
                            p.birth_year
                              ? String(p.birth_year)
                              : ''
                          ]
                          .filter(Boolean)
                          .join(' • ')
                        )}
                      </small>
                    </button>
                  `).join('')
                : `
                    <div
                      class="muted"
                      style="padding:12px"
                    >
                      ${
                        C.lang==='ar'
                          ? 'لا يوجد مريض مطابق — اختر "مريض جديد".'
                          : 'No matching patient — choose "New patient".'
                      }
                    </div>
                  `;

            results.querySelectorAll(
              '[data-v62-patient]'
            ).forEach(btn=>{
              btn.addEventListener(
                'click',
                ()=>{
                  patientId.value=
                    btn.dataset.v62Patient;

                  results.querySelectorAll(
                    '.v62-patient-choice'
                  ).forEach(x=>
                    x.classList.remove('selected')
                  );

                  btn.classList.add('selected');
                }
              );
            });
          }
          catch(error){
            results.innerHTML=
              `<div style="padding:12px;color:#b91c1c">
                ${C.escape(error.message)}
              </div>`;
          }
        }

        let searchTimer=null;

        search.addEventListener(
          'input',
          ()=>{
            clearTimeout(searchTimer);

            searchTimer=setTimeout(
              renderPatients,
              220
            );
          }
        );

        doctor.addEventListener(
          'change',
          refreshSummary
        );

        date.addEventListener(
          'change',
          refreshSummary
        );

        form.addEventListener(
          'submit',
          async event=>{
            event.preventDefault();

            submit.disabled=true;

            const oldText=
              submit.textContent;

            submit.textContent=
              C.lang==='ar'
                ? 'جاري الحجز...'
                : 'Booking...';

            let rpc;

            if(mode==='existing'){
              if(!patientId.value){
                submit.disabled=false;
                submit.textContent=oldText;

                return C.toast(
                  C.lang==='ar'
                    ? 'اختر المريض أو اختر "مريض جديد".'
                    : 'Choose a patient or select "New patient".',
                  'error'
                );
              }

              rpc=await C.sb.rpc(
                'frontend_book_extra_case',
                {
                  p_patient:patientId.value,
                  p_doctor:doctor.value,
                  p_day:date.value,
                  p_time:time.value||'14:00',
                  p_type:type.value||'new',
                  p_note:note.value.trim()||null
                }
              );
            }
            else{
              const ar=
                root.querySelector(
                  '#v62ArabicName'
                ).value.trim();

              const en=
                root.querySelector(
                  '#v62EnglishName'
                ).value.trim();

              if(!ar && !en){
                submit.disabled=false;
                submit.textContent=oldText;

                return C.toast(
                  C.lang==='ar'
                    ? 'اكتب اسم المريض الجديد.'
                    : 'Enter the new patient name.',
                  'error'
                );
              }

              const birthYear=
                root.querySelector(
                  '#v62BirthYear'
                ).value;

              rpc=await C.sb.rpc(
                'frontend_create_patient_and_book_extra_case',
                {
                  p_doctor:doctor.value,
                  p_day:date.value,
                  p_time:time.value||'14:00',
                  p_type:type.value||'new',
                  p_note:note.value.trim()||null,
                  p_arabic_name:ar||null,
                  p_english_name:en||null,
                  p_birth_year:
                    birthYear
                      ? Number(birthYear)
                      : null,
                  p_gender:
                    root.querySelector(
                      '#v62Gender'
                    ).value||null,
                  p_mobile:
                    root.querySelector(
                      '#v62Mobile'
                    ).value.trim()||null,
                  p_address:
                    root.querySelector(
                      '#v62Address'
                    ).value.trim()||null
                }
              );
            }

            if(rpc.error){
              submit.disabled=false;
              submit.textContent=oldText;

              return C.toast(
                rpc.error.message,
                'error'
              );
            }

            C.closeModal();

            C.toast(
              C.lang==='ar'
                ? 'تم حجز الحالة الإضافية.'
                : 'Extra case booked.'
            );

            setTimeout(
              ()=>window.location.reload(),
              300
            );
          }
        );

        renderPatients();
        refreshSummary();
      }
    });
  }

  // Make this the canonical extra-case modal.
  C.openExtraCaseModal=openExtraCaseModal;

  function rewireTopExtraButton(){
    const old=
      doc.getElementById(
        'v51ExtraCaseButton'
      );

    if(!old || old.dataset.v62Wired==='1'){
      return;
    }

    const clone=old.cloneNode(true);
    clone.dataset.v62Wired='1';

    clone.addEventListener(
      'click',
      ()=>openExtraCaseModal()
    );

    old.replaceWith(clone);
  }

  function injectDayButtons(){
    if(!isAppointmentsPage()) return;

    removeLegacyDayButtons();

    for(const {col,label,date} of findDayColumns()){
      const existing=
        col.querySelectorAll(
          '.v62-day-plus'
        );

      existing.forEach((btn,index)=>{
        if(index>0) btn.remove();
      });

      if(existing.length) continue;

      let row=label.parentElement;

      if(
        !row ||
        row===col ||
        /\d{1,2}:\d{2}/.test(
          normalizeArabicDigits(
            row.textContent||''
          )
        )
      ){
        row=doc.createElement('div');
        row.className='v62-day-name-row';

        label.parentNode.insertBefore(
          row,
          label
        );

        row.appendChild(label);
      }
      else{
        row.classList.add(
          'v62-day-name-row'
        );
      }

      const btn=
        doc.createElement('button');

      btn.type='button';
      btn.className='v62-day-plus';
      btn.textContent='＋';

      btn.title=
        C.lang==='ar'
          ? 'إضافة حالة إضافية لهذا اليوم'
          : 'Add extra case for this day';

      btn.setAttribute(
        'aria-label',
        btn.title
      );

      btn.addEventListener(
        'click',
        event=>{
          event.preventDefault();
          event.stopPropagation();

          openExtraCaseModal({
            date
          });
        }
      );

      row.appendChild(btn);
    }
  }

  function fridayAdvance(){
    if(
      fridayShiftDone ||
      !isAppointmentsPage() ||
      cairoParts().weekday!=='Fri'
    ){
      return;
    }

    const target=
      ymd(
        nextSaturday(
          cairoToday()
        )
      );

    // Best path: use the Jump-to date control.
    const dateInputs=[
      ...doc.querySelectorAll(
        'input[type="date"]'
      )
    ];

    const jump=
      doc.querySelector(
        '#jumpDate,#calendarJumpDate,input[data-jump-date][type="date"]'
      )
      ||
      dateInputs.find(input=>{
        const parentText=
          (input.parentElement?.textContent||'').toLowerCase();

        return (
          parentText.includes('jump') ||
          parentText.includes('اذهب')
        );
      });

    if(jump){
      fridayShiftDone=true;

      jump.value=target;

      jump.dispatchEvent(
        new Event('input',{
          bubbles:true
        })
      );

      jump.dispatchEvent(
        new Event('change',{
          bubbles:true
        })
      );

      return;
    }

    // Fallback: click Next / التالي exactly once.
    const buttons=[
      ...doc.querySelectorAll('button')
    ];

    const nextButton=
      buttons.find(btn=>{
        const text=
          (btn.textContent||'')
            .replace(/\s+/g,' ')
            .trim();

        return (
          /^Next\b/i.test(text) ||
          /^التالي\b/.test(text)
        );
      });

    if(nextButton){
      fridayShiftDone=true;
      nextButton.click();
    }
  }

  function run(){
    if(!isAppointmentsPage()) return;

    addStyles();
    rewireTopExtraButton();
    injectDayButtons();

    // Run after the appointment calendar exists.
    setTimeout(
      fridayAdvance,
      30
    );
  }

  addStyles();

  new MutationObserver(()=>{
    clearTimeout(observerTimer);

    observerTimer=setTimeout(
      run,
      25
    );
  }).observe(
    doc.body,
    {
      childList:true,
      subtree:true
    }
  );

  doc.addEventListener(
    'click',
    event=>{
      if(
        event.target.closest(
          '.app-lang-btn'
        )
      ){
        setTimeout(
          run,
          120
        );

        setTimeout(
          run,
          320
        );
      }
    }
  );

  run();
})();
