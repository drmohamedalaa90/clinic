(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => C.lang === "ar" ? ar : en;

  function ensureStyles() {
    if (document.getElementById("v82-extra-case-new-patient-style")) return;

    const style = document.createElement("style");
    style.id = "v82-extra-case-new-patient-style";
    style.textContent = `
      .v82-extra-form{display:grid;gap:14px}
      .v82-extra-banner{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;
        border-radius:13px;padding:12px 14px
      }
      .v82-extra-banner strong{font-size:13px}
      .v82-extra-hint{font-size:11px;color:#8a5a3b;margin-top:3px}
      .v82-extra-count{font-weight:900;background:#ffedd5;border-radius:999px;padding:6px 10px;white-space:nowrap}
      .v82-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v82-grid label,.v82-extra-form>label{display:grid;gap:5px;font-size:12px;font-weight:800}
      .v82-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .v82-mode{
        min-height:42px;border:1px solid var(--border);border-radius:11px;background:#fff;
        color:var(--text);font-weight:850;cursor:pointer
      }
      .v82-mode.active{border-color:var(--primary);background:var(--primary-soft);color:var(--primary)}
      .v82-panel{display:none}
      .v82-panel.active{display:grid;gap:10px}
      .v82-results{max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:12px;background:#fff}
      .v82-choice{width:100%;border:0;border-bottom:1px solid var(--border);background:#fff;padding:10px 12px;text-align:start;display:grid;gap:2px;cursor:pointer}
      .v82-choice:last-child{border-bottom:0}
      .v82-choice.selected,.v82-choice:hover{background:var(--primary-soft)}
      .v82-choice small{font-size:11px;color:var(--muted)}
      #modalRoot .v82-extra-form .control{min-height:40px!important;height:40px!important;padding:7px 10px!important}
      #modalRoot .v82-extra-form textarea.control{height:auto!important;min-height:64px!important}
      @media(max-width:700px){.v82-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function searchPatients(term = "") {
    let q = C.sb
      .from("patients")
      .select("id,medical_record_number,english_name,arabic_name,birth_year,mobile")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(80);

    const t = String(term || "").trim();
    if (t) {
      const safe = t.replaceAll(",", " ");
      q = q.or(
        `medical_record_number.ilike.%${safe}%,` +
        `arabic_name.ilike.%${safe}%,` +
        `english_name.ilike.%${safe}%,` +
        `mobile.ilike.%${safe}%`
      );
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function summary(doctorId, day) {
    const { data, error } = await C.sb.rpc("frontend_get_extra_case_summary", {
      p_doctor: doctorId,
      p_day: day
    });
    if (error) throw error;
    return data || { count: 0, remaining: 10, limit: 10 };
  }

  async function createPatient(root) {
    const ar = root.querySelector("#v82ArabicName").value.trim();
    const en = root.querySelector("#v82EnglishName").value.trim();

    if (!ar && !en) {
      throw new Error(txt("Enter the new patient name.", "اكتب اسم المريض الجديد."));
    }

    const birthRaw = root.querySelector("#v82BirthYear").value;
    const birthYear = birthRaw ? Number(birthRaw) : null;
    const currentYear = new Date().getFullYear();

    if (
      birthYear &&
      (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear)
    ) {
      throw new Error(txt("Enter a valid year of birth.", "أدخل سنة ميلاد صحيحة."));
    }

    const payload = {
      arabic_name: ar || null,
      english_name: en || null,
      birth_year: birthYear,
      gender: root.querySelector("#v82Gender").value || null,
      mobile: root.querySelector("#v82Mobile").value.trim() || null,
      address: root.querySelector("#v82Address").value.trim() || null,
      created_by: C.user.id,
      updated_by: C.user.id
    };

    const { data, error } = await C.sb
      .from("patients")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async function openExtraCaseModal(prefill = {}) {
    await C.loadDoctors(true);

    const doctorOnly = C.currentPage === "doctor-appointments";
    const defaultDoctorId =
      prefill.doctorId ||
      (doctorOnly ? C.user?.id : "") ||
      document.querySelector("#doctorSelect,#calendarDoctor,select[data-doctor-select]")?.value ||
      C.doctors?.[0]?.id ||
      "";

    const today = C.cairoDate();
    const selectedDate = prefill.date || today;

    C.showModal({
      title: txt("Add extra case", "إضافة حالة إضافية"),
      wide: true,
      body: `
        <form id="v82ExtraForm" class="v82-extra-form">
          <div class="v82-extra-banner">
            <div>
              <strong>${txt(
                "Extra cases do not follow hourly slots or the 4-patients/hour limit.",
                "الحالات الإضافية لا تتبع الساعات ولا حد 4 مرضى/ساعة."
              )}</strong>
              <div class="v82-extra-hint">${txt(
                "Maximum 10 extra cases per doctor per day.",
                "الحد الأقصى 10 حالات إضافية لكل طبيب في اليوم."
              )}</div>
            </div>
            <span id="v82Count" class="v82-extra-count">0 / 10</span>
          </div>

          <div class="v82-grid">
            <label>
              ${txt("Doctor","الطبيب")}
              <select id="v82Doctor" class="control" ${doctorOnly ? "disabled" : ""}>
                ${C.doctors.map(d => `
                  <option value="${d.id}" ${d.id === defaultDoctorId ? "selected" : ""}>
                    ${C.escape(C.doctorName(d.id))}
                  </option>
                `).join("")}
              </select>
            </label>

            <label>
              ${txt("Date","التاريخ")}
              <input id="v82Date" class="control" type="date" min="${today}" value="${selectedDate}" required>
            </label>

            <label>
              ${txt("Free approximate time","وقت تقريبي حر")}
              <input id="v82Time" class="control" type="time" value="${prefill.time || "12:00"}" required>
            </label>

            <label>
              ${txt("Visit type","نوع الزيارة")}
              <select id="v82Type" class="control">
                <option value="new">${txt("Examination","كشف")}</option>
                <option value="follow_up">${txt("Consultation","استشارة")}</option>
              </select>
            </label>
          </div>

          <div class="v82-mode-row">
            <button type="button" class="v82-mode active" data-v82-mode="existing">
              ${txt("Existing patient","مريض موجود")}
            </button>
            <button type="button" class="v82-mode" data-v82-mode="new">
              + ${txt("New patient","مريض جديد")}
            </button>
          </div>

          <section id="v82Existing" class="v82-panel active">
            <label>
              ${txt("Choose patient","اختر المريض")}
              <input id="v82Search" class="control" placeholder="${txt("Name / MRN / mobile","الاسم / MRN / الموبايل")}">
            </label>
            <input id="v82PatientId" type="hidden">
            <div id="v82Results" class="v82-results"></div>
          </section>

          <section id="v82New" class="v82-panel">
            <div class="v82-grid">
              <label>
                ${txt("Arabic name","الاسم بالعربية")}
                <input id="v82ArabicName" class="control">
              </label>
              <label>
                ${txt("English name","الاسم بالإنجليزية")}
                <input id="v82EnglishName" class="control">
              </label>
              <label>
                ${txt("Birth year","سنة الميلاد")}
                <input id="v82BirthYear" class="control" type="number" min="1900" max="${new Date().getFullYear()}">
              </label>
              <label>
                ${txt("Gender","النوع")}
                <select id="v82Gender" class="control">
                  <option value="">—</option>
                  <option value="male">${txt("Male","ذكر")}</option>
                  <option value="female">${txt("Female","أنثى")}</option>
                </select>
              </label>
              <label>
                ${txt("Mobile","الموبايل")}
                <input id="v82Mobile" class="control" inputmode="tel">
              </label>
              <label>
                ${txt("Address","العنوان")}
                <input id="v82Address" class="control">
              </label>
            </div>
          </section>

          <label>
            ${txt("Booking notes","ملاحظات الحجز")}
            <textarea id="v82Note" class="control" rows="2"></textarea>
          </label>

          <div class="form-actions">
            <button id="v82Submit" class="primary-button compact" type="submit">
              ${txt("Book extra case","حجز الحالة الإضافية")}
            </button>
          </div>
        </form>
      `,
      onOpen: root => {
        const form = root.querySelector("#v82ExtraForm");
        const doctor = root.querySelector("#v82Doctor");
        const date = root.querySelector("#v82Date");
        const time = root.querySelector("#v82Time");
        const type = root.querySelector("#v82Type");
        const note = root.querySelector("#v82Note");
        const count = root.querySelector("#v82Count");
        const submit = root.querySelector("#v82Submit");
        const existing = root.querySelector("#v82Existing");
        const fresh = root.querySelector("#v82New");
        const search = root.querySelector("#v82Search");
        const results = root.querySelector("#v82Results");
        const patientId = root.querySelector("#v82PatientId");

        let mode = "existing";

        function setMode(next) {
          mode = next;
          root.querySelectorAll("[data-v82-mode]").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.v82Mode === mode);
          });
          existing.classList.toggle("active", mode === "existing");
          fresh.classList.toggle("active", mode === "new");
        }

        root.querySelectorAll("[data-v82-mode]").forEach(btn => {
          btn.addEventListener("click", () => setMode(btn.dataset.v82Mode));
        });

        async function refreshSummary() {
          try {
            const s = await summary(doctor.value, date.value);
            count.textContent = `${s.count || 0} / 10`;
            submit.disabled = Number(s.remaining || 0) <= 0;
          } catch (e) {
            console.warn(e);
          }
        }

        async function renderPatients() {
          results.innerHTML = `<div class="muted" style="padding:10px">${txt("Searching...","جاري البحث...")}</div>`;
          try {
            const rows = await searchPatients(search.value);
            results.innerHTML = rows.length
              ? rows.map(p => `
                  <button type="button" class="v82-choice" data-patient="${p.id}">
                    <strong>${C.escape(p.english_name || p.arabic_name || "Patient")}</strong>
                    <small>${C.escape([
                      p.medical_record_number,
                      p.mobile,
                      p.birth_year ? String(p.birth_year) : ""
                    ].filter(Boolean).join(" • "))}</small>
                  </button>
                `).join("")
              : `<div class="muted" style="padding:10px">${txt(
                  'No matching patient — choose "New patient".',
                  'لا يوجد مريض مطابق — اختر "مريض جديد".'
                )}</div>`;

            results.querySelectorAll("[data-patient]").forEach(btn => {
              btn.addEventListener("click", () => {
                patientId.value = btn.dataset.patient;
                results.querySelectorAll(".v82-choice").forEach(x => x.classList.remove("selected"));
                btn.classList.add("selected");
              });
            });
          } catch (e) {
            results.innerHTML = `<div style="padding:10px;color:#b91c1c">${C.escape(e.message)}</div>`;
          }
        }

        let timer;
        search.addEventListener("input", () => {
          clearTimeout(timer);
          timer = setTimeout(renderPatients, 180);
        });

        doctor.addEventListener("change", refreshSummary);
        date.addEventListener("change", refreshSummary);

        form.addEventListener("submit", async event => {
          event.preventDefault();

          const old = submit.textContent;
          submit.disabled = true;
          submit.textContent = txt("Booking...","جاري الحجز...");

          try {
            let selectedPatientId = patientId.value;

            if (mode === "new") {
              selectedPatientId = await createPatient(root);
            } else if (!selectedPatientId) {
              throw new Error(txt(
                'Choose a patient or select "New patient".',
                'اختر المريض أو اختر "مريض جديد".'
              ));
            }

            const { error } = await C.sb.rpc("frontend_book_extra_case", {
              p_patient: selectedPatientId,
              p_doctor: doctor.value,
              p_day: date.value,
              p_time: time.value || "12:00",
              p_type: type.value || "new",
              p_note: note.value.trim() || null
            });

            if (error) throw error;

            C.closeModal();
            C.toast(txt("Extra case booked.","تم حجز الحالة الإضافية."));
            setTimeout(() => window.location.reload(), 250);
          } catch (error) {
            submit.disabled = false;
            submit.textContent = old;
            C.toast(error.message, "error");
          }
        });

        renderPatients();
        refreshSummary();
      }
    });
  }

  ensureStyles();

  // Canonical launcher: newer than V51, so all day "+" buttons calling
  // C.openExtraCaseModal automatically get the New Patient option.
  C.openExtraCaseModal = openExtraCaseModal;

  // Replace the old top V51 button handler safely by cloning once.
  function wireTopButton() {
    const old = document.getElementById("v51ExtraCaseButton");
    if (!old || old.dataset.v82Wired === "1") return;

    const clone = old.cloneNode(true);
    clone.dataset.v82Wired = "1";
    clone.addEventListener("click", () => openExtraCaseModal());
    old.replaceWith(clone);
  }

  wireTopButton();
  setTimeout(wireTopButton, 500);
  setTimeout(wireTopButton, 1500);
})();