window.ClinicPages['dashboard'] = async function (params={}) {
  const C = window.Clinic;

  C.setTitle(C.t('dashboard'));

  const today = C.cairoDate();

  let cards = [];
  let recent = '';

  const { data:live, error:liveError } =
    await C.sb.rpc(
      'frontend_dashboard_today'
    );

  if (liveError) {
    console.warn(
      'Dashboard live summary unavailable:',
      liveError
    );
  }

  const stats = live || {};

  if (C.isDoctor() && !C.hasRole('owner')) {
    const { data:refs, error:refErr } =
      await C.sb
        .from('referrals')
        .select('id,status,urgency,patient_id,created_at')
        .eq('to_doctor_id', C.user.id)
        .order('created_at', {ascending:false})
        .limit(6);

    if (refErr) {
      console.warn(refErr);
    }

    const r = refs || [];

    cards = [
      [
        '⌛',
        C.lang==='ar' ? 'في الانتظار' : 'Waiting',
        Number(stats.waiting || 0)
      ],
      [
        '☀',
        C.lang==='ar' ? 'مرضى اليوم' : "Today's Patients",
        Number(stats.patients_today || 0)
      ],
      [
        '⇄',
        C.lang==='ar' ? 'تحويلات جديدة' : 'New Referrals',
        r.filter(x => x.status === 'pending').length
      ],
      [
        '✓',
        C.lang==='ar' ? 'تم الكشف' : 'Completed',
        Number(stats.completed || 0)
      ]
    ];

    recent = `
      <section class="content-card">
        <div class="section-head">
          <div>
            <span class="eyebrow">
              ${C.lang==='ar'?'مباشر':'LIVE'}
            </span>

            <h3>
              ${C.lang==='ar'
                ?'مسار عيادة اليوم'
                :'Today clinic flow'}
            </h3>
          </div>

          <button
            class="secondary-button"
            data-go="today-clinic"
          >
            ${C.lang==='ar'
              ?'فتح عيادة اليوم'
              :"Open today's clinic"}
          </button>
        </div>

        <div class="flow-strip">
          ${[
            ['booked',stats.booked],
            ['arrived',stats.arrived],
            ['waiting',stats.waiting],
            ['with_doctor',stats.with_doctor],
            ['completed',stats.completed]
          ].map(([status,value])=>`
            <div>
              <strong>${Number(value||0)}</strong>
              <span>${status.replaceAll('_',' ')}</span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  else if (
    C.isManagement()
    ||
    C.hasRole('secretary')
  ) {
    cards = [
      [
        '📅',
        C.lang==='ar' ? 'حجوزات اليوم' : "Today's Appointments",
        Number(stats.appointments_today || 0)
      ],
      [
        '👥',
        C.lang==='ar' ? 'المرضى اليوم' : 'Patients Today',
        Number(stats.patients_today || 0)
      ],
      [
        '⌛',
        C.lang==='ar' ? 'في الانتظار' : 'Waiting',
        Number(stats.waiting || 0)
      ],
      [
        '✓',
        C.lang==='ar' ? 'مكتمل' : 'Completed',
        Number(stats.completed || 0)
      ],
      [
        '💳',
        C.lang==='ar' ? 'دخل اليوم' : "Today's Income",
        C.formatMoney(stats.income_today || 0)
      ],
      [
        '📦',
        C.lang==='ar' ? 'طلبات معلقة' : 'Pending Requests',
        Number(stats.pending_logistics || 0)
      ]
    ];

    recent = `
      <section class="content-card">
        <div class="section-head">
          <div>
            <span class="eyebrow">
              LIVE
            </span>

            <h3>
              ${C.lang==='ar'
                ?'حالة العيادة اليوم'
                :'Today at a glance'}
            </h3>

            <p class="muted">
              ${C.lang==='ar'
                ?'يتحدث تلقائياً كل عدة ثوانٍ؛ الإلغاء وتسجيل الوصول والدخل تظهر هنا بدون الاعتماد على بيانات قديمة.'
                :'Auto-refreshes every few seconds so cancellations, check-ins and daily income stay current.'}
            </p>
          </div>

          <button
            class="secondary-button"
            data-go="appointments"
          >
            ${C.lang==='ar'
              ?'فتح الحجوزات'
              :'Open appointments'}
          </button>
        </div>

        <div class="flow-strip">
          ${[
            ['booked',stats.booked],
            ['arrived',stats.arrived],
            ['waiting',stats.waiting],
            ['with_doctor',stats.with_doctor],
            ['completed',stats.completed],
            ['cancelled',stats.cancelled]
          ].map(([status,value])=>`
            <div>
              <strong>${Number(value||0)}</strong>
              <span>${status.replaceAll('_',' ')}</span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  else {
    cards = [[
      '✓',
      C.lang==='ar' ? 'النظام' : 'System',
      C.lang==='ar' ? 'متصل' : 'Connected'
    ]];
  }


  const name =
    C.profile.display_name
    ||
    C.profile.username;


  document
    .getElementById('mainContent')
    .innerHTML = `
      <section class="dashboard-welcome">
        <div>
          <span class="eyebrow">
            ${C.lang==='ar'?'مرحباً':'WELCOME'}
          </span>

          <h2>${C.escape(name)}</h2>

          <p>
            ${C.isDoctor()
              ? (
                  C.lang==='ar'
                    ?'إدارة مرضاك وعيادة اليوم والتحويلات.'
                    :"Manage your patients, today's clinic and referrals."
                )
              : (
                  C.lang==='ar'
                    ?'لوحة تشغيل وإدارة العيادة.'
                    :'Clinic operations and management dashboard.'
                )
            }
          </p>
        </div>

        <span class="dashboard-live-badge">
          ● ${C.lang==='ar'?'بيانات مباشرة':'Live data'}
        </span>
      </section>


      <section
        class="dashboard-grid ${
          cards.length > 4
            ? 'dashboard-grid-six'
            : ''
        }"
      >
        ${cards.map(([icon,label,value])=>`
          <article class="stat-card">
            <span class="stat-icon">${icon}</span>
            <span class="stat-label">${label}</span>
            <strong>${value}</strong>
          </article>
        `).join('')}
      </section>


      <section
        id="dashboardNotificationSection"
        class="content-card dashboard-notifications-card"
      >
        <div class="centered compact-loading">
          <div class="loader"></div>

          <p class="muted">
            ${C.lang==='ar'
              ?'جاري تحميل الإشعارات...'
              :'Loading notifications...'}
          </p>
        </div>
      </section>


      ${recent}
    `;


  document
    .querySelectorAll('[data-go]')
    .forEach(button=>{
      button.onclick=
        ()=>C.route(
          button.dataset.go
        );
    });


  await window
    .ClinicNotifications
    ?.refresh?.();


  // One-shot live refresh. Each render resets the timer, so only
  // one timer remains active at a time.
  clearTimeout(
    window.__clinicDashboardRefreshTimer
  );

  window.__clinicDashboardRefreshTimer =
    setTimeout(
      ()=>{
        if(
          C.currentPage==='dashboard'
        ){
          window
            .ClinicPages
            .dashboard({
              silent:true
            });
        }
      },
      12000
    );
};
