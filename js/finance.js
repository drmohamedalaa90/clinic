(function(){
  const C=()=>window.Clinic;

  async function patientMap(ids){
    const c=C(); const uniq=[...new Set((ids||[]).filter(Boolean))];
    if(!uniq.length) return new Map();
    const {data}=await c.sb.from('patients').select('id,medical_record_number,english_name,arabic_name').in('id',uniq);
    return new Map((data||[]).map(p=>[p.id,p]));
  }

  async function renderFinance(){
    const c=C();
    if(!c.isReception()) return c.route('dashboard');
    c.setTitle(c.t('finance'));
    const today=c.cairoDate();
    const [{data:sum},{data:invoices},{data:services},{data:closings}] = await Promise.all([
      c.sb.rpc('frontend_income_summary',{p_from:today,p_to:today}),
      c.sb.from('invoices').select('*').order('created_at',{ascending:false}).limit(80),
      c.sb.from('clinic_services').select('*').order('is_active',{ascending:false}).order('name_en'),
      c.sb.from('cash_closings').select('*').order('closing_date',{ascending:false}).limit(20)
    ]);
    const inv=invoices||[], pm=await patientMap(inv.map(x=>x.patient_id));
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">FINANCE</span><h2>${c.lang==='ar'?'المالية والفواتير':'Finance & invoices'}</h2><p class="muted">${c.lang==='ar'?'الفواتير، التحصيل، الخدمات والإغلاق النقدي.':'Invoices, payments, services and daily cash closing.'}</p></div>
      <div class="toolbar-actions"><button id="newInvoice" class="primary-button compact">+ ${c.lang==='ar'?'فاتورة':'Invoice'}</button></div></section>
      <section class="dashboard-grid">
        <article class="stat-card"><span class="stat-icon">💰</span><span class="stat-label">${c.lang==='ar'?'تحصيل اليوم':'Received today'}</span><strong>${c.formatMoney(sum?.total_received||0)}</strong></article>
        <article class="stat-card"><span class="stat-icon">💵</span><span class="stat-label">${c.lang==='ar'?'نقدي':'Cash'}</span><strong>${c.formatMoney(sum?.cash_received||0)}</strong></article>
        <article class="stat-card"><span class="stat-icon">📲</span><span class="stat-label">InstaPay</span><strong>${c.formatMoney(sum?.instapay_received||0)}</strong></article>
        <article class="stat-card"><span class="stat-icon">🧾</span><span class="stat-label">${c.lang==='ar'?'مدفوعات اليوم':'Payments today'}</span><strong>${sum?.payment_count||0}</strong></article>
      </section>
      <div class="tabs" id="financeTabs"><button class="tab active" data-tab="invoices">${c.lang==='ar'?'الفواتير':'Invoices'}</button><button class="tab" data-tab="services">${c.lang==='ar'?'الخدمات والأسعار':'Services'}</button><button class="tab" data-tab="closing">${c.lang==='ar'?'الإغلاق النقدي':'Cash closing'}</button></div>
      <section class="content-card"><div id="financeArea"></div></section>`;

    const area=document.getElementById('financeArea');
    function showInvoices(){
      area.innerHTML=inv.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'الفاتورة':'Invoice'}</th><th>${c.lang==='ar'?'المريض':'Patient'}</th><th>${c.lang==='ar'?'الإجمالي':'Total'}</th><th>${c.lang==='ar'?'المدفوع':'Paid'}</th><th>${c.lang==='ar'?'المتبقي':'Balance'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th><th></th></tr></thead><tbody>${inv.map(i=>{const p=pm.get(i.patient_id)||{};return `<tr><td><strong>${c.escape(i.invoice_number)}</strong><div class="subline">${c.formatDate(i.created_at)}</div></td><td>${c.escape(p.english_name||p.arabic_name||'Patient')}<div class="subline">${c.escape(p.medical_record_number||'')}</div></td><td>${c.formatMoney(i.total_amount)}</td><td>${c.formatMoney(i.paid_amount)}</td><td>${c.formatMoney(i.balance_due)}</td><td>${c.statusPill(i.status)}</td><td><button class="table-action" data-open-invoice="${i.id}">${c.lang==='ar'?'فتح':'Open'}</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`;
      area.querySelectorAll('[data-open-invoice]').forEach(b=>b.onclick=()=>openInvoice(b.dataset.openInvoice));
    }

    function showServices(){
      area.innerHTML=`<div class="section-head"><h3>${c.lang==='ar'?'قائمة الخدمات':'Service price list'}</h3>${c.isManagement()?`<button id="addService" class="primary-button compact">+ ${c.lang==='ar'?'خدمة':'Service'}</button>`:''}</div>${services?.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'الخدمة':'Service'}</th><th>${c.lang==='ar'?'الفئة':'Category'}</th><th>${c.lang==='ar'?'السعر':'Price'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th>${c.isManagement()?'<th></th>':''}</tr></thead><tbody>${services.map(s=>`<tr><td><strong>${c.escape(s.name_en)}</strong>${s.name_ar?`<div class="subline">${c.escape(s.name_ar)}</div>`:''}</td><td>${c.escape(s.category||'—')}</td><td>${c.formatMoney(s.default_price)}</td><td>${c.statusPill(s.is_active?'active':'inactive')}</td>${c.isManagement()?`<td><button class="table-action" data-edit-service="${s.id}">${c.lang==='ar'?'تعديل':'Edit'}</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`}`;
      if(c.isManagement()){
        document.getElementById('addService')?.addEventListener('click',()=>serviceModal());
        area.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>serviceModal(services.find(x=>x.id===b.dataset.editService)));
      }
    }

    function showClosing(){
      area.innerHTML=`<div class="section-head"><h3>${c.lang==='ar'?'الإغلاق النقدي اليومي':'Daily cash closing'}</h3><button id="submitClosing" class="primary-button compact">${c.lang==='ar'?'إرسال إغلاق':'Submit closing'}</button></div>${closings?.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'التاريخ':'Date'}</th><th>${c.lang==='ar'?'المتوقع':'Expected'}</th><th>${c.lang==='ar'?'الفعلي':'Actual'}</th><th>${c.lang==='ar'?'الفرق':'Difference'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th><th></th></tr></thead><tbody>${closings.map(x=>`<tr><td>${x.closing_date}</td><td>${c.formatMoney(x.expected_cash)}</td><td>${c.formatMoney(x.actual_cash)}</td><td class="${Number(x.discrepancy)<0?'text-danger':''}">${c.formatMoney(x.discrepancy)}</td><td>${c.statusPill(x.status)}</td><td>${c.isManagement()&&x.status==='submitted'?`<button class="table-action success-outline" data-close-review="${x.id}" data-action="approve">✓</button><button class="table-action danger-outline" data-close-review="${x.id}" data-action="reject">✕</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`}`;
      document.getElementById('submitClosing')?.addEventListener('click',submitClosingModal);
      area.querySelectorAll('[data-close-review]').forEach(b=>b.onclick=()=>reviewClosing(b.dataset.closeReview,b.dataset.action));
    }

    document.querySelectorAll('#financeTabs .tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('#financeTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.tab==='invoices')showInvoices();if(b.dataset.tab==='services')showServices();if(b.dataset.tab==='closing')showClosing();});
    document.getElementById('newInvoice').onclick=newInvoiceModal;
    showInvoices();
  }

  async function newInvoiceModal(){
    const c=C();
    const [{data:patients},{data:appointments}]=await Promise.all([
      c.sb.from('patients').select('id,medical_record_number,english_name,arabic_name').eq('is_active',true).order('created_at',{ascending:false}).limit(300),
      c.sb.from('appointments').select('id,appointment_number,patient_id,doctor_id,scheduled_start,status').order('scheduled_start',{ascending:false}).limit(200)
    ]);
    c.showModal({title:c.lang==='ar'?'فاتورة جديدة':'New invoice',body:`<form id="invoiceForm" class="form-grid"><label class="full-span">${c.lang==='ar'?'المريض':'Patient'}<select id="invPatient" class="control" required><option value="">—</option>${(patients||[]).map(p=>`<option value="${p.id}">${c.escape(p.english_name||p.arabic_name||'Patient')} • ${c.escape(p.medical_record_number||'')}</option>`).join('')}</select></label><label class="full-span">${c.lang==='ar'?'الحجز (اختياري)':'Appointment (optional)'}<select id="invAppointment" class="control"><option value="">—</option></select></label><label class="full-span">${c.lang==='ar'?'ملاحظات':'Notes'}<textarea id="invNotes" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'إنشاء':'Create'}</button></div></form>`,onOpen:(root)=>{
      const psel=root.querySelector('#invPatient'),asel=root.querySelector('#invAppointment');
      function loadAppts(){asel.innerHTML='<option value="">—</option>'+((appointments||[]).filter(a=>a.patient_id===psel.value).map(a=>`<option value="${a.id}">${c.formatDate(a.scheduled_start,{hour:'2-digit',minute:'2-digit'})} • ${a.status}</option>`).join(''));}
      psel.onchange=loadAppts;
      root.querySelector('#invoiceForm').onsubmit=async e=>{e.preventDefault();const {data,error}=await c.sb.rpc('create_invoice',{p_patient_id:psel.value,p_appointment_id:asel.value||null,p_notes:root.querySelector('#invNotes').value||null});if(error)return c.toast(error.message,'error');c.closeModal();c.toast(c.lang==='ar'?'تم إنشاء الفاتورة':'Invoice created');await c.route('finance');if(data?.id) setTimeout(()=>openInvoice(data.id),100);};
    }});
  }

  async function openInvoice(id){
    const c=C();
    const [{data:invoice,error},{data:items},{data:payments},{data:services}]=await Promise.all([
      c.sb.from('invoices').select('*').eq('id',id).single(),
      c.sb.from('invoice_items').select('*').eq('invoice_id',id).order('created_at'),
      c.sb.from('invoice_payments').select('*').eq('invoice_id',id).order('received_at'),
      c.sb.from('clinic_services').select('*').eq('is_active',true).order('name_en')
    ]);
    if(error)return c.toast(error.message,'error');
    const pm=await patientMap([invoice.patient_id]),p=pm.get(invoice.patient_id)||{};
    c.showModal({title:`${invoice.invoice_number} — ${c.escape(p.english_name||p.arabic_name||'Patient')}`,wide:true,body:`
      <div class="invoice-total-grid"><div><span>${c.lang==='ar'?'الإجمالي':'Total'}</span><strong>${c.formatMoney(invoice.total_amount)}</strong></div><div><span>${c.lang==='ar'?'المدفوع':'Paid'}</span><strong>${c.formatMoney(invoice.paid_amount)}</strong></div><div><span>${c.lang==='ar'?'المتبقي':'Balance'}</span><strong>${c.formatMoney(invoice.balance_due)}</strong></div><div><span>${c.lang==='ar'?'الحالة':'Status'}</span>${c.statusPill(invoice.status)}</div></div>
      <div class="section-head space-top"><h3>${c.lang==='ar'?'البنود':'Items'}</h3>${invoice.status!=='voided'?`<button id="invoiceAddItem" class="secondary-button">+ ${c.lang==='ar'?'بند':'Item'}</button>`:''}</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'البند':'Item'}</th><th>Qty</th><th>${c.lang==='ar'?'السعر':'Price'}</th><th>${c.lang==='ar'?'الخصم':'Discount'}</th><th>${c.lang==='ar'?'الإجمالي':'Total'}</th></tr></thead><tbody>${(items||[]).map(x=>`<tr><td>${c.escape(x.item_name_en)}</td><td>${x.quantity}</td><td>${c.formatMoney(x.unit_price)}</td><td>${c.formatMoney(x.discount_amount)}</td><td>${c.formatMoney(x.line_total)}</td></tr>`).join('')||'<tr><td colspan="5">—</td></tr>'}</tbody></table></div>
      <div class="section-head space-top"><h3>${c.lang==='ar'?'المدفوعات':'Payments'}</h3>${invoice.status!=='voided'&&Number(invoice.balance_due)>0?`<button id="invoiceAddPayment" class="primary-button compact">+ ${c.lang==='ar'?'دفعة':'Payment'}</button>`:''}</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'القيمة':'Amount'}</th><th>${c.lang==='ar'?'الطريقة':'Method'}</th><th>${c.lang==='ar'?'التاريخ':'Date'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th></tr></thead><tbody>${(payments||[]).map(x=>`<tr><td>${c.formatMoney(x.amount)}</td><td>${c.escape(x.payment_method)}</td><td>${c.formatDate(x.received_at,{hour:'2-digit',minute:'2-digit'})}</td><td>${x.is_voided?c.statusPill('voided'):c.statusPill('paid')}</td></tr>`).join('')||'<tr><td colspan="4">—</td></tr>'}</tbody></table></div>
      ${c.isManagement()&&invoice.status!=='voided'?`<div class="form-actions space-top"><button id="invoiceDiscount" class="secondary-button">${c.lang==='ar'?'خصم الفاتورة':'Invoice discount'}</button><button id="invoiceVoid" class="danger-button">${c.lang==='ar'?'إلغاء الفاتورة':'Void invoice'}</button></div>`:''}`,
      onOpen:(root)=>{
        root.querySelector('#invoiceAddItem')?.addEventListener('click',()=>addItemModal(invoice,services||[]));
        root.querySelector('#invoiceAddPayment')?.addEventListener('click',()=>paymentModal(invoice));
        root.querySelector('#invoiceDiscount')?.addEventListener('click',async()=>{const val=prompt(c.lang==='ar'?'قيمة الخصم':'Discount amount',invoice.invoice_discount||0);if(val===null)return;const {error}=await c.sb.rpc('set_invoice_discount',{p_invoice_id:invoice.id,p_discount:Number(val)});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Updated');openInvoice(invoice.id);});
        root.querySelector('#invoiceVoid')?.addEventListener('click',async()=>{const reason=prompt(c.lang==='ar'?'سبب الإلغاء':'Void reason');if(!reason)return;const {error}=await c.sb.rpc('void_invoice',{p_invoice_id:invoice.id,p_reason:reason});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Updated');c.route('finance');});
      }});
  }

  function addItemModal(invoice,services){
    const c=C();
    c.showModal({title:c.lang==='ar'?'إضافة بند':'Add invoice item',body:`<form id="itemForm" class="form-grid"><label class="full-span">${c.lang==='ar'?'الخدمة':'Service'}<select id="itemService" class="control" required>${services.map(s=>`<option value="${s.id}">${c.escape(s.name_en)} — ${c.formatMoney(s.default_price)}</option>`).join('')}</select></label><label>Qty<input id="itemQty" class="control" type="number" min="0.01" step="0.01" value="1"></label>${c.isManagement()?`<label>${c.lang==='ar'?'سعر بديل':'Override price'}<input id="itemPrice" class="control" type="number" min="0" step="0.01"></label><label>${c.lang==='ar'?'خصم':'Discount'}<input id="itemDiscount" class="control" type="number" min="0" step="0.01" value="0"></label>`:''}<div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'إضافة':'Add'}</button></div></form>`,onOpen:(root)=>root.querySelector('#itemForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('add_invoice_item',{p_invoice_id:invoice.id,p_service_id:root.querySelector('#itemService').value,p_quantity:Number(root.querySelector('#itemQty').value||1),p_override_price:c.isManagement()&&root.querySelector('#itemPrice').value?Number(root.querySelector('#itemPrice').value):null,p_discount_amount:c.isManagement()?Number(root.querySelector('#itemDiscount').value||0):0});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Added');openInvoice(invoice.id);}});
  }

  function paymentModal(invoice){
    const c=C();
    c.showModal({title:c.lang==='ar'?'تسجيل دفعة':'Record payment',body:`<form id="payForm" class="form-grid"><label>${c.lang==='ar'?'القيمة':'Amount'}<input id="payAmount" class="control" type="number" min="0.01" step="0.01" max="${invoice.balance_due}" value="${invoice.balance_due}" required></label><label>${c.lang==='ar'?'الطريقة':'Method'}<select id="payMethod" class="control"><option value="cash">Cash</option><option value="card">Card</option><option value="instapay">InstaPay</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label class="full-span">${c.lang==='ar'?'مرجع':'Reference'}<input id="payRef" class="control"></label><label class="full-span">${c.lang==='ar'?'ملاحظات':'Notes'}<textarea id="payNotes" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#payForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('record_invoice_payment',{p_invoice_id:invoice.id,p_amount:Number(root.querySelector('#payAmount').value),p_method:root.querySelector('#payMethod').value,p_reference:root.querySelector('#payRef').value||null,p_notes:root.querySelector('#payNotes').value||null});if(error)return c.toast(error.message,'error');c.closeModal();c.toast(c.lang==='ar'?'تم تسجيل الدفعة':'Payment recorded');openInvoice(invoice.id);}});
  }

  function serviceModal(s=null){
    const c=C();
    c.showModal({title:s?(c.lang==='ar'?'تعديل خدمة':'Edit service'):(c.lang==='ar'?'خدمة جديدة':'New service'),body:`<form id="serviceForm" class="form-grid"><label>${c.lang==='ar'?'الاسم بالإنجليزية':'English name'}<input id="svcEn" class="control" value="${c.escape(s?.name_en||'')}" required></label><label>${c.lang==='ar'?'الاسم بالعربية':'Arabic name'}<input id="svcAr" class="control" value="${c.escape(s?.name_ar||'')}"></label><label>${c.lang==='ar'?'الفئة':'Category'}<input id="svcCat" class="control" value="${c.escape(s?.category||'')}"></label><label>${c.lang==='ar'?'السعر':'Price'}<input id="svcPrice" class="control" type="number" min="0" step="0.01" value="${s?.default_price||0}" required></label><label class="inline-check"><input id="svcActive" type="checkbox" ${s?.is_active===false?'':'checked'}> ${c.lang==='ar'?'نشط':'Active'}</label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#serviceForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('save_clinic_service',{p_service_id:s?.id||null,p_name_en:root.querySelector('#svcEn').value,p_name_ar:root.querySelector('#svcAr').value||null,p_category:root.querySelector('#svcCat').value||null,p_price:Number(root.querySelector('#svcPrice').value),p_doctor_id:s?.doctor_id||null,p_is_active:root.querySelector('#svcActive').checked});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Saved');c.route('finance');}});
  }

  function submitClosingModal(){
    const c=C(); const today=c.cairoDate();
    c.showModal({title:c.lang==='ar'?'إغلاق نقدي':'Cash closing',body:`<form id="closeForm" class="form-grid"><label>${c.lang==='ar'?'التاريخ':'Date'}<input id="closeDate" class="control" type="date" value="${today}" required></label><label>${c.lang==='ar'?'رصيد بداية اليوم':'Opening cash'}<input id="openCash" class="control" type="number" min="0" step="0.01" value="0" required></label><label>${c.lang==='ar'?'النقد الفعلي':'Actual cash'}<input id="actualCash" class="control" type="number" min="0" step="0.01" required></label><label class="full-span">${c.lang==='ar'?'ملاحظات':'Notes'}<textarea id="closeNotes" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'إرسال':'Submit'}</button></div></form>`,onOpen:(root)=>root.querySelector('#closeForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('submit_cash_closing',{p_closing_date:root.querySelector('#closeDate').value,p_opening_cash:Number(root.querySelector('#openCash').value),p_actual_cash:Number(root.querySelector('#actualCash').value),p_notes:root.querySelector('#closeNotes').value||null});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Submitted');c.route('finance');}});
  }

  async function reviewClosing(id,action){
    const c=C();let note=null;if(action==='reject'){note=prompt(c.lang==='ar'?'سبب الرفض':'Rejection reason');if(!note)return;}const {error}=await c.sb.rpc('review_cash_closing',{p_closing_id:id,p_action:action,p_note:note});if(error)return c.toast(error.message,'error');c.toast('Updated');c.route('finance');
  }

  window.ClinicPages['finance']=renderFinance;
})();
