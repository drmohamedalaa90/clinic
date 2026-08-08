window.ClinicNotifications = {
  items: [],
  seen: new Set(JSON.parse(localStorage.getItem('clinic_notification_seen') || '[]')),

  markSeen(id){ this.seen.add(id); localStorage.setItem('clinic_notification_seen', JSON.stringify([...this.seen].slice(-250))); },

  async refresh(){
    const C=Clinic;if(!C.user)return;
    const items=[];
    try{
      if(C.isDoctor()){
        const [refs,waiting,exceptions]=await Promise.all([
          C.sb.from('referrals').select('id,patient_id,urgency,referral_reason,created_at').eq('to_doctor_id',C.user.id).eq('status','pending').order('created_at',{ascending:false}).limit(20),
          C.sb.from('appointments').select('id,patient_id,sent_to_doctor_at').eq('doctor_id',C.user.id).eq('status','waiting').order('sent_to_doctor_at',{ascending:true}).limit(20),
          C.sb.from('doctor_schedule_exceptions').select('id,status,exception_date,exception_type,reviewed_at').eq('doctor_id',C.user.id).in('status',['approved','rejected']).order('reviewed_at',{ascending:false}).limit(10)
        ]);
        (refs.data||[]).forEach(x=>items.push({id:`ref-${x.id}`,icon:x.urgency==='urgent'?'🚨':'⇄',title:x.urgency==='urgent'?'Urgent referral':'New referral',text:x.referral_reason,time:x.created_at,page:'referrals'}));
        (waiting.data||[]).forEach(x=>items.push({id:`wait-${x.id}`,icon:'⌛',title:C.lang==='ar'?'مريض في الانتظار':'Patient waiting',text:C.lang==='ar'?'المريض جاهز للدخول.':'Patient is ready for consultation.',time:x.sent_to_doctor_at,page:'queue'}));
        (exceptions.data||[]).forEach(x=>items.push({id:`schedule-${x.id}-${x.status}`,icon:x.status==='approved'?'✓':'✕',title:`Schedule ${x.status}`,text:`${x.exception_type.replaceAll('_',' ')} • ${x.exception_date}`,time:x.reviewed_at,page:'my-schedule'}));
      }
      if(C.isManagement()){
        const {data}=await C.sb.from('doctor_schedule_exceptions').select('id,doctor_id,exception_date,exception_type,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(20);
        (data||[]).forEach(x=>items.push({id:`schedule-pending-${x.id}`,icon:'🕒',title:C.lang==='ar'?'طلب جدول جديد':'Schedule request',text:`${C.doctorName(x.doctor_id)} • ${x.exception_type.replaceAll('_',' ')} • ${x.exception_date}`,time:x.created_at,page:'schedules'}));
      }
    }catch(e){console.warn('Notifications',e);}
    this.items=items.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0));
    this.render();
  },

  render(){
    const C=Clinic,badge=document.getElementById('notificationBadge'),list=document.getElementById('notificationList');
    if(!badge||!list)return;
    const unread=this.items.filter(x=>!this.seen.has(x.id)).length;
    badge.textContent=unread>99?'99+':unread;badge.classList.toggle('hidden',unread===0);
    list.innerHTML=this.items.length?this.items.map(x=>`<button class="notification-item ${this.seen.has(x.id)?'read':''}" data-notification="${x.id}" data-page="${x.page}"><span class="notification-icon">${x.icon}</span><span><strong>${C.escape(x.title)}</strong><small>${C.escape(x.text||'')}</small><em>${x.time?C.formatDate(x.time,{hour:'2-digit',minute:'2-digit'}):''}</em></span></button>`).join(''):`<div class="empty-state">${C.lang==='ar'?'لا توجد إشعارات حالياً.':'No notifications right now.'}</div>`;
    list.querySelectorAll('[data-notification]').forEach(b=>b.onclick=()=>{this.markSeen(b.dataset.notification);this.close();C.route(b.dataset.page);this.render();});
  },

  open(){ document.getElementById('notificationDrawer').classList.add('open');document.getElementById('drawerOverlay').classList.add('show');this.items.forEach(x=>this.markSeen(x.id));this.render(); },
  close(){ document.getElementById('notificationDrawer').classList.remove('open');document.getElementById('drawerOverlay').classList.remove('show'); }
};

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('notificationButton').addEventListener('click',()=>ClinicNotifications.open());
  document.getElementById('closeNotifications').addEventListener('click',()=>ClinicNotifications.close());
  document.getElementById('drawerOverlay').addEventListener('click',()=>ClinicNotifications.close());
  setInterval(()=>ClinicNotifications.refresh(),60000);
});
