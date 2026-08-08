const sb = window.supabaseClient;
window.ClinicPages = window.ClinicPages || {};

const Clinic = window.Clinic = {
  sb,
  user: null,
  profile: null,
  roles: [],
  doctors: [],
  lang: localStorage.getItem('clinic_language') || 'ar',
  currentPage: 'dashboard',

  labels: {
    en: {
      clinic: 'Operation Clinic', logout: 'Logout', dashboard: 'Dashboard', patients: 'Patients', appointments: 'Appointments',
      schedules: "Doctors' Schedules", finance: 'Finance', logistics: 'Logistics', attendance: 'Attendance', reports: 'Reports',
      users: 'Users', audit: 'Audit Log', settings: 'Settings', todayClinic: "Today's Clinic", queue: 'My Queue',
      referrals: 'Referrals', mySchedule: 'My Schedule', profile: 'My Profile', technical: 'Technical Administration',
      reception: 'Reception Desk', notifications: 'Notifications', clinicManagement: 'Clinic Management', loading: 'Loading...', noData: 'No data found'
    },
    ar: {
      clinic: 'عيادة العمليات', logout: 'تسجيل الخروج', dashboard: 'الرئيسية', patients: 'المرضى', appointments: 'الحجوزات',
      schedules: 'جداول الأطباء', finance: 'المالية', logistics: 'احتياجات العيادة', attendance: 'الحضور والانصراف', reports: 'التقارير',
      users: 'المستخدمون', audit: 'سجل النشاط', settings: 'الإعدادات', todayClinic: 'عيادة اليوم', queue: 'قائمة الانتظار',
      referrals: 'التحويلات', mySchedule: 'جدولي', profile: 'ملفي الشخصي', technical: 'الإدارة التقنية',
      reception: 'الاستقبال', notifications: 'الإشعارات', clinicManagement: 'إدارة العيادة', loading: 'جاري التحميل...', noData: 'لا توجد بيانات'
    }
  },

  t(key) { return this.labels[this.lang]?.[key] || key; },
  hasRole(role) { return this.roles.includes(role); },
  isManagement() { return ['owner','manager','deputy_manager'].some(r => this.hasRole(r)); },
  isReception() { return this.isManagement() || this.hasRole('secretary'); },
  isDoctor() { return this.hasRole('doctor'); },

  escape(value='') {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  },

  cairoDate(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  },

  formatDate(value, options={}) {
    if (!value) return '—';

    // Clinic-wide display rule:
    // DD/MM/YYYY, while preserving optional time fields.
    // We intentionally use en-GB for the numeric date so both
    // Arabic and English screens show the same 08/08/2026 format.
    const d = new Date(value);

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options
    }).format(d);
  },

  formatDateOnly(value) {
    return this.formatDate(value);
  },

  formatTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    return new Intl.DateTimeFormat(this.lang === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit'
    }).format(d);
  },

  formatMoney(value) {
    const n = Number(value || 0);
    return `${new Intl.NumberFormat(this.lang === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 2 }).format(n)} EGP`;
  },

  ageFromDob(dob) {
    if (!dob) return '—';
    const b = new Date(`${dob}T00:00:00`), now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  },

  ageFromBirthYear(birthYear, fallbackDob=null) {
    const year = Number(birthYear);

    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      const currentYear = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Cairo',
          year: 'numeric'
        }).format(new Date())
      );

      return Math.max(0, currentYear - year);
    }

    return fallbackDob ? this.ageFromDob(fallbackDob) : '—';
  },

  birthYearFromPatient(patient={}) {
    const year = Number(patient.birth_year);

    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      return year;
    }

    if (patient.date_of_birth) {
      const match = String(patient.date_of_birth).match(/^(\d{4})/);
      if (match) return Number(match[1]);
    }

    return null;
  },

  statusPill(status) {
    const safe = this.escape(status || 'unknown');
    return `<span class="status-pill status-${safe.replaceAll('_','-')}">${safe.replaceAll('_',' ')}</span>`;
  },

  async safe(queryPromise, context='Operation failed') {
    try {
      const result = await queryPromise;
      if (result?.error) throw result.error;
      return result?.data ?? result;
    } catch (err) {
      console.error(context, err);
      this.toast(`${context}: ${err.message || err}`, 'error');
      throw err;
    }
  },

  toast(message, type='success') {
    const root = document.getElementById('toastRoot');
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.classList.add('show'), 20);
    setTimeout(() => { item.classList.remove('show'); setTimeout(() => item.remove(), 250); }, 3300);
  },

  showModal({title='', body='', wide=false, onOpen=null}) {
    const root = document.getElementById('modalRoot');
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <section class="modal-card ${wide ? 'modal-wide' : ''}">
        <header class="modal-header"><h3>${this.escape(title)}</h3><button class="icon-button" data-close-modal>✕</button></header>
        <div class="modal-body">${body}</div>
      </section>`;
    root.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => this.closeModal()));
    onOpen?.(root);
  },

  closeModal() {
    const root = document.getElementById('modalRoot');
    root.classList.add('hidden');
    root.innerHTML = '';
  },

  setTitle(title) { document.getElementById('pageTitle').textContent = title; },

  setLoading(message) {
    document.getElementById('mainContent').innerHTML = `<section class="content-card centered"><div class="loader"></div><p class="muted">${this.escape(message || this.t('loading'))}</p></section>`;
  },

  async loadDoctors(force=false) {
    if (this.doctors.length && !force) return this.doctors;
    const { data, error } = await sb.rpc('list_active_doctors');
    if (!error && Array.isArray(data)) {
      this.doctors = data;
      return data;
    }
    // Graceful fallback: current doctor remains available if helper SQL has not yet been run.
    if (this.isDoctor()) {
      this.doctors = [{ id: this.user.id, display_name: this.profile.display_name, username: this.profile.username, photo_url: this.profile.photo_url }];
    }
    console.warn('list_active_doctors unavailable. Run sql/task-13b-13f-helper.sql', error);
    return this.doctors;
  },

  doctorName(id) {
    return this.doctors.find(d => d.id === id)?.display_name || 'Doctor';
  },

  navItem(icon, key, page) {
    return `<button class="nav-item ${this.currentPage === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icon}</span><span>${this.t(key)}</span></button>`;
  },

  buildNavigation() {
    let menu = '';

    if (this.isDoctor() && !this.hasRole('owner')) {
      menu += this.navItem('📅','appointments','doctor-appointments');
      menu += this.navItem('⌂','dashboard','dashboard');
    } else {
      menu += this.navItem('⌂','dashboard','dashboard');
    }

    if (this.isManagement()) {
      menu += this.navItem('📅','appointments','appointments');
      menu += this.navItem('👥','patients','patients');
      menu += this.navItem('🛎','reception','reception');
      menu += this.navItem('🕒','schedules','schedules');
      menu += this.navItem('💳','finance','finance');
      menu += this.navItem('📦','logistics','logistics');
      menu += this.navItem('✓','attendance','attendance');
      menu += this.navItem('📊','reports','reports');
      menu += this.navItem('👤','profile','profile');
      if (this.hasRole('owner')) {
        menu += this.navItem('👥','users','users');
        menu += this.navItem('◷','audit','audit');
        menu += this.navItem('⚙','settings','settings');
      }
    } else if (this.hasRole('secretary')) {
      menu += this.navItem('📅','appointments','appointments');
      menu += this.navItem('👥','patients','patients');
      menu += this.navItem('🛎','reception','reception');
      menu += this.navItem('💳','finance','finance');
      menu += this.navItem('📦','logistics','logistics');
      menu += this.navItem('✓','attendance','attendance');
      menu += this.navItem('👤','profile','profile');
    }
    if (this.isDoctor() && !this.hasRole('owner')) {
      menu += this.navItem('☀','todayClinic','today-clinic');
      menu += this.navItem('⌛','queue','queue');
      menu += this.navItem('👥','patients','patients');
      menu += this.navItem('⇄','referrals','referrals');
      menu += this.navItem('🕒','mySchedule','my-schedule');
      menu += this.navItem('👤','profile','profile');
    }
    if (this.hasRole('technical_admin')) menu += this.navItem('⚙','technical','technical');
    document.getElementById('navigation').innerHTML = menu;
    document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => this.route(btn.dataset.page)));
  },

  primaryRoleLabel() {
    if (this.hasRole('owner') && this.hasRole('technical_admin')) return this.lang === 'ar' ? 'المالك / المستشار التقني' : 'Owner / Technical Advisor';
    if (this.hasRole('owner')) return this.lang === 'ar' ? 'المالك / مدير النظام' : 'Owner / Administrator';
    if (this.isDoctor() && this.hasRole('technical_admin')) return this.lang === 'ar' ? 'طبيب / مستشار تقني' : 'Doctor / Technical Advisor';
    if (this.isDoctor()) return this.lang === 'ar' ? 'طبيب' : 'Doctor';
    if (this.hasRole('secretary')) return this.lang === 'ar' ? 'سكرتارية' : 'Secretary';
    if (this.hasRole('manager')) return this.lang === 'ar' ? 'مدير العيادة' : 'Clinic Manager';
    if (this.hasRole('deputy_manager')) return this.lang === 'ar' ? 'نائب مدير العيادة' : 'Deputy Manager';
    return this.roles.join(', ');
  },

  applyLanguage() {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (this.labels[this.lang]?.[k]) el.textContent = this.labels[this.lang][k]; });
    document.querySelectorAll('.app-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === this.lang));
    document.getElementById('notificationTitle').textContent = this.t('notifications');
    const now = new Date();
    const weekday = new Intl.DateTimeFormat(
      this.lang === 'ar' ? 'ar-EG' : 'en-GB',
      { timeZone:'Africa/Cairo', weekday:'long' }
    ).format(now);

    // Example: Saturday, 08/08/2026
    document.getElementById('todayDate').textContent =
      `${weekday}, ${this.formatDate(now)}`;
    this.buildNavigation();
  },

  async route(page, params={}) {
    this.currentPage = page;
    this.buildNavigation();
    this.closeMobileSidebar();
    const renderer = window.ClinicPages[page];
    if (!renderer) {
      this.setTitle(page.replaceAll('-',' '));
      document.getElementById('mainContent').innerHTML = `<section class="content-card centered"><div class="placeholder-icon">◇</div><h2>${this.escape(page.replaceAll('-',' '))}</h2><p class="muted">${this.lang === 'ar' ? 'هذه الصفحة ضمن مرحلة الواجهة التالية.' : 'This page is part of the next interface block.'}</p></section>`;
      return;
    }
    this.setLoading();
    try { await renderer(params); } catch (err) { console.error(err); }
  },

  closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  },

  async refreshAvatar() {
    const el = document.getElementById('profileAvatar');
    if (!el) return;
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.textContent = (this.profile?.display_name || this.profile?.username || 'U').trim().charAt(0).toUpperCase();
    if (!this.profile?.photo_url) return;
    const { data, error } = await this.sb.storage.from('profile-photos').createSignedUrl(this.profile.photo_url, 3600);
    if (!error && data?.signedUrl) {
      el.textContent = '';
      el.style.backgroundImage = `url("${data.signedUrl}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
  },

  async init() {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) { location.href = 'index.html'; return; }
    this.user = user;

    const { data: profile, error: profileError } = await sb.from('profiles')
      .select('id,username,email,display_name,photo_url,whatsapp,preferred_language,is_active').eq('id', user.id).single();
    if (profileError || !profile || !profile.is_active) {
      await sb.auth.signOut(); location.href = 'index.html'; return;
    }
    this.profile = profile;

    const { data: roles, error: rolesError } = await sb.from('user_roles').select('role').eq('user_id', user.id);
    if (rolesError || !roles?.length) { alert('No clinic role assigned.'); await sb.auth.signOut(); location.href='index.html'; return; }
    this.roles = roles.map(x => x.role);

    if (!localStorage.getItem('clinic_language') && profile.preferred_language) this.lang = profile.preferred_language;

    document.getElementById('profileName').textContent = profile.display_name || profile.username || profile.email;
    document.getElementById('profileRole').textContent = this.primaryRoleLabel();
    document.getElementById('profileAvatar').textContent = (profile.display_name || profile.username || 'U').trim().charAt(0).toUpperCase();
    await this.refreshAvatar();

    await this.loadDoctors();
    this.applyLanguage();
    document.getElementById('appLoading').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');

    await this.route(
      this.isDoctor() && !this.hasRole('owner')
        ? 'doctor-appointments'
        : 'dashboard'
    );

    window.ClinicNotifications?.refresh?.();
  }
};

// Global UI wiring
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.app-lang-btn').forEach(btn => btn.addEventListener('click', async () => {
    Clinic.lang = btn.dataset.lang;
    localStorage.setItem('clinic_language', Clinic.lang);
    Clinic.applyLanguage();
    await Clinic.route(Clinic.currentPage);
  }));

  document.getElementById('logoutButton').addEventListener('click', async () => { await sb.auth.signOut(); location.href='index.html'; });
  document.getElementById('menuButton').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => Clinic.closeMobileSidebar());
  Clinic.init();
});
