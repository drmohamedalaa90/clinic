const sb =
  window.supabaseClient;


let currentUser = null;
let currentProfile = null;
let currentRoles = [];


const UI = {

  en: {

    clinic:
      "Operation Clinic",

    logout:
      "Logout",

    welcome:
      "Welcome",

    system:
      "System",

    ready:
      "Clinic system connected",

    foundation:
      "Your account, role and secure database connection are working.",

    dashboard:
      "Dashboard",

    patients:
      "Patients",

    appointments:
      "Appointments",

    schedules:
      "Doctors' Schedules",

    finance:
      "Finance",

    logistics:
      "Logistics",

    attendance:
      "Attendance",

    reports:
      "Reports",

    users:
      "Users",

    audit:
      "Audit Log",

    settings:
      "Settings",

    todayClinic:
      "Today's Clinic",

    queue:
      "My Queue",

    referrals:
      "Referrals",

    mySchedule:
      "My Schedule",

    profile:
      "My Profile",

    technical:
      "Technical Administration"
  },


  ar: {

    clinic:
      "عيادة العمليات",

    logout:
      "تسجيل الخروج",

    welcome:
      "مرحباً",

    system:
      "النظام",

    ready:
      "تم الاتصال بنظام العيادة",

    foundation:
      "تم الاتصال بحسابك وصلاحياتك وقاعدة البيانات الآمنة بنجاح.",

    dashboard:
      "الرئيسية",

    patients:
      "المرضى",

    appointments:
      "الحجوزات",

    schedules:
      "جداول الأطباء",

    finance:
      "المالية",

    logistics:
      "احتياجات العيادة",

    attendance:
      "الحضور والانصراف",

    reports:
      "التقارير",

    users:
      "المستخدمون",

    audit:
      "سجل النشاط",

    settings:
      "الإعدادات",

    todayClinic:
      "عيادة اليوم",

    queue:
      "قائمة الانتظار",

    referrals:
      "التحويلات",

    mySchedule:
      "جدولي",

    profile:
      "ملفي الشخصي",

    technical:
      "الإدارة التقنية"
  }

};


let lang =
  localStorage.getItem(
    "clinic_language"
  ) || "ar";



function hasRole(role) {

  return currentRoles.includes(
    role
  );

}



function applyLanguage() {

  document.documentElement.lang =
    lang;

  document.documentElement.dir =
    lang === "ar"
      ? "rtl"
      : "ltr";


  document
    .querySelectorAll(
      "[data-i18n]"
    )
    .forEach((el) => {

      const key =
        el.dataset.i18n;

      if (UI[lang][key]) {

        el.textContent =
          UI[lang][key];

      }

    });


  document
    .querySelectorAll(
      ".app-lang-btn"
    )
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.lang === lang
      );

    });


  buildNavigation();

  setDate();

}



function setDate() {

  const formatter =
    new Intl.DateTimeFormat(
      lang === "ar"
        ? "ar-EG"
        : "en-GB",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );


  document.getElementById(
    "todayDate"
  ).textContent =
    formatter.format(
      new Date()
    );

}



function navItem(
  icon,
  key,
  page
) {

  return `
    <button
      class="nav-item"
      data-page="${page}"
    >
      <span class="nav-icon">
        ${icon}
      </span>

      <span>
        ${UI[lang][key]}
      </span>
    </button>
  `;

}



function buildNavigation() {

  let menu = "";


  menu += navItem(
    "⌂",
    "dashboard",
    "dashboard"
  );


  /*
  ========================================
  OWNER / MANAGEMENT MENU
  ========================================
  */

  if (hasRole("owner")) {

    menu += navItem(
      "👥",
      "patients",
      "patients"
    );

    menu += navItem(
      "📅",
      "appointments",
      "appointments"
    );

    menu += navItem(
      "🕒",
      "schedules",
      "schedules"
    );

    menu += navItem(
      "💳",
      "finance",
      "finance"
    );

    menu += navItem(
      "📦",
      "logistics",
      "logistics"
    );

    menu += navItem(
      "✓",
      "attendance",
      "attendance"
    );

    menu += navItem(
      "📊",
      "reports",
      "reports"
    );

    menu += navItem(
      "👤",
      "users",
      "users"
    );

    menu += navItem(
      "◷",
      "audit",
      "audit"
    );

    menu += navItem(
      "⚙",
      "settings",
      "settings"
    );

  }


  /*
  ========================================
  DOCTOR MENU
  ========================================
  */

  if (
    hasRole("doctor")
    &&
    !hasRole("owner")
  ) {

    menu += navItem(
      "☀",
      "todayClinic",
      "today-clinic"
    );

    menu += navItem(
      "⌛",
      "queue",
      "queue"
    );

    menu += navItem(
      "👥",
      "patients",
      "patients"
    );

    menu += navItem(
      "📅",
      "appointments",
      "appointments"
    );

    menu += navItem(
      "⇄",
      "referrals",
      "referrals"
    );

    menu += navItem(
      "🕒",
      "mySchedule",
      "my-schedule"
    );

    menu += navItem(
      "👤",
      "profile",
      "profile"
    );

  }


  /*
  ========================================
  TECHNICAL ADMIN EXTRA MENU
  ========================================
  */

  if (
    hasRole("technical_admin")
    &&
    !hasRole("owner")
  ) {

    menu += navItem(
      "⚙",
      "technical",
      "technical"
    );

  }


  document.getElementById(
    "navigation"
  ).innerHTML =
    menu;


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".nav-item"
            )
            .forEach(
              item =>
                item.classList.remove(
                  "active"
                )
            );


          button.classList.add(
            "active"
          );


          showPlaceholderPage(
            button.dataset.page,
            button
              .querySelector(
                "span:last-child"
              )
              .textContent
          );


          closeMobileSidebar();

        }
      );

    });


  document
    .querySelector(
      ".nav-item"
    )
    ?.classList.add(
      "active"
    );

}



function getPrimaryRoleLabel() {

  if (hasRole("owner")) {

    return lang === "ar"
      ? "المالك / مدير النظام"
      : "Owner / Administrator";

  }


  if (
    hasRole("doctor")
    &&
    hasRole("technical_admin")
  ) {

    return lang === "ar"
      ? "طبيب / مستشار تقني"
      : "Doctor / Technical Advisor";

  }


  if (hasRole("doctor")) {

    return lang === "ar"
      ? "طبيب"
      : "Doctor";

  }


  if (hasRole("secretary")) {

    return lang === "ar"
      ? "سكرتارية"
      : "Secretary";

  }


  if (hasRole("manager")) {

    return lang === "ar"
      ? "مدير العيادة"
      : "Clinic Manager";

  }


  return currentRoles.join(", ");

}



function buildDashboard() {

  const cards =
    document.getElementById(
      "dashboardCards"
    );


  if (hasRole("owner")) {

    cards.innerHTML = `

      <div class="stat-card">
        <span class="stat-icon">📅</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "حجوزات اليوم"
            : "Today's Appointments"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">👥</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "المرضى اليوم"
            : "Patients Today"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">💳</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "دخل اليوم"
            : "Today's Income"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">📦</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "طلبات العيادة"
            : "Clinic Requests"}
        </span>
        <strong>—</strong>
      </div>
    `;

  }


  else if (hasRole("doctor")) {

    cards.innerHTML = `

      <div class="stat-card">
        <span class="stat-icon">⌛</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "في الانتظار"
            : "Waiting"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">☀</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "مرضى اليوم"
            : "Today's Patients"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">⇄</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "تحويلات جديدة"
            : "New Referrals"}
        </span>
        <strong>—</strong>
      </div>

      <div class="stat-card">
        <span class="stat-icon">✓</span>
        <span class="stat-label">
          ${lang === "ar"
            ? "تم الكشف"
            : "Completed"}
        </span>
        <strong>—</strong>
      </div>
    `;

  }

}



function showPlaceholderPage(
  page,
  title
) {

  if (page === "dashboard") {

    window.location.reload();

    return;

  }


  document.getElementById(
    "pageTitle"
  ).textContent =
    title;


  document.getElementById(
    "mainContent"
  ).innerHTML = `

    <section class="content-card page-placeholder">

      <div class="placeholder-icon">
        ◇
      </div>

      <h2>${title}</h2>

      <p>
        ${
          lang === "ar"
            ? "سيتم بناء هذه الصفحة في الخطوة التالية."
            : "This page will be built in the next development step."
        }
      </p>

    </section>
  `;

}



async function loadCurrentUser() {

  const {
    data: {
      user
    },
    error: userError
  } =
    await sb.auth.getUser();


  if (
    userError
    ||
    !user
  ) {

    window.location.href =
      "index.html";

    return;

  }


  currentUser = user;



  const {
    data: profile,
    error: profileError
  } =
    await sb

      .from("profiles")

      .select(`
        id,
        username,
        email,
        display_name,
        photo_url,
        preferred_language,
        is_active
      `)

      .eq(
        "id",
        user.id
      )

      .single();



  if (
    profileError
    ||
    !profile
  ) {

    console.error(
      profileError
    );

    alert(
      "Profile could not be loaded."
    );

    return;

  }


  if (!profile.is_active) {

    await sb.auth.signOut();

    window.location.href =
      "index.html";

    return;

  }


  currentProfile =
    profile;



  const {
    data: roles,
    error: rolesError
  } =
    await sb

      .from("user_roles")

      .select("role")

      .eq(
        "user_id",
        user.id
      );



  if (rolesError) {

    console.error(
      rolesError
    );

    alert(
      "Roles could not be loaded."
    );

    return;

  }


  currentRoles =
    roles.map(
      item => item.role
    );



  if (
    currentRoles.length === 0
  ) {

    await sb.auth.signOut();

    alert(
      "No clinic role has been assigned to this account."
    );

    window.location.href =
      "index.html";

    return;

  }



  if (
    profile.preferred_language
    &&
    !localStorage.getItem(
      "clinic_language"
    )
  ) {

    lang =
      profile.preferred_language;

  }



  renderUser();

}



function renderUser() {

  const name =
    currentProfile.display_name
    ||
    currentProfile.username
    ||
    currentProfile.email;


  document.getElementById(
    "profileName"
  ).textContent =
    name;


  document.getElementById(
    "profileRole"
  ).textContent =
    getPrimaryRoleLabel();


  document.getElementById(
    "welcomeName"
  ).textContent =
    name;


  document.getElementById(
    "profileAvatar"
  ).textContent =
    name
      .trim()
      .charAt(0)
      .toUpperCase();


  document.getElementById(
    "welcomeDescription"
  ).textContent =

    hasRole("owner")

      ? (
        lang === "ar"
          ? "لوحة التحكم والإدارة الكاملة للعيادة."
          : "Full clinic administration and system oversight."
      )

      : hasRole("doctor")

        ? (
          lang === "ar"
            ? "إدارة مرضاك وعيادة اليوم والتحويلات."
            : "Manage your patients, today's clinic and referrals."
        )

        : "";


  applyLanguage();

  buildDashboard();


  document.getElementById(
    "appLoading"
  ).classList.add(
    "hidden"
  );


  document.getElementById(
    "appRoot"
  ).classList.remove(
    "hidden"
  );

}



document
  .querySelectorAll(
    ".app-lang-btn"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        lang =
          button.dataset.lang;

        localStorage.setItem(
          "clinic_language",
          lang
        );

        renderUser();

      }
    );

  });



document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    async () => {

      await sb.auth.signOut();

      window.location.href =
        "index.html";

    }
  );



const sidebar =
  document.getElementById(
    "sidebar"
  );


const overlay =
  document.getElementById(
    "sidebarOverlay"
  );


document
  .getElementById(
    "menuButton"
  )
  .addEventListener(
    "click",
    () => {

      sidebar.classList.toggle(
        "open"
      );

      overlay.classList.toggle(
        "show"
      );

    }
  );



function closeMobileSidebar() {

  sidebar.classList.remove(
    "open"
  );

  overlay.classList.remove(
    "show"
  );

}


overlay.addEventListener(
  "click",
  closeMobileSidebar
);


loadCurrentUser();
