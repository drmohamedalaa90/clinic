window.ClinicNotifications = {
  items: [],
  dashboardFilter: 'all',

  categoryMeta: {
    all:        { en:'All',             ar:'الكل',                 icon:'●'  },
    booking:    { en:'Bookings',        ar:'الحجوزات',             icon:'📅' },
    finance:    { en:'Finance',         ar:'المالية',              icon:'💳' },
    logistics:  { en:'Logistics issue', ar:'نقص / مشكلة لوجستية',  icon:'📦' },
    apology:    { en:'Apology',         ar:'الاعتذارات',           icon:'⚠'  },
    referral:   { en:'Referrals',       ar:'التحويلات',            icon:'⇄'  },
    attendance: { en:'Attendance',      ar:'الحضور والإجازات',     icon:'✓'  }
  },

  label(category) {
    const C = window.Clinic;
    const meta = this.categoryMeta[category] || this.categoryMeta.all;
    return C?.lang === 'ar' ? meta.ar : meta.en;
  },

  icon(category) {
    return (this.categoryMeta[category] || this.categoryMeta.all).icon;
  },

  unreadCount(category='all') {
    return this.items.filter(x =>
      !x.is_read &&
      (category === 'all' || x.category === category)
    ).length;
  },

  allowedCategories() {
    const C = window.Clinic;
    const cats = ['all'];

    if (C?.isReception?.() || C?.isDoctor?.()) cats.push('booking');
    if (C?.isReception?.()) cats.push('finance');

    // Deficiency + approved apologies are intentionally visible
    // to every active clinic member.
    cats.push('logistics', 'apology');

    if (C?.isDoctor?.()) cats.push('referral');
    if (C?.isManagement?.() || C?.hasRole?.('secretary')) cats.push('attendance');

    return [...new Set(cats)];
  },

  async refresh() {
    const C = window.Clinic;
    if (!C?.user) return;

    const { data, error } = await C.sb.rpc(
      'get_dashboard_notifications',
      { p_limit: 80 }
    );

    if (error) {
      console.warn(
        'Dashboard notifications unavailable. Run sql/task-13l-dashboard-notifications.sql',
        error
      );
      this.items = [];
      this.render();
      this.renderDashboard();
      return;
    }

    this.items = (data || []).map(x => ({
      id: x.notification_key,
      category: x.category,
      priority: Number(x.priority || 0),
      title: C.lang === 'ar' ? x.title_ar : x.title_en,
      text: C.lang === 'ar' ? x.body_ar : x.body_en,
      time: x.event_time,
      page: x.target_page || 'dashboard',
      entityId: x.entity_id,
      is_read: !!x.is_read
    }));

    this.render();
    this.renderDashboard();
  },

  async markSeen(id, { navigate=false, page='dashboard' } = {}) {
    const C = window.Clinic;
    const item = this.items.find(x => x.id === id);

    if (item && !item.is_read) {
      // Optimistic UI first.
      item.is_read = true;
      this.render();
      this.renderDashboard();

      const { error } = await C.sb.rpc(
        'mark_dashboard_notification_read',
        { p_notification_key: id }
      );

      if (error) {
        item.is_read = false;
        this.render();
        this.renderDashboard();
        C.toast(
          C.lang === 'ar'
            ? 'تعذر تحديث حالة الإشعار.'
            : 'Could not update notification status.',
          'error'
        );
        return;
      }
    }

    if (navigate) {
      this.close();
      C.route(page || item?.page || 'dashboard');
    }
  },

  async markAll() {
    const C = window.Clinic;
    const unread = this.items.filter(x => !x.is_read);

    if (!unread.length) return;

    const keys = unread.map(x => x.id);
    unread.forEach(x => { x.is_read = true; });
    this.render();
    this.renderDashboard();

    const { error } = await C.sb.rpc(
      'mark_dashboard_notifications_read',
      { p_notification_keys: keys }
    );

    if (error) {
      unread.forEach(x => { x.is_read = false; });
      this.render();
      this.renderDashboard();
      return C.toast(error.message, 'error');
    }

    C.toast(
      C.lang === 'ar'
        ? 'تم تعليم كل الإشعارات كمقروءة.'
        : 'All notifications marked as read.'
    );
  },

  render() {
    const C = window.Clinic;
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationList');

    if (!badge || !list) return;

    const unread = this.unreadCount();

    badge.textContent = unread > 99 ? '99+' : unread;
    badge.classList.toggle('hidden', unread === 0);

    list.innerHTML = this.items.length
      ? this.items.map(x => `
          <button
            class="notification-item ${x.is_read ? 'read' : 'unread'}"
            data-notification="${C.escape(x.id)}"
            data-page="${C.escape(x.page || 'dashboard')}"
          >
            <span class="notification-icon">${this.icon(x.category)}</span>

            <span>
              <span class="notification-item-topline">
                <span class="notification-category category-${C.escape(x.category)}">
                  ${C.escape(this.label(x.category))}
                </span>
                ${!x.is_read ? '<i class="unread-dot" aria-label="Unread"></i>' : ''}
              </span>

              <strong>${C.escape(x.title)}</strong>
              <small>${C.escape(x.text || '')}</small>
              <em>
                ${x.time
                  ? C.formatDate(x.time, {
                      day:'2-digit',
                      month:'short',
                      hour:'2-digit',
                      minute:'2-digit'
                    })
                  : ''
                }
              </em>
            </span>
          </button>
        `).join('')
      : `<div class="empty-state">
           ${C.lang === 'ar'
             ? 'لا توجد إشعارات حالياً.'
             : 'No notifications right now.'}
         </div>`;

    list.querySelectorAll('[data-notification]').forEach(button => {
      button.onclick = () => this.markSeen(
        button.dataset.notification,
        {
          navigate: true,
          page: button.dataset.page
        }
      );
    });
  },

  renderDashboard() {
    const C = window.Clinic;
    const root = document.getElementById('dashboardNotificationSection');
    if (!root || !C) return;

    const categories = this.allowedCategories();

    if (!categories.includes(this.dashboardFilter)) {
      this.dashboardFilter = 'all';
    }

    const unread = this.unreadCount();
    const filtered = this.items
      .filter(x =>
        this.dashboardFilter === 'all' ||
        x.category === this.dashboardFilter
      )
      .slice(0, 10);

    root.innerHTML = `
      <div class="section-head dashboard-notification-head">
        <div>
          <div class="notification-heading-line">
            <span class="eyebrow">
              ${C.lang === 'ar' ? 'التحديثات المهمة' : 'IMPORTANT UPDATES'}
            </span>

            <span
              class="dashboard-unread-badge ${unread === 0 ? 'zero' : ''}"
              title="${C.lang === 'ar' ? 'غير مقروء' : 'Unread'}"
            >
              ${unread > 99 ? '99+' : unread}
            </span>
          </div>

          <h3>${C.lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>

          <p class="muted notification-intro">
            ${C.lang === 'ar'
              ? 'الاعتذارات، نقص احتياجات العيادة، الحجوزات والتحديثات المهمة الخاصة بدورك.'
              : 'Apologies, clinic deficiencies, bookings and other role-relevant updates.'}
          </p>
        </div>

        <button
          id="dashboardMarkAllNotifications"
          class="secondary-button compact"
          ${unread === 0 ? 'disabled' : ''}
        >
          ${C.lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all as read'}
        </button>
      </div>

      <div class="notification-filters">
        ${categories.map(category => {
          const total = category === 'all'
            ? this.items.length
            : this.items.filter(x => x.category === category).length;

          const catUnread = this.unreadCount(category);

          return `
            <button
              class="notification-filter ${
                this.dashboardFilter === category ? 'active' : ''
              }"
              data-notification-filter="${category}"
            >
              <span>${this.icon(category)}</span>
              <span>${C.escape(this.label(category))}</span>
              <b>${total}</b>
              ${catUnread > 0
                ? `<i>${catUnread > 99 ? '99+' : catUnread}</i>`
                : ''
              }
            </button>
          `;
        }).join('')}
      </div>

      <div class="dashboard-notification-list">
        ${filtered.length
          ? filtered.map(x => `
              <button
                class="dashboard-notification-row ${
                  x.is_read ? 'read' : 'unread'
                }"
                data-dashboard-notification="${C.escape(x.id)}"
                data-page="${C.escape(x.page || 'dashboard')}"
              >
                <span class="dashboard-notification-icon category-bg-${C.escape(x.category)}">
                  ${this.icon(x.category)}
                </span>

                <span class="dashboard-notification-copy">
                  <span class="dashboard-notification-topline">
                    <span class="notification-category category-${C.escape(x.category)}">
                      ${C.escape(this.label(x.category))}
                    </span>

                    <span class="dashboard-notification-time">
                      ${x.time
                        ? C.formatDate(x.time, {
                            day:'2-digit',
                            month:'short',
                            hour:'2-digit',
                            minute:'2-digit'
                          })
                        : ''
                      }
                    </span>
                  </span>

                  <strong>${C.escape(x.title)}</strong>
                  <small>${C.escape(x.text || '')}</small>
                </span>

                ${!x.is_read
                  ? '<span class="dashboard-row-unread-dot"></span>'
                  : '<span class="dashboard-row-chevron">›</span>'
                }
              </button>
            `).join('')
          : `<div class="empty-state dashboard-notification-empty">
               ${C.lang === 'ar'
                 ? 'لا توجد إشعارات في هذا التصنيف.'
                 : 'No notifications in this category.'}
             </div>`
        }
      </div>
    `;

    root
      .querySelectorAll('[data-notification-filter]')
      .forEach(button => {
        button.onclick = () => {
          this.dashboardFilter = button.dataset.notificationFilter;
          this.renderDashboard();
        };
      });

    root
      .querySelectorAll('[data-dashboard-notification]')
      .forEach(button => {
        button.onclick = () => this.markSeen(
          button.dataset.dashboardNotification,
          {
            navigate: button.dataset.page !== 'dashboard',
            page: button.dataset.page
          }
        );
      });

    const markAll = document.getElementById('dashboardMarkAllNotifications');
    if (markAll) markAll.onclick = () => this.markAll();
  },

  open() {
    document.getElementById('notificationDrawer')?.classList.add('open');
    document.getElementById('drawerOverlay')?.classList.add('show');
    // Opening the drawer no longer automatically marks everything as read.
    // Items are read when opened individually or via "Mark all as read".
    this.render();
  },

  close() {
    document.getElementById('notificationDrawer')?.classList.remove('open');
    document.getElementById('drawerOverlay')?.classList.remove('show');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('notificationButton')
    ?.addEventListener('click', () => ClinicNotifications.open());

  document
    .getElementById('closeNotifications')
    ?.addEventListener('click', () => ClinicNotifications.close());

  document
    .getElementById('drawerOverlay')
    ?.addEventListener('click', () => ClinicNotifications.close());

  // Keep the orange unread counter reasonably fresh.
  setInterval(() => ClinicNotifications.refresh(), 60000);
});
