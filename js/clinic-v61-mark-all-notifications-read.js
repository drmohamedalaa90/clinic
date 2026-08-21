(() => {
  const C = window.Clinic;
  if (!C || C.__v61MarkAllNotificationsLoaded) return;
  C.__v61MarkAllNotificationsLoaded = true;

  function addStyles(){
    if(document.getElementById('v61-mark-all-read-styles')) return;

    const s=document.createElement('style');
    s.id='v61-mark-all-read-styles';
    s.textContent=`
      .v61-mark-all-read{
        border:0;
        background:transparent;
        color:#0f8b78;
        font-weight:850;
        font-size:12px;
        cursor:pointer;
        padding:7px 9px;
        border-radius:9px;
        white-space:nowrap;
      }

      .v61-mark-all-read:hover{
        background:#ecfdf8;
      }

      .v61-mark-all-read:disabled{
        opacity:.55;
        cursor:default;
      }

      .v61-notification-actions{
        display:flex;
        align-items:center;
        gap:8px;
        margin-inline-start:auto;
      }
    `;

    document.head.appendChild(s);
  }

  function clearUnreadUI(){
    // unread cards/classes
    document.querySelectorAll(
      '.notification-item.unread,'+
      '[data-notification].unread,'+
      '[data-notification-id].unread,'+
      '.notification-unread,'+
      '[data-unread="true"]'
    ).forEach(el=>{
      el.classList.remove(
        'unread',
        'notification-unread'
      );
      el.removeAttribute('data-unread');
    });

    // orange unread dots
    document.querySelectorAll(
      '.unread-dot,'+
      '.notification-dot,'+
      '.notification-unread-dot,'+
      '[aria-label="Unread"]'
    ).forEach(el=>el.remove());

    // top counters
    document.querySelectorAll(
      '#notificationBadge,'+
      '.notification-badge,'+
      '.top-notification-badge'
    ).forEach(el=>{
      el.textContent='0';
      el.classList.add('hidden');
    });
  }

  async function markAll(button){
    const original=button.textContent;

    button.disabled=true;
    button.textContent=
      C.lang==='ar'
        ? 'جاري التعليم...'
        : 'Marking...';

    try{
      const {data,error}=await C.sb.rpc(
        'frontend_mark_all_notifications_read'
      );

      if(error) throw error;

      clearUnreadUI();

      // Reload drawer from the app's own notification loader when present.
      if(typeof C.loadNotifications==='function'){
        try{
          await C.loadNotifications();
        }catch(_){}
      }

      if(typeof C.refreshNotifications==='function'){
        try{
          await C.refreshNotifications();
        }catch(_){}
      }

      const count=
        Number(data?.marked_read || 0);

      C.toast(
        C.lang==='ar'
          ? (
              count
                ? `تم تعليم ${count} إشعار كمقروء.`
                : 'كل الإشعارات مقروءة بالفعل.'
            )
          : (
              count
                ? `${count} notifications marked as read.`
                : 'All notifications are already read.'
            )
      );
    }
    catch(error){
      console.error(
        'V61 mark all notifications read failed',
        error
      );

      C.toast(
        C.lang==='ar'
          ? `تعذر تعليم الإشعارات كمقروءة: ${error.message || ''}`
          : `Could not mark notifications as read: ${error.message || ''}`,
        'error'
      );
    }
    finally{
      button.disabled=false;
      button.textContent=original;
    }
  }

  function inject(){
    const drawer=
      document.getElementById(
        'notificationDrawer'
      );

    if(!drawer) return;

    const header=
      drawer.querySelector(
        '.drawer-header'
      );

    if(!header) return;

    // Remove old V55 button, if loaded.
    const old=
      header.querySelector(
        '#v55MarkAllRead'
      );

    if(old){
      old.closest(
        '.v55-notification-header-actions'
      )?.remove();
      old.remove();
    }

    if(
      header.querySelector(
        '#v61MarkAllRead'
      )
    ){
      return;
    }

    const close=
      header.querySelector(
        '#closeNotifications'
      );

    const actions=
      document.createElement('div');

    actions.className=
      'v61-notification-actions';

    const button=
      document.createElement('button');

    button.id='v61MarkAllRead';
    button.type='button';
    button.className=
      'v61-mark-all-read';

    button.textContent=
      C.lang==='ar'
        ? 'تعليم الكل كمقروء'
        : 'Mark all as read';

    button.addEventListener(
      'click',
      ()=>markAll(button)
    );

    actions.appendChild(button);

    if(close){
      actions.appendChild(close);
    }

    header.appendChild(actions);
  }

  addStyles();

  new MutationObserver(
    inject
  ).observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );

  document.addEventListener(
    'click',
    event=>{
      if(
        event.target.closest(
          '.app-lang-btn'
        )
      ){
        setTimeout(()=>{
          const b=
            document.getElementById(
              'v61MarkAllRead'
            );

          if(b){
            b.textContent=
              C.lang==='ar'
                ? 'تعليم الكل كمقروء'
                : 'Mark all as read';
          }
        },100);
      }
    }
  );

  inject();
})();
