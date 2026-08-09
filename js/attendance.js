(function(){
  const C=()=>window.Clinic;
  // ISO weekday values remain Monday=1 ... Sunday=7 in Supabase.
  // Display and dropdown order starts on Saturday.
  const weekdays={
    en:{1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday',6:'Saturday',7:'Sunday'},
    ar:{1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت',7:'الأحد'}
  };

  const clinicWeekOrder=[6,7,1,2,3,4,5];

  function weekdayLabel(day){
    return weekdays[C().lang][Number(day)] || day;
  }

  function sortClinicWeek(rows=[]){
    const rank=new Map(clinicWeekOrder.map((day,index)=>[day,index]));
    return [...rows].sort((a,b)=>
      (rank.get(Number(a.weekday))??99)-
      (rank.get(Number(b.weekday))??99)
    );
  }

  function weekdayOptions(){
    return clinicWeekOrder
      .map(day=>`<option value="${day}">${weekdayLabel(day)}</option>`)
      .join('');
  }
  const firstRow=data=>Array.isArray(data)?(data[0]||null):data;

  function isDesktopAttendanceDevice(){
    return window.matchMedia('(min-width: 900px)').matches;
  }

  function attendanceDuration(record){
    if(!record?.check_in_at) return '—';

    const start=new Date(record.check_in_at).getTime();
    const end=record.check_out_at
      ? new Date(record.check_out_at).getTime()
      : Date.now();

    if(!Number.isFinite(start) || !Number.isFinite(end) || end < start){
      return '—';
    }

    const total=Math.floor((end-start)/60000);
    const h=Math.floor(total/60);
    const m=total%60;

    return `${h} h ${m} min`;
  }

  function displayWorkDate(value){
    if(!value) return '—';
    const parts=String(value).slice(0,10).split('-');
    return parts.length===3
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : value;
  }

  async function render(){
    const c=C(); if(!(c.hasRole('secretary')||c.isManagement())) return c.route('dashboard');
    c.setTitle(c.t('attendance'));
    let staffId=c.user.id, staff=[];
    if(c.isManagement()){
      const {data,error}=await c.sb.rpc('frontend_list_staff_by_role',{p_role:'secretary'});
      if(error) c.toast(error.message,'error');
      staff=data||[]; staffId=staff[0]?.id||'';
    }
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">STAFF</span><h2>${c.lang==='ar'?'الحضور والمكافآت':'Attendance & bonus'}</h2><p class="muted">${c.lang==='ar'?'الحضور والانصراف والإجازات والملخص الشهري.':'Check-in/out, leave, monthly summary and bonus.'}</p></div>${c.isManagement()?`<div class="toolbar-actions"><select id="attendanceStaff" class="control">${staff.map(s=>`<option value="${s.id}">${c.escape(s.display_name||s.username||s.email)}</option>`).join('')}</select></div>`:''}</section>
      <div class="tabs" id="attendanceTabs"><button class="tab active" data-tab="today">${c.lang==='ar'?'اليوم':'Today'}</button><button class="tab" data-tab="leave">${c.lang==='ar'?'الإجازات':'Leave'}</button><button class="tab" data-tab="month">${c.lang==='ar'?'الملخص الشهري':'Monthly'}</button>${c.isManagement()?`<button class="tab" data-tab="rules">${c.lang==='ar'?'قواعد المكافأة':'Bonus rules'}</button>`:''}</div>
      <section class="content-card"><div id="attendanceArea"></div></section>`;
    const area=document.getElementById('attendanceArea');
    const staffSelect=document.getElementById('attendanceStaff');
    if(staffSelect) staffSelect.onchange=()=>{staffId=staffSelect.value;showToday();};

    async function showToday(){
      if(!staffId){
        area.innerHTML=`<div class="empty-state">${c.lang==='ar'?'لا توجد سكرتارية نشطة.':'No active secretary account.'}</div>`;
        return;
      }

      const today=c.cairoDate();

      const [
        todayResult,
        scheduleResult,
        historyResult
      ] = await Promise.all([
        c.sb.rpc(
          'frontend_get_staff_attendance_today',
          {p_staff_id:staffId}
        ),

        c.sb.rpc(
          'frontend_get_staff_work_schedule',
          {p_staff_id:staffId}
        ),

        c.sb.rpc(
          'frontend_get_staff_attendance_history',
          {
            p_staff_id:staffId,
            p_days:45
          }
        )
      ]);

      if(todayResult.error){
        c.toast(todayResult.error.message,'error');
      }

      const record=
        firstRow(
          todayResult.data
        );

      const schedules=scheduleResult.data||[];
      const history=historyResult.data||[];

      if(scheduleResult.error){
        c.toast(scheduleResult.error.message,'error');
      }

      if(historyResult.error){
        c.toast(historyResult.error.message,'error');
      }

      const weekday=
        ((new Date(`${today}T12:00:00+03:00`).getDay()+6)%7)+1;

      const sch=(schedules||[]).find(
        x=>
          Number(x.weekday)===weekday
          &&
          today>=x.effective_from
          &&
          (!x.effective_until||today<=x.effective_until)
      );

      const desktopAllowed=isDesktopAttendanceDevice();
      const isSecretarySelf=
        !c.isManagement()
        &&
        c.hasRole('secretary')
        &&
        staffId===c.user.id;

      area.innerHTML=`
        <div class="attendance-today-grid">

          <article class="attendance-clock-card">

            <span class="eyebrow">
              ${c.formatDate(today)}
            </span>

            <h3>
              ${
                sch
                  ? `${sch.start_time.slice(0,5)} → ${sch.end_time.slice(0,5)}`
                  : (
                      c.lang==='ar'
                        ?'لا يوجد جدول اليوم'
                        :'No schedule today'
                    )
              }
            </h3>

            <div class="attendance-state">

              ${
                record
                  ? `
                    ${c.statusPill(record.check_out_at?'completed':'active')}

                    <strong>
                      ${c.lang==='ar'?'دخول':'In'}:
                      ${c.formatTime(record.check_in_at)}
                    </strong>

                    <strong>
                      ${c.lang==='ar'?'خروج':'Out'}:
                      ${c.formatTime(record.check_out_at)}
                    </strong>

                    <strong>
                      ${c.lang==='ar'?'مدة البقاء':'Duration'}:
                      ${attendanceDuration(record)}
                    </strong>

                    <span>
                      ${c.lang==='ar'?'تأخير':'Late'}
                      ${record.late_minutes||0} min
                      •
                      ${c.lang==='ar'?'خروج مبكر':'Early'}
                      ${record.early_leave_minutes||0} min
                    </span>
                  `
                  : `
                    <span class="muted">
                      ${c.lang==='ar'
                        ?'لم يتم تسجيل الحضور بعد.'
                        :'No attendance recorded yet.'}
                    </span>
                  `
              }

            </div>

            ${
              isSecretarySelf
                ? (
                    desktopAllowed
                      ? `
                        <div class="form-actions">
                          ${
                            !record
                              ? `
                                <button
                                  id="staffCheckIn"
                                  class="primary-button compact"
                                >
                                  ${c.lang==='ar'?'تسجيل حضور':'Check in'}
                                </button>
                              `
                              : !record.check_out_at
                                ? `
                                  <button
                                    id="staffCheckOut"
                                    class="primary-button compact"
                                  >
                                    ${c.lang==='ar'?'تسجيل انصراف':'Check out'}
                                  </button>
                                `
                                : ''
                          }
                        </div>
                      `
                      : `
                        <div class="attendance-desktop-only-note">
                          💻
                          ${c.lang==='ar'
                            ?'تسجيل الحضور والانصراف متاح من نسخة اللابتوب فقط.'
                            :'Check-in and check-out are available from the laptop site only.'}
                        </div>
                      `
                  )
                : ''
            }

            ${
              c.isManagement()
                ? `
                  <div class="form-actions">
                    <button
                      id="manualAttendance"
                      class="secondary-button"
                    >
                      ${
                        record
                          ? (
                              c.lang==='ar'
                                ?'تصحيح السجل'
                                :'Adjust record'
                            )
                          : (
                              c.lang==='ar'
                                ?'إدخال يدوي'
                                :'Manual attendance'
                            )
                      }
                    </button>

                    <button
                      id="addStaffSchedule"
                      class="secondary-button"
                    >
                      + ${c.lang==='ar'?'جدول عمل':'Work schedule'}
                    </button>
                  </div>
                `
                : ''
            }

          </article>


          <article>

            <div class="section-head compact-section-head">

              <div>
                <h3>
                  ${c.lang==='ar'
                    ?'الجدول الأسبوعي'
                    :'Weekly schedule'}
                </h3>

                ${
                  c.hasRole('owner')
                    ? `
                      <p class="muted">
                        ${c.lang==='ar'
                          ?'حدد يوماً واحداً أو أكثر ثم احذف أيام الجدول المطلوبة.'
                          :'Select one or more days to remove from Sara\'s schedule.'}
                      </p>
                    `
                    : ''
                }
              </div>

              ${
                c.hasRole('owner')
                  ? `
                    <button
                      id="deleteSelectedStaffSchedule"
                      type="button"
                      class="danger-button compact"
                      disabled
                    >
                      ${c.lang==='ar'
                        ?'حذف الأيام المحددة'
                        :'Delete selected days'}
                    </button>
                  `
                  : ''
              }

            </div>

            <div class="stack-list space-top">

              ${
                (schedules||[]).length
                  ? sortClinicWeek(schedules||[]).map(s=>`
                      <div
                        class="list-card staff-schedule-row"
                        data-staff-schedule-row="${s.id}"
                      >

                        ${
                          c.hasRole('owner')
                            ? `
                              <label
                                class="staff-schedule-selector"
                                title="${
                                  c.lang==='ar'
                                    ?'تحديد للحذف'
                                    :'Select for deletion'
                                }"
                              >
                                <input
                                  type="checkbox"
                                  data-staff-schedule-select="${s.id}"
                                >
                              </label>
                            `
                            : ''
                        }

                        <div class="staff-schedule-main">
                          <strong>
                            ${weekdayLabel(s.weekday)}
                          </strong>

                          <div class="small-note">
                            ${s.start_time.slice(0,5)}
                            →
                            ${s.end_time.slice(0,5)}
                            •
                            ${c.lang==='ar'?'سماح':'Grace'}
                            ${s.late_grace_minutes}
                            min
                          </div>
                        </div>

                        <div class="inline-actions">
                          ${c.statusPill(s.is_active?'active':'inactive')}

                          ${
                            c.hasRole('owner')
                              ? `
                                <button
                                  type="button"
                                  class="table-action"
                                  data-edit-staff-schedule="${s.id}"
                                >
                                  ${c.lang==='ar'
                                    ?'تعديل'
                                    :'Edit'}
                                </button>
                              `
                              : ''
                          }
                        </div>
                      </div>
                    `).join('')
                  : `<div class="empty-state">${c.t('noData')}</div>`
              }

            </div>

          </article>

        </div>


        <section class="attendance-history-section">

          <div class="section-head">
            <div>
              <span class="eyebrow">
                ${c.lang==='ar'
                  ?'السجل اليومي'
                  :'DAILY ATTENDANCE'}
              </span>

              <h3>
                ${c.lang==='ar'
                  ?'الحضور والانصراف ومدة البقاء'
                  :'Check-in, check-out & clinic duration'}
              </h3>
            </div>
          </div>

          ${
            history.length
              ? `
                <div class="table-wrap">
                  <table class="data-table attendance-history-table">
                    <thead>
                      <tr>
                        <th>${c.lang==='ar'?'التاريخ':'Date'}</th>
                        <th>${c.lang==='ar'?'دخول':'Check in'}</th>
                        <th>${c.lang==='ar'?'خروج':'Check out'}</th>
                        <th>${c.lang==='ar'?'مدة البقاء':'Duration'}</th>
                        <th>${c.lang==='ar'?'الحالة':'Status'}</th>
                        ${
                          c.hasRole('owner')
                            ? `<th>${c.lang==='ar'?'اختبار':'Test'}</th>`
                            : ''
                        }
                      </tr>
                    </thead>

                    <tbody>
                      ${history.map(r=>`
                        <tr>
                          <td>
                            <strong>${displayWorkDate(r.work_date)}</strong>
                          </td>

                          <td>${c.formatTime(r.check_in_at)}</td>

                          <td>${c.formatTime(r.check_out_at)}</td>

                          <td>
                            <strong>${attendanceDuration(r)}</strong>
                          </td>

                          <td>
                            ${
                              r.check_out_at
                                ? c.statusPill('completed')
                                : c.statusPill('active')
                            }
                          </td>

                          ${
                            c.hasRole('owner')
                              ? `
                                <td>
                                  <button
                                    type="button"
                                    class="table-action danger-outline"
                                    data-delete-attendance="${r.id}"
                                    data-delete-attendance-date="${r.work_date}"
                                  >
                                    ${c.lang==='ar'
                                      ?'حذف سجل الاختبار'
                                      :'Delete test record'}
                                  </button>
                                </td>
                              `
                              : ''
                          }
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `
              : `
                <div class="empty-state">
                  ${c.lang==='ar'
                    ?'لا يوجد سجل حضور حتى الآن.'
                    :'No attendance history yet.'}
                </div>
              `
          }

        </section>
      `;

      const scheduleDeleteButton =
        document.getElementById(
          'deleteSelectedStaffSchedule'
        );


      function selectedScheduleIds(){
        return [
          ...area.querySelectorAll(
            '[data-staff-schedule-select]:checked'
          )
        ].map(
          input=>
            input.dataset
              .staffScheduleSelect
        );
      }


      function updateScheduleDeleteButton(){
        if(!scheduleDeleteButton){
          return;
        }

        const count=
          selectedScheduleIds()
            .length;

        scheduleDeleteButton.disabled=
          count===0;

        scheduleDeleteButton.textContent=
          count
            ? (
                c.lang==='ar'
                  ? `حذف الأيام المحددة (${count})`
                  : `Delete selected days (${count})`
              )
            : (
                c.lang==='ar'
                  ?'حذف الأيام المحددة'
                  :'Delete selected days'
              );
      }


      area
        .querySelectorAll(
          '[data-staff-schedule-select]'
        )
        .forEach(input=>{

          input.addEventListener(
            'change',
            updateScheduleDeleteButton
          );

        });


      scheduleDeleteButton
        ?.addEventListener(
          'click',
          async()=>{

            if(!c.hasRole('owner')){
              return;
            }

            const ids=
              selectedScheduleIds();

            if(!ids.length){
              return;
            }

            const selectedRows=
              schedules.filter(
                schedule=>
                  ids.includes(
                    schedule.id
                  )
              );

            const dayNames=
              selectedRows
                .map(
                  schedule=>
                    weekdayLabel(
                      schedule.weekday
                    )
                )
                .join(', ');


            const reason=prompt(
              c.lang==='ar'
                ? `سبب حذف أيام الجدول: ${dayNames}`
                : `Reason for deleting schedule days: ${dayNames}`
            );


            if(!reason?.trim()){
              return;
            }


            const confirmed=confirm(
              c.lang==='ar'
                ? `سيتم حذف ${ids.length} يوم/أيام من جدول سارة:\n${dayNames}\n\nهل تريد المتابعة؟`
                : `Delete ${ids.length} schedule day(s) for Sara?\n${dayNames}\n\nContinue?`
            );


            if(!confirmed){
              return;
            }


            scheduleDeleteButton.disabled=
              true;


            const {error}=await c.sb.rpc(
              'owner_delete_staff_schedule_days',
              {
                p_schedule_ids:
                  ids,

                p_reason:
                  reason.trim()
              }
            );


            if(error){

              scheduleDeleteButton.disabled=
                false;

              return c.toast(
                error.message,
                'error'
              );
            }


            c.toast(
              c.lang==='ar'
                ?'تم حذف أيام الجدول المحددة.'
                :'Selected schedule days deleted.'
            );


            c.route(
              'attendance'
            );
          }
        );


      area
        .querySelectorAll(
          '[data-edit-staff-schedule]'
        )
        .forEach(button=>{

          button.addEventListener(
            'click',
            ()=>{

              if(!c.hasRole('owner')){
                return;
              }

              const schedule=
                schedules.find(
                  s=>
                    s.id===
                    button.dataset
                      .editStaffSchedule
                );

              if(schedule){
                scheduleModal(
                  staffId,
                  schedule
                );
              }
            }
          );

        });


      area
        .querySelectorAll(
          '[data-delete-attendance]'
        )
        .forEach(button=>{

          button.addEventListener(
            'click',
            async()=>{

              if(!c.hasRole('owner')){
                return;
              }

              const date=
                button.dataset
                  .deleteAttendanceDate;

              const confirmed=
                confirm(
                  c.lang==='ar'
                    ? `حذف سجل حضور سارة بتاريخ ${displayWorkDate(date)}؟\n\nهذا مخصص لفترة الاختبار فقط، وبعد الحذف يمكن تسجيل الحضور لهذا اليوم من جديد.`
                    : `Delete Sara's attendance record for ${displayWorkDate(date)}?\n\nThis is for the test period only. After deletion, attendance can be recorded again for that day.`
                );

              if(!confirmed){
                return;
              }

              button.disabled=true;

              const {error}=await c.sb.rpc(
                'owner_delete_attendance_test_record',
                {
                  p_attendance_id:
                    button.dataset
                      .deleteAttendance,

                  p_reason:
                    'Owner test-period cleanup'
                }
              );

              button.disabled=false;

              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }

              c.toast(
                c.lang==='ar'
                  ?'تم حذف سجل الحضور التجريبي.'
                  :'Test attendance record deleted.'
              );

              showToday();
            }
          );

        });


      document
        .getElementById('staffCheckIn')
        ?.addEventListener(
          'click',
          async()=>{
            if(!isDesktopAttendanceDevice()){
              return c.toast(
                c.lang==='ar'
                  ?'تسجيل الحضور متاح من اللابتوب فقط.'
                  :'Check-in is available from the laptop site only.',
                'error'
              );
            }

            const {error}=await c.sb.rpc(
              'frontend_staff_check_in',
              {p_note:null}
            );

            if(error){
              return c.toast(error.message,'error');
            }

            c.toast(
              c.lang==='ar'
                ?'تم تسجيل الحضور'
                :'Checked in'
            );

            showToday();
          }
        );

      document
        .getElementById('staffCheckOut')
        ?.addEventListener(
          'click',
          async()=>{
            if(!isDesktopAttendanceDevice()){
              return c.toast(
                c.lang==='ar'
                  ?'تسجيل الانصراف متاح من اللابتوب فقط.'
                  :'Check-out is available from the laptop site only.',
                'error'
              );
            }

            const {error}=await c.sb.rpc(
              'frontend_staff_check_out',
              {p_note:null}
            );

            if(error){
              return c.toast(error.message,'error');
            }

            c.toast(
              c.lang==='ar'
                ?'تم تسجيل الانصراف'
                :'Checked out'
            );

            showToday();
          }
        );

      document
        .getElementById('manualAttendance')
        ?.addEventListener(
          'click',
          ()=>manualModal(staffId,record)
        );

      document
        .getElementById('addStaffSchedule')
        ?.addEventListener(
          'click',
          ()=>scheduleModal(staffId)
        );
    }

    async function showLeave(){
      if(!staffId){area.innerHTML=`<div class="empty-state">${c.t('noData')}</div>`;return;}
      const {data}=await c.sb.from('staff_leave_requests').select('*').eq('staff_id',staffId).order('requested_at',{ascending:false}).limit(50);
      area.innerHTML=`<div class="section-head"><h3>${c.lang==='ar'?'طلبات الإجازة':'Leave requests'}</h3>${!c.isManagement()?`<button id="newLeave" class="primary-button compact">+ ${c.lang==='ar'?'طلب إجازة':'Leave request'}</button>`:''}</div>${data?.length?`<div class="stack-list">${data.map(x=>`<article class="list-card"><div><div class="list-title">${c.formatDate(x.start_date)} → ${c.formatDate(x.end_date)}</div><div class="small-note">${c.escape(x.leave_type.replaceAll('_',' '))}${x.note?` • ${c.escape(x.note)}`:''}</div></div><div class="list-actions">${c.statusPill(x.status)}${c.isManagement()&&x.status==='pending'?`<button class="table-action success-outline" data-leave="${x.id}" data-action="approve">✓</button><button class="table-action danger-outline" data-leave="${x.id}" data-action="reject">✕</button>`:''}</div></article>`).join('')}</div>`:`<div class="empty-state">${c.t('noData')}</div>`}`;
      document.getElementById('newLeave')?.addEventListener('click',leaveModal);
      area.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>reviewLeave(b.dataset.leave,b.dataset.action));
    }

    async function showMonth(){
      if(!staffId){area.innerHTML=`<div class="empty-state">${c.t('noData')}</div>`;return;}
      const month=new Date().toISOString().slice(0,7)+'-01';
      area.innerHTML=`<div class="filter-row"><input id="attendanceMonth" class="control" type="month" value="${month.slice(0,7)}"><button id="loadMonth" class="secondary-button">${c.lang==='ar'?'تحميل':'Load'}</button></div><div id="monthResult" class="space-top"></div>`;
      async function load(){
        const m=document.getElementById('attendanceMonth').value+'-01';
        const [{data:summary,error},{data:bonus}] = await Promise.all([
          c.sb.rpc('get_monthly_attendance_summary',{p_staff_id:staffId,p_month:m}),
          c.sb.rpc('preview_monthly_staff_bonus',{p_staff_id:staffId,p_month:m})
        ]);
        const s=firstRow(summary),b=firstRow(bonus);const out=document.getElementById('monthResult');
        if(error||!s){out.innerHTML=`<div class="empty-state">${c.escape(error?.message||c.t('noData'))}</div>`;return;}
        out.innerHTML=`<section class="dashboard-grid dashboard-grid-six"><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'أيام مطلوبة':'Required days'}</span><strong>${s.required_work_days}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'حضور':'Attended'}</span><strong>${s.attended_days}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'غياب':'Absent'}</span><strong>${s.absent_days}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'تأخير':'Late minutes'}</span><strong>${s.total_late_minutes}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'خروج مبكر':'Early minutes'}</span><strong>${s.total_early_leave_minutes}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'نسبة الحضور':'Attendance'}</span><strong>${s.attendance_rate_percent}%</strong></article></section>${b?`<div class="bonus-breakdown"><div><span>${c.lang==='ar'?'أساسي':'Base'}</span><strong>${c.formatMoney(b.base_bonus)}</strong></div><div><span>${c.lang==='ar'?'إضافات':'Additions'}</span><strong>${c.formatMoney(b.perfect_attendance_bonus)}</strong></div><div><span>${c.lang==='ar'?'خصومات':'Deductions'}</span><strong>${c.formatMoney(b.total_deductions)}</strong></div><div class="bonus-final"><span>${c.lang==='ar'?'المكافأة المتوقعة':'Preview bonus'}</span><strong>${c.formatMoney(b.final_bonus)}</strong></div></div>${c.isManagement()?`<div class="form-actions space-top"><button id="calculateBonus" class="primary-button compact">${c.lang==='ar'?'حساب وحفظ الشهر المكتمل':'Calculate completed month'}</button></div>`:''}`:`<div class="callout">${c.lang==='ar'?'لا توجد قاعدة مكافأة نشطة لهذا الشهر.':'No active bonus rule for this month.'}</div>`}`;
        document.getElementById('calculateBonus')?.addEventListener('click',async()=>{const {error}=await c.sb.rpc('calculate_monthly_staff_bonus',{p_staff_id:staffId,p_month:m});if(error)return c.toast(error.message,'error');c.toast('Bonus calculated');showRules();});
      }
      document.getElementById('loadMonth').onclick=load;load();
    }

    async function showRules(){
      if(!c.isManagement())return showMonth();
      const [{data:rules},{data:bonuses}]=await Promise.all([
        c.sb.from('staff_bonus_rules').select('*').order('effective_from',{ascending:false}),
        c.sb.from('monthly_staff_bonuses').select('*').order('month_start',{ascending:false}).limit(30)
      ]);
      area.innerHTML=`<div class="section-head"><h3>${c.lang==='ar'?'قواعد المكافأة':'Bonus rules'}</h3><button id="newBonusRule" class="primary-button compact">+ ${c.lang==='ar'?'قاعدة':'Rule'}</button></div><div class="stack-list">${(rules||[]).map(r=>`<article class="list-card"><div><div class="list-title">${c.escape(r.rule_name)}</div><div class="small-note">${c.formatDate(r.effective_from)}${r.effective_until?` → ${c.formatDate(r.effective_until)}`:''} • ${c.lang==='ar'?'أساسي':'Base'} ${c.formatMoney(r.base_bonus)}</div></div>${c.statusPill(r.is_active?'active':'inactive')}</article>`).join('')||`<div class="empty-state">${c.t('noData')}</div>`}</div><div class="section-head space-top"><h3>${c.lang==='ar'?'المكافآت الشهرية':'Monthly bonuses'}</h3></div>${bonuses?.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'الشهر':'Month'}</th><th>${c.lang==='ar'?'القيمة':'Amount'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th><th></th></tr></thead><tbody>${bonuses.map(b=>`<tr><td>${c.formatDate(b.month_start)}</td><td>${c.formatMoney(b.final_bonus)}</td><td>${c.statusPill(b.status)}</td><td>${b.status==='draft'?`<button class="table-action success-outline" data-bonus-action="approve" data-id="${b.id}">Approve</button>`:b.status==='approved'?`<button class="table-action success-outline" data-bonus-action="paid" data-id="${b.id}">Paid</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`}`;
      document.getElementById('newBonusRule').onclick=bonusRuleModal;
      area.querySelectorAll('[data-bonus-action]').forEach(b=>b.onclick=()=>bonusAction(b.dataset.id,b.dataset.bonusAction));
    }

    document.querySelectorAll('#attendanceTabs .tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('#attendanceTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');({today:showToday,leave:showLeave,month:showMonth,rules:showRules}[b.dataset.tab]||showToday)();});
    showToday();
  }

  function scheduleModal(staffId,schedule=null){
    const c=C();

    const editing=
      Boolean(
        schedule?.id
      );

    c.showModal({
      title:
        editing
          ? (
              c.lang==='ar'
                ?'تعديل جدول السكرتارية'
                :'Edit secretary schedule'
            )
          : (
              c.lang==='ar'
                ?'إضافة جدول عمل'
                :'Add work schedule'
            ),

      body:`
        <form
          id="staffScheduleForm"
          class="form-grid"
        >

          <label>
            ${c.lang==='ar'?'اليوم':'Weekday'}

            <select
              id="ssDay"
              class="control"
            >
              ${weekdayOptions()}
            </select>
          </label>


          <label>
            ${c.lang==='ar'?'من':'Start'}

            <input
              id="ssStart"
              type="time"
              class="control"
              value="${
                schedule?.start_time
                  ? schedule.start_time.slice(0,5)
                  : ''
              }"
              required
            >
          </label>


          <label>
            ${c.lang==='ar'?'إلى':'End'}

            <input
              id="ssEnd"
              type="time"
              class="control"
              value="${
                schedule?.end_time
                  ? schedule.end_time.slice(0,5)
                  : ''
              }"
              required
            >
          </label>


          <label>
            ${c.lang==='ar'
              ?'سماح التأخير'
              :'Late grace'}

            <input
              id="ssLate"
              type="number"
              class="control"
              value="${schedule?.late_grace_minutes??0}"
              min="0"
              max="120"
            >
          </label>


          <label>
            ${c.lang==='ar'
              ?'سماح الخروج المبكر'
              :'Early grace'}

            <input
              id="ssEarly"
              type="number"
              class="control"
              value="${schedule?.early_leave_grace_minutes??0}"
              min="0"
              max="120"
            >
          </label>


          <label>
            ${c.lang==='ar'
              ?'ساري من'
              :'Effective from'}

            <input
              id="ssFrom"
              type="date"
              class="control"
              value="${schedule?.effective_from||c.cairoDate()}"
              required
            >
          </label>


          <label>
            ${c.lang==='ar'
              ?'ساري حتى (اختياري)'
              :'Effective until (optional)'}

            <input
              id="ssUntil"
              type="date"
              class="control"
              value="${schedule?.effective_until||''}"
            >
          </label>


          <label>
            ${c.lang==='ar'
              ?'الحالة'
              :'Status'}

            <select
              id="ssActive"
              class="control"
            >
              <option
                value="true"
                ${schedule?.is_active===false?'':'selected'}
              >
                ${c.lang==='ar'?'نشط':'Active'}
              </option>

              <option
                value="false"
                ${schedule?.is_active===false?'selected':''}
              >
                ${c.lang==='ar'?'غير نشط':'Inactive'}
              </option>
            </select>
          </label>


          <label class="full-span">
            ${c.lang==='ar'
              ?'ملاحظات (اختياري)'
              :'Notes (optional)'}

            <textarea
              id="ssNotes"
              class="control"
            >${c.escape(schedule?.notes||'')}</textarea>
          </label>


          <div class="form-actions full-span">
            <button
              class="primary-button compact"
              type="submit"
            >
              ${
                editing
                  ? (
                      c.lang==='ar'
                        ?'حفظ التعديل'
                        :'Save changes'
                    )
                  : (
                      c.lang==='ar'
                        ?'حفظ'
                        :'Save'
                    )
              }
            </button>
          </div>

        </form>
      `,

      onOpen:(root)=>{

        if(schedule?.weekday){
          root
            .querySelector(
              '#ssDay'
            )
            .value=
              String(
                schedule.weekday
              );
        }


        root
          .querySelector(
            '#staffScheduleForm'
          )
          .onsubmit=async event=>{

            event.preventDefault();


            const {error}=await c.sb.rpc(
              'save_staff_work_schedule',
              {
                p_schedule_id:
                  schedule?.id||null,

                p_staff_id:
                  staffId,

                p_weekday:
                  Number(
                    root
                      .querySelector(
                        '#ssDay'
                      )
                      .value
                  ),

                p_start_time:
                  root
                    .querySelector(
                      '#ssStart'
                    )
                    .value,

                p_end_time:
                  root
                    .querySelector(
                      '#ssEnd'
                    )
                    .value,

                p_late_grace_minutes:
                  Number(
                    root
                      .querySelector(
                        '#ssLate'
                      )
                      .value||0
                  ),

                p_early_leave_grace_minutes:
                  Number(
                    root
                      .querySelector(
                        '#ssEarly'
                      )
                      .value||0
                  ),

                p_effective_from:
                  root
                    .querySelector(
                      '#ssFrom'
                    )
                    .value,

                p_effective_until:
                  root
                    .querySelector(
                      '#ssUntil'
                    )
                    .value||null,

                p_notes:
                  root
                    .querySelector(
                      '#ssNotes'
                    )
                    .value||null,

                p_is_active:
                  root
                    .querySelector(
                      '#ssActive'
                    )
                    .value==='true'
              }
            );


            if(error){
              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();

            c.toast(
              editing
                ? (
                    c.lang==='ar'
                      ?'تم تعديل جدول السكرتارية.'
                      :'Secretary schedule updated.'
                  )
                : (
                    c.lang==='ar'
                      ?'تم إضافة جدول العمل.'
                      :'Work schedule added.'
                  )
            );


            c.route(
              'attendance'
            );
          };
      }
    });
  }

  function manualModal(staffId,record){
    const c=C(),date=record?.work_date||c.cairoDate();
    const cin=record?new Date(record.check_in_at).toLocaleTimeString('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'}):'';
    const cout=record?.check_out_at?new Date(record.check_out_at).toLocaleTimeString('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'}):'';
    c.showModal({title:record?(c.lang==='ar'?'تصحيح الحضور':'Adjust attendance'):(c.lang==='ar'?'إدخال حضور يدوي':'Manual attendance'),body:`<form id="manualForm" class="form-grid"><label>${c.lang==='ar'?'التاريخ':'Date'}<input id="manDate" type="date" class="control" value="${date}" ${record?'disabled':''}></label><label>${c.lang==='ar'?'دخول':'Check in'}<input id="manIn" type="time" class="control" value="${cin}" required></label><label>${c.lang==='ar'?'خروج':'Check out'}<input id="manOut" type="time" class="control" value="${cout}" required></label><label class="full-span">${c.lang==='ar'?'السبب':'Reason'}<textarea id="manReason" class="control" required></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#manualForm').onsubmit=async e=>{e.preventDefault();const d=record?.work_date||root.querySelector('#manDate').value,ci=`${d}T${root.querySelector('#manIn').value}:00+03:00`,co=`${d}T${root.querySelector('#manOut').value}:00+03:00`,reason=root.querySelector('#manReason').value;const rpc=record?'adjust_attendance_record':'record_manual_attendance';const args=record?{p_attendance_id:record.id,p_new_check_in:ci,p_new_check_out:co,p_reason:reason}:{p_staff_id:staffId,p_work_date:d,p_check_in_at:ci,p_check_out_at:co,p_reason:reason};const {error}=await c.sb.rpc(rpc,args);if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Saved');c.route('attendance');}});
  }

  function leaveModal(){
    const c=C();
    c.showModal({title:c.lang==='ar'?'طلب إجازة':'Leave request',body:`<form id="leaveForm" class="form-grid"><label>${c.lang==='ar'?'من':'From'}<input id="lvFrom" type="date" class="control" required></label><label>${c.lang==='ar'?'إلى':'To'}<input id="lvTo" type="date" class="control" required></label><label>${c.lang==='ar'?'النوع':'Type'}<select id="lvType" class="control"><option value="authorized_leave">Authorized leave</option><option value="personal_leave">Personal leave</option><option value="other">Other</option></select></label><label class="full-span">${c.lang==='ar'?'ملاحظة':'Note'}<textarea id="lvNote" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'إرسال':'Submit'}</button></div></form>`,onOpen:(root)=>root.querySelector('#leaveForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('request_staff_leave',{p_start_date:root.querySelector('#lvFrom').value,p_end_date:root.querySelector('#lvTo').value,p_leave_type:root.querySelector('#lvType').value,p_note:root.querySelector('#lvNote').value||null});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Submitted');c.route('attendance');}});
  }

  async function reviewLeave(id,action){const c=C();let note=null;if(action==='reject'){note=prompt(c.lang==='ar'?'سبب الرفض':'Rejection reason');if(!note)return;}const {error}=await c.sb.rpc('review_staff_leave',{p_leave_id:id,p_action:action,p_note:note});if(error)return c.toast(error.message,'error');c.toast('Updated');c.route('attendance');}

  function bonusRuleModal(){
    const c=C();
    c.showModal({title:c.lang==='ar'?'قاعدة مكافأة جديدة':'New bonus rule',wide:true,body:`<form id="bonusRuleForm" class="form-grid compact-grid"><label>${c.lang==='ar'?'اسم القاعدة':'Rule name'}<input id="brName" class="control" required></label><label>${c.lang==='ar'?'ساري من':'Effective from'}<input id="brFrom" type="date" class="control" required></label><label>${c.lang==='ar'?'ساري حتى':'Effective until'}<input id="brUntil" type="date" class="control"></label><label>${c.lang==='ar'?'المكافأة الأساسية':'Base bonus'}<input id="brBase" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'مكافأة الحضور الكامل':'Perfect bonus'}<input id="brPerfect" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'خصم يوم الغياب':'Absence/day'}<input id="brAbsent" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'خصم يوم تأخير':'Late/day'}<input id="brLateDay" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'خصم دقيقة تأخير':'Late/min'}<input id="brLateMin" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'خصم يوم خروج مبكر':'Early/day'}<input id="brEarlyDay" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'خصم دقيقة خروج مبكر':'Early/min'}<input id="brEarlyMin" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'الحد الأدنى':'Minimum'}<input id="brMin" type="number" min="0" step="0.01" value="0" class="control"></label><label>${c.lang==='ar'?'الحد الأقصى':'Maximum'}<input id="brMax" type="number" min="0" step="0.01" class="control"></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#bonusRuleForm').onsubmit=async e=>{e.preventDefault();const g=id=>root.querySelector(id),num=id=>Number(g(id).value||0);const {error}=await c.sb.rpc('save_staff_bonus_rule',{p_rule_id:null,p_rule_name:g('#brName').value,p_effective_from:g('#brFrom').value,p_effective_until:g('#brUntil').value||null,p_base_bonus:num('#brBase'),p_perfect_attendance_bonus:num('#brPerfect'),p_absence_deduction_per_day:num('#brAbsent'),p_late_deduction_per_day:num('#brLateDay'),p_late_deduction_per_minute:num('#brLateMin'),p_early_leave_deduction_per_day:num('#brEarlyDay'),p_early_leave_deduction_per_minute:num('#brEarlyMin'),p_minimum_bonus:num('#brMin'),p_maximum_bonus:g('#brMax').value?num('#brMax'):null,p_notes:null,p_is_active:true});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Saved');c.route('attendance');}});
  }

  async function bonusAction(id,action){const c=C();let rpc,args;if(action==='approve'){rpc='approve_monthly_staff_bonus';args={p_bonus_id:id,p_note:null};}else{rpc='mark_staff_bonus_paid';args={p_bonus_id:id,p_note:null};}const {error}=await c.sb.rpc(rpc,args);if(error)return c.toast(error.message,'error');c.toast('Updated');c.route('attendance');}

  window.ClinicPages['attendance']=render;
})();
