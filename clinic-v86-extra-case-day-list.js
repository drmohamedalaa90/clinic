(() => {
  const C = window.Clinic;
  if (!C || C.__v86ExtraCaseDayListLoaded) return;
  C.__v86ExtraCaseDayListLoaded = true;

  const PAGES = new Set(["appointments", "doctor-appointments"]);
  const STATUS_HIDDEN = new Set(["cancelled", "rescheduled"]);

  const DAY_NAMES = [
    "Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday",
    "السبت","الأحد","الاحد","الإثنين","الاثنين","الثلاثاء",
    "الأربعاء","الاربعاء","الخميس","الجمعة"
  ];

  const DAY_RE = new RegExp(
    "^(" + DAY_NAMES.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")$",
    "i"
  );

  function txt(en, ar) {
    return C.lang === "ar" ? ar : en;
  }

  function addStyles() {
    if (document.getElementById("v86-extra-day-list-style")) return;
    const s = document.createElement("style");
    s.id = "v86-extra-day-list-style";
    s.textContent = `
      .v86-extra-day-list{
        margin-top:10px;
        padding-top:10px;
        border-top:1px dashed #f59e0b;
        display:grid;
        gap:7px;
      }
      .v86-extra-day-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        color:#b45309;
        font-size:12px;
        font-weight:900;
      }
      .v86-extra-day-count{
        min-width:24px;
        height:24px;
        padding:0 7px;
        border-radius:999px;
        background:#fff7ed;
        border:1px solid #fed7aa;
        display:inline-grid;
        place-items:center;
        font-size:11px;
      }
      .v86-extra-card{
        border:1px solid #fed7aa;
        background:#fffaf4;
        border-radius:11px;
        padding:9px 10px;
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
      }
      .v86-extra-time{
        min-width:64px;
        font-weight:900;
        color:#9a3412;
        white-space:nowrap;
        font-size:12px;
      }
      .v86-extra-patient{
        min-width:0;
        display:grid;
        gap:2px;
      }
      .v86-extra-patient strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:12px;
      }
      .v86-extra-patient small{
        color:var(--muted);
        font-size:10px;
      }
      .v86-extra-badge{
        padding:4px 7px;
        border-radius:999px;
        background:#ffedd5;
        color:#9a3412;
        font-size:10px;
        font-weight:850;
        white-space:nowrap;
      }
      [dir="rtl"] .v86-extra-card{direction:rtl}
      @media(max-width:600px){
        .v86-extra-card{
          grid-template-columns:auto minmax(0,1fr);
        }
        .v86-extra-badge{
          grid-column:1 / -1;
          justify-self:start;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function normalizeArabicDigits(s = "") {
    const ar = "٠١٢٣٤٥٦٧٨٩";
    return String(s).replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)));
  }

  function parseVisibleDate(text = "") {
    const t = normalizeArabicDigits(text);

    let m = t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    const months = {
      "يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"ابريل":4,
      "مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"اغسطس":8,
      "سبتمبر":9,"أكتوبر":10,"اكتوبر":10,"نوفمبر":11,"ديسمبر":12
    };

    for (const [name, num] of Object.entries(months)) {
      const re = new RegExp("(\\d{1,2})\\s+" + name + "\\s+(\\d{4})");
      m = t.match(re);
      if (m) {
        return `${m[2]}-${String(num).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`;
      }
    }
    return null;
  }

  function localYmd(iso) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date(iso));
      const get = t => parts.find(x => x.type === t)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    } catch {
      return "";
    }
  }

  function formatTime(iso) {
    try {
      return new Intl.DateTimeFormat(C.lang === "ar" ? "ar-EG" : "en-US", {
        timeZone: "Africa/Cairo",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).format(new Date(iso));
    } catch {
      return "";
    }
  }

  function doctorId() {
    if (C.currentPage === "doctor-appointments") return C.user?.id || "";
    return (
      document.querySelector("#doctorSelect,#calendarDoctor,select[data-doctor-select]")?.value ||
      C.doctors?.[0]?.id ||
      ""
    );
  }

  function findDayColumns() {
    const labels = [...document.querySelectorAll("div,span,strong,h3,h4")]
      .filter(el => DAY_RE.test((el.textContent || "").trim()));

    const out = [];

    for (const label of labels) {
      let col = label.parentElement;
      let hops = 0;

      while (col && hops < 7) {
        const date = parseVisibleDate(col.textContent || "");
        const starts = col.querySelectorAll("[data-start][data-end]").length;
        if (date && starts > 0) break;
        col = col.parentElement;
        hops += 1;
      }

      if (!col) continue;
      const date = parseVisibleDate(col.textContent || "");
      if (!date) continue;

      if (!out.some(x => x.col === col)) out.push({ col, date });
    }

    return out;
  }

  function canonicalInstant(value) {
    const ms = Date.parse(value || "");
    return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
  }

  function standardIntervals(col) {
    const set = new Set();

    col.querySelectorAll("[data-start][data-end]").forEach(el => {
      const start = canonicalInstant(el.dataset.start);
      const end = canonicalInstant(el.dataset.end);
      if (start && end) set.add(`${start}|${end}`);
    });

    return set;
  }

  function isExtraAppointment(a, standard) {
    if (!a || STATUS_HIDDEN.has(String(a.status || ""))) return false;

    // Prefer explicit backend markers when present.
    const source = String(a.booking_source || "").toLowerCase();
    if (
      source.includes("extra") ||
      source.includes("overbook") ||
      source.includes("walk_in_extra")
    ) return true;

    const start = canonicalInstant(a.scheduled_start);
    const end = canonicalInstant(a.scheduled_end);
    if (!start || !end) return false;

    // Regular appointments exactly match one of the visible hourly windows.
    // Anything deliberately booked at a free approximate time is therefore
    // shown in the separate "Extra cases" block below the day's schedule.
    return standard.size > 0 && !standard.has(`${start}|${end}`);
  }

  async function loadAppointments(doctor, dates) {
    if (!doctor || !dates.length) return [];

    const first = [...dates].sort()[0];
    const last = [...dates].sort().at(-1);

    // Deliberately use a generous UTC envelope, then filter by Cairo local date.
    const from = `${first}T00:00:00Z`;
    const endDate = new Date(`${last}T12:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 2);
    const to = endDate.toISOString();

    const { data, error } = await C.sb
      .from("appointments")
      .select("id,patient_id,doctor_id,appointment_type,scheduled_start,scheduled_end,status,booking_source")
      .eq("doctor_id", doctor)
      .gte("scheduled_start", from)
      .lt("scheduled_start", to)
      .order("scheduled_start", { ascending: true });

    if (error) throw error;

    const rows = (data || []).filter(a => dates.includes(localYmd(a.scheduled_start)));
    const patientIds = [...new Set(rows.map(a => a.patient_id).filter(Boolean))];

    let patientMap = new Map();

    if (patientIds.length) {
      const p = await C.sb
        .from("patients")
        .select("id,medical_record_number,english_name,arabic_name,mobile")
        .in("id", patientIds);

      if (!p.error) {
        patientMap = new Map((p.data || []).map(x => [x.id, x]));
      }
    }

    return rows.map(a => ({ ...a, patient: patientMap.get(a.patient_id) || null }));
  }

  function statusLabel(status) {
    const mapEn = {
      booked:"Booked", confirmed:"Confirmed", arrived:"Arrived",
      waiting:"Waiting", with_doctor:"With doctor", completed:"Completed",
      no_show:"No-show"
    };
    const mapAr = {
      booked:"محجوز", confirmed:"مؤكد", arrived:"وصل",
      waiting:"انتظار", with_doctor:"مع الطبيب", completed:"مكتمل",
      no_show:"لم يحضر"
    };
    return (C.lang === "ar" ? mapAr : mapEn)[status] || status || "";
  }

  function patientName(p) {
    return p?.english_name || p?.arabic_name || txt("Patient", "مريض");
  }

  function renderColumn(col, rows, standard) {
    col.querySelector(".v86-extra-day-list")?.remove();

    const extras = rows.filter(a => isExtraAppointment(a, standard));
    if (!extras.length) return;

    const wrap = document.createElement("section");
    wrap.className = "v86-extra-day-list";
    wrap.innerHTML = `
      <div class="v86-extra-day-title">
        <span>＋ ${txt("Extra cases", "الحالات الإضافية")}</span>
        <span class="v86-extra-day-count">${extras.length}</span>
      </div>
      ${extras.map(a => {
        const p = a.patient;
        const meta = [p?.medical_record_number, p?.mobile].filter(Boolean).join(" • ");
        return `
          <div class="v86-extra-card" data-extra-appointment="${C.escape(a.id)}">
            <span class="v86-extra-time">${C.escape(formatTime(a.scheduled_start))}</span>
            <span class="v86-extra-patient">
              <strong>${C.escape(patientName(p))}</strong>
              <small>${C.escape(meta || txt("Extra booking", "حجز إضافي"))}</small>
            </span>
            <span class="v86-extra-badge">${C.escape(statusLabel(a.status))}</span>
          </div>
        `;
      }).join("")}
    `;

    col.appendChild(wrap);
  }

  let busy = false;
  let queued = false;

  async function refresh() {
    if (!PAGES.has(C.currentPage)) return;
    if (busy) {
      queued = true;
      return;
    }

    const columns = findDayColumns();
    if (!columns.length) return;

    const doctor = doctorId();
    if (!doctor) return;

    busy = true;

    try {
      const dates = [...new Set(columns.map(x => x.date))];
      const rows = await loadAppointments(doctor, dates);

      for (const { col, date } of columns) {
        const standard = standardIntervals(col);
        if (!standard.size) continue;
        renderColumn(
          col,
          rows.filter(a => localYmd(a.scheduled_start) === date),
          standard
        );
      }
    } catch (e) {
      console.warn("V86 extra-case day list:", e);
    } finally {
      busy = false;
      if (queued) {
        queued = false;
        setTimeout(refresh, 80);
      }
    }
  }

  addStyles();

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("change", e => {
    if (
      e.target.matches?.("#doctorSelect,#calendarDoctor,select[data-doctor-select],#jumpDate,#calendarJumpDate")
    ) {
      setTimeout(refresh, 80);
    }
  });

  document.addEventListener("click", e => {
    if (e.target.closest(".app-lang-btn")) setTimeout(refresh, 180);
  });

  window.addEventListener("focus", () => setTimeout(refresh, 80));

  setTimeout(refresh, 300);
  setTimeout(refresh, 1200);
})();
