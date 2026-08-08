window.ClinicPages['dashboard'] = async function () {
  const C = window.Clinic;
  C.setTitle(C.t('dashboard'));
  const today = C.cairoDate();
  const start = `${today}T00:00:00+03:00`;
  const end = `${today}T23:59:59+03:00`;

  let cards = [];
  let recent = '';

  if (C.isDoctor() && !C.hasRole('owner')) {
    const [{ data: appts, error: apptErr }, { data: refs, error: refErr }] = await Promise.all([
      C.sb.from('appointments').select('id,patient_id,status,scheduled_start').gte('scheduled_start', start).lte('scheduled_start', end).order('scheduled_start'),
      C.sb.from('referrals').select('id,status,urgency,patient_id,created_at').eq('to_doctor_id', C.user.id).order('created_at', { ascending:false }).limit(6)
    ]);
    if (apptErr) console.warn(apptErr);
    if (refErr) console.warn(refErr);
    const a = appts || [];
    const r = refs || [];
    cards = [
      ['⌛', C.lang==='ar'?'في الانتظار':'Waiting', a.filter(x=>x.status==='waiting').length],
      ['☀', C.lang==='ar'?'مرضى اليوم':"Today's Patients", new Set(a.map(x=>x.patient_id)).size],
      ['⇄', C.lang==='ar'?'تحويلات جديدة':'New Referrals', r.filter(x=>x.status==='pending').length],
      ['✓', C.lang==='ar'?'تم الكشف':'Completed', a.filter(x=>x.status==='completed').length]
    ];

    recent = `
      <section class="content-card">
        <div class="section-head"><div><span class="eyebrow">${C.lang==='ar'?'اليوم':'TODAY'}</span><h3>${C.lang==='ar'?'مسار العيادة':'Clinic flow'}</h3></div>
          <button class="secondary-button" data-go="queue">${C.lang==='ar'?'فتح قائمة الانتظار':'Open Queue'}</button></div>
        <div class="flow-strip">
          ${['booked','confirmed','arrived','waiting','with_doctor','completed'].map(s=>`<div><strong>${a.filter(x=>x.status===s).length}</strong><span>${s.replaceAll('_',' ')}</span></div>`).join('')}
        </div>
      </section>`;
  } else if (C.isManagement() || C.hasRole('secretary')) {
    const queries = [
      C.sb.from('appointments').select('id,patient_id,status,doctor_id,scheduled_start').gte('scheduled_start', start).lte('scheduled_start', end),
      C.sb.from('logistics_requests').select('id,status').eq('status','requested')
    ];
    if (C.isReception()) queries.push(C.sb.rpc('frontend_income_summary', { p_from: today, p_to: today }));
    const results = await Promise.all(queries);
    const appts = results[0].data || [];
    const logistics = results[1].data || [];
    const income = results[2]?.data || {};
    cards = [
      ['📅', C.lang==='ar'?'حجوزات اليوم':"Today's Appointments", appts.length],
      ['👥', C.lang==='ar'?'المرضى اليوم':'Patients Today', new Set(appts.map(x=>x.patient_id)).size],
      ['⌛', C.lang==='ar'?'في الانتظار':'Waiting', appts.filter(x=>x.status==='waiting').length],
      ['✓', C.lang==='ar'?'مكتمل':'Completed', appts.filter(x=>x.status==='completed').length],
      ['💳', C.lang==='ar'?'دخل اليوم':"Today's Income", C.formatMoney(income.total_received || 0)],
      ['📦', C.lang==='ar'?'طلبات معلقة':'Pending Requests', logistics.length]
    ];

    recent = `
      <section class="content-card">
        <div class="section-head"><div><span class="eyebrow">LIVE</span><h3>${C.lang==='ar'?'حالة العيادة اليوم':'Today at a glance'}</h3></div>
          ${C.isReception()?`<button class="secondary-button" data-go="reception">${C.lang==='ar'?'فتح الاستقبال':'Open Reception'}</button>`:''}
        </div>
        <div class="flow-strip">
          ${['booked','confirmed','arrived','waiting','with_doctor','completed'].map(s=>`<div><strong>${appts.filter(x=>x.status===s).length}</strong><span>${s.replaceAll('_',' ')}</span></div>`).join('')}
        </div>
      </section>`;
  } else {
    cards = [['✓', C.lang==='ar'?'النظام':'System', C.lang==='ar'?'متصل':'Connected']];
  }

  const name = C.profile.display_name || C.profile.username;
  document.getElementById('mainContent').innerHTML = `
    <section class="dashboard-welcome"><div><span class="eyebrow">${C.lang==='ar'?'مرحباً':'WELCOME'}</span><h2>${C.escape(name)}</h2>
      <p>${C.isDoctor() ? (C.lang==='ar'?'إدارة مرضاك وعيادة اليوم والتحويلات.':"Manage your patients, today's clinic and referrals.") : (C.lang==='ar'?'لوحة تشغيل وإدارة العيادة.':'Clinic operations and management dashboard.')}</p></div></section>
    <section class="dashboard-grid ${cards.length>4?'dashboard-grid-six':''}">
      ${cards.map(([icon,label,value])=>`<article class="stat-card"><span class="stat-icon">${icon}</span><span class="stat-label">${label}</span><strong>${value}</strong></article>`).join('')}
    </section>
    ${recent}
  `;
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>C.route(b.dataset.go)));
};
