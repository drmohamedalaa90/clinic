(function(){
  const C=()=>window.Clinic;
  const roleLabels={owner:'Owner',manager:'Manager',deputy_manager:'Deputy Manager',doctor:'Doctor',technical_admin:'Technical Advisor',secretary:'Secretary'};

  async function profilePage(){
    const c=C(); c.setTitle(c.t('profile'));
    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar"><div><span class="eyebrow">ACCOUNT</span><h2>${c.lang==='ar'?'ملفي الشخصي':'My profile'}</h2><p class="muted">${c.lang==='ar'?'الاسم، اللغة، واتساب وكلمة المرور.':'Display name, language, WhatsApp and password.'}</p></div></section>
      <section class="content-card profile-editor-card"><div class="profile-editor-avatar"><div id="profileEditorAvatar" class="profile-large-avatar">${c.escape((c.profile.display_name||'U').charAt(0).toUpperCase())}</div><div><strong>${c.escape(c.profile.email)}</strong><div class="small-note">@${c.escape(c.profile.username||'')}</div><label class="secondary-button file-button">${c.lang==='ar'?'رفع صورة':'Upload photo'}<input id="profilePhoto" type="file" accept="image/*" hidden></label></div></div>
      <form id="profileForm" class="form-grid space-top"><label>${c.lang==='ar'?'الاسم الظاهر':'Display name'}<input id="profName" class="control" value="${c.escape(c.profile.display_name||'')}" required></label><label>${c.lang==='ar'?'اللغة':'Language'}<select id="profLang" class="control"><option value="ar" ${c.profile.preferred_language==='ar'?'selected':''}>العربية</option><option value="en" ${c.profile.preferred_language==='en'?'selected':''}>English</option></select></label><label>${c.lang==='ar'?'واتساب':'WhatsApp'}<input id="profWhats" class="control" value="${c.escape(c.profile.whatsapp||'')}" placeholder="+20..."></label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ الملف':'Save profile'}</button></div></form>
      <hr class="section-divider"><form id="passwordForm" class="form-grid"><label>${c.lang==='ar'?'كلمة مرور جديدة':'New password'}<input id="newPass" class="control" type="password" minlength="8" required></label><label>${c.lang==='ar'?'تأكيد كلمة المرور':'Confirm password'}<input id="newPass2" class="control" type="password" minlength="8" required></label><div class="form-actions full-span"><button class="secondary-button" type="submit">${c.lang==='ar'?'تغيير كلمة المرور':'Change password'}</button></div></form></section>`;

    let newPhotoPath=null;
    await renderProfileImage(document.getElementById('profileEditorAvatar'),c.profile.photo_url);
    document.getElementById('profilePhoto').onchange=async e=>{
      const file=e.target.files?.[0]; if(!file)return;
      if(file.size>3*1024*1024)return c.toast(c.lang==='ar'?'الصورة أكبر من 3MB':'Image is larger than 3 MB','error');
      const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
      const path=`${c.user.id}/avatar-${Date.now()}.${ext}`;
      const {error}=await c.sb.storage.from('profile-photos').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(error)return c.toast(`${c.lang==='ar'?'أنشئ bucket خاص باسم profile-photos أولاً. ':'Create a private profile-photos bucket first. '}${error.message}`,'error');
      newPhotoPath=path; await renderProfileImage(document.getElementById('profileEditorAvatar'),path); c.toast(c.lang==='ar'?'تم رفع الصورة، اضغط حفظ':'Photo uploaded; press Save');
    };

    document.getElementById('profileForm').onsubmit=async e=>{e.preventDefault();const {data,error}=await c.sb.rpc('frontend_save_my_profile',{p_display_name:document.getElementById('profName').value,p_language:document.getElementById('profLang').value,p_whatsapp:document.getElementById('profWhats').value||null,p_photo_path:newPhotoPath});if(error)return c.toast(error.message,'error');c.profile={...c.profile,...data};c.lang=c.profile.preferred_language||c.lang;localStorage.setItem('clinic_language',c.lang);c.applyLanguage();await c.refreshAvatar?.();c.toast(c.lang==='ar'?'تم حفظ الملف':'Profile saved');};
    document.getElementById('passwordForm').onsubmit=async e=>{e.preventDefault();const a=document.getElementById('newPass').value,b=document.getElementById('newPass2').value;if(a!==b)return c.toast(c.lang==='ar'?'كلمتا المرور غير متطابقتين':'Passwords do not match','error');const {error}=await c.sb.auth.updateUser({password:a});if(error)return c.toast(error.message,'error');e.target.reset();c.toast(c.lang==='ar'?'تم تغيير كلمة المرور':'Password changed');};
  }

  async function renderProfileImage(el,path){
    if(!el||!path)return;
    const c=C(); const {data,error}=await c.sb.storage.from('profile-photos').createSignedUrl(path,3600);
    if(error||!data?.signedUrl)return;
    el.textContent='';el.style.backgroundImage=`url("${data.signedUrl}")`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';
  }

  async function usersPage(){
    const c=C(); if(!c.hasRole('owner'))return c.route('dashboard'); c.setTitle(c.t('users'));
    const {data,error}=await c.sb.rpc('frontend_list_clinic_users');
    if(error){c.toast(error.message,'error');return;}
    const users=data||[];
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">OWNER</span><h2>${c.lang==='ar'?'المستخدمون والصلاحيات':'Users & roles'}</h2><p class="muted">${c.lang==='ar'?'إدارة الاسم، اسم المستخدم، الحالة والصلاحيات.':'Manage display names, usernames, active state and roles.'}</p></div></section><section class="content-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>${c.lang==='ar'?'المستخدم':'User'}</th><th>${c.lang==='ar'?'البريد':'Email'}</th><th>${c.lang==='ar'?'اسم المستخدم':'Username'}</th><th>${c.lang==='ar'?'الصلاحيات':'Roles'}</th><th>${c.lang==='ar'?'الحالة':'Status'}</th><th></th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${c.escape(u.display_name||'—')}</strong></td><td>${c.escape(u.email||'—')}</td><td>${c.escape(u.username||'—')}</td><td><div class="chips-list">${(u.roles||[]).map(r=>`<span class="info-chip">${c.escape(roleLabels[r]||r)}</span>`).join('')}</div></td><td>${c.statusPill(u.is_active?'active':'inactive')}</td><td><button class="table-action" data-edit-user="${u.id}">${c.lang==='ar'?'تعديل':'Edit'}</button></td></tr>`).join('')}</tbody></table></div></section>`;
    document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>editUser(users.find(x=>x.id===b.dataset.editUser)));
  }

  function editUser(u){
    const c=C(),roles=['owner','manager','deputy_manager','doctor','technical_admin','secretary'];
    c.showModal({title:c.lang==='ar'?'تعديل المستخدم':'Edit user',body:`<form id="userAdminForm" class="form-grid"><label>${c.lang==='ar'?'الاسم':'Display name'}<input id="uaName" class="control" value="${c.escape(u.display_name||'')}" required></label><label>${c.lang==='ar'?'اسم المستخدم':'Username'}<input id="uaUser" class="control" value="${c.escape(u.username||'')}" required></label><div class="full-span role-check-grid">${roles.map(r=>`<label class="role-check"><input type="checkbox" value="${r}" ${u.roles?.includes(r)?'checked':''}> <span>${c.escape(roleLabels[r])}</span></label>`).join('')}</div><label class="inline-check"><input id="uaActive" type="checkbox" ${u.is_active?'checked':''}> ${c.lang==='ar'?'حساب نشط':'Active account'}</label><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save'}</button></div></form>`,onOpen:(root)=>root.querySelector('#userAdminForm').onsubmit=async e=>{e.preventDefault();const selected=[...root.querySelectorAll('.role-check input:checked')].map(x=>x.value);const {error}=await c.sb.rpc('frontend_owner_update_user',{p_user_id:u.id,p_display_name:root.querySelector('#uaName').value,p_username:root.querySelector('#uaUser').value,p_is_active:root.querySelector('#uaActive').checked,p_roles:selected});if(error)return c.toast(error.message,'error');c.closeModal();c.toast('Saved');c.route('users');}});
  }

  async function settingsPage(){
    const c=C(); if(!c.isManagement())return c.route('profile'); c.setTitle(c.t('settings'));
    const {data,error}=await c.sb.rpc('frontend_get_clinic_settings'); if(error)return c.toast(error.message,'error'); const s=data||{};
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">SETTINGS</span><h2>${c.lang==='ar'?'إعدادات العيادة':'Clinic settings'}</h2></div></section><section class="content-card"><form id="clinicSettingsForm" class="form-grid"><label>${c.lang==='ar'?'اسم العيادة بالإنجليزية':'Clinic name (English)'}<input id="setEn" class="control" value="${c.escape(s.clinic_name_en||'Operation Clinic')}" required></label><label>${c.lang==='ar'?'اسم العيادة بالعربية':'Clinic name (Arabic)'}<input id="setAr" class="control" value="${c.escape(s.clinic_name_ar||'عيادة العمليات')}" required></label><label>${c.lang==='ar'?'هاتف العيادة':'Clinic phone'}<input id="setPhone" class="control" value="${c.escape(s.phone||'')}"></label><label class="full-span">${c.lang==='ar'?'العنوان بالإنجليزية':'Address (English)'}<input id="setAddressEn" class="control" value="${c.escape(s.address_en||'')}"></label><label class="full-span">${c.lang==='ar'?'العنوان بالعربية':'Address (Arabic)'}<input id="setAddressAr" class="control" value="${c.escape(s.address_ar||'')}"></label><div class="settings-fixed"><span>Timezone</span><strong>${c.escape(s.timezone||'Africa/Cairo')}</strong><span>Currency</span><strong>${c.escape(s.currency||'EGP')}</strong></div><div class="form-actions full-span"><button class="primary-button compact" type="submit">${c.lang==='ar'?'حفظ':'Save settings'}</button></div></form></section>`;
    document.getElementById('clinicSettingsForm').onsubmit=async e=>{e.preventDefault();const {error}=await c.sb.rpc('frontend_save_clinic_settings',{p_name_en:document.getElementById('setEn').value,p_name_ar:document.getElementById('setAr').value,p_phone:document.getElementById('setPhone').value||null,p_address_en:document.getElementById('setAddressEn').value||null,p_address_ar:document.getElementById('setAddressAr').value||null});if(error)return c.toast(error.message,'error');c.toast(c.lang==='ar'?'تم حفظ الإعدادات':'Settings saved');};
  }

  async function technicalPage(){
    const c=C(); if(!c.hasRole('technical_admin'))return c.route('dashboard'); c.setTitle(c.t('technical'));
    const {data,error}=await c.sb.rpc('frontend_system_health'); if(error)return c.toast(error.message,'error'); const h=data||{};
    document.getElementById('mainContent').innerHTML=`<section class="page-toolbar"><div><span class="eyebrow">TECHNICAL</span><h2>${c.lang==='ar'?'الإدارة التقنية':'Technical administration'}</h2><p class="muted">${c.lang==='ar'?'ملخص آمن لصحة النظام بدون محتوى سريري.':'Safe system health overview without clinical content.'}</p></div><div class="toolbar-actions"><button id="refreshHealth" class="secondary-button">↻ ${c.lang==='ar'?'تحديث':'Refresh'}</button></div></section><section class="dashboard-grid dashboard-grid-six">${[['👥','Active users',h.active_users],['🩺','Active doctors',h.active_doctors],['🧑','Active patients',h.active_patients],['📅','Appointments today',h.appointments_today],['⇄','Pending referrals',h.pending_referrals],['📦','Pending logistics',h.pending_logistics]].map(x=>`<article class="stat-card"><span class="stat-icon">${x[0]}</span><span class="stat-label">${x[1]}</span><strong>${x[2]??'—'}</strong></article>`).join('')}</section><section class="content-card"><div class="detail-grid"><div><span class="field-label">Database time</span><strong>${c.formatDate(h.database_time,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</strong></div><div><span class="field-label">Timezone</span><strong>${c.escape(h.timezone||'Africa/Cairo')}</strong></div><div><span class="field-label">Audit rows</span><strong>${h.audit_rows??'—'}</strong></div><div><span class="field-label">Frontend</span><strong>Tasks 13B–13K</strong></div></div></section>`;
    document.getElementById('refreshHealth').onclick=technicalPage;
  }

  window.ClinicPages['profile']=profilePage;
  window.ClinicPages['users']=usersPage;
  window.ClinicPages['settings']=settingsPage;
  window.ClinicPages['technical']=technicalPage;
})();
