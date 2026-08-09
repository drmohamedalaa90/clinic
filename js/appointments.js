(function(){
  const statusActions = {
    booked: ['checkin','reschedule','noshow','cancel'],
    confirmed: ['checkin','reschedule','noshow','cancel'],
    arrived: ['send','cancel'],
    waiting: [],
    with_doctor: [],
    completed: [],
    cancelled: [],
    no_show: [],
    rescheduled: []
  };

  function parseYmd(value){
    const [y,m,d] = String(value).split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d));
  }

  function toYmd(date){
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth()+1).padStart(2,'0'),
      String(date.getUTCDate()).padStart(2,'0')
    ].join('-');
  }

  function addDays(value, days){
    const d = typeof value === 'string' ? parseYmd(value) : new Date(value);
    d.setUTCDate(d.getUTCDate()+days);
    return toYmd(d);
  }

  function saturdayStart(value){
    const d = parseYmd(value);
    const dow = d.getUTCDay(); // Sunday=0 ... Saturday=6
    const daysSinceSaturday = (dow + 1) % 7;
    d.setUTCDate(d.getUTCDate() - daysSinceSaturday);
    return toYmd(d);
  }

  function weekdayName(date){
    const d = new Date(`${date}T12:00:00+03:00`);
    return new Intl.DateTimeFormat(
      Clinic.lang==='ar' ? 'ar-EG' : 'en-GB',
      {
        timeZone:'Africa/Cairo',
        weekday:'long'
      }
    ).format(d);
  }

  function receptionActionLabel(kind){
    const C=Clinic;

    const labels={
      confirm:
        C.lang==='ar'
          ?'تأكيد الحجز'
          :'Confirm booking',

      checkin:
        C.lang==='ar'
          ?'تسجيل الوصول'
          :'Check in',

      send:
        C.lang==='ar'
          ?'إرسال للطبيب'
          :'Send to doctor',

      noshow:
        C.lang==='ar'
          ?'لم يحضر'
          :'No-show',

      cancel:
        C.lang==='ar'
          ?'إلغاء'
          :'Cancel',

      reschedule:
        C.lang==='ar'
          ?'تغيير الموعد'
          :'Reschedule'
    };

    return labels[kind]||kind;
  }


  function appointmentStatusLabel(status){
    const C=Clinic;
    const map={
      booked: C.lang==='ar'?'محجوز':'Booked',
      confirmed: C.lang==='ar'?'مؤكد':'Confirmed',
      arrived: C.lang==='ar'?'وصل':'Arrived',
      waiting: C.lang==='ar'?'انتظار':'Waiting',
      with_doctor: C.lang==='ar'?'مع الطبيب':'With doctor',
      completed: C.lang==='ar'?'مكتمل':'Completed',
      cancelled: C.lang==='ar'?'ملغي':'Cancelled',
      no_show: C.lang==='ar'?'لم يحضر':'No-show',
      rescheduled: C.lang==='ar'?'أعيدت جدولته':'Rescheduled'
    };
    return map[status] || status;
  }

  async function patientOptions(search=''){
    const C=Clinic;
    let q=C.sb
      .from('patients')
      .select('id,medical_record_number,english_name,arabic_name,birth_year,mobile')
      .eq('is_active',true)
      .order('created_at',{ascending:false})
      .limit(100);

    if(search){
      const term=search.replaceAll(',',' ');
      q=q.or(
        `medical_record_number.ilike.%${term}%` +
        `,arabic_name.ilike.%${term}%` +
        `,english_name.ilike.%${term}%` +
        `,mobile.ilike.%${term}%`
      );
    }

    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function loadPatientSearch(root){
    const C=Clinic;
    const query=root.querySelector('#existingPatientSearch').value.trim();
    const box=root.querySelector('#existingPatientResults');

    box.innerHTML=`
      <div class="booking-patient-search-loading">
        ${C.lang==='ar'?'جاري البحث...':'Searching...'}
      </div>
    `;

    try{
      const rows=await patientOptions(query);

      box.innerHTML=rows.length
        ? rows.map(p=>`
            <button
              type="button"
              class="existing-patient-choice"
              data-patient-id="${p.id}"
            >
              <span>
                <strong>
                  ${C.escape(
                    p.english_name||
                    p.arabic_name||
                    'Patient'
                  )}
                </strong>

                <small>
                  ${C.escape(p.medical_record_number)}
                  ${p.birth_year ? ` • ${p.birth_year}` : ''}
                  ${p.mobile ? ` • ${C.escape(p.mobile)}` : ''}
                </small>
              </span>

              <span>›</span>
            </button>
          `).join('')
        : `<div class="empty-state compact-empty">
             ${C.lang==='ar'
               ?'لا يوجد مريض مطابق.'
               :'No matching patient.'}
           </div>`;

      box.querySelectorAll('[data-patient-id]').forEach(button=>{
        button.onclick=()=>{
          root.querySelector('#selectedExistingPatient').value =
            button.dataset.patientId;

          box.querySelectorAll('.existing-patient-choice')
            .forEach(x=>x.classList.remove('selected'));

          button.classList.add('selected');
        };
      });
    }catch(error){
      box.innerHTML=`
        <div class="empty-state compact-empty">
          ${C.escape(error.message)}
        </div>
      `;
    }
  }

  async function showBookingModal(prefill={}){
    const C=Clinic;
    await C.loadDoctors(true);

    const doctorId = prefill.doctorId || '';
    const date = prefill.date || C.cairoDate();
    const slotStart = prefill.slotStart || '';
    const slotEnd = prefill.slotEnd || '';
    const currentYear = Number(
      new Intl.DateTimeFormat('en-GB',{
        timeZone:'Africa/Cairo',
        year:'numeric'
      }).format(new Date())
    );

    C.showModal({
      title:C.lang==='ar'?'حجز موعد':'Book appointment',
      wide:true,

      body:`
        <form id="bookingForm" class="booking-form-v2">

          <section class="booking-form-section">
            <div class="booking-section-heading">
              <div>
                <span class="eyebrow">
                  ${C.lang==='ar'?'بيانات الموعد':'APPOINTMENT'}
                </span>

                <h3>
                  ${C.lang==='ar'?'الموعد المختار':'Selected appointment'}
                </h3>
              </div>
            </div>

            <div class="booking-summary-grid">
              <label>
                ${C.lang==='ar'?'الطبيب':'Doctor'}
                <select
                  id="bookingDoctor"
                  name="doctor_id"
                  class="control"
                  required
                >
                  <option value="">—</option>
                  ${C.doctors.map(d=>`
                    <option
                      value="${d.id}"
                      ${d.id===doctorId?'selected':''}
                    >
                      ${C.escape(d.display_name||d.username)}
                    </option>
                  `).join('')}
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'التاريخ':'Date'}
                <input
                  id="bookingDate"
                  name="date"
                  type="date"
                  min="${C.cairoDate()}"
                  value="${date}"
                  class="control"
                  required
                >
              </label>

              <label>
                ${C.lang==='ar'?'نوع الزيارة':'Type'}
                <select
                  name="appointment_type"
                  class="control"
                >
                  <option value="new">
                    ${C.lang==='ar'?'جديد':'New'}
                  </option>
                  <option value="follow_up">
                    ${C.lang==='ar'?'متابعة':'Follow-up'}
                  </option>
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'الفترة الزمنية':'Time interval'}
                <select
                  id="bookingSlot"
                  name="slot"
                  class="control"
                  required
                >
                  ${slotStart && slotEnd
                    ? `<option
                         value="${slotStart}|${slotEnd}"
                         selected
                       >
                         ${C.formatTime(slotStart)}
                         –
                         ${C.formatTime(slotEnd)}
                       </option>`
                    : `<option value="">
                         ${C.lang==='ar'
                           ?'اختر الطبيب والتاريخ'
                           :'Choose doctor & date'}
                       </option>`
                  }
                </select>
              </label>
            </div>

            <div
              id="slotHint"
              class="small-note"
            ></div>

          </section>


          <section class="booking-form-section">
            <div class="booking-section-heading patient-booking-heading">
              <div>
                <span class="eyebrow">
                  ${C.lang==='ar'?'بيانات المريض':'PATIENT'}
                </span>

                <h3>
                  ${C.lang==='ar'
                    ?'أدخل بيانات المريض أثناء الحجز'
                    :'Patient data is entered during booking'}
                </h3>
              </div>

              <div class="patient-mode-switch">
                <button
                  type="button"
                  class="patient-mode-btn active"
                  data-patient-mode="new"
                >
                  + ${C.lang==='ar'?'مريض جديد':'New patient'}
                </button>

                <button
                  type="button"
                  class="patient-mode-btn"
                  data-patient-mode="existing"
                >
                  ${C.lang==='ar'?'مريض موجود':'Existing patient'}
                </button>
              </div>
            </div>

            <input
              id="selectedExistingPatient"
              type="hidden"
              value="${prefill.patientId||''}"
            >

            <div
              id="newPatientPanel"
              class="patient-mode-panel"
            >
              <div class="form-grid">
                <label>
                  ${C.lang==='ar'?'الاسم بالعربية':'Arabic name'}
                  <input
                    id="bookingArabicName"
                    class="control"
                  >
                </label>

                <label>
                  ${C.lang==='ar'?'الاسم بالإنجليزية':'English name'}
                  <input
                    id="bookingEnglishName"
                    class="control"
                  >
                </label>

                <label>
                  ${C.lang==='ar'?'سنة الميلاد':'Year of birth'}
                  <input
                    id="bookingBirthYear"
                    type="number"
                    inputmode="numeric"
                    min="1900"
                    max="${currentYear}"
                    step="1"
                    placeholder="1985"
                    class="control"
                  >
                </label>

                <label>
                  ${C.lang==='ar'?'النوع':'Gender'}
                  <select
                    id="bookingGender"
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
                    id="bookingMobile"
                    inputmode="tel"
                    class="control"
                  >
                </label>

                <label>
                  ${C.lang==='ar'?'العنوان':'Address'}
                  <input
                    id="bookingAddress"
                    class="control"
                  >
                </label>
              </div>
            </div>


            <div
              id="existingPatientPanel"
              class="patient-mode-panel hidden"
            >
              <div class="existing-patient-search-row">
                <input
                  id="existingPatientSearch"
                  class="control"
                  placeholder="${C.lang==='ar'
                    ?'ابحث بالاسم / MRN / الموبايل'
                    :'Search name / MRN / mobile'}"
                >

                <button
                  id="existingPatientSearchBtn"
                  type="button"
                  class="secondary-button"
                >
                  ${C.lang==='ar'?'بحث':'Search'}
                </button>
              </div>

              <div
                id="existingPatientResults"
                class="existing-patient-results"
              ></div>
            </div>
          </section>


          <section class="booking-form-section">
            <label class="full-span">
              ${C.lang==='ar'?'ملاحظات الحجز':'Booking notes'}
              <textarea
                id="bookingNotes"
                class="control"
              ></textarea>
            </label>
          </section>


          <div class="booking-submit-row">
            <button
              class="primary-button compact"
              type="submit"
            >
              ${C.lang==='ar'
                ?'تأكيد الحجز'
                :'Book appointment'}
            </button>
          </div>
        </form>
      `,

      onOpen:(root)=>{
        root
          .querySelector('.modal-card')
          ?.classList.add('booking-modal-card');

        const doctor=root.querySelector('#bookingDoctor');
        const dateInput=root.querySelector('#bookingDate');
        const slot=root.querySelector('#bookingSlot');
        const hint=root.querySelector('#slotHint');

        let patientMode = prefill.patientId ? 'existing' : 'new';

        function applyPatientMode(){
          root
            .querySelectorAll('[data-patient-mode]')
            .forEach(button=>{
              button.classList.toggle(
                'active',
                button.dataset.patientMode === patientMode
              );
            });

          root
            .querySelector('#newPatientPanel')
            .classList.toggle(
              'hidden',
              patientMode!=='new'
            );

          root
            .querySelector('#existingPatientPanel')
            .classList.toggle(
              'hidden',
              patientMode!=='existing'
            );

          if(patientMode==='existing'){
            loadPatientSearch(root);
          }
        }

        root
          .querySelectorAll('[data-patient-mode]')
          .forEach(button=>{
            button.onclick=()=>{
              patientMode=button.dataset.patientMode;
              applyPatientMode();
            };
          });

        async function loadSlots(){
          if(!doctor.value || !dateInput.value){
            slot.innerHTML='<option value="">—</option>';
            return;
          }

          slot.innerHTML=`
            <option>
              ${C.lang==='ar'?'جاري التحميل...':'Loading...'}
            </option>
          `;

          const {data,error}=await C.sb.rpc(
            'frontend_get_hourly_slots',
            {
              p_doctor:doctor.value,
              p_day:dateInput.value
            }
          );

          if(error){
            slot.innerHTML=`
              <option value="">
                ${C.lang==='ar'?'لا توجد فترات':'No slots'}
              </option>
            `;
            hint.textContent=error.message;
            return;
          }

          const rows=data||[];

          slot.innerHTML=`
            <option value="">
              ${rows.length
                ? (
                    C.lang==='ar'
                      ?'اختر الفترة الزمنية'
                      :'Select time interval'
                  )
                : (
                    C.lang==='ar'
                      ?'لا توجد مواعيد متاحة'
                      :'No available slots'
                  )
              }
            </option>

            ${rows
              .filter(x=>Number(x.remaining_capacity||0)>0)
              .map(x=>`
                <option
                  value="${x.slot_start}|${x.slot_end}"
                >
                  ${C.formatTime(x.slot_start)}
                  –
                  ${C.formatTime(x.slot_end)}
                  •
                  ${x.remaining_capacity}/4
                  ${C.lang==='ar'?'أماكن متبقية':'places left'}
                </option>
              `).join('')}
          `;

          const openRows = rows.filter(
            x=>Number(x.remaining_capacity||0)>0
          );

          hint.textContent=openRows.length
            ? `${openRows.length} ${
                C.lang==='ar'
                  ?'ساعات متاحة — الحد الأقصى 4 مرضى لكل ساعة'
                  :'available hours — maximum 4 patients per hour'
              }`
            : (
                C.lang==='ar'
                  ?'كل الساعات ممتلئة.'
                  :'All hourly slots are full.'
              );
        }

        doctor.onchange=loadSlots;
        dateInput.onchange=loadSlots;

        root
          .querySelector('#existingPatientSearchBtn')
          .onclick=()=>loadPatientSearch(root);

        root
          .querySelector('#existingPatientSearch')
          .addEventListener('keydown',event=>{
            if(event.key==='Enter'){
              event.preventDefault();
              loadPatientSearch(root);
            }
          });

        if(prefill.patientId){
          patientMode='existing';
        }

        applyPatientMode();

        if(!(slotStart && slotEnd) && doctor.value){
          loadSlots();
        }


        root.querySelector('#bookingForm').onsubmit=async event=>{
          event.preventDefault();

          const parts=(slot.value||'').split('|');

          if(parts.length!==2){
            return C.toast(
              C.lang==='ar'
                ?'اختر فترة زمنية متاحة.'
                :'Choose an available time interval.',
              'error'
            );
          }

          const appointmentType=
            root.querySelector('[name="appointment_type"]').value;

          const note=
            root.querySelector('#bookingNotes').value.trim()||null;

          let result;

          if(patientMode==='existing'){
            const patientId=
              root.querySelector('#selectedExistingPatient').value;

            if(!patientId){
              return C.toast(
                C.lang==='ar'
                  ?'اختر المريض الموجود.'
                  :'Select an existing patient.',
                'error'
              );
            }

            result=await C.sb.rpc(
              'frontend_book_appointment',
              {
                p_patient:patientId,
                p_doctor:doctor.value,
                p_start:parts[0],
                p_end:parts[1],
                p_type:appointmentType,
                p_note:note
              }
            );
          }

          else {
            const arabicName=
              root.querySelector('#bookingArabicName').value.trim();

            const englishName=
              root.querySelector('#bookingEnglishName').value.trim();

            if(!arabicName && !englishName){
              return C.toast(
                C.lang==='ar'
                  ?'أدخل اسم المريض.'
                  :'Enter patient name.',
                'error'
              );
            }

            const birthYearText=
              root.querySelector('#bookingBirthYear').value.trim();

            result=await C.sb.rpc(
              'frontend_create_patient_and_book',
              {
                p_doctor:doctor.value,
                p_start:parts[0],
                p_end:parts[1],
                p_type:appointmentType,
                p_note:note,
                p_arabic_name:arabicName||null,
                p_english_name:englishName||null,
                p_birth_year:birthYearText
                  ? Number(birthYearText)
                  : null,
                p_gender:
                  root.querySelector('#bookingGender').value||null,
                p_mobile:
                  root.querySelector('#bookingMobile').value.trim()||null,
                p_address:
                  root.querySelector('#bookingAddress').value.trim()||null
              }
            );
          }

          if(result.error){
            return C.toast(
              result.error.message,
              'error'
            );
          }

          C.closeModal();

          C.toast(
            C.lang==='ar'
              ?'تم إنشاء المريض والحجز بنجاح.'
              :'Patient and appointment saved.'
          );

          window.ClinicNotifications?.refresh?.();

          C.route(
            C.currentPage==='doctor-appointments'
              ? 'doctor-appointments'
              : 'appointments'
          );
        };
      }
    });
  }


  async function fetchRangeAppointments({
    doctorId,
    from,
    to
  }){
    const C=Clinic;

    const start=`${from}T00:00:00+03:00`;
    const end=`${to}T23:59:59+03:00`;

    let q=C.sb
      .from('appointments')
      .select('*')
      .gte('scheduled_start',start)
      .lte('scheduled_start',end)
      .order('scheduled_start');

    if(doctorId){
      q=q.eq('doctor_id',doctorId);
    }

    const {data,error}=await q;

    if(error) throw error;

    return data||[];
  }


  async function attachPatientNames(appts){
    const ids=[
      ...new Set(
        appts
          .map(a=>a.patient_id)
          .filter(Boolean)
      )
    ];

    if(!ids.length){
      return new Map();
    }

    const {data,error}=await Clinic.sb
      .from('patients')
      .select(
        'id,medical_record_number,english_name,arabic_name,mobile,birth_year'
      )
      .in('id',ids);

    if(error){
      console.warn(error);
      return new Map();
    }

    return new Map(
      (data||[]).map(p=>[p.id,p])
    );
  }


  async function fetchExceptions(
    doctorId,
    from,
    to
  ){
    const {data,error}=await Clinic.sb.rpc(
      'frontend_get_doctor_schedule_exceptions',
      {
        p_doctor:doctorId,
        p_from:from,
        p_to:to
      }
    );

    if(error){
      console.warn(error);
      return [];
    }

    return data||[];
  }


  function activeExceptionForDate(exceptions,date){
    return exceptions
      .filter(x=>
        x.exception_date===date &&
        x.status==='approved'
      )
      .sort((a,b)=>
        String(a.created_at).localeCompare(
          String(b.created_at)
        )
      );
  }


  async function loadTwoWeekData(doctorId, anchorDate){
    const C=Clinic;

    const weekStart=saturdayStart(anchorDate);
    const dates=Array.from(
      {length:14},
      (_,index)=>addDays(weekStart,index)
    );

    const from=dates[0];
    const to=dates[13];

    const [appointments,exceptions] =
      await Promise.all([
        fetchRangeAppointments({
          doctorId,
          from,
          to
        }),
        fetchExceptions(
          doctorId,
          from,
          to
        )
      ]);

    const patients=await attachPatientNames(
      appointments
    );

    const slotResults=await Promise.all(
      dates.map(async date=>{
        const {data,error}=await C.sb.rpc(
          'frontend_get_hourly_slots',
          {
            p_doctor:doctorId,
            p_day:date
          }
        );

        return {
          date,
          slots:error ? [] : (data||[]),
          error:error?.message||null
        };
      })
    );

    const slotsByDate=new Map(
      slotResults.map(x=>[
        x.date,
        x
      ])
    );

    const appointmentsByDate=new Map();

    appointments.forEach(a=>{
      const date=new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:'Africa/Cairo',
          year:'numeric',
          month:'2-digit',
          day:'2-digit'
        }
      ).format(new Date(a.scheduled_start));

      if(!appointmentsByDate.has(date)){
        appointmentsByDate.set(date,[]);
      }

      appointmentsByDate.get(date).push(a);
    });

    return {
      dates,
      weekStart,
      appointments,
      patients,
      exceptions,
      slotsByDate,
      appointmentsByDate
    };
  }


  function renderDayCard({
    date,
    dayIndex,
    data,
    canBook
  }){
    const C=Clinic;

    const slotInfo=data.slotsByDate.get(date) || {
      slots:[],
      error:null
    };

    const appts=(
      data.appointmentsByDate.get(date) || []
    ).filter(a=>
      !['cancelled','rescheduled'].includes(a.status)
    );

    const exceptions=activeExceptionForDate(
      data.exceptions,
      date
    );

    const closingException=exceptions.find(x=>
      ['apology','vacation','emergency_cancellation']
        .includes(x.exception_type)
      && x.is_all_day
    );

    const isPast=date < C.cairoDate();

    const hourlyCards=(slotInfo.slots||[]).map(slot=>{
      const hourPatients=appts
        .filter(a=>
          new Date(a.scheduled_start) < new Date(slot.slot_end)
          &&
          new Date(a.scheduled_end) > new Date(slot.slot_start)
        )
        .sort((a,b)=>
          new Date(a.created_at||a.scheduled_start) -
          new Date(b.created_at||b.scheduled_start)
        );

      const booked=hourPatients.length;
      const remaining=Math.max(
        0,
        Number(slot.capacity||4)-booked
      );

      return `
        <div class="hour-capacity-card ${
          remaining===0 ? 'full' : ''
        }">
          <div class="hour-capacity-head">
            <div>
              <strong>
                ${C.formatTime(slot.slot_start)}
                –
                ${C.formatTime(slot.slot_end)}
              </strong>

              <small>
                ${booked}/4
                ${C.lang==='ar'?'مرضى':'patients'}
              </small>
            </div>

            <span class="capacity-pill ${
              remaining===0 ? 'full' : 'open'
            }">
              ${remaining===0
                ? (
                    C.lang==='ar'
                      ?'ممتلئ'
                      :'Full'
                  )
                : `${remaining} ${
                    C.lang==='ar'
                      ?'متبقي'
                      :'left'
                  }`
              }
            </span>
          </div>

          <div class="hour-patient-list">
            ${Array.from({length:4},(_,index)=>{
              const appointment=hourPatients[index];

              if(appointment){
                const patient=data.patients.get(
                  appointment.patient_id
                ) || {};

                return `
                  <button
                    class="hour-patient-seat occupied status-${C.escape(appointment.status)}"
                    data-appointment-id="${appointment.id}"
                    type="button"
                  >
                    <span class="seat-number">
                      ${index+1}
                    </span>

                    <span class="seat-copy">
                      <strong>
                        ${C.escape(
                          patient.english_name||
                          patient.arabic_name||
                          'Patient'
                        )}
                      </strong>

                      <small>
                        ${C.escape(
                          appointmentStatusLabel(
                            appointment.status
                          )
                        )}
                      </small>
                    </span>
                  </button>
                `;
              }

              return `
                <button
                  class="hour-patient-seat empty"
                  ${canBook && !isPast && remaining>0
                    ? `data-book-slot="1"
                       data-date="${date}"
                       data-start="${slot.slot_start}"
                       data-end="${slot.slot_end}"`
                    : 'disabled'
                  }
                >
                  <span class="seat-number">
                    ${index+1}
                  </span>

                  <span class="seat-copy">
                    <strong>
                      ${isPast
                        ? (
                            C.lang==='ar'
                              ?'انتهى'
                              :'Past'
                          )
                        : (
                            C.lang==='ar'
                              ?'متاح'
                              :'Available'
                          )
                      }
                    </strong>

                    <small>
                      ${C.lang==='ar'
                        ?'حجز مريض'
                        :'Book patient'}
                    </small>
                  </span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    return `
      <article
        class="scheduler-day-card ${
          dayIndex<7 ? 'current-week-day' : 'next-week-day'
        }"
      >
        <header class="scheduler-day-header">
          <div>
            <strong>
              ${weekdayName(date)}
            </strong>

            <span>
              ${C.formatDate(date)}
            </span>
          </div>

          ${date===C.cairoDate()
            ? `<span class="today-chip">
                 ${C.lang==='ar'?'اليوم':'Today'}
               </span>`
            : ''
          }
        </header>

        ${exceptions.length
          ? `<div class="day-exception-stack">
               ${exceptions.map(x=>`
                 <span class="day-exception-tag exception-${C.escape(x.exception_type)}">
                   ${C.escape(
                     x.exception_type
                       .replaceAll('_',' ')
                   )}
                 </span>
               `).join('')}
             </div>`
          : ''
        }

        <div class="scheduler-slot-stack">
          ${closingException
            ? `<div class="clinic-closed-card">
                 <strong>
                   ${C.lang==='ar'
                     ?'العيادة غير متاحة'
                     :'Clinic unavailable'}
                 </strong>

                 <small>
                   ${C.escape(
                     closingException.note||
                     closingException.exception_type
                       .replaceAll('_',' ')
                   )}
                 </small>
               </div>`

            : hourlyCards.length
              ? hourlyCards.join('')

              : `<div class="no-clinic-day">
                   ${slotInfo.error
                     ? C.escape(slotInfo.error)
                     : (
                         C.lang==='ar'
                           ?'لا توجد عيادة / ساعات متاحة'
                           :'No clinic / hourly slots'
                       )
                   }
                 </div>`
          }
        </div>
      </article>
    `;
  }


  function renderWeekBlock(
    title,
    dates,
    data,
    canBook,
    offset
  ){
    const C=Clinic;

    return `
      <section class="scheduler-week-section">
        <div class="scheduler-week-heading">
          <div>
            <span class="eyebrow">
              ${offset===0
                ? (
                    C.lang==='ar'
                      ?'الأسبوع الأول'
                      :'WEEK 1'
                  )
                : (
                    C.lang==='ar'
                      ?'الأسبوع الثاني'
                      :'WEEK 2'
                  )
              }
            </span>

            <h3>${title}</h3>
          </div>
        </div>

        <div class="scheduler-week-grid">
          ${dates.map((date,index)=>
            renderDayCard({
              date,
              dayIndex:offset+index,
              data,
              canBook
            })
          ).join('')}
        </div>
      </section>
    `;
  }


  async function confirmArrivalWithFee(id){
    const C=Clinic;

    C.showModal({
      title:
        C.lang==='ar'
          ?'تأكيد حضور المريض'
          :'Confirm patient arrival',

      body:`
        <form
          id="arrivalFeeForm"
          class="form-grid"
        >
          <div class="arrival-fee-message full-span">
            <span>✓</span>

            <div>
              <strong>
                ${C.lang==='ar'
                  ?'المريض حضر للعيادة'
                  :'Patient has arrived'}
              </strong>

              <small>
                ${C.lang==='ar'
                  ?'سجل رسوم الكشف الآن. ستظهر مباشرة في المالية ← الدخل.'
                  :'Enter the consultation fee now. It will appear immediately in Finance → Income.'}
              </small>
            </div>
          </div>

          <label>
            ${C.lang==='ar'
              ?'الرسوم (جنيه)'
              :'Fees (EGP)'}

            <input
              id="arrivalFee"
              class="control"
              type="number"
              min="0"
              step="1"
              value="0"
              required
            >
          </label>

          <label>
            ${C.lang==='ar'
              ?'طريقة الدفع'
              :'Payment method'}

            <select
              id="arrivalPayment"
              class="control"
            >
              <option value="cash">
                ${C.lang==='ar'?'نقدي':'Cash'}
              </option>

              <option value="instapay">
                InstaPay
              </option>

              <option value="card">
                ${C.lang==='ar'?'بطاقة':'Card'}
              </option>

              <option value="bank_transfer">
                ${C.lang==='ar'
                  ?'تحويل بنكي'
                  :'Bank transfer'}
              </option>

              <option value="other">
                ${C.lang==='ar'?'أخرى':'Other'}
              </option>
            </select>
          </label>

          <label class="full-span">
            ${C.lang==='ar'
              ?'ملاحظة مالية (اختياري)'
              :'Finance note (optional)'}

            <textarea
              id="arrivalFeeNote"
              class="control"
            ></textarea>
          </label>

          <div class="form-actions full-span">
            <button
              class="primary-button compact"
              type="submit"
            >
              ${C.lang==='ar'
                ?'تأكيد الحضور'
                :'Confirm arrival'}
            </button>
          </div>
        </form>
      `,

      onOpen:(root)=>{
        root
          .querySelector('#arrivalFeeForm')
          .onsubmit=async event=>{
            event.preventDefault();

            const fee=
              Number(
                root
                  .querySelector('#arrivalFee')
                  .value||0
              );

            if(fee < 0){
              return C.toast(
                C.lang==='ar'
                  ?'الرسوم لا يمكن أن تكون سالبة.'
                  :'Fees cannot be negative.',
                'error'
              );
            }

            const {error}=await C.sb.rpc(
              'frontend_check_in_with_fee',
              {
                p_id:id,
                p_fee:fee,
                p_payment_method:
                  root
                    .querySelector('#arrivalPayment')
                    .value,
                p_note:
                  root
                    .querySelector('#arrivalFeeNote')
                    .value
                    .trim()||
                  null
              }
            );

            if(error){
              return C.toast(
                error.message,
                'error'
              );
            }

            C.closeModal();

            C.toast(
              fee>0
                ? (
                    C.lang==='ar'
                      ?'تم تسجيل الوصول والدخل.'
                      :'Checked in and income recorded.'
                  )
                : (
                    C.lang==='ar'
                      ?'تم تسجيل وصول المريض.'
                      :'Patient checked in.'
                  )
            );

            window.ClinicNotifications
              ?.refresh?.();

            C.route(C.currentPage);
          };
      }
    });
  }


  async function action(id,kind){
    const C=Clinic;
    let result;


    if(kind==='checkin'){
      await confirmArrivalWithFee(id);
      return;
    }

    if(kind==='send'){
      result=await C.sb.rpc(
        'frontend_send_to_doctor',
        {p_id:id}
      );
    }

    if(kind==='noshow'){
      result=await C.sb.rpc(
        'frontend_mark_no_show',
        {
          p_id:id,
          p_reason:null
        }
      );
    }

    if(kind==='cancel'){
      const reason=prompt(
        C.lang==='ar'
          ?'سبب الإلغاء'
          :'Cancellation reason'
      );

      if(!reason) return;

      result=await C.sb.rpc(
        'frontend_cancel_appointment',
        {
          p_id:id,
          p_reason:reason
        }
      );
    }

    if(result?.error){
      return C.toast(
        result.error.message,
        'error'
      );
    }

    C.toast(
      C.lang==='ar'
        ?'تم تحديث الموعد'
        :'Appointment updated'
    );

    window.ClinicNotifications?.refresh?.();
    C.route(C.currentPage);
  }


  async function reschedule(id,doctorId){
    const C=Clinic;

    C.showModal({
      title:C.lang==='ar'
        ?'إعادة جدولة'
        :'Reschedule',

      body:`
        <form
          id="rescheduleForm"
          class="form-grid"
        >
          <label>
            ${C.lang==='ar'
              ?'التاريخ الجديد'
              :'New date'}

            <input
              id="rescheduleDate"
              type="date"
              min="${C.cairoDate()}"
              value="${C.cairoDate()}"
              class="control"
              required
            >
          </label>

          <label>
            ${C.lang==='ar'?'الفترة':'Time interval'}

            <select
              id="rescheduleSlot"
              class="control"
              required
            ></select>
          </label>

          <label class="full-span">
            ${C.lang==='ar'?'السبب':'Reason'}

            <textarea
              id="rescheduleReason"
              class="control"
              required
            ></textarea>
          </label>

          <div class="form-actions full-span">
            <button class="primary-button compact">
              ${C.lang==='ar'?'تأكيد':'Confirm'}
            </button>
          </div>
        </form>
      `,

      onOpen:(root)=>{
        const date=root.querySelector('#rescheduleDate');
        const slot=root.querySelector('#rescheduleSlot');

        async function load(){
          const {data,error}=await C.sb.rpc(
            'frontend_get_hourly_slots',
            {
              p_doctor:doctorId,
              p_day:date.value
            }
          );

          slot.innerHTML=error
            ? `<option>${C.escape(error.message)}</option>`
            : `
                <option value="">—</option>
                ${(data||[])
                  .filter(x=>Number(x.remaining_capacity||0)>0)
                  .map(x=>`
                    <option value="${x.slot_start}|${x.slot_end}">
                      ${C.formatTime(x.slot_start)}
                      –
                      ${C.formatTime(x.slot_end)}
                      • ${x.remaining_capacity}/4 left
                    </option>
                  `).join('')}
              `;
        }

        date.onchange=load;
        load();

        root.querySelector('#rescheduleForm').onsubmit=async event=>{
          event.preventDefault();

          const parts=slot.value.split('|');
          const reason=
            root.querySelector('#rescheduleReason')
              .value
              .trim();

          if(parts.length!==2 || !reason){
            return;
          }

          const {error}=await C.sb.rpc(
            'frontend_reschedule_appointment',
            {
              p_id:id,
              p_start:parts[0],
              p_end:parts[1],
              p_reason:reason
            }
          );

          if(error){
            return C.toast(
              error.message,
              'error'
            );
          }

          C.closeModal();

          C.toast(
            C.lang==='ar'
              ?'تمت إعادة الجدولة'
              :'Appointment rescheduled'
          );

          C.route(C.currentPage);
        };
      }
    });
  }


  async function showAppointmentDetails(
    appointmentId,
    data,
    doctorOnly
  ){
    const C=Clinic;
    const a=data.appointments.find(x=>
      x.id===appointmentId
    );

    if(!a) return;

    const patient=data.patients.get(
      a.patient_id
    ) || {};

    const actions=statusActions[a.status]||[];

    C.showModal({
      title:C.lang==='ar'
        ?'تفاصيل الموعد'
        :'Appointment details',

      body:`
        <div class="appointment-detail-card">
          <div class="appointment-detail-patient">
            <span class="eyebrow">
              ${C.escape(
                patient.medical_record_number||
                a.appointment_number
              )}
            </span>

            <h3>
              ${C.escape(
                patient.english_name||
                patient.arabic_name||
                'Patient'
              )}
            </h3>

            <p class="muted">
              ${C.formatDate(a.scheduled_start)}
              •
              ${C.formatTime(a.scheduled_start)}
              –
              ${C.formatTime(a.scheduled_end)}
            </p>

            ${C.statusPill(a.status)}
          </div>

          ${C.isReception() && !doctorOnly
            ? `<div class="appointment-detail-actions">
                 ${actions.map(kind=>
                   kind==='reschedule'
                     ? `<button
                          class="secondary-button compact"
                          data-reschedule="1"
                        >
                          ${receptionActionLabel('reschedule')}
                        </button>`
                     : `<button
                          class="secondary-button compact"
                          data-appt-action="${kind}"
                        >
                          ${receptionActionLabel(kind)}
                        </button>`
                 ).join('')}
               </div>`
            : ''
          }
        </div>
      `,

      onOpen:(root)=>{
        root
          .querySelectorAll('[data-appt-action]')
          .forEach(button=>{
            button.onclick=async()=>{
              C.closeModal();
              await action(
                a.id,
                button.dataset.apptAction
              );
            };
          });

        root
          .querySelector('[data-reschedule]')
          ?.addEventListener(
            'click',
            ()=>{
              C.closeModal();
              reschedule(
                a.id,
                a.doctor_id
              );
            }
          );
      }
    });
  }


  async function renderAppointmentsPage({
    patientId=null,
    openBooking=false,
    doctorOnly=false
  }={}){
    const C=Clinic;

    C.setTitle(C.t('appointments'));
    await C.loadDoctors(true);

    const canBook=C.isReception() || doctorOnly;
    const defaultDoctor=doctorOnly
      ? C.user.id
      : (
          C.doctors[0]?.id||
          ''
        );

    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar appointment-first-toolbar">
        <div>
          <span class="eyebrow">
            ${doctorOnly
              ? (
                  C.lang==='ar'
                    ?'مواعيدي'
                    :'MY APPOINTMENTS'
                )
              : (
                  C.lang==='ar'
                    ?'الحجز'
                    :'BOOKING'
                )
            }
          </span>

          <h2>
            ${doctorOnly
              ? (
                  C.lang==='ar'
                    ?'مواعيدي'
                    :'My appointments'
                )
              : (
                  C.lang==='ar'
                    ?'المواعيد'
                    :'Appointments'
                )
            }
          </h2>

          <p class="muted">
            ${C.lang==='ar'
              ?'يمكنك التنقل بين جميع الأسابيع السابقة والقادمة أو الذهاب مباشرةً إلى أي تاريخ. كل ساعة تستوعب 4 مرضى.'
              :'Browse any past or future week, or jump directly to a date. Each one-hour slot accepts up to 4 patients.'}
          </p>
        </div>

        <div class="toolbar-actions appointment-calendar-controls">
          ${!doctorOnly
            ? `<select
                 id="calendarDoctor"
                 class="control"
               >
                 ${C.doctors.map(d=>`
                   <option value="${d.id}">
                     ${C.escape(d.display_name||d.username)}
                   </option>
                 `).join('')}
               </select>`
            : `<div class="selected-doctor-chip">
                 ${C.escape(
                   C.doctorName(C.user.id)
                 )}
               </div>`
          }

          <button
            id="calendarPrevious"
            class="secondary-button calendar-nav-button"
            type="button"
            title="${C.lang==='ar'?'الأسبوع السابق':'Previous week'}"
          >
            ${C.lang==='ar'?'← السابق':'← Previous'}
          </button>

          <button
            id="calendarToday"
            class="secondary-button calendar-nav-button"
            type="button"
          >
            ${C.lang==='ar'
              ?'الأسبوع الحالي'
              :'Current week'}
          </button>

          <button
            id="calendarNext"
            class="secondary-button calendar-nav-button"
            type="button"
            title="${C.lang==='ar'?'الأسبوع التالي':'Next week'}"
          >
            ${C.lang==='ar'?'التالي →':'Next →'}
          </button>

          <label class="calendar-jump-control">
            <span>
              ${C.lang==='ar'?'اذهب إلى':'Jump to'}
            </span>

            <input
              id="calendarJumpDate"
              type="date"
              class="control"
              value="${C.cairoDate()}"
            >
          </label>

          ${canBook
            ? `<button
                 id="newBooking"
                 class="primary-button compact"
               >
                 + ${C.lang==='ar'
                   ?'حجز جديد'
                   :'New booking'}
               </button>`
            : ''
          }

          ${C.hasRole('owner') && !doctorOnly
            ? `<button
                 id="resetAppointmentsTest"
                 class="danger-button compact"
               >
                 ${C.lang==='ar'
                   ?'إعادة ضبط المواعيد'
                   :'Reset appointments'}
               </button>`
            : ''
          }
        </div>
      </section>

      <section class="calendar-legend">
        <span>
          <i class="legend-dot available"></i>
          ${C.lang==='ar'?'متاح':'Available'}
        </span>

        <span>
          <i class="legend-dot booked"></i>
          ${C.lang==='ar'?'محجوز':'Booked'}
        </span>

        <span>
          <i class="legend-dot apology"></i>
          ${C.lang==='ar'?'اعتذار / غير متاح':'Apology / unavailable'}
        </span>
      </section>

      <div
        id="twoWeekScheduler"
        class="two-week-scheduler"
      >
        <div class="centered calendar-loading">
          <div class="loader"></div>
          <p class="muted">
            ${C.lang==='ar'
              ?'جاري تحميل الفترات...'
              :'Loading clinic intervals...'}
          </p>
        </div>
      </div>
    `;

    let anchor=C.cairoDate();
    let lastData=null;

    const doctorSelect=
      document.getElementById(
        'calendarDoctor'
      );

    async function refresh(){
      const doctorId=doctorOnly
        ? C.user.id
        : doctorSelect.value;

      const root=
        document.getElementById(
          'twoWeekScheduler'
        );

      if(!doctorId){
        root.innerHTML=`
          <div class="empty-state">
            ${C.lang==='ar'
              ?'اختر الطبيب.'
              :'Choose a doctor.'}
          </div>
        `;
        return;
      }

      root.innerHTML=`
        <div class="centered calendar-loading">
          <div class="loader"></div>
          <p class="muted">
            ${C.lang==='ar'
              ?'جاري تحميل الفترات...'
              :'Loading clinic intervals...'}
          </p>
        </div>
      `;

      try{
        lastData=await loadTwoWeekData(
          doctorId,
          anchor
        );

        const currentWeek=
          lastData.dates.slice(0,7);

        const nextWeek=
          lastData.dates.slice(7,14);

        root.innerHTML=`
          ${renderWeekBlock(
            `${C.formatDate(currentWeek[0])} – ${C.formatDate(currentWeek[6])}`,
            currentWeek,
            lastData,
            canBook,
            0
          )}

          ${renderWeekBlock(
            `${C.formatDate(nextWeek[0])} – ${C.formatDate(nextWeek[6])}`,
            nextWeek,
            lastData,
            canBook,
            7
          )}
        `;

        root
          .querySelectorAll('[data-book-slot]')
          .forEach(button=>{
            button.onclick=()=>showBookingModal({
              patientId,
              doctorId,
              date:button.dataset.date,
              slotStart:button.dataset.start,
              slotEnd:button.dataset.end
            });
          });

        root
          .querySelectorAll('[data-appointment-id]')
          .forEach(button=>{
            button.onclick=()=>showAppointmentDetails(
              button.dataset.appointmentId,
              lastData,
              doctorOnly
            );
          });
      }

      catch(error){
        root.innerHTML=`
          <div class="empty-state scheduler-error">
            <strong>
              ${C.lang==='ar'
                ?'تعذر تحميل جدول المواعيد.'
                :'Could not load appointment calendar.'}
            </strong>

            <span>
              ${C.escape(error.message)}
            </span>
          </div>
        `;
      }
    }

    if(doctorSelect){
      doctorSelect.value=
        defaultDoctor;

      doctorSelect.onchange=refresh;
    }

    document.getElementById('calendarPrevious').onclick=()=>{
      anchor=addDays(anchor,-7);
      document.getElementById('calendarJumpDate').value=anchor;
      refresh();
    };

    document.getElementById('calendarToday').onclick=()=>{
      anchor=C.cairoDate();
      document.getElementById('calendarJumpDate').value=anchor;
      refresh();
    };

    document.getElementById('calendarNext').onclick=()=>{
      anchor=addDays(anchor,7);
      document.getElementById('calendarJumpDate').value=anchor;
      refresh();
    };

    document.getElementById('calendarJumpDate').onchange=(event)=>{
      if(!event.target.value){
        return;
      }

      anchor=event.target.value;
      refresh();
    };

    document
      .getElementById('resetAppointmentsTest')
      ?.addEventListener(
        'click',
        async()=>{
          const phrase=prompt(
            C.lang==='ar'
              ?'هذا سيحذف كل بيانات المواعيد التجريبية مع سجل حالاتها والزيارات المرتبطة بها. لن يتم حذف المرضى أو جداول عمل الأطباء. اكتب RESET APPOINTMENTS للمتابعة.'
              :'This deletes all test appointment data, status history and appointment-linked clinical visits. Patients and doctor working schedules are preserved. Type RESET APPOINTMENTS to continue.'
          );

          if(phrase!=='RESET APPOINTMENTS'){
            return;
          }

          const {data,error}=await C.sb.rpc(
            'owner_reset_appointments_test_data',
            {
              p_confirmation:
                phrase
            }
          );

          if(error){
            return C.toast(
              error.message,
              'error'
            );
          }

          C.toast(
            C.lang==='ar'
              ?'تمت إعادة ضبط بيانات المواعيد التجريبية.'
              :'Test appointment data reset.'
          );

          window.ClinicNotifications?.refresh?.();
          refresh();
        }
      );


    document
      .getElementById('newBooking')
      ?.addEventListener(
        'click',
        ()=>{
          const doctorId=doctorOnly
            ? C.user.id
            : doctorSelect.value;

          C.toast(
            C.lang==='ar'
              ?'اختر فترة زمنية متاحة من الجدول للحجز.'
              :'Choose an available time interval from the calendar to book.'
          );

          document
            .querySelector('.available-slot:not(:disabled)')
            ?.scrollIntoView({
              behavior:'smooth',
              block:'center'
            });
        }
      );

    await refresh();

    if(openBooking && patientId){
      C.toast(
        C.lang==='ar'
          ?'اختر فترة متاحة لإكمال الحجز لهذا المريض.'
          :'Choose an available interval to complete this patient booking.'
      );
    }
  }


  window.ClinicPages['appointments']=
    params=>renderAppointmentsPage({
      ...(params||{}),
      doctorOnly:false
    });


  window.ClinicPages['doctor-appointments']=
    params=>renderAppointmentsPage({
      ...(params||{}),
      doctorOnly:true
    });


  function doctorClinicStatusCounts(appts=[]){
    return {
      total:
        appts.filter(x=>
          !['cancelled','rescheduled'].includes(x.status)
        ).length,

      arrived:
        appts.filter(x=>x.status==='arrived').length,

      waiting:
        appts.filter(x=>x.status==='waiting').length,

      withDoctor:
        appts.filter(x=>x.status==='with_doctor').length,

      completed:
        appts.filter(x=>x.status==='completed').length
    };
  }


  function renderDoctorClinicDay({
    date,
    slots,
    appointments,
    patients,
    isTomorrow=false
  }){
    const C=Clinic;

    const activeAppointments=
      (appointments||[])
        .filter(x=>
          !['cancelled','rescheduled'].includes(x.status)
        );

    const counts=
      doctorClinicStatusCounts(
        activeAppointments
      );

    const matchedIds=
      new Set();

    const slotCards=(slots||[]).map(slot=>{

      const hourPatients=
        activeAppointments
          .filter(a=>
            new Date(a.scheduled_start)
              < new Date(slot.slot_end)
            &&
            new Date(a.scheduled_end)
              > new Date(slot.slot_start)
          )
          .sort(
            (a,b)=>
              new Date(a.created_at||a.scheduled_start)
              -
              new Date(b.created_at||b.scheduled_start)
          );

      hourPatients.forEach(
        a=>matchedIds.add(a.id)
      );

      return `
        <article class="doctor-clinic-hour">
          <header>
            <div>
              <strong>
                ${C.formatTime(slot.slot_start)}
                –
                ${C.formatTime(slot.slot_end)}
              </strong>

              <small>
                ${hourPatients.length}/4
                ${C.lang==='ar'
                  ?'مرضى'
                  :'patients'}
              </small>
            </div>

            <span class="clinic-capacity ${
              hourPatients.length>=4
                ? 'full'
                : 'open'
            }">
              ${hourPatients.length>=4
                ? (
                    C.lang==='ar'
                      ?'ممتلئ'
                      :'Full'
                  )
                : `${4-hourPatients.length} ${
                    C.lang==='ar'
                      ?'متبقي'
                      :'left'
                  }`
              }
            </span>
          </header>

          <div class="doctor-clinic-patients">
            ${hourPatients.length
              ? hourPatients.map(a=>{
                  const p=
                    patients.get(a.patient_id)||{};

                  return `
                    <button
                      class="doctor-clinic-patient"
                      data-doctor-home-patient="${a.patient_id}"
                      type="button"
                    >
                      <span class="doctor-clinic-patient-main">
                        <strong>
                          ${C.escape(
                            p.english_name||
                            p.arabic_name||
                            'Patient'
                          )}
                        </strong>

                        <small>
                          ${C.escape(
                            p.medical_record_number||
                            ''
                          )}
                        </small>
                      </span>

                      ${C.statusPill(a.status)}
                    </button>
                  `;
                }).join('')

              : `<div class="doctor-clinic-empty-hour">
                   ${C.lang==='ar'
                     ?'لا يوجد مرضى محجوزون في هذه الساعة.'
                     :'No patients booked in this hour.'}
                 </div>`
            }
          </div>
        </article>
      `;
    });


    const legacyAppointments=
      activeAppointments
        .filter(a=>!matchedIds.has(a.id));


    return `
      <section class="content-card doctor-clinic-day-card ${
        isTomorrow
          ? 'tomorrow-clinic-card'
          : 'today-clinic-card'
      }">
        <div class="section-head doctor-clinic-section-head">
          <div>
            <span class="eyebrow">
              ${isTomorrow
                ? (
                    C.lang==='ar'
                      ?'غداً'
                      :'TOMORROW'
                  )
                : (
                    C.lang==='ar'
                      ?'اليوم'
                      :'TODAY'
                  )
              }
            </span>

            <h3>
              ${isTomorrow
                ? (
                    C.lang==='ar'
                      ?'عيادة الغد'
                      :"Tomorrow's clinic"
                  )
                : (
                    C.lang==='ar'
                      ?'عيادة اليوم'
                      :"Today's clinic"
                  )
              }
            </h3>

            <p class="muted">
              ${weekdayName(date)}
              •
              ${C.formatDate(date)}
            </p>
          </div>

          <div class="doctor-clinic-stats">
            <span>
              <b>${counts.total}</b>
              ${C.lang==='ar'
                ?'حجز'
                :'booked'}
            </span>

            ${!isTomorrow
              ? `
                  <span>
                    <b>${counts.waiting}</b>
                    ${C.lang==='ar'
                      ?'انتظار'
                      :'waiting'}
                  </span>

                  <span>
                    <b>${counts.completed}</b>
                    ${C.lang==='ar'
                      ?'مكتمل'
                      :'completed'}
                  </span>
                `
              : ''
            }
          </div>
        </div>

        ${(slots||[]).length
          ? `<div class="doctor-clinic-hours">
               ${slotCards.join('')}
             </div>`

          : activeAppointments.length
            ? ''
            : `<div class="empty-state">
                 ${isTomorrow
                   ? (
                       C.lang==='ar'
                         ?'لا توجد عيادة مجدولة غداً.'
                         :'No clinic is scheduled tomorrow.'
                     )
                   : (
                       C.lang==='ar'
                         ?'لا توجد عيادة مجدولة اليوم.'
                         :'No clinic is scheduled today.'
                     )
                 }
               </div>`
        }

        ${legacyAppointments.length
          ? `
              <div class="legacy-clinic-appointments">
                <strong>
                  ${C.lang==='ar'
                    ?'حجوزات إضافية'
                    :'Other appointments'}
                </strong>

                ${legacyAppointments.map(a=>{
                  const p=
                    patients.get(a.patient_id)||{};

                  return `
                    <button
                      class="doctor-clinic-patient"
                      data-doctor-home-patient="${a.patient_id}"
                    >
                      <span class="doctor-clinic-patient-main">
                        <strong>
                          ${C.escape(
                            p.english_name||
                            p.arabic_name||
                            'Patient'
                          )}
                        </strong>

                        <small>
                          ${C.formatTime(a.scheduled_start)}
                          •
                          ${C.escape(
                            p.medical_record_number||
                            ''
                          )}
                        </small>
                      </span>

                      ${C.statusPill(a.status)}
                    </button>
                  `;
                }).join('')}
              </div>
            `
          : ''
        }
      </section>
    `;
  }


  window.ClinicPages['today-clinic']=async function(){
    const C=Clinic;

    if(!C.isDoctor()){
      return C.route('dashboard');
    }

    C.setTitle(
      C.lang==='ar'
        ?'عيادة اليوم'
        :"Today's Clinic"
    );

    const today=
      C.cairoDate();

    const tomorrow=
      addDays(
        today,
        1
      );


    const [
      todaySlotResult,
      tomorrowSlotResult,
      todayAppointments,
      tomorrowAppointments
    ] = await Promise.all([

      C.sb.rpc(
        'frontend_get_hourly_slots',
        {
          p_doctor:
            C.user.id,

          p_day:
            today
        }
      ),

      C.sb.rpc(
        'frontend_get_hourly_slots',
        {
          p_doctor:
            C.user.id,

          p_day:
            tomorrow
        }
      ),

      fetchRangeAppointments({
        doctorId:
          C.user.id,

        from:
          today,

        to:
          today
      }),

      fetchRangeAppointments({
        doctorId:
          C.user.id,

        from:
          tomorrow,

        to:
          tomorrow
      })
    ]);


    const todaySlots=
      todaySlotResult.error
        ? []
        : (todaySlotResult.data||[]);

    const tomorrowSlots=
      tomorrowSlotResult.error
        ? []
        : (tomorrowSlotResult.data||[]);


    const patients=
      await attachPatientNames([
        ...(todayAppointments||[]),
        ...(tomorrowAppointments||[])
      ]);


    // The "Today's clinic" part remains the doctor's active home
    // until TWO HOURS after the last clinic hour / appointment.
    const activeTodayAppointments=
      (todayAppointments||[])
        .filter(a=>
          !['cancelled','rescheduled'].includes(a.status)
        );

    const endCandidates=[
      ...todaySlots.map(x=>x.slot_end),
      ...activeTodayAppointments.map(x=>x.scheduled_end)
    ]
      .filter(Boolean)
      .map(x=>new Date(x).getTime())
      .filter(Number.isFinite);


    const clinicEndMs=
      endCandidates.length
        ? Math.max(...endCandidates)
        : null;

    const graceEndMs=
      clinicEndMs
        ? clinicEndMs + (2*60*60*1000)
        : null;

    const nowMs=
      Date.now();

    const showTodayAsActive=
      graceEndMs!==null
        ? nowMs <= graceEndMs
        : false;


    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar doctor-home-toolbar">
        <div>
          <span class="eyebrow">
            ${showTodayAsActive
              ? (
                  C.lang==='ar'
                    ?'العيادة الحالية'
                    :'DOCTOR HOME'
                )
              : (
                  C.lang==='ar'
                    ?'العيادة القادمة'
                    :'NEXT CLINIC'
                )
            }
          </span>

          <h2>
            ${showTodayAsActive
              ? (
                  C.lang==='ar'
                    ?'عيادة اليوم'
                    :"Today's clinic"
                )
              : (
                  C.lang==='ar'
                    ?'عيادة الغد'
                    :"Tomorrow's clinic"
                )
            }
          </h2>

          <p class="muted">
            ${showTodayAsActive && clinicEndMs
              ? (
                  C.lang==='ar'
                    ? `تظل عيادة اليوم الصفحة الرئيسية حتى ساعتين بعد نهاية العيادة (${C.formatTime(new Date(clinicEndMs))}).`
                    : `Today's clinic remains your home until 2 hours after clinic end (${C.formatTime(new Date(clinicEndMs))}).`
                )
              : (
                  C.lang==='ar'
                    ?'انتهت نافذة عيادة اليوم؛ عيادة الغد معروضة الآن.'
                    :"Today's clinic window has ended; tomorrow's clinic is now in focus."
                )
            }
          </p>
        </div>

        <div class="toolbar-actions">
          <button
            id="doctorHomeQueue"
            class="primary-button compact"
          >
            ${C.lang==='ar'
              ?'قائمة الانتظار'
              :'My Queue'}
          </button>

          <button
            id="doctorHomeAppointments"
            class="secondary-button"
          >
            ${C.lang==='ar'
              ?'كل المواعيد'
              :'Appointments'}
          </button>
        </div>
      </section>


      ${showTodayAsActive
        ? renderDoctorClinicDay({
            date:
              today,

            slots:
              todaySlots,

            appointments:
              todayAppointments||[],

            patients,
            isTomorrow:
              false
          })

        : `
            <section class="content-card clinic-ended-card">
              <div>
                <span>✓</span>

                <div>
                  <strong>
                    ${C.lang==='ar'
                      ?'انتهت عيادة اليوم'
                      :"Today's clinic has ended"}
                  </strong>

                  <small>
                    ${clinicEndMs
                      ? (
                          C.lang==='ar'
                            ? `انتهت في ${C.formatTime(new Date(clinicEndMs))}، وانتهت فترة الساعتين الإضافيتين.`
                            : `Clinic ended at ${C.formatTime(new Date(clinicEndMs))}; the 2-hour grace period has also ended.`
                        )
                      : (
                          C.lang==='ar'
                            ?'لا توجد عيادة مسجلة اليوم.'
                            :'No clinic was scheduled today.'
                        )
                    }
                  </small>
                </div>
              </div>
            </section>
          `
      }


      ${renderDoctorClinicDay({
        date:
          tomorrow,

        slots:
          tomorrowSlots,

        appointments:
          tomorrowAppointments||[],

        patients,
        isTomorrow:
          true
      })}
    `;


    document
      .getElementById('doctorHomeQueue')
      .onclick=
        ()=>C.route('queue');


    document
      .getElementById('doctorHomeAppointments')
      .onclick=
        ()=>C.route('doctor-appointments');


    document
      .querySelectorAll(
        '[data-doctor-home-patient]'
      )
      .forEach(button=>{

        button.onclick=()=>C.route(
          'patient-detail',
          {
            patientId:
              button.dataset.doctorHomePatient
          }
        );

      });
  };


  window.ClinicPages['reception']=async function(){
    const C=Clinic;

    if(!C.isReception()){
      return C.route('dashboard');
    }

    C.setTitle(C.t('reception'));
    await C.loadDoctors(true);

    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar">
        <div>
          <span class="eyebrow">
            ${C.lang==='ar'?'اليوم':'TODAY'}
          </span>

          <h2>
            ${C.lang==='ar'
              ?'مكتب الاستقبال'
              :'Reception Desk'}
          </h2>
        </div>

        <button
          id="receptionBook"
          class="primary-button compact"
        >
          + ${C.lang==='ar'
            ?'حجز'
            :'Booking'}
        </button>
      </section>

      <section class="content-card">
        <div class="filter-row">
          <input
            id="receptionDate"
            type="date"
            value="${C.cairoDate()}"
            class="control"
          >

          <select
            id="receptionDoctor"
            class="control"
          >
            <option value="">
              ${C.lang==='ar'
                ?'كل الأطباء'
                :'All doctors'}
            </option>

            ${C.doctors.map(d=>`
              <option value="${d.id}">
                ${C.escape(d.display_name||d.username)}
              </option>
            `).join('')}
          </select>

          <button
            id="refreshReception"
            class="secondary-button"
          >
            ${C.lang==='ar'
              ?'تحديث'
              :'Refresh'}
          </button>
        </div>

        <div
          id="receptionArea"
          class="space-top"
        ></div>
      </section>
    `;

    async function refresh(){
      const date=
        document.getElementById(
          'receptionDate'
        ).value;

      const doctor=
        document.getElementById(
          'receptionDoctor'
        ).value||null;

      const start=`${date}T00:00:00+03:00`;
      const end=`${date}T23:59:59+03:00`;

      let q=C.sb
        .from('appointments')
        .select('*')
        .gte('scheduled_start',start)
        .lte('scheduled_start',end)
        .order('scheduled_start');

      if(doctor){
        q=q.eq('doctor_id',doctor);
      }

      const {data:appts,error}=await q;

      if(error){
        return C.toast(
          error.message,
          'error'
        );
      }

      const pm=await attachPatientNames(
        appts||[]
      );

      const area=
        document.getElementById(
          'receptionArea'
        );

      area.innerHTML=(appts||[]).length
        ? `<div class="stack-list">
            ${(appts||[]).map(a=>{
              const p=pm.get(a.patient_id)||{};
              const acts=statusActions[a.status]||[];

              return `
                <article class="reception-card">
                  <div class="reception-time">
                    ${C.formatTime(a.scheduled_start)}
                  </div>

                  <div class="reception-main">
                    <strong>
                      ${C.escape(
                        p.english_name||
                        p.arabic_name||
                        'Patient'
                      )}
                    </strong>

                    <span>
                      ${C.escape(
                        p.medical_record_number||
                        ''
                      )}
                      •
                      ${C.escape(
                        C.doctorName(a.doctor_id)
                      )}
                    </span>
                  </div>

                  <div>
                    ${C.statusPill(a.status)}
                  </div>

                  <div class="reception-actions">
                    ${acts.map(kind=>
                      kind==='reschedule'
                        ? `<button
                             class="table-action"
                             data-reschedule="${a.id}"
                             data-doctor="${a.doctor_id}"
                           >
                             ${receptionActionLabel('reschedule')}
                           </button>`
                        : `<button
                             class="table-action"
                             data-action="${kind}"
                             data-id="${a.id}"
                           >
                             ${receptionActionLabel(kind)}
                           </button>`
                    ).join('')}
                  </div>
                </article>
              `;
            }).join('')}
          </div>`

        : `<div class="empty-state">
             ${C.lang==='ar'
               ?'لا توجد مواعيد في هذا اليوم.'
               :'No appointments for this day.'}
           </div>`;

      area
        .querySelectorAll('[data-action]')
        .forEach(button=>{
          button.onclick=()=>action(
            button.dataset.id,
            button.dataset.action
          );
        });

      area
        .querySelectorAll('[data-reschedule]')
        .forEach(button=>{
          button.onclick=()=>reschedule(
            button.dataset.reschedule,
            button.dataset.doctor
          );
        });
    }

    document
      .getElementById('refreshReception')
      .onclick=refresh;

    document
      .getElementById('receptionDate')
      .onchange=refresh;

    document
      .getElementById('receptionDoctor')
      .onchange=refresh;

    document
      .getElementById('receptionBook')
      .onclick=()=>C.route('appointments');

    refresh();
  };
})();
