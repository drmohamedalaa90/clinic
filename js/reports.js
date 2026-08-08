(function(){
  const C=()=>window.Clinic;

  function isoMonthStart(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}
  function today(){return C().cairoDate();}

  async function reportsPage(){
    const c=C(); if(!c.isManagement())return c.route('dashboard'); c.setTitle(c.t('reports'));
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">REPORTS</span><h2>${c.lang==='ar'?'التقارير':'Reports'}</h2><p class="muted">${c.lang==='ar'?'تشغيل العيادة، التحويلات والملخص المالي.':'Clinic operations, referrals and financial summary.'}</p></div></section><section class="content-card"><div class="filter-row"><label>${c.lang==='ar'?'من':'From'}<input id="reportFrom" type="date" class="control" value="${isoMonthStart()}"></label><label>${c.lang==='ar'?'إلى':'To'}<input id="reportTo" type="date" class="control" value="${today()}"></label><button id="runReport" class="primary-button compact">${c.lang==='ar'?'تشغيل':'Run'}</button><button id="exportReport" class="secondary-button">CSV</button></div><div id="reportArea" class="space-top"></div></section>`;
    let lastRows=[];
    async function run(){
      const from=document.getElementById('reportFrom').value,to=document.getElementById('reportTo').value;
      const start=`${from}T00:00:00+03:00`,end=`${to}T23:59:59+03:00`;
      const [{data:appts,error:aerr},{data:refs},{data:finance,error:ferr},{data:expenses}] = await Promise.all([
        c.sb.from('appointments').select('id,status,doctor_id,patient_id,scheduled_start').gte('scheduled_start',start).lte('scheduled_start',end),
        c.sb.from('referrals').select('id,status,from_doctor_id,to_doctor_id,created_at').gte('created_at',start).lte('created_at',end),
        c.sb.rpc('get_clinic_financial_summary',{p_from_date:from,p_to_date:to}),
        c.sb.from('clinic_expenses').select('id,amount,payment_method,expense_at,is_voided').gte('expense_at',start).lte('expense_at',end)
      ]);
      if(aerr)c.toast(aerr.message,'error'); if(ferr)c.toast(ferr.message,'error');
      const a=appts||[],r=refs||[],f=Array.isArray(finance)?finance[0]:finance||{},ex=(expenses||[]).filter(x=>!x.is_voided);
      const statusCounts={};a.forEach(x=>statusCounts[x.status]=(statusCounts[x.status]||0)+1);
      const doctorCounts={};a.forEach(x=>doctorCounts[x.doctor_id]=(doctorCounts[x.doctor_id]||0)+1);
      lastRows=[['Metric','Value'],['Appointments',a.length],['Unique patients',new Set(a.map(x=>x.patient_id)).size],['Completed',statusCounts.completed||0],['Cancelled',statusCounts.cancelled||0],['No show',statusCounts.no_show||0],['Referrals',r.length],['Patient income',Number(f.patient_income||0)],['Clinic expenses',Number(f.clinic_expenses||0)],['Net position',Number(f.net_position||0)]];
      document.getElementById('reportArea').innerHTML=`
        <section class="dashboard-grid dashboard-grid-six"><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'الحجوزات':'Appointments'}</span><strong>${a.length}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'مرضى مختلفون':'Unique patients'}</span><strong>${new Set(a.map(x=>x.patient_id)).size}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'مكتمل':'Completed'}</span><strong>${statusCounts.completed||0}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'تحويلات':'Referrals'}</span><strong>${r.length}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'دخل':'Income'}</span><strong>${c.formatMoney(f.patient_income||0)}</strong></article><article class="stat-card"><span class="stat-label">${c.lang==='ar'?'صافي':'Net'}</span><strong>${c.formatMoney(f.net_position||0)}</strong></article></section>
        <div class="report-grid"><article class="content-card inner-card"><h3>${c.lang==='ar'?'حالات الحجوزات':'Appointment statuses'}</h3><div class="stack-list space-top">${Object.entries(statusCounts).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<div class="metric-row"><span>${c.statusPill(s)}</span><strong>${n}</strong></div>`).join('')||'—'}</div></article><article class="content-card inner-card"><h3>${c.lang==='ar'?'الحجوزات حسب الطبيب':'Appointments by doctor'}</h3><div class="stack-list space-top">${Object.entries(doctorCounts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<div class="metric-row"><span>${c.escape(c.doctorName(id))}</span><strong>${n}</strong></div>`).join('')||'—'}</div></article></div>
        <div class="report-grid space-top"><article class="content-card inner-card"><h3>${c.lang==='ar'?'المالية':'Finance'}</h3><div class="detail-grid space-top"><div><span class="field-label">${c.lang==='ar'?'دخل المرضى':'Patient income'}</span><strong>${c.formatMoney(f.patient_income||0)}</strong></div><div><span class="field-label">${c.lang==='ar'?'المصروفات':'Expenses'}</span><strong>${c.formatMoney(f.clinic_expenses||0)}</strong></div><div class="wide"><span class="field-label">${c.lang==='ar'?'صافي المركز':'Net position'}</span><strong>${c.formatMoney(f.net_position||0)}</strong></div></div></article><article class="content-card inner-card"><h3>${c.lang==='ar'?'المصروفات المسجلة':'Recorded expenses'}</h3><div class="detail-grid space-top"><div><span class="field-label">${c.lang==='ar'?'عدد العمليات':'Transactions'}</span><strong>${ex.length}</strong></div><div><span class="field-label">${c.lang==='ar'?'إجمالي':'Total'}</span><strong>${c.formatMoney(ex.reduce((s,x)=>s+Number(x.amount||0),0))}</strong></div></div></article></div>`;
    }
    document.getElementById('runReport').onclick=run;
    document.getElementById('exportReport').onclick=()=>{if(!lastRows.length)return run();const csv=lastRows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`clinic-report-${document.getElementById('reportFrom').value}-${document.getElementById('reportTo').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    run();
  }

  async function auditPage(){
    const c=C(); if(!c.hasRole('owner'))return c.route('dashboard'); c.setTitle(c.t('audit'));
    const {data,error}=await c.sb.from('audit_log').select('*').order('changed_at',{ascending:false}).limit(250);if(error)return c.toast(error.message,'error');const rows=data||[];
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">OWNER</span><h2>${c.lang==='ar'?'سجل النشاط':'Audit log'}</h2><p class="muted">${c.lang==='ar'?'سجل غير سريري للتغييرات التشغيلية والمالية والإدارية.':'Non-clinical record of operational, financial and administrative changes.'}</p></div></section><section class="content-card"><div class="filter-row"><select id="auditType" class="control"><option value="">${c.lang==='ar'?'كل الأنواع':'All types'}</option>${[...new Set(rows.map(x=>x.entity_type))].sort().map(x=>`<option value="${c.escape(x)}">${c.escape(x)}</option>`).join('')}</select><select id="auditAction" class="control"><option value="">${c.lang==='ar'?'كل الأفعال':'All actions'}</option>${[...new Set(rows.map(x=>x.action))].sort().map(x=>`<option value="${c.escape(x)}">${c.escape(x)}</option>`).join('')}</select></div><div id="auditArea" class="space-top"></div></section>`;
    const area=document.getElementById('auditArea');
    function draw(){const type=document.getElementById('auditType').value,act=document.getElementById('auditAction').value,filtered=rows.filter(x=>(!type||x.entity_type===type)&&(!act||x.action===act));area.innerHTML=filtered.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'الوقت':'Time'}</th><th>${c.lang==='ar'?'النوع':'Entity'}</th><th>${c.lang==='ar'?'الفعل':'Action'}</th><th>${c.lang==='ar'?'المستخدم':'User ID'}</th><th>${c.lang==='ar'?'تفاصيل':'Details'}</th></tr></thead><tbody>${filtered.map(x=>`<tr><td>${c.formatDate(x.changed_at,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td><td>${c.escape(x.entity_type)}</td><td>${c.escape(x.action)}</td><td><code>${c.escape(x.changed_by||'system')}</code></td><td><code class="audit-json">${c.escape(JSON.stringify(x.details||{}))}</code></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`;}
    document.getElementById('auditType').onchange=draw;document.getElementById('auditAction').onchange=draw;draw();
  }

  window.ClinicPages['reports']=reportsPage;
  window.ClinicPages['audit']=auditPage;
})();
