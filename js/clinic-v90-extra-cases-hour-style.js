(() => {
  const C = window.Clinic;
  if (!C || C.__v90ExtraCasesLoaded) return;
  C.__v90ExtraCasesLoaded = true;

  const PAGES = new Set(['appointments','doctor-appointments']);
  const HIDDEN = new Set(['cancelled','rescheduled']);

  const t = (en, ar) => C.lang === 'ar' ? ar : en;

  function injectStyles(){
    if(document.getElementById('v90-extra-style')) return;

    const s = document.createElement('style');
    s.id = 'v90-extra-style';
    s.textContent = `
      .v86-extra-day-list,
      .v88-extra-day-list,
      .v89-extra-day-list{
        display:none !important;
      }

      .v90-extra-block{
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        margin-top:10px;
        border:1px solid #dbe4ee;
        border-radius:14px;
        background:#fff;
        overflow:hidden;
      }

      .v90-extra-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px 12px;
        border-bottom:1px solid #e6edf5;
        background:#fff;
      }

      .v90-extra-head strong{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#10233c;
        font-size:13px;
        font-weight:900;
      }

      .v90-extra-count{
        flex:0 0 auto;
        padding:4px 8px;
        border-radius:999px;
        background:#fff7ed;
        color:#b45309;
        border:1px solid #fed7aa;
        font-size:10px;
        font-weight:900;
      }

      .v90-extra-list{
        display:grid;
      }

      .v90-extra-row{
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
        text-align:start;
        cursor:pointer;
        color:inherit;
      }

      .v90-extra-row:last-child{
        border-bottom:0;
      }

      .v90-extra-row:hover{
        background:#f8fbff;
      }

      .v90-extra-num{
        width:28px;
        height:28px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:#f1f5f9;
        color:#475569;
        font-size:11px;
        font-weight:900;
      }

      .v90-extra-copy{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .v90-extra-copy strong{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#10233c;
        font-size:11px;
        line-height:1.2;
        font-weight:850;
      }

      .v90-extra-copy small{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#718096;
        font-size:9px;
      }

      .v90-extra-time{
        color:#b45309;
        font-weight:800;
      }

      .v90-extra-status{
        color:#0f766e;
        font-weight:800;
      }

      [dir="rtl"] .v90-extra-row{
        text-align:right;
      }

      @media(max-width:600px){
        .v90-extra-head{
          padding:9px 10px;
        }

        .v90-extra-row{
          padding:9px 10px;
          grid-template-columns:26px minmax(0,1fr);
          gap:7px;
        }

        .v90-extra-num{
          width:26px;
          height:26px;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function localYmd(iso){
    try{
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone:'Africa/Cairo',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).formatToParts(new Date(iso));

      const get = type => parts.find(x => x.type === type)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch{
      return '';
    }
  }

  function formatTime(iso){
    try{
      return new Intl.DateTimeFormat(
        C.lang === 'ar' ? 'ar-EG' : 'en-US',
        {
          timeZone:'Africa/Cairo',
          hour:'numeric',
          minute:'2-digit',
          hour12:true
        }
      ).format(new Date(iso));
    }catch{
      return '';
    }
  }

  function normalizeDigits(s=''){
    const ar='٠١٢٣٤٥٦٧٨٩';
    return String(s).replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)));
  }

  function parseDate(text=''){
    const x = normalizeDigits(text);

    let m = x.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m){
      return `${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
    }

    const months = {
      'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,
      'مايو':5,'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,
      'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12
    };

    for(const [name,num] of Object.entries(months)){
      m = x.match(new RegExp('(\\d{1,2})\\s+' + name + '\\s+(\\d{4})'));
      if(m){
        return `${m[2]}-${String(num).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
      }
    }

    return null;
  }

  function visibleDays(){
    return [...document.querySelectorAll('.scheduler-day-card')]
      .map(card => ({
        card,
        date: parseDate(
          card.querySelector('.scheduler-day-header')?.textContent || ''
        )
      }))
      .filter(x => x.date);
  }

  function doctorId(){
    if(C.currentPage === 'doctor-appointments'){
      return C.user?.id || '';
    }

    return (
      document.getElementById('calendarDoctor')?.value ||
      C.doctors?.[0]?.id ||
      ''
    );
  }

  function statusLabel(status){
    const en = {
      booked:'Booked',
      confirmed:'Confirmed',
      arrived:'Arrived',
      waiting:'Waiting',
      with_doctor:'With doctor',
      completed:'Completed',
      no_show:'No-show'
    };

    const ar = {
      booked:'محجوز',
      confirmed:'مؤكد',
      arrived:'وصل',
      waiting:'انتظار',
      with_doctor:'مع الطبيب',
      completed:'مكتمل',
      no_show:'لم يحضر'
    };

    return (C.lang === 'ar' ? ar : en)[status] || status || '';
  }

  async function fetchExtras(doctor, dates){
    if(!doctor || !dates.length) return [];

    const sorted = [...dates].sort();
    const from = `${sorted[0]}T00:00:00+03:00`;

    const last = new Date(`${sorted.at(-1)}T23:59:59+03:00`);
    last.setTime(last.getTime() + 86400000);

    let result = await C.sb
      .from('appointments')
      .select(`
        *,
        patient:patients(
          id,
          medical_record_number,
          english_name,
          arabic_name,
          mobile,
          birth_year
        )
      `)
      .eq('doctor_id', doctor)
      .eq('booking_source','extra_case')
      .gte('scheduled_start', from)
      .lt('scheduled_start', last.toISOString())
      .order('scheduled_start');

    if(result.error){
      const fallback = await C.sb
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctor)
        .eq('booking_source','extra_case')
        .gte('scheduled_start', from)
        .lt('scheduled_start', last.toISOString())
        .order('scheduled_start');

      if(fallback.error) throw fallback.error;

      const rows = fallback.data || [];
      const patientIds = [
        ...new Set(rows.map(a => a.patient_id).filter(Boolean))
      ];

      let patientMap = new Map();

      if(patientIds.length){
        const patients = await C.sb
          .from('patients')
          .select('id,medical_record_number,english_name,arabic_name,mobile,birth_year')
          .in('id', patientIds);

        if(!patients.error){
          patientMap = new Map(
            (patients.data || []).map(p => [p.id,p])
          );
        }
      }

      result = {
        data: rows.map(a => ({
          ...a,
          patient: patientMap.get(a.patient_id) || {}
        }))
      };
    }

    return (result.data || []).filter(a =>
      !HIDDEN.has(String(a.status || '')) &&
      dates.includes(localYmd(a.scheduled_start))
    );
  }

  function canReceptionActions(){
    return (
      C.isReception?.() ||
      C.hasRole?.('owner') ||
      C.hasRole?.('manager') ||
      C.hasRole?.('deputy_manager') ||
      C.hasRole?.('secretary')
    );
  }

  async function rpc(name,args,success){
    const {error} = await C.sb.rpc(name,args);
    if(error){
      return C.toast(error.message,'error');
    }

    C.closeModal();
    C.toast(success);
    C.route(C.currentPage);
  }

  function editBooking(a){
    const editor = window.ClinicBookingWorkflow?.showEditBookingModal;

    if(!editor){
      return C.toast(
        t('Could not open booking editor.','تعذر فتح تعديل الحجز.'),
        'error'
      );
    }

    C.closeModal();
    editor(a.id);
  }

  function confirmInformation(a){
    C.closeModal();

    const ghost = document.createElement('button');
    ghost.type = 'button';
    ghost.dataset.appointmentId = a.id;
    ghost.style.position = 'fixed';
    ghost.style.left = '-9999px';
    ghost.style.top = '-9999px';

    document.body.appendChild(ghost);

    ghost.dispatchEvent(
      new MouseEvent('click', {
        bubbles:true,
        cancelable:true,
        view:window
      })
    );

    setTimeout(() => ghost.remove(), 300);
  }

  function checkIn(a){
    C.showModal({
      title:t('Confirm patient arrival','تأكيد حضور المريض'),
      body:`
        <form id="v90CheckinForm" class="form-grid">
          <label>
            ${t('Fees (EGP)','الرسوم (جنيه)')}
            <input
              id="v90Fee"
              class="control"
              type="number"
              min="0"
              step="1"
              required
            >
          </label>

          <label>
            ${t('Payment method','طريقة الدفع')}
            <select id="v90Payment" class="control">
              <option value="cash">${t('Cash','نقدي')}</option>
              <option value="instapay">InstaPay</option>
              <option value="card">${t('Card','بطاقة')}</option>
              <option value="bank_transfer">${t('Bank transfer','تحويل بنكي')}</option>
              <option value="other">${t('Other','أخرى')}</option>
            </select>
          </label>

          <div class="form-actions full-span">
            <button class="primary-button compact">
              ${t('Confirm arrival','تأكيد الحضور')}
            </button>
          </div>
        </form>
      `,
      onOpen:root=>{
        root.querySelector('#v90CheckinForm').onsubmit = async event => {
          event.preventDefault();

          await rpc(
            'frontend_check_in_with_fee',
            {
              p_id:a.id,
              p_fee:Number(root.querySelector('#v90Fee').value || 0),
              p_payment_method:root.querySelector('#v90Payment').value,
              p_note:null
            },
            t('Checked in.','تم تسجيل الوصول.')
          );
        };
      }
    });
  }

  function openActions(a){
    const p = a.patient || {};
    const reception = canReceptionActions();

    C.showModal({
      title:t('Extra case','حالة إضافية'),
      body:`
        <div class="appointment-detail-card">
          <div class="appointment-detail-patient">
            <span class="eyebrow">
              ${C.escape(
                p.medical_record_number ||
                a.appointment_number ||
                ''
              )}
            </span>

            <h3>
              ${C.escape(
                p.english_name ||
                p.arabic_name ||
                t('Patient','مريض')
              )}
            </h3>

            <p class="muted">
              ${C.escape(formatTime(a.scheduled_start))}
              •
              ${C.escape(statusLabel(a.status))}
            </p>
          </div>

          <div class="v89-action-grid">
            ${['booked','confirmed'].includes(a.status) ? `
              <button class="secondary-button compact" data-v90="confirm">
                ${t('Confirm information','تأكيد البيانات')}
              </button>

              ${reception ? `
                <button class="secondary-button compact" data-v90="edit">
                  ${t('Edit booking','تعديل الحجز')}
                </button>

                <button class="secondary-button compact" data-v90="checkin">
                  ${t('Check in','تسجيل الوصول')}
                </button>

                <button class="secondary-button compact" data-v90="noshow">
                  ${t('No-show','لم يحضر')}
                </button>

                <button class="danger-button compact" data-v90="cancel">
                  ${t('Cancel','إلغاء')}
                </button>
              ` : ''}
            ` : ''}

            ${a.status === 'arrived' && reception ? `
              <button class="primary-button compact" data-v90="send">
                ${t('Send to doctor','إرسال للطبيب')}
              </button>
            ` : ''}
          </div>
        </div>
      `,
      onOpen:root=>{
        root.querySelector('[data-v90="confirm"]')
          ?.addEventListener('click',()=>confirmInformation(a));

        root.querySelector('[data-v90="edit"]')
          ?.addEventListener('click',()=>editBooking(a));

        root.querySelector('[data-v90="checkin"]')
          ?.addEventListener('click',()=>checkIn(a));

        root.querySelector('[data-v90="noshow"]')
          ?.addEventListener('click',()=>rpc(
            'frontend_mark_no_show',
            {p_id:a.id,p_reason:null},
            t('Marked no-show.','تم تسجيل عدم الحضور.')
          ));

        root.querySelector('[data-v90="cancel"]')
          ?.addEventListener('click',()=>{
            const reason = prompt(
              t('Cancellation reason','سبب الإلغاء')
            );

            if(!reason) return;

            rpc(
              'frontend_cancel_appointment',
              {p_id:a.id,p_reason:reason},
              t('Appointment cancelled.','تم إلغاء الموعد.')
            );
          });

        root.querySelector('[data-v90="send"]')
          ?.addEventListener('click',()=>rpc(
            'frontend_send_to_doctor',
            {p_id:a.id},
            t('Sent to doctor.','تم إرسال المريض للطبيب.')
          ));
      }
    });
  }

  function render(day, rows){
    day.card.querySelectorAll('.v90-extra-block').forEach(x => x.remove());

    if(!rows.length) return;

    const wrap = document.createElement('section');
    wrap.className = 'v90-extra-block';

    wrap.innerHTML = `
      <div class="v90-extra-head">
        <strong>${t('Extra cases','الحالات الإضافية')}</strong>
        <span class="v90-extra-count">
          ${rows.length}
        </span>
      </div>

      <div class="v90-extra-list">
        ${rows.map((a,index)=>{
          const p = a.patient || {};
          const name =
            p.english_name ||
            p.arabic_name ||
            t('Patient','مريض');

          const meta = [
            formatTime(a.scheduled_start),
            statusLabel(a.status),
            p.mobile
          ].filter(Boolean);

          return `
            <button
              type="button"
              class="v90-extra-row"
              data-v90-id="${C.escape(a.id)}"
            >
              <span class="v90-extra-num">
                ${index+1}
              </span>

              <span class="v90-extra-copy">
                <strong>
                  ${C.escape(name)}
                </strong>

                <small>
                  <span class="v90-extra-time">
                    ${C.escape(meta[0] || '')}
                  </span>
                  ${meta[1] ? ` • <span class="v90-extra-status">${C.escape(meta[1])}</span>` : ''}
                  ${meta[2] ? ` • ${C.escape(meta[2])}` : ''}
                </small>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    const stack = day.card.querySelector('.scheduler-slot-stack');

    if(stack){
      stack.insertAdjacentElement('afterend',wrap);
    }else{
      day.card.appendChild(wrap);
    }

    const rowMap = new Map(rows.map(a => [a.id,a]));

    wrap.querySelectorAll('[data-v90-id]').forEach(button=>{
      button.onclick = () => {
        const appointment = rowMap.get(button.dataset.v90Id);
        if(appointment) openActions(appointment);
      };
    });
  }

  let loading = false;
  let rerun = false;

  async function refresh(){
    if(!PAGES.has(C.currentPage)) return;

    const dayCards = visibleDays();
    if(!dayCards.length) return;

    const doctor = doctorId();
    if(!doctor) return;

    if(loading){
      rerun = true;
      return;
    }

    loading = true;

    try{
      const dates = [...new Set(dayCards.map(x => x.date))];

      const extras = await fetchExtras(
        doctor,
        dates
      );

      for(const day of dayCards){
        render(
          day,
          extras.filter(
            a => localYmd(a.scheduled_start) === day.date
          )
        );
      }
    }catch(error){
      console.warn('V90 extra cases:',error);
    }finally{
      loading = false;

      if(rerun){
        rerun = false;
        queueMicrotask(refresh);
      }
    }
  }

  injectStyles();

  let raf = 0;

  new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refresh);
  }).observe(
    document.getElementById('mainContent') || document.body,
    {
      childList:true,
      subtree:true
    }
  );

  document.addEventListener('change',event=>{
    if(
      ['calendarDoctor','calendarWeekCount']
        .includes(event.target?.id)
    ){
      requestAnimationFrame(refresh);
    }
  });

  document.addEventListener('click',event=>{
    if(
      event.target.closest(
        '.app-lang-btn,#calendarPrevious,#calendarNext,#calendarToday,[data-mini-date]'
      )
    ){
      requestAnimationFrame(refresh);
    }
  });

  requestAnimationFrame(refresh);
})();
