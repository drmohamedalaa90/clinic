(function(){
  const clinicWeekOrder=[6,7,1,2,3,4,5];

  const weekdayNames={
    en:{
      1:'Monday',
      2:'Tuesday',
      3:'Wednesday',
      4:'Thursday',
      5:'Friday',
      6:'Saturday',
      7:'Sunday'
    },
    ar:{
      1:'الاثنين',
      2:'الثلاثاء',
      3:'الأربعاء',
      4:'الخميس',
      5:'الجمعة',
      6:'السبت',
      7:'الأحد'
    }
  };

  function weekdayLabel(day){
    return weekdayNames[Clinic.lang][Number(day)] || day;
  }

  function weekdayOptions(){
    return clinicWeekOrder
      .map(day=>`
        <option value="${day}">
          ${weekdayLabel(day)}
        </option>
      `)
      .join('');
  }

  function sortClinicWeek(rows=[]){
    const rank=new Map(
      clinicWeekOrder.map(
        (day,index)=>[day,index]
      )
    );

    return [...rows].sort((a,b)=>{
      const dayDiff=
        (rank.get(Number(a.weekday))??99)-
        (rank.get(Number(b.weekday))??99);

      if(dayDiff!==0){
        return dayDiff;
      }

      return String(a.start_time||'')
        .localeCompare(
          String(b.start_time||'')
        );
    });
  }

  async function getHours(doctorId){
    const {data,error}=await Clinic.sb.rpc(
      'frontend_get_doctor_working_hours',
      {p_doctor:doctorId}
    );

    if(error) throw error;

    return data||[];
  }

  async function getExceptions(
    doctorId,
    from=Clinic.cairoDate(),
    to=null
  ){
    const {data,error}=await Clinic.sb.rpc(
      'frontend_get_doctor_schedule_exceptions',
      {
        p_doctor:doctorId,
        p_from:from,
        p_to:to
      }
    );

    if(error) throw error;

    return data||[];
  }

  async function renderScheduleRows(
    doctorId,
    editable=false
  ){
    try{
      const data=await getHours(doctorId);

      if(!data.length){
        return `
          <div class="empty-state schedule-empty-state">
            <strong>
              ${Clinic.lang==='ar'
                ?'لا توجد ساعات عمل محفوظة لهذا الطبيب.'
                :'No working hours are saved for this doctor.'}
            </strong>

            <span>
              ${Clinic.lang==='ar'
                ?'يمكن للإدارة إضافتها من زر ساعات العمل.'
                :'Management can add them using Working hours.'}
            </span>
          </div>
        `;
      }

      return `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>${Clinic.lang==='ar'?'اليوم':'Day'}</th>
                <th>${Clinic.lang==='ar'?'من':'From'}</th>
                <th>${Clinic.lang==='ar'?'إلى':'To'}</th>
                <th>${Clinic.lang==='ar'?'مدة الحجز':'Slot'}</th>
                <th>${Clinic.lang==='ar'?'ساري':'Effective'}</th>
                <th>${Clinic.lang==='ar'?'الحالة':'Status'}</th>
                ${editable?'<th></th>':''}
              </tr>
            </thead>

            <tbody>
              ${sortClinicWeek(data).map(row=>`
                <tr>
                  <td>
                    <strong>
                      ${weekdayLabel(row.weekday)}
                    </strong>
                  </td>

                  <td>
                    ${row.start_time?.slice(0,5)||'—'}
                  </td>

                  <td>
                    ${row.end_time?.slice(0,5)||'—'}
                  </td>

                  <td>
                    ${Clinic.lang==='ar'?'4 مرضى / ساعة':'4 patients / hour'}
                  </td>

                  <td>
                    ${Clinic.formatDate(row.effective_from)}
                    ${row.effective_until
                      ? ` → ${Clinic.formatDate(row.effective_until)}`
                      : ''
                    }
                  </td>

                  <td>
                    ${row.is_active===false
                      ? Clinic.statusPill('inactive')
                      : Clinic.statusPill('active')
                    }
                  </td>

                  ${editable
                    ? `<td>
                         <button
                           class="table-action danger-outline"
                           data-toggle-hours="${row.id}"
                           data-active="${row.is_active!==false}"
                         >
                           ${row.is_active===false
                             ? (
                                 Clinic.lang==='ar'
                                   ?'تفعيل'
                                   :'Activate'
                               )
                             : (
                                 Clinic.lang==='ar'
                                   ?'تعطيل'
                                   :'Disable'
                               )
                           }
                         </button>
                       </td>`
                    : ''
                  }
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    catch(error){
      return `
        <div class="empty-state scheduler-error">
          <strong>
            ${Clinic.lang==='ar'
              ?'تعذر تحميل ساعات العمل.'
              :'Could not load working hours.'}
          </strong>

          <span>
            ${Clinic.escape(error.message)}
          </span>

          <small>
            ${Clinic.lang==='ar'
              ?'تأكد من تشغيل ملف appointment-first-scheduler.sql.'
              :'Make sure appointment-first-scheduler.sql was run in Supabase.'}
          </small>
        </div>
      `;
    }
  }


  async function renderExceptions(
    doctorId,
    management=false
  ){
    try{
      const data=await getExceptions(
        doctorId,
        Clinic.cairoDate(),
        null
      );

      if(!data.length){
        return `
          <div class="empty-state">
            ${Clinic.lang==='ar'
              ?'لا توجد تغييرات قادمة.'
              :'No upcoming schedule exceptions.'}
          </div>
        `;
      }

      return `
        <div class="stack-list">
          ${data.map(x=>`
            <article class="list-card">
              <div>
                <div class="list-title">
                  ${Clinic.escape(
                    (x.exception_type||'')
                      .replaceAll('_',' ')
                  )}
                </div>

                <div class="muted">
                  ${Clinic.formatDate(x.exception_date)}

                  ${x.is_all_day
                    ? ' • all day'
                    : `
                        ${x.start_time?.slice(0,5)||''}
                        ${x.end_time
                          ? ` → ${x.end_time.slice(0,5)}`
                          : ''
                        }
                      `
                  }
                </div>

                ${x.note
                  ? `<div class="small-note">
                       ${Clinic.escape(x.note)}
                     </div>`
                  : ''
                }
              </div>

              <div class="list-actions">
                ${Clinic.statusPill(x.status)}

                ${management && x.status==='pending'
                  ? `
                      <button
                        class="table-action success-outline"
                        data-review-exception="${x.id}"
                        data-action="approved"
                      >
                        ✓
                      </button>

                      <button
                        class="table-action danger-outline"
                        data-review-exception="${x.id}"
                        data-action="rejected"
                      >
                        ✕
                      </button>
                    `
                  : ''
                }
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

    catch(error){
      return `
        <div class="empty-state scheduler-error">
          <strong>
            ${Clinic.lang==='ar'
              ?'تعذر تحميل تغييرات الجدول.'
              :'Could not load schedule exceptions.'}
          </strong>

          <span>
            ${Clinic.escape(error.message)}
          </span>
        </div>
      `;
    }
  }


  window.ClinicPages['schedules']=async function(){
    const C=Clinic;

    if(!C.isManagement()){
      return C.route('my-schedule');
    }

    C.setTitle(C.t('schedules'));
    await C.loadDoctors(true);

    const docs=C.doctors;

    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar">
        <div>
          <span class="eyebrow">
            ${C.lang==='ar'?'الإدارة':'MANAGEMENT'}
          </span>

          <h2>
            ${C.lang==='ar'
              ?'إدارة جداول الأطباء'
              :'Doctor schedule management'}
          </h2>

          <p class="muted">
            ${C.lang==='ar'
              ?'ساعات العمل الأساسية والتغييرات حسب التاريخ.'
              :'Regular hours and date-specific exceptions.'}
          </p>
        </div>

        <div class="toolbar-actions">
          <select
            id="scheduleDoctor"
            class="control"
          >
            ${docs.map(d=>`
              <option value="${d.id}">
                ${C.escape(
                  d.display_name||
                  d.username
                )}
              </option>
            `).join('')}
          </select>

          <button
            id="addWorkingHours"
            class="primary-button compact"
          >
            + ${C.lang==='ar'
              ?'ساعات عمل'
              :'Working hours'}
          </button>

          <button
            id="addException"
            class="secondary-button"
          >
            + ${C.lang==='ar'
              ?'تغيير / اعتذار'
              :'Exception'}
          </button>
        </div>
      </section>

      <section class="content-card">
        <div class="section-head">
          <h3>
            ${C.lang==='ar'
              ?'الساعات الأسبوعية'
              :'Weekly hours'}
          </h3>
        </div>

        <div id="workingHoursArea">
          <div class="centered compact-loading">
            <div class="loader"></div>
          </div>
        </div>
      </section>

      <section class="content-card">
        <div class="section-head">
          <h3>
            ${C.lang==='ar'
              ?'التغييرات القادمة'
              :'Upcoming exceptions'}
          </h3>
        </div>

        <div id="exceptionsArea">
          <div class="centered compact-loading">
            <div class="loader"></div>
          </div>
        </div>
      </section>
    `;

    const doctorSelect=
      document.getElementById(
        'scheduleDoctor'
      );

    async function refresh(){
      const doctorId=doctorSelect.value;

      const [hours,exceptions]=
        await Promise.all([
          renderScheduleRows(
            doctorId,
            true
          ),
          renderExceptions(
            doctorId,
            true
          )
        ]);

      document
        .getElementById(
          'workingHoursArea'
        )
        .innerHTML=hours;

      document
        .getElementById(
          'exceptionsArea'
        )
        .innerHTML=exceptions;

      bindRowActions();
    }

    function bindRowActions(){
      document
        .querySelectorAll(
          '[data-toggle-hours]'
        )
        .forEach(button=>{
          button.onclick=async()=>{
            const active=
              button.dataset.active==='true';

            const {error}=await C.sb.rpc(
              'frontend_set_working_hours_active',
              {
                p_id:
                  button.dataset.toggleHours,
                p_active:
                  !active
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
                ?'تم تحديث الجدول'
                :'Schedule updated'
            );

            refresh();
          };
        });

      document
        .querySelectorAll(
          '[data-review-exception]'
        )
        .forEach(button=>{
          button.onclick=async()=>{
            const {error}=await C.sb.rpc(
              'frontend_review_schedule_exception',
              {
                p_id:
                  button.dataset.reviewException,
                p_action:
                  button.dataset.action
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
                ?'تم تحديث الطلب'
                :'Request updated'
            );

            window.ClinicNotifications
              ?.refresh?.();

            refresh();
          };
        });
    }

    doctorSelect.onchange=refresh;


    document
      .getElementById('addWorkingHours')
      .onclick=()=>C.showModal({
        title:C.lang==='ar'
          ?'إضافة ساعات عمل'
          :'Add working hours',

        body:`
          <form
            id="workingHoursForm"
            class="form-grid"
          >
            <label>
              ${C.lang==='ar'?'اليوم':'Weekday'}
              <select
                name="weekday"
                class="control"
              >
                ${weekdayOptions()}
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'من':'Start'}
              <input
                name="start_time"
                type="time"
                class="control"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'?'إلى':'End'}
              <input
                name="end_time"
                type="time"
                class="control"
                required
              >
            </label>

            <div class="capacity-rule-card">
              <span>${C.lang==='ar'?'نظام الحجز':'Booking rule'}</span>
              <strong>${C.lang==='ar'?'كل ساعة = 4 مرضى':'Each hour = 4 patients'}</strong>
            </div>

            <label>
              ${C.lang==='ar'
                ?'ساري من'
                :'Effective from'}

              <input
                name="effective_from"
                type="date"
                value="${C.cairoDate()}"
                class="control"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'?'حتى':'Effective until'}
              <input
                name="effective_until"
                type="date"
                class="control"
              >
            </label>

            <label class="full-span">
              ${C.lang==='ar'?'ملاحظات':'Notes'}
              <textarea
                name="notes"
                class="control"
              ></textarea>
            </label>

            <div class="form-actions full-span">
              <button
                class="primary-button compact"
                type="submit"
              >
                ${C.lang==='ar'?'حفظ':'Save'}
              </button>
            </div>
          </form>
        `,

        onOpen:(root)=>{
          root
            .querySelector('#workingHoursForm')
            .onsubmit=async event=>{
              event.preventDefault();

              const f=new FormData(
                event.currentTarget
              );

              const {error}=await C.sb.rpc(
                'frontend_save_working_hours',
                {
                  p_doctor:
                    doctorSelect.value,

                  p_weekday:
                    Number(
                      f.get('weekday')
                    ),

                  p_start:
                    f.get('start_time'),

                  p_end:
                    f.get('end_time'),

                  p_slot_minutes:60,

                  p_effective_from:
                    f.get('effective_from'),

                  p_effective_until:
                    f.get('effective_until')||null,

                  p_notes:
                    f.get('notes')||null
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
                  ?'تم حفظ ساعات العمل'
                  :'Working hours saved'
              );

              refresh();
            };
        }
      });


    document
      .getElementById('addException')
      .onclick=()=>C.showModal({
        title:C.lang==='ar'
          ?'تغيير على الجدول'
          :'Schedule exception',

        body:`
          <form
            id="exceptionForm"
            class="form-grid"
          >
            <label>
              ${C.lang==='ar'?'النوع':'Type'}

              <select
                name="exception_type"
                class="control"
              >
                <option value="apology">
                  Apology
                </option>

                <option value="vacation">
                  Vacation
                </option>

                <option value="emergency_cancellation">
                  Emergency cancellation
                </option>

                <option value="extra_clinic">
                  Extra clinic
                </option>

                <option value="blocked_period">
                  Blocked period
                </option>

                <option value="changed_hours">
                  Changed hours
                </option>
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'التاريخ':'Date'}

              <input
                name="exception_date"
                type="date"
                value="${C.cairoDate()}"
                class="control"
                required
              >
            </label>

            <label class="inline-check">
              <input
                name="is_all_day"
                type="checkbox"
                checked
              >
              ${C.lang==='ar'
                ?'طوال اليوم'
                :'All day'}
            </label>

            <label>
              ${C.lang==='ar'?'من':'Start'}

              <input
                name="start_time"
                type="time"
                class="control"
              >
            </label>

            <label>
              ${C.lang==='ar'?'إلى':'End'}

              <input
                name="end_time"
                type="time"
                class="control"
              >
            </label>

            <div class="capacity-rule-card">
              <span>${C.lang==='ar'?'نظام الحجز':'Booking rule'}</span>
              <strong>${C.lang==='ar'?'كل ساعة = 4 مرضى':'Each hour = 4 patients'}</strong>
            </div>

            <label class="full-span">
              ${C.lang==='ar'?'ملاحظة':'Note'}

              <textarea
                name="note"
                class="control"
              ></textarea>
            </label>

            <div class="form-actions full-span">
              <button
                class="primary-button compact"
              >
                ${C.lang==='ar'
                  ?'حفظ واعتماد'
                  :'Save & approve'}
              </button>
            </div>
          </form>
        `,

        onOpen:(root)=>{
          root
            .querySelector('#exceptionForm')
            .onsubmit=async event=>{
              event.preventDefault();

              const f=new FormData(
                event.currentTarget
              );

              const all=
                f.get('is_all_day')==='on';

              const type=
                f.get('exception_type');

              const {error}=await C.sb.rpc(
                'frontend_save_schedule_exception',
                {
                  p_doctor:
                    doctorSelect.value,

                  p_date:
                    f.get('exception_date'),

                  p_type:
                    type,

                  p_all_day:
                    all,

                  p_start:
                    all
                      ? null
                      : (
                          f.get('start_time')||
                          null
                        ),

                  p_end:
                    all
                      ? null
                      : (
                          f.get('end_time')||
                          null
                        ),

                  p_slot_minutes:
                    ['extra_clinic','changed_hours']
                      .includes(type)
                        ? 60
                        : null,

                  p_note:
                    f.get('note')||null
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
                  ?'تم حفظ التغيير'
                  :'Exception saved'
              );

              window.ClinicNotifications
                ?.refresh?.();

              refresh();
            };
        }
      });

    refresh();
  };


  window.ClinicPages['my-schedule']=async function(){
    const C=Clinic;

    C.setTitle(C.t('mySchedule'));

    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar">
        <div>
          <span class="eyebrow">
            ${C.lang==='ar'
              ?'جدولي'
              :'MY SCHEDULE'}
          </span>

          <h2>
            ${C.lang==='ar'
              ?'ساعات العمل والطلبات'
              :'Working hours & requests'}
          </h2>
        </div>

        <button
          id="requestException"
          class="primary-button compact"
        >
          + ${C.lang==='ar'
            ?'طلب تغيير / اعتذار'
            :'Request change'}
        </button>
      </section>

      <section class="content-card">
        <h3>
          ${C.lang==='ar'
            ?'الساعات الأسبوعية'
            :'Weekly hours'}
        </h3>

        <div
          id="myHours"
          class="space-top"
        ></div>
      </section>

      <section class="content-card">
        <h3>
          ${C.lang==='ar'
            ?'التغييرات والطلبات القادمة'
            :'Upcoming changes & requests'}
        </h3>

        <div
          id="myExceptions"
          class="space-top"
        ></div>
      </section>
    `;

    async function refresh(){
      const [hours,exceptions]=
        await Promise.all([
          renderScheduleRows(
            C.user.id,
            false
          ),
          renderExceptions(
            C.user.id,
            false
          )
        ]);

      document
        .getElementById('myHours')
        .innerHTML=hours;

      document
        .getElementById('myExceptions')
        .innerHTML=exceptions;
    }

    document
      .getElementById('requestException')
      .onclick=()=>C.showModal({
        title:C.lang==='ar'
          ?'طلب تغيير الجدول'
          :'Request schedule change',

        body:`
          <form
            id="doctorExceptionForm"
            class="form-grid"
          >
            <label>
              ${C.lang==='ar'?'النوع':'Type'}

              <select
                name="exception_type"
                class="control"
              >
                <option value="apology">Apology</option>
                <option value="vacation">Vacation</option>
                <option value="emergency_cancellation">Emergency cancellation</option>
                <option value="extra_clinic">Extra clinic</option>
                <option value="blocked_period">Blocked period</option>
                <option value="changed_hours">Changed hours</option>
              </select>
            </label>

            <label>
              ${C.lang==='ar'?'التاريخ':'Date'}

              <input
                name="exception_date"
                type="date"
                min="${C.cairoDate()}"
                class="control"
                required
              >
            </label>

            <label class="inline-check">
              <input
                name="is_all_day"
                type="checkbox"
                checked
              >
              ${C.lang==='ar'
                ?'طوال اليوم'
                :'All day'}
            </label>

            <label>
              ${C.lang==='ar'?'من':'Start'}
              <input
                name="start_time"
                type="time"
                class="control"
              >
            </label>

            <label>
              ${C.lang==='ar'?'إلى':'End'}
              <input
                name="end_time"
                type="time"
                class="control"
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'مدة الموعد'
                :'Slot minutes'}

              <input
                name="slot_minutes"
                type="number"
                value="15"
                class="control"
              >
            </label>

            <label class="full-span">
              ${C.lang==='ar'
                ?'السبب / الملاحظة'
                :'Reason / note'}

              <textarea
                name="note"
                class="control"
                required
              ></textarea>
            </label>

            <div class="form-actions full-span">
              <button
                class="primary-button compact"
              >
                ${C.lang==='ar'
                  ?'إرسال الطلب'
                  :'Send request'}
              </button>
            </div>
          </form>
        `,

        onOpen:(root)=>{
          root
            .querySelector('#doctorExceptionForm')
            .onsubmit=async event=>{
              event.preventDefault();

              const f=new FormData(
                event.currentTarget
              );

              const all=
                f.get('is_all_day')==='on';

              const type=
                f.get('exception_type');

              const {error}=await C.sb.rpc(
                'frontend_request_schedule_exception',
                {
                  p_date:
                    f.get('exception_date'),

                  p_type:
                    type,

                  p_all_day:
                    all,

                  p_start:
                    all
                      ? null
                      : (
                          f.get('start_time')||
                          null
                        ),

                  p_end:
                    all
                      ? null
                      : (
                          f.get('end_time')||
                          null
                        ),

                  p_slot_minutes:
                    ['extra_clinic','changed_hours']
                      .includes(type)
                        ? 60
                        : null,

                  p_note:
                    f.get('note')||null
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
                  ?'تم إرسال الطلب'
                  :'Request sent'
              );

              window.ClinicNotifications
                ?.refresh?.();

              refresh();
            };
        }
      });

    refresh();
  };
})();
