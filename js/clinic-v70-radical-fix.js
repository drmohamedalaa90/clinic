(() => {
  const C = window.Clinic;
  if (!C || C.__v70RadicalFixLoaded) return;
  C.__v70RadicalFixLoaded = true;

  const D = document;
  let lastPage = null;
  let fridayShiftPending = true;
  let mutationTimer = null;

  const DAY_NAMES = [
    'Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday',
    'السبت','الأحد','الاحد','الإثنين','الاثنين','الثلاثاء',
    'الأربعاء','الاربعاء','الخميس','الجمعة'
  ];

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  const DAY_RE = new RegExp(
    '^(' + DAY_NAMES.map(escRe).join('|') + ')$',
    'i'
  );

  const ANY_DAY_RE = new RegExp(
    '(' + DAY_NAMES.map(escRe).join('|') + ')',
    'gi'
  );

  const MONTHS_AR = {
    'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,
    'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,
    'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12
  };

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

    const get = type => parts.find(x=>x.type===type)?.value || '';

    return {
      year:Number(get('year')),
      month:Number(get('month')),
      day:Number(get('day')),
      weekday:get('weekday')
    };
  }

  function cairoDateObj(){
    const p=cairoParts();
    return new Date(Date.UTC(p.year,p.month-1,p.day,12,0,0));
  }

  function nextSaturdayIso(){
    const d=cairoDateObj();
    const add=(6-d.getUTCDay()+7)%7 || 7;
    d.setUTCDate(d.getUTCDate()+add);

    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth()+1).padStart(2,'0'),
      String(d.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function normalizeArabicDigits(text=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(text).replace(/[٠-٩]/g,ch=>String(ar.indexOf(ch)));
  }

  function parseVisibleDate(text=''){
    const t=normalizeArabicDigits(text);

    let m=t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);

    if(m){
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    for(const [name,num] of Object.entries(MONTHS_AR)){
      m=t.match(
        new RegExp(
          '(\\d{1,2})\\s+' + escRe(name) + '\\s+(\\d{4})'
        )
      );

      if(m){
        return `${m[2]}-${String(num).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
      }
    }

    return null;
  }

  function addStyles(){
    if(D.getElementById('v70-radical-styles')) return;

    const s=D.createElement('style');
    s.id='v70-radical-styles';
    s.textContent=`
      .v70-day-title-row{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:8px!important;
        width:100%!important;
      }

      .v70-day-plus{
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

      .v70-day-plus:hover{
        background:#ffedd5;
      }

      .v70-extra-modal{display:grid;gap:16px}

      .v70-extra-banner{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        border:1px solid #fed7aa;
        background:#fff7ed;
        color:#9a3412;
        border-radius:14px;
        padding:14px 16px;
      }

      .v70-extra-count{
        background:#ffedd5;
        border-radius:999px;
        padding:7px 11px;
        font-weight:900;
        flex:0 0 auto;
      }

      .v70-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
      }

      .v70-grid label,
      .v70-extra-modal>label{
        display:grid;
        gap:7px;
        font-size:13px;
        font-weight:750;
      }

      .v70-mode-row{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .v70-mode-btn{
        min-height:48px;
        border:1px solid var(--border);
        border-radius:12px;
        background:#fff;
        color:var(--text);
        font-weight:850;
        cursor:pointer;
      }

      .v70-mode-btn.active{
        border-color:var(--primary);
        background:var(--primary-soft);
        color:var(--primary);
      }

      .v70-panel{display:none}
      .v70-panel.active{display:grid;gap:14px}

      .v70-results{
        max-height:250px;
        overflow:auto;
        border:1px solid var(--border);
        border-radius:13px;
        background:#fff;
      }

      .v70-choice{
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

      .v70-choice:last-child{border-bottom:0}
      .v70-choice:hover,.v70-choice.selected{background:var(--primary-soft)}
      .v70-choice small{color:var(--muted);font-size:11px}

      .v70-mark-all-read{
        border:0;
        background:transparent;
        color:#0f8b78;
        font-weight:850;
        font-size:12px;
        cursor:pointer;
        padding:7px 9px;
        border-radius:9px;
        white-space:nowrap;
      }

      .v70-mark-all-read:hover{background:#ecfdf8}
      .v70-mark-all-read:disabled{opacity:.55;cursor:default}

      .v70-notif-actions{
        display:flex;
        align-items:center;
        gap:8px;
        margin-inline-start:auto;
      }

      @media(max-width:700px){
        .v70-grid{grid-template-columns:1fr}
      }
    `;

    D.head.appendChild(s);
  }

  // ======================================================
  // 1) EXTRA-CASE + BESIDE EACH DAY
  // ======================================================

  function removeLegacyDayButtons(){
    D.querySelectorAll(
      '.v53-day-extra-btn,.v54-day-extra-btn,.v54-day-extra-slot,'+
      '.v56-day-plus,.v56-day-plus-wrap,.v57-day-plus,.v58-day-plus,'+
      '.v59-day-plus,.v60-day-plus,.v62-day-plus,.v63-day-plus'
    ).forEach(el=>el.remove());
  }

  function parseDayDate(col){
    const direct =
      col.dataset?.date ||
      col.querySelector('[data-date]')?.dataset?.date;

    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)){
      return direct;
    }

    return parseVisibleDate(col.textContent||'');
  }

  function findDayColumns(){
    const labels=[...D.querySelectorAll('div,span,strong,h3,h4')]
      .filter(el=>DAY_RE.test((el.textContent||'').trim()));

    const out=[];

    for(const label of labels){
      let col=label.parentElement;
      let hops=0;

      while(col && hops<6){
        const text=(col.textContent||'').trim();
        const dayMatches=text.match(ANY_DAY_RE)||[];

        if(dayMatches.length===1 && parseVisibleDate(text)){
          break;
        }

        col=col.parentElement;
        hops++;
      }

      if(!col) continue;

      const date=parseDayDate(col);
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
      .select('id,medical_record_number,english_name,arabic_name,birth_year,mobile')
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
      D.querySelector('#doctorSelect,#calendarDoctor,select[data-doctor-select]')?.value
      ||
      C.doctors?.[0]?.id
      ||
      ''
    );
  }

  async function openExtraCaseModal(prefill={}){
    await C.loadDoctors(true);

    const doctorOnly=C.currentPage==='doctor-appointments';
    const doctorId=prefill.doctorId||selectedDoctorId();
    const day=prefill.date||C.cairoDate();

    C.showModal({
      title:C.lang==='ar'?'إضافة حالة إضافية':'Add extra case',
      wide:true,

      body:`
        <form id="v70ExtraForm" class="v70-extra-modal">

          <div class="v70-extra-banner">
            <div>
              <strong>
                ${C.lang==='ar'
                  ?'الحالة الإضافية لا تتبع مواعيد الساعات العادية'
                  :'Extra case does not use the normal hourly slots'}
              </strong>
              <div style="font-size:11px;opacity:.8;margin-top:4px">
                ${C.lang==='ar'
                  ?'حتى 10 حالات إضافية لكل طبيب في اليوم.'
                  :'Up to 10 extra cases per doctor per day.'}
              </div>
            </div>
            <span id="v70Count" class="v70-extra-count">0 / 10</span>
          </div>

          <div class="v70-grid">

            <label>
              ${C.lang==='ar'?'الطبيب':'Doctor'}
              <select id="v70Doctor" class="control" ${doctorOnly?'disabled':''}>
                ${C.doctors.map(d=>`
                  <option value="${d.id}" ${d.id===doctorId?'selected':''}>
                    ${C.escape(C.doctorName(d.id))}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'التاريخ':'Date'}
              <input
                id="v70Date"
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
                id="v70Time"
                class="control"
                type="time"
                value="14:00"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'?'نوع الزيارة':'Visit type'}
              <select id="v70Type" class="control">
                <option value="new">${C.lang==='ar'?'كشف':'Examination'}</option>
                <option value="follow_up">${C.lang==='ar'?'استشارة':'Consultation'}</option>
              </select>
            </label>

          </div>

          <div class="v70-mode-row">
            <button type="button" class="v70-mode-btn active" data-v70-mode="existing">
              ${C.lang==='ar'?'مريض مسجل':'Existing patient'}
            </button>

            <button type="button" class="v70-mode-btn" data-v70-mode="new">
              + ${C.lang==='ar'?'مريض جديد':'New patient'}
            </button>
          </div>

          <section id="v70ExistingPanel" class="v70-panel active">
            <label>
              ${C.lang==='ar'?'اختر المريض':'Choose patient'}
              <input
                id="v70PatientSearch"
                class="control"
                autocomplete="off"
                placeholder="${C.lang==='ar'
                  ?'الاسم / رقم الملف / الموبايل'
                  :'Name / MRN / mobile'}"
              >
            </label>

            <input id="v70PatientId" type="hidden">

            <div id="v70Results" class="v70-results"></div>
          </section>

          <section id="v70NewPanel" class="v70-panel">
            <div class="v70-grid">

              <label>
                ${C.lang==='ar'?'الاسم بالعربية':'Arabic name'}
                <input id="v70ArabicName" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'الاسم بالإنجليزية':'English name'}
                <input id="v70EnglishName" class="control">
              </label>

              <label>
                ${C.lang==='ar'?'سنة الميلاد':'Birth year'}
                <input
                  id="v70BirthYear"
                  class="control"
                  type="number"
                  min="1900"
                  max="${new Date().getFullYear()}"
                >
              </label>

              <label>
                ${C.lang==='ar'?'النوع':'Gender'}
                <select id="v70Gender" class="control">
                  <option value="">—</option>
                  <option value="male">${C.lang==='ar'?'ذكر':'Male'}</option>
                  <option value="female">${C.lang==='ar'?'أنثى':'Female'}</option>
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'الموبايل':'Mobile'}
                <input id="v70Mobile" class="control" inputmode="tel">
              </label>

              <label>
                ${C.lang==='ar'?'العنوان':'Address'}
                <input id="v70Address" class="control">
              </label>

            </div>
          </section>

          <label>
            ${C.lang==='ar'?'ملاحظات الحجز':'Booking notes'}
            <textarea id="v70Note" class="control" rows="3"></textarea>
          </label>

          <div class="form-actions">
            <button id="v70Submit" type="submit" class="primary-button compact">
              ${C.lang==='ar'?'حجز الحالة الإضافية':'Book extra case'}
            </button>
          </div>

        </form>
      `,

      onOpen:(root)=>{
        const form=root.querySelector('#v70ExtraForm');
        const doctor=root.querySelector('#v70Doctor');
        const date=root.querySelector('#v70Date');
        const time=root.querySelector('#v70Time');
        const type=root.querySelector('#v70Type');
        const note=root.querySelector('#v70Note');
        const count=root.querySelector('#v70Count');
        const submit=root.querySelector('#v70Submit');

        const existingPanel=root.querySelector('#v70ExistingPanel');
        const newPanel=root.querySelector('#v70NewPanel');
        const search=root.querySelector('#v70PatientSearch');
        const patientId=root.querySelector('#v70PatientId');
        const results=root.querySelector('#v70Results');

        let mode='existing';

        function setMode(next){
          mode=next;

          root.querySelectorAll('[data-v70-mode]').forEach(btn=>{
            btn.classList.toggle('active',btn.dataset.v70Mode===next);
          });

          existingPanel.classList.toggle('active',next==='existing');
          newPanel.classList.toggle('active',next==='new');
        }

        root.querySelectorAll('[data-v70-mode]').forEach(btn=>{
          btn.addEventListener('click',()=>setMode(btn.dataset.v70Mode));
        });

        async function refreshSummary(){
          try{
            const summary=await getExtraSummary(doctor.value,date.value);
            count.textContent=`${summary.count||0} / 10`;

            const full=Number(summary.remaining||0)<=0;
            submit.disabled=full;

            submit.textContent=full
              ? (C.lang==='ar'?'تم الوصول للحد اليومي (10)':'Daily limit reached (10)')
              : (C.lang==='ar'?'حجز الحالة الإضافية':'Book extra case');
          }catch(error){
            console.warn('V70 summary failed',error);
          }
        }

        async function renderPatients(){
          results.innerHTML=`<div class="muted" style="padding:12px">
            ${C.lang==='ar'?'جاري البحث...':'Searching...'}
          </div>`;

          try{
            const rows=await searchPatients(search.value);

            results.innerHTML=rows.length
              ? rows.map(p=>`
                  <button type="button" class="v70-choice" data-v70-patient="${p.id}">
                    <strong>${C.escape(p.english_name||p.arabic_name||'Patient')}</strong>
                    <small>
                      ${C.escape([
                        p.medical_record_number,
                        p.mobile,
                        p.birth_year?String(p.birth_year):''
                      ].filter(Boolean).join(' • '))}
                    </small>
                  </button>
                `).join('')
              : `<div class="muted" style="padding:12px">
                  ${C.lang==='ar'
                    ?'لا يوجد مريض مطابق — اختر "مريض جديد".'
                    :'No matching patient — choose "New patient".'}
                 </div>`;

            results.querySelectorAll('[data-v70-patient]').forEach(btn=>{
              btn.addEventListener('click',()=>{
                patientId.value=btn.dataset.v70Patient;

                results.querySelectorAll('.v70-choice').forEach(x=>{
                  x.classList.remove('selected');
                });

                btn.classList.add('selected');
              });
            });
          }catch(error){
            results.innerHTML=`<div style="padding:12px;color:#b91c1c">
              ${C.escape(error.message)}
            </div>`;
          }
        }

        let searchTimer=null;

        search.addEventListener('input',()=>{
          clearTimeout(searchTimer);
          searchTimer=setTimeout(renderPatients,180);
        });

        doctor.addEventListener('change',refreshSummary);
        date.addEventListener('change',refreshSummary);

        form.addEventListener('submit',async event=>{
          event.preventDefault();

          const oldText=submit.textContent;
          submit.disabled=true;
          submit.textContent=C.lang==='ar'?'جاري الحجز...':'Booking...';

          let rpc;

          if(mode==='existing'){
            if(!patientId.value){
              submit.disabled=false;
              submit.textContent=oldText;

              return C.toast(
                C.lang==='ar'
                  ?'اختر المريض أو اختر "مريض جديد".'
                  :'Choose a patient or select "New patient".',
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
          }else{
            const ar=root.querySelector('#v70ArabicName').value.trim();
            const en=root.querySelector('#v70EnglishName').value.trim();

            if(!ar && !en){
              submit.disabled=false;
              submit.textContent=oldText;

              return C.toast(
                C.lang==='ar'?'اكتب اسم المريض الجديد.':'Enter the new patient name.',
                'error'
              );
            }

            const by=root.querySelector('#v70BirthYear').value;

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
                p_birth_year:by?Number(by):null,
                p_gender:root.querySelector('#v70Gender').value||null,
                p_mobile:root.querySelector('#v70Mobile').value.trim()||null,
                p_address:root.querySelector('#v70Address').value.trim()||null
              }
            );
          }

          if(rpc.error){
            submit.disabled=false;
            submit.textContent=oldText;
            return C.toast(rpc.error.message,'error');
          }

          C.closeModal();
          C.toast(C.lang==='ar'?'تم حجز الحالة الإضافية.':'Extra case booked.');

          setTimeout(()=>window.location.reload(),250);
        });

        renderPatients();
        refreshSummary();
      }
    });
  }

  C.openExtraCaseModal=openExtraCaseModal;

  function wireTopExtraButton(){
    const old=D.getElementById('v51ExtraCaseButton');
    if(!old || old.dataset.v70Wired==='1') return;

    const clone=old.cloneNode(true);
    clone.dataset.v70Wired='1';
    clone.addEventListener('click',()=>openExtraCaseModal());
    old.replaceWith(clone);
  }

  function injectDayPlus(){
    if(!isAppointmentsPage()) return;

    removeLegacyDayButtons();

    for(const {col,label,date} of findDayColumns()){
      if(col.querySelector('.v70-day-plus')) continue;

      let row=label.parentElement;

      if(
        !row ||
        row===col ||
        /\d{1,2}:\d{2}/.test(normalizeArabicDigits(row.textContent||''))
      ){
        row=D.createElement('div');
        row.className='v70-day-title-row';

        label.parentNode.insertBefore(row,label);
        row.appendChild(label);
      }else{
        row.classList.add('v70-day-title-row');
      }

      const btn=D.createElement('button');
      btn.type='button';
      btn.className='v70-day-plus';
      btn.textContent='＋';
      btn.title=C.lang==='ar'
        ?'إضافة حالة إضافية لهذا اليوم'
        :'Add extra case for this day';

      btn.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        openExtraCaseModal({date});
      });

      row.appendChild(btn);
    }
  }

  // ======================================================
  // 2) FRIDAY -> NEXT SATURDAY, EXACTLY ONCE PER PAGE ENTRY
  // ======================================================

  function findJumpInput(){
    const explicit=D.querySelector(
      '#jumpDate,#calendarJumpDate,input[data-jump-date][type="date"]'
    );

    if(explicit) return explicit;

    return [...D.querySelectorAll('input[type="date"]')].find(input=>{
      const wrap=input.closest('label,div,section')||input.parentElement;
      const text=(wrap?.textContent||'').toLowerCase();

      return text.includes('jump') || text.includes('اذهب');
    }) || null;
  }

  function applyFridayShift(){
    if(!isAppointmentsPage()) return;
    if(!fridayShiftPending) return;
    if(cairoParts().weekday!=='Fri'){
      fridayShiftPending=false;
      return;
    }

    const jump=findJumpInput();
    if(!jump) return;

    fridayShiftPending=false;

    const target=nextSaturdayIso();

    if(jump.value===target) return;

    jump.value=target;

    jump.dispatchEvent(new Event('input',{bubbles:true}));
    jump.dispatchEvent(new Event('change',{bubbles:true}));
  }

  // ======================================================
  // 3) MARK ALL NOTIFICATIONS READ
  // ======================================================

  function clearUnreadUI(){
    D.querySelectorAll(
      '.notification-item.unread,'+
      '[data-notification].unread,'+
      '[data-notification-id].unread,'+
      '.notification-unread,'+
      '[data-unread="true"]'
    ).forEach(el=>{
      el.classList.remove('unread','notification-unread');
      el.removeAttribute('data-unread');
    });

    D.querySelectorAll(
      '.unread-dot,.notification-dot,.notification-unread-dot,[aria-label="Unread"]'
    ).forEach(el=>el.remove());

    D.querySelectorAll(
      '#notificationBadge,.notification-badge,.top-notification-badge'
    ).forEach(el=>{
      el.textContent='0';
      el.classList.add('hidden');
    });
  }

  async function markAllRead(button){
    const old=button.textContent;
    button.disabled=true;
    button.textContent=C.lang==='ar'?'جاري...':'Marking...';

    try{
      const {data,error}=await C.sb.rpc('frontend_mark_all_notifications_read');
      if(error) throw error;

      clearUnreadUI();

      if(typeof C.loadNotifications==='function'){
        try{ await C.loadNotifications(); }catch(_){}
      }

      if(typeof C.refreshNotifications==='function'){
        try{ await C.refreshNotifications(); }catch(_){}
      }

      clearUnreadUI();

      C.toast(
        C.lang==='ar'
          ?'تم تعليم كل الإشعارات كمقروءة.'
          :'All notifications marked as read.'
      );
    }catch(error){
      console.error('V70 mark-all-read failed',error);

      C.toast(
        C.lang==='ar'
          ?`تعذر تعليم الإشعارات كمقروءة: ${error.message||''}`
          :`Could not mark notifications as read: ${error.message||''}`,
        'error'
      );
    }finally{
      button.disabled=false;
      button.textContent=old;
    }
  }

  function injectMarkAllRead(){
    const drawer=D.getElementById('notificationDrawer');
    if(!drawer) return;

    const header=drawer.querySelector('.drawer-header');
    if(!header) return;

    // Remove all old mark-all implementations.
    header.querySelector('#v55MarkAllRead')?.closest('.v55-notification-header-actions')?.remove();
    header.querySelector('#v61MarkAllRead')?.closest('.v61-notification-actions')?.remove();

    if(header.querySelector('#v70MarkAllRead')) return;

    const close=header.querySelector('#closeNotifications');

    const actions=D.createElement('div');
    actions.className='v70-notif-actions';

    const button=D.createElement('button');
    button.id='v70MarkAllRead';
    button.type='button';
    button.className='v70-mark-all-read';
    button.textContent=C.lang==='ar'
      ?'تعليم الكل كمقروء'
      :'Mark all as read';

    button.addEventListener('click',()=>markAllRead(button));

    actions.appendChild(button);

    if(close) actions.appendChild(close);

    header.appendChild(actions);
  }

  // ======================================================
  // SINGLE OBSERVER / SINGLE PATCH
  // ======================================================

  function run(){
    const page=C.currentPage;

    if(page!==lastPage){
      if(['appointments','doctor-appointments'].includes(page)){
        fridayShiftPending=true;
      }

      lastPage=page;
    }

    if(isAppointmentsPage()){
      wireTopExtraButton();
      injectDayPlus();
      applyFridayShift();
    }

    injectMarkAllRead();
  }

  addStyles();

  // Fast finite first-render passes.
  [0,20,50,100,180,300,500].forEach(ms=>setTimeout(run,ms));

  new MutationObserver(()=>{
    clearTimeout(mutationTimer);
    mutationTimer=setTimeout(run,15);
  }).observe(D.body,{
    childList:true,
    subtree:true
  });

  D.addEventListener('click',event=>{
    if(event.target.closest('.app-lang-btn')){
      setTimeout(run,60);
      setTimeout(run,180);
    }
  });

  run();
})();
