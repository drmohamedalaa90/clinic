(function(){
  const C=()=>window.Clinic;

  async function render(){
    const c=C(); if(!c.isReception()) return c.route('dashboard');
    c.setTitle(c.t('logistics'));
    const [{data:reqs},{data:cats},{data:expenses}] = await Promise.all([
      c.sb.from('logistics_requests').select('*').order('requested_at',{ascending:false}).limit(100),
      c.sb.from('expense_categories').select('*').eq('is_active',true).order('name_en'),
      c.sb.from('clinic_expenses').select('*').order('expense_at',{ascending:false}).limit(100)
    ]);
    const catMap=new Map((cats||[]).map(x=>[x.id,x]));
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">OPERATIONS</span><h2>${c.lang==='ar'?'احتياجات ومصروفات العيادة':'Clinic logistics & expenses'}</h2><p class="muted">${c.lang==='ar'?'طلبات الشراء، الموافقات، المصروفات والمتابعة.':'Requests, approvals, purchases and expense tracking.'}</p></div><div class="toolbar-actions"><button id="newLogistics" class="primary-button compact">+ ${c.lang==='ar'?'طلب جديد':'New request'}</button>${c.isManagement()?`<button id="directExpense" class="secondary-button">+ ${c.lang==='ar'?'مصروف مباشر':'Direct expense'}</button>`:''}</div></section>
      <div class="tabs" id="logTabs"><button class="tab active" data-tab="requests">${c.lang==='ar'?'الطلبات':'Requests'}</button><button class="tab" data-tab="expenses">${c.lang==='ar'?'المصروفات':'Expenses'}</button></div>
      <section class="content-card"><div id="logArea"></div></section>`;
    const area=document.getElementById('logArea');

    function requests(){
      const rows=reqs||[];
      area.innerHTML=rows.length?`<div class="stack-list">${rows.map(r=>{const cat=catMap.get(r.category_id)||{};return `<article class="list-card"><div><div class="referral-topline">${c.statusPill(r.status)} ${r.urgency==='urgent'?'<span class="urgent-tag">URGENT</span>':''}</div><div class="list-title">${c.escape(r.item_name)}</div><div class="small-note">${c.escape(cat.name_en||'Other')} • ${r.quantity||'—'} ${c.escape(r.unit||'')} ${r.estimated_cost!=null?`• ${c.lang==='ar'?'تقديري':'Est.'} ${c.formatMoney(r.estimated_cost)}`:''}</div>${r.request_notes?`<div class="small-note">${c.escape(r.request_notes)}</div>`:''}</div><div class="list-actions">${c.isManagement()&&r.status==='requested'?`<button class="table-action success-outline" data-review="${r.id}" data-action="approve">Approve</button><button class="table-action danger-outline" data-review="${r.id}" data-action="reject">Reject</button>`:''}${['approved','paid'].includes(r.status)?`<button class="table-action" data-purchase="${r.id}">${r.status==='approved'?(c.lang==='ar'?'تسجيل شراء':'Record purchase'):(c.lang==='ar'?'تفاصيل':'Details')}</button>`:''}${r.status==='paid'?`<button class="table-action success-outline" data-complete="${r.id}">${c.lang==='ar'?'إكمال':'Complete'}</button>`:''}</div></article>`}).join('')}</div>`:`<div class="empty-state">${c.t('noData')}</div>`;
      area.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewRequest(b.dataset.review,b.dataset.action));
      area.querySelectorAll('[data-purchase]').forEach(b=>b.onclick=()=>expenseModal(cats||[],reqs.find(x=>x.id===b.dataset.purchase)));
      area.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>completeRequest(b.dataset.complete));
    }

    function expenseRows(){
      area.innerHTML=(expenses||[]).length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'رقم':'No.'}</th><th>${c.lang==='ar'?'الوصف':'Description'}</th><th>${c.lang==='ar'?'الفئة':'Category'}</th><th>${c.lang==='ar'?'المبلغ':'Amount'}</th><th>${c.lang==='ar'?'الطريقة':'Method'}</th><th>${c.lang==='ar'?'التاريخ':'Date'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th><th></th></tr></thead><tbody>${expenses.map(e=>`<tr><td><strong>${c.escape(e.expense_number)}</strong></td><td>${c.escape(e.description)}</td><td>${c.escape(catMap.get(e.category_id)?.name_en||'—')}</td><td>${c.formatMoney(e.amount)}</td><td>${c.escape(e.payment_method)}</td><td>${c.formatDate(e.expense_at,{hour:'2-digit',minute:'2-digit'})}</td><td>${e.is_voided?c.statusPill('voided'):c.statusPill('paid')}</td><td>${c.isManagement()&&!e.is_voided?`<button class="table-action danger-outline" data-void-expense="${e.id}">${c.lang==='ar'?'إلغاء':'Void'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${c.t('noData')}</div>`;
      area.querySelectorAll('[data-void-expense]').forEach(b=>b.onclick=()=>voidExpense(b.dataset.voidExpense));
    }

    document.querySelectorAll('#logTabs .tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('#logTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');b.dataset.tab==='requests'?requests():expenseRows();});
    document.getElementById('newLogistics').onclick=()=>requestModal(cats||[]);
    document.getElementById('directExpense')?.addEventListener('click',()=>expenseModal(cats||[],null));
    requests();
  }

  function requestModal(cats){
    const c=C();
    c.showModal({title:c.lang==='ar'?'طلب احتياج جديد':'New logistics request',body:`<form id="reqForm" class="form-grid"><label>${c.lang==='ar'?'البند':'Item'}<input id="reqItem" class="control" required></label><label>${c.lang==='ar'?'الفئة':'Category'}<select id="reqCat" class="control"><option value="">—</option>${cats.map(x=>`<option value="${x.id}">${c.escape(x.name_en)}</option>`).join('')}</select></label><label>${c.lang==='ar'?'الكمية':'Quantity'}<input id="reqQty" class="control" type="number" min="0.01" step="0.01"></label><label>${c.lang==='ar'?'الوحدة':'Unit'}<input id="reqUnit" class="control"></label><label>${c.lang==='ar'?'التكلفة التقديرية':'Estimated cost'}<input id="reqCost" class="control" type="number" min="0" step="0.01"></label><label>${c.lang==='ar'?'مطلوب قبل':'Needed by'}<input id="reqNeeded" class="control" type="date"></label><label>${c.lang==='ar'?'الأولوية':'Urgency'}<select id="reqUrgency" class="control"><option value="routine">Routine</option><option value="urgent">Urgent</option></select></label><label class="full-span">${c.lang==='ar'?'ملاحظات':'Notes'}<textarea id="reqNotes" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'إرسال':'Submit'}</button></div></form>`,onOpen:(root)=>root.querySelector('#reqForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('create_logistics_request',{p_item_name:root.querySelector('#reqItem').value,p_category_id:root.querySelector('#reqCat').value||null,p_quantity:root.querySelector('#reqQty').value?Number(root.querySelector('#reqQty').value):null,p_unit:root.querySelector('#reqUnit').value||null,p_estimated_cost:root.querySelector('#reqCost').value?Number(root.querySelector('#reqCost').value):null,p_needed_by:root.querySelector('#reqNeeded').value||null,p_urgency:root.querySelector('#reqUrgency').value,p_notes:root.querySelector('#reqNotes').value||null});if(error)return c.toast(error.message,'error');c.closeModal();c.toast(c.lang==='ar'?'تم إرسال الطلب':'Request submitted');c.route('logistics');}});
  }

  async function reviewRequest(id,action){
    const c=C();let note=null;if(action==='reject'){note=prompt(c.lang==='ar'?'سبب الرفض':'Rejection reason');if(!note)return;}const {error}=await c.sb.rpc('review_logistics_request',{p_request_id:id,p_action:action,p_note:note});if(error)return c.toast(error.message,'error');c.toast('Updated');c.route('logistics');
  }

  function expenseModal(cats,request){
    const c=C();
    c.showModal({title:request?(c.lang==='ar'?'تسجيل شراء':'Record purchase'):(c.lang==='ar'?'مصروف مباشر':'Direct expense'),body:`<form id="expenseForm" class="form-grid"><label>${c.lang==='ar'?'الفئة':'Category'}<select id="expCat" class="control" required>${cats.map(x=>`<option value="${x.id}" ${x.id===request?.category_id?'selected':''}>${c.escape(x.name_en)}</option>`).join('')}</select></label><label>${c.lang==='ar'?'المبلغ':'Amount'}<input id="expAmount" class="control" type="number" min="0.01" step="0.01" required></label><label class="full-span">${c.lang==='ar'?'الوصف':'Description'}<input id="expDesc" class="control" value="${c.escape(request?.item_name||'')}" required></label><label>${c.lang==='ar'?'طريقة الدفع':'Payment method'}<select id="expMethod" class="control"><option value="cash">Cash</option><option value="card">Card</option><option value="instapay">InstaPay</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label>${c.lang==='ar'?'المورد':'Vendor'}<input id="expVendor" class="control"></label><label>${c.lang==='ar'?'مرجع':'Reference'}<input id="expRef" class="control"></label><label>${c.lang==='ar'?'التاريخ والوقت':'Date/time'}<input id="expDate" class="control" type="datetime-local"></label><label class="full-span">${c.lang==='ar'?'ملاحظات':'Notes'}<textarea id="expNotes" class="control"></textarea></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#expenseForm').onsubmit=async e=>{e.preventDefault();const local=root.querySelector('#expDate').value;const expenseAt=local?`${local}:00+03:00`:null;const args={p_category_id:root.querySelector('#expCat').value,p_description:root.querySelector('#expDesc').value,p_amount:Number(root.querySelector('#expAmount').value),p_method:root.querySelector('#expMethod').value,p_logistics_request_id:request?.id||null,p_vendor:root.querySelector('#expVendor').value||null,p_reference:root.querySelector('#expRef').value||null,p_notes:root.querySelector('#expNotes').value||null,p_receipt_path:null,p_receipt_original_name:null};if(expenseAt)args.p_expense_at=expenseAt;const {error}=await c.sb.rpc('record_clinic_expense',args);if(error)return c.toast(error.message,'error');c.closeModal();c.toast(c.lang==='ar'?'تم تسجيل المصروف':'Expense recorded');c.route('logistics');}});
  }

  async function completeRequest(id){const c=C();const {error}=await c.sb.rpc('complete_logistics_request',{p_request_id:id});if(error)return c.toast(error.message,'error');c.toast('Completed');c.route('logistics');}
  async function voidExpense(id){const c=C();const reason=prompt(c.lang==='ar'?'سبب الإلغاء':'Void reason');if(!reason)return;const {error}=await c.sb.rpc('void_clinic_expense',{p_expense_id:id,p_reason:reason});if(error)return c.toast(error.message,'error');c.toast('Voided');c.route('logistics');}

  window.ClinicPages['logistics']=render;
})();
