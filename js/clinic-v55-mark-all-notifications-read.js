(() => {
  const C = window.Clinic;
  if (!C || C.__v55MarkAllNotificationsLoaded) return;
  C.__v55MarkAllNotificationsLoaded = true;

  function addStyles(){
    if(document.getElementById('v55-mark-all-read-styles')) return;

    const s=document.createElement('style');
    s.id='v55-mark-all-read-styles';
    s.textContent=`
      .v55-mark-all-read{
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
      .v55-mark-all-read:hover{
        background:#ecfdf8;
      }
      .v55-mark-all-read:disabled{
        opacity:.55;
        cursor:default;
      }
      .v55-notification-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
        margin-left:auto;
      }
      [dir="rtl"] .v55-notification-header-actions{
        margin-left:0;
        margin-right:auto;
      }
    `;
    document.head.appendChild(s);
  }

  function userId(){
    return C.user?.id || null;
  }

  async function tryKnownBackends(){
    const uid=userId();
    if(!uid) throw new Error('User session not found');

    // Try likely schemas used by different clinic builds.
    // We stop at the first successful update.
    const attempts = [
      async () => {
        const { error } = await C.sb
          .from('notification_recipients')
          .update({
            read_at:new Date().toISOString(),
            is_read:true
          })
          .eq('user_id',uid)
          .is('read_at',null);
        if(error) throw error;
      },

      async () => {
        const { error } = await C.sb
          .from('notification_recipients')
          .update({ read_at:new Date().toISOString() })
          .eq('recipient_id',uid)
          .is('read_at',null);
        if(error) throw error;
      },

      async () => {
        const { error } = await C.sb
          .from('notifications')
          .update({
            read_at:new Date().toISOString(),
            is_read:true
          })
          .eq('user_id',uid)
          .is('read_at',null);
        if(error) throw error;
      },

      async () => {
        const { error } = await C.sb
          .from('notifications')
          .update({ read_at:new Date().toISOString() })
          .eq('recipient_id',uid)
          .is('read_at',null);
        if(error) throw error;
      },

      async () => {
        const { error } = await C.sb.rpc(
          'frontend_mark_all_notifications_read'
        );
        if(error) throw error;
      },

      async () => {
        const { error } = await C.sb.rpc(
          'mark_all_notifications_read'
        );
        if(error) throw error;
      }
    ];

    let lastError=null;

    for(const attempt of attempts){
      try{
        await attempt();
        return true;
      }catch(error){
        lastError=error;
      }
    }

    throw lastError || new Error('Could not mark notifications as read');
  }

  function clearUnreadUI(){
    // orange unread dots / unread emphasis
    document
      .querySelectorAll(
        '.notification-item.unread,' +
        '[data-notification].unread,' +
        '[data-notification-id].unread,' +
        '.notification-unread,' +
        '[data-unread="true"]'
      )
      .forEach(el=>{
        el.classList.remove('unread','notification-unread');
        el.removeAttribute('data-unread');
      });

    document
      .querySelectorAll(
        '.notification-item .unread-dot,' +
        '.notification-dot,' +
        '.notification-unread-dot,' +
        '.notification-item [aria-label="Unread"]'
      )
      .forEach(el=>el.remove());

    const badge=document.getElementById('notificationBadge');
    if(badge){
      badge.textContent='0';
      badge.classList.add('hidden');
    }

    // Some builds have a second top-bar badge.
    document
      .querySelectorAll('.notification-badge,.top-notification-badge')
      .forEach(el=>{
        el.textContent='0';
        el.classList.add('hidden');
      });
  }

  async function markAll(button){
    button.disabled=true;

    const oldText=button.textContent;

    button.textContent=
      C.lang==='ar'
        ? 'جاري...'
        : 'Marking...';

    try{
      await tryKnownBackends();

      clearUnreadUI();

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

      C.toast(
        C.lang==='ar'
          ? 'تم تعليم كل الإشعارات كمقروءة.'
          : 'All notifications marked as read.'
      );
    }
    catch(error){
      console.error('V55 mark all notifications read failed',error);

      C.toast(
        C.lang==='ar'
          ? 'تعذر تعليم كل الإشعارات كمقروءة.'
          : 'Could not mark all notifications as read.',
        'error'
      );
    }
    finally{
      button.disabled=false;
      button.textContent=oldText;
    }
  }

  function injectButton(){
    const drawer=document.getElementById('notificationDrawer');
    if(!drawer) return;

    const header=drawer.querySelector('.drawer-header');
    if(!header) return;

    if(header.querySelector('#v55MarkAllRead')) return;

    const close=
      header.querySelector(
        '#closeNotifications,.icon-button'
      );

    const actions=document.createElement('div');
    actions.className='v55-notification-header-actions';

    const btn=document.createElement('button');
    btn.id='v55MarkAllRead';
    btn.type='button';
    btn.className='v55-mark-all-read';
    btn.textContent=
      C.lang==='ar'
        ? 'تعليم الكل كمقروء'
        : 'Mark all as read';

    btn.addEventListener(
      'click',
      ()=>markAll(btn)
    );

    actions.appendChild(btn);

    if(close){
      actions.appendChild(close);
    }

    header.appendChild(actions);
  }

  addStyles();

  new MutationObserver(injectButton)
    .observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

  injectButton();
})();
