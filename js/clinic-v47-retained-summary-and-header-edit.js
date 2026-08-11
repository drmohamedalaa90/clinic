(() => {
  const C = window.Clinic;
  if (!C) return;

  const ar = () => C.lang === 'ar' || document.documentElement.dir === 'rtl';

  async function loadSummary(patientId) {
    const { data, error } = await C.sb.rpc('v36_get_patient_summary', { p_patient: patientId });
    if (error) throw error;
    return data || { diagnosis:'', most_important_notes:'' };
  }

  async function saveSummary(patientId) {
    const diagnosis = document.getElementById('v47RetainedDiagnosis');
    const notes = document.getElementById('v47RetainedImportantNotes');
    if (!diagnosis || !notes) return;

    const { error } = await C.sb.rpc('v36_save_patient_summary', {
      p_patient: patientId,
      p_diagnosis: diagnosis.value.trim(),
      p_important_notes: notes.value.trim()
    });
    if (error) throw error;

    const original = document.querySelector('#clinicalForm textarea[name="diagnosis_summary"]');
    if (original) original.value = diagnosis.value;
  }

  async function installRetainedTop() {
    if (C.currentPage !== 'clinical-visit') return;

    const form = document.getElementById('clinicalForm');
    if (!form || document.getElementById('v47PermanentClinicalSummary')) return;

    const state = C.loadRouteState?.() || {};
    const patientId =
      state.params?.patientId ||
      form.dataset.patientId ||
      document.querySelector('[data-patient-id]')?.dataset.patientId;

    if (!patientId) return;

    let summary = { diagnosis:'', most_important_notes:'' };
    try { summary = await loadSummary(patientId); } catch {}

    const box = document.createElement('section');
    box.id = 'v47PermanentClinicalSummary';
    box.className = 'v47-permanent-summary';
    box.innerHTML = `
      <div class="v47-summary-head">
        <div>
          <span class="v47-eyebrow">${ar() ? 'الملخص الطبي الدائم' : 'PERMANENT CLINICAL SUMMARY'}</span>
          <h2>${ar() ? 'التشخيص وأهم الملاحظات' : 'Diagnosis & most important notes'}</h2>
          <p>${ar() ? 'اكتب هذين القسمين أولاً. سيظلان محفوظين دائماً في ملف المريض بعد إغلاق الزيارة.' : 'Complete these two fields first. They remain permanently in the patient record after the visit is closed.'}</p>
        </div>
        <span class="v47-retained-badge">${ar() ? 'محفوظ دائماً' : 'Always retained'}</span>
      </div>

      <div class="v47-summary-grid">
        <label>
          <span>${ar() ? 'التشخيص' : 'Diagnosis'}</span>
          <textarea id="v47RetainedDiagnosis" class="control" rows="5"></textarea>
        </label>

        <label>
          <span>${ar() ? 'أهم الملاحظات' : 'Most important notes'}</span>
          <textarea id="v47RetainedImportantNotes" class="control" rows="5"></textarea>
        </label>
      </div>

      <div class="v47-summary-actions">
        <button id="v47SaveRetainedSummary" type="button" class="primary-button compact">
          ${ar() ? 'حفظ المعلومات الدائمة' : 'Save retained information'}
        </button>
        <small>${ar() ? 'باقي بيانات الزيارة أسفل هذا الإطار ليست المعلومات الدائمة.' : 'The remaining clinical fields below are visit details, not the permanently retained summary.'}</small>
      </div>
    `;

    form.insertBefore(box, form.firstChild);

    document.getElementById('v47RetainedDiagnosis').value = summary.diagnosis || '';
    document.getElementById('v47RetainedImportantNotes').value = summary.most_important_notes || '';

    const original = document.querySelector('#clinicalForm textarea[name="diagnosis_summary"]');
    if (original) {
      original.value = summary.diagnosis || original.value || '';
      const block = original.closest('.clinical-field') || original.parentElement;
      if (block) block.style.display = 'none';
    }

    document.getElementById('v47SaveRetainedSummary').onclick = async () => {
      try {
        await saveSummary(patientId);
        C.toast(ar() ? 'تم حفظ التشخيص وأهم الملاحظات.' : 'Diagnosis and most important notes saved.');
      } catch (e) {
        C.toast(e.message, 'error');
      }
    };

    form.addEventListener('submit', () => saveSummary(patientId).catch(()=>{}), true);

    [...form.querySelectorAll('button')].forEach(btn => {
      const t = btn.textContent?.trim().toLowerCase();
      if (t === 'save draft' || t === 'حفظ المسودة') {
        btn.addEventListener('click', () => saveSummary(patientId).catch(()=>{}), true);
      }
    });
  }

  function moveEditBookingToHeader() {
    const root = document.getElementById('modalRoot');
    if (!root || root.classList.contains('hidden')) return;

    const header = root.querySelector('.modal-header');
    if (!header) return;

    let button = root.querySelector('#editFromInformationConfirm');

    if (!button) {
      button = [...root.querySelectorAll('button')].find(btn => {
        const t = btn.textContent?.trim().toLowerCase();
        return ['edit booking','تعديل الحجز','edit information','تعديل البيانات'].includes(t);
      });
    }

    if (!button || button.classList.contains('v47-header-edit-booking')) return;

    button.classList.add('v47-header-edit-booking');
    button.textContent = ar() ? '✎ تعديل الحجز' : '✎ Edit booking';

    const close = header.querySelector('[data-close-modal], .icon-button');
    close ? header.insertBefore(button, close) : header.appendChild(button);
  }

  const oldClinical = window.ClinicPages?.['clinical-visit'];
  if (typeof oldClinical === 'function') {
    window.ClinicPages['clinical-visit'] = async function(params={}) {
      const result = await oldClinical(params);
      setTimeout(installRetainedTop, 0);
      return result;
    };
  }

  const obs = new MutationObserver(() => {
    requestAnimationFrame(() => {
      installRetainedTop();
      moveEditBookingToHeader();
    });
  });

  obs.observe(document.body, { childList:true, subtree:true });

  const style = document.createElement('style');
  style.textContent = `
    .v47-permanent-summary{margin:0 0 18px;padding:18px;border:1.5px solid #8fd1c2;border-radius:16px;background:linear-gradient(135deg,#effaf7,#fff 80%);}
    .v47-summary-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px;}
    .v47-eyebrow{display:block;color:#0b8b76;font-size:11px;font-weight:900;letter-spacing:.05em;}
    .v47-summary-head h2{margin:4px 0 5px;font-size:22px;color:#10233c;}
    .v47-summary-head p{margin:0;color:#718097;font-size:12px;font-weight:650;}
    .v47-retained-badge{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#0d927c;color:#fff;font-size:9px;font-weight:900;height:max-content;}
    .v47-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
    .v47-summary-grid label{display:grid;gap:6px;font-weight:900;color:#10233c;}
    .v47-summary-grid textarea{min-height:125px;resize:vertical;background:#fff;}
    .v47-summary-actions{margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
    .v47-summary-actions small{color:#788598;}
    #modalRoot .modal-header{display:flex;align-items:center;gap:10px;}
    #modalRoot .modal-header h3{flex:1 1 auto;min-width:0;}
    #modalRoot .v47-header-edit-booking{flex:0 0 auto;min-height:40px;padding:8px 13px!important;border:1px solid #abd8ce!important;border-radius:11px!important;background:#effaf7!important;color:#087260!important;font-size:11px!important;font-weight:900!important;white-space:nowrap;}
    @media(max-width:760px){.v47-summary-grid{grid-template-columns:1fr}.v47-permanent-summary{padding:13px}.v47-summary-head h2{font-size:18px}#modalRoot .v47-header-edit-booking{min-height:36px;padding:7px 9px!important;font-size:9px!important}}
  `;
  document.head.appendChild(style);
})();