(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function isDoctor(){

    return Boolean(
      C.isDoctor?.()
    );
  }


  function cairoDayBounds(){

    const day =
      C.cairoDate();


    return {
      start:
        `${day}T00:00:00+03:00`,

      end:
        `${day}T23:59:59+03:00`
    };
  }


  function patientName(
    patient
  ){

    return (
      patient?.english_name
      ||
      patient?.arabic_name
      ||
      patient?.medical_record_number
      ||
      'Patient'
    );
  }


  function escapeText(
    value
  ){

    return C.escape(
      value
      ??
      ''
    );
  }


  function statusRank(
    status
  ){

    const ranks = {
      with_doctor:
        1,

      waiting:
        2,

      arrived:
        3,

      completed:
        4,

      confirmed:
        5,

      booked:
        6
    };


    return (
      ranks[status]
      ??
      99
    );
  }


  async function getTodayAppointmentForPatient(
    patientId
  ){

    const {
      start,
      end
    } =
      cairoDayBounds();


    const {
      data,
      error
    } =
      await C.sb
        .from(
          'appointments'
        )
        .select(
          `
            id,
            patient_id,
            doctor_id,
            status,
            scheduled_start,
            scheduled_end
          `
        )
        .eq(
          'doctor_id',
          C.user.id
        )
        .eq(
          'patient_id',
          patientId
        )
        .gte(
          'scheduled_start',
          start
        )
        .lte(
          'scheduled_start',
          end
        )
        .not(
          'status',
          'in',
          '("cancelled","rescheduled","no_show")'
        );


    if(error){
      throw error;
    }


    const rows =
      data
      ||
      [];


    rows.sort(
      (a,b)=>
        (
          statusRank(
            a.status
          )
          -
          statusRank(
            b.status
          )
        )
        ||
        (
          new Date(
            b.scheduled_start
          ).getTime()
          -
          new Date(
            a.scheduled_start
          ).getTime()
        )
    );


    return (
      rows[0]
      ||
      null
    );
  }


  async function getVisitForAppointment(
    appointmentId
  ){

    const {
      data,
      error
    } =
      await C.sb
        .from(
          'clinical_visits'
        )
        .select(
          'id,appointment_id,patient_id,doctor_id,finalized_at'
        )
        .eq(
          'appointment_id',
          appointmentId
        )
        .maybeSingle();


    if(error){
      throw error;
    }


    return data;
  }


  function visitIdFromRpc(
    value
  ){

    const v =
      Array.isArray(
        value
      )
        ? value[0]
        : value;


    if(!v){
      return null;
    }


    if(
      typeof v ===
      'string'
    ){
      return v;
    }


    return (
      v.id
      ||
      v.visit_id
      ||
      null
    );
  }


  async function openCheckedInPatient(
    patientId
  ){

    if(!isDoctor()){

      return C.route(
        'patient-detail',
        {
          patientId
        }
      );
    }


    let appointment;


    try{

      appointment =
        await getTodayAppointmentForPatient(
          patientId
        );

    }
    catch(error){

      return C.toast(
        error.message,
        'error'
      );
    }


    if(!appointment){

      return C.route(
        'patient-detail',
        {
          patientId
        }
      );
    }


    /*
     * Not yet checked in:
     * doctor may review the patient record,
     * but cannot start/edit a clinical visit.
     */
    if(
      [
        'booked',
        'confirmed'
      ].includes(
        appointment.status
      )
    ){

      return C.route(
        'patient-detail',
        {
          patientId
        }
      );
    }


    /*
     * If an older check-in workflow left the case as ARRIVED,
     * this doctor-only RPC safely promotes the assigned doctor's
     * own patient into the waiting workflow.
     */
    if(
      appointment.status ===
      'arrived'
    ){

      const prep =
        await C.sb.rpc(
          'doctor_prepare_checked_in_appointment',
          {
            p_appointment:
              appointment.id
          }
        );


      if(prep.error){

        return C.toast(
          prep.error.message,
          'error'
        );
      }


      appointment.status =
        prep.data?.status
        ||
        'waiting';
    }


    /*
     * Waiting -> doctor starts consultation -> visit becomes editable.
     */
    if(
      appointment.status ===
      'waiting'
    ){

      const start =
        await C.sb.rpc(
          'frontend_start_consultation',
          {
            p_id:
              appointment.id
          }
        );


      if(start.error){

        return C.toast(
          start.error.message,
          'error'
        );
      }


      const open =
        await C.sb.rpc(
          'frontend_open_clinical_visit',
          {
            p_appointment:
              appointment.id
          }
        );


      if(open.error){

        return C.toast(
          open.error.message,
          'error'
        );
      }


      const visitId =
        visitIdFromRpc(
          open.data
        );


      if(!visitId){

        return C.toast(
          C.lang==='ar'
            ? 'تعذر فتح الزيارة الطبية.'
            : 'Could not open clinical visit.',
          'error'
        );
      }


      return C.route(
        'clinical-visit',
        {
          visitId,
          appointmentId:
            appointment.id,
          readOnly:
            false
        }
      );
    }


    /*
     * Already with doctor:
     * open the same draft, do NOT create another visit.
     */
    if(
      appointment.status ===
      'with_doctor'
    ){

      let visit;


      try{

        visit =
          await getVisitForAppointment(
            appointment.id
          );

      }
      catch(error){

        return C.toast(
          error.message,
          'error'
        );
      }


      if(!visit){

        const open =
          await C.sb.rpc(
            'frontend_open_clinical_visit',
            {
              p_appointment:
                appointment.id
            }
          );


        if(open.error){

          return C.toast(
            open.error.message,
            'error'
          );
        }


        const visitId =
          visitIdFromRpc(
            open.data
          );


        if(!visitId){

          return C.toast(
            'Could not open clinical visit.',
            'error'
          );
        }


        return C.route(
          'clinical-visit',
          {
            visitId,
            appointmentId:
              appointment.id,
            readOnly:
              false
          }
        );
      }


      return C.route(
        'clinical-visit',
        {
          visitId:
            visit.id,

          appointmentId:
            appointment.id,

          readOnly:
            Boolean(
              visit.finalized_at
            )
        }
      );
    }


    /*
     * Completed:
     * open the previous note read-only.
     */
    if(
      appointment.status ===
      'completed'
    ){

      try{

        const visit =
          await getVisitForAppointment(
            appointment.id
          );


        if(visit){

          return C.route(
            'clinical-visit',
            {
              visitId:
                visit.id,

              appointmentId:
                appointment.id,

              readOnly:
                true
            }
          );
        }

      }
      catch(error){

        console.warn(
          error
        );
      }
    }


    return C.route(
      'patient-detail',
      {
        patientId
      }
    );
  }


  function enhanceTodayClinic(){

    if(!isDoctor()){
      return;
    }


    document
      .querySelectorAll(
        '[data-doctor-home-patient]'
      )
      .forEach(
        button=>{

          if(
            button.dataset
              .clinicalOpenReady ===
            '1'
          ){
            return;
          }


          button.dataset
            .clinicalOpenReady =
              '1';


          /*
           * appointments.js originally opens Patient Details.
           * We intentionally replace that click after Today's Clinic
           * has rendered.
           */
          button.onclick =
            event=>{

              event.preventDefault();
              event.stopPropagation();


              openCheckedInPatient(
                button.dataset
                  .doctorHomePatient
              );
            };


          const statusText =
            button
              .querySelector(
                '.status-pill'
              )
              ?.textContent
              ?.trim()
              ?.toLowerCase()
              ||
              '';


          if(
            statusText.includes(
              'waiting'
            )
            ||
            statusText.includes(
              'انتظار'
            )
            ||
            statusText.includes(
              'with doctor'
            )
            ||
            statusText.includes(
              'مع الطبيب'
            )
          ){

            button.classList.add(
              'doctor-clinical-ready'
            );


            const main =
              button.querySelector(
                '.doctor-clinic-patient-main'
              );


            if(
              main
              &&
              !main.querySelector(
                '.doctor-clinical-hint'
              )
            ){

              const hint =
                document.createElement(
                  'small'
                );


              hint.className =
                'doctor-clinical-hint';


              hint.textContent =
                C.lang==='ar'
                  ? 'اضغط لفتح التشخيص والملاحظات'
                  : 'Open diagnosis & notes';


              main.appendChild(
                hint
              );
            }
          }
        }
      );
  }


  /*
   * Wrap Today's Clinic so the enhancement is re-applied every time
   * the SPA page is rendered.
   */
  const originalTodayClinic =
    window.ClinicPages?.[
      'today-clinic'
    ];


  if(
    typeof originalTodayClinic ===
    'function'
  ){

    window.ClinicPages[
      'today-clinic'
    ] =
      async function(...args){

        const result =
          await originalTodayClinic(
            ...args
          );


        enhanceTodayClinic();


        return result;
      };
  }


  /*
   * ---------- CLINICAL SEARCH IN PATIENTS ----------
   */


  async function searchClinicalRecords(
    term
  ){

    const clean =
      String(
        term
        ||
        ''
      )
      .trim();


    if(
      !isDoctor()
      ||
      clean.length < 2
    ){

      return [];
    }


    const {
      data,
      error
    } =
      await C.sb.rpc(
        'doctor_search_patients_clinically',
        {
          p_term:
            clean
        }
      );


    if(error){
      throw error;
    }


    return (
      data
      ||
      []
    );
  }


  function renderClinicalMatches(
    host,
    matches,
    term
  ){

    if(!host){
      return;
    }


    if(
      !term
      ||
      term.length < 2
    ){

      host.innerHTML =
        '';

      host.classList.add(
        'hidden'
      );

      return;
    }


    host.classList.remove(
      'hidden'
    );


    host.innerHTML = `
      <div class="clinical-search-head">

        <div>
          <span class="eyebrow">
            CLINICAL SEARCH
          </span>

          <strong>
            ${
              C.lang==='ar'
                ? 'نتائج من التشخيصات والملاحظات'
                : 'Matches in diagnoses & clinical notes'
            }
          </strong>
        </div>

        <span class="clinical-search-count">
          ${matches.length}
        </span>

      </div>

      ${
        matches.length
          ? `
            <div class="clinical-search-list">

              ${matches.map(
                item=>`
                  <article class="clinical-search-card">

                    <div class="clinical-search-main">

                      <span class="eyebrow">
                        ${escapeText(
                          item.medical_record_number
                          ||
                          ''
                        )}
                      </span>

                      <strong>
                        ${escapeText(
                          item.patient_name
                          ||
                          'Patient'
                        )}
                      </strong>

                      <small>
                        ${escapeText(
                          item.match_source
                          ||
                          ''
                        )}
                        •
                        ${
                          item.visit_date
                            ? C.formatDate(
                                item.visit_date
                              )
                            : ''
                        }
                      </small>

                      <p>
                        ${escapeText(
                          item.matched_text
                          ||
                          ''
                        )}
                      </p>

                    </div>

                    <div class="clinical-search-actions">

                      <button
                        type="button"
                        class="table-action"
                        data-clinical-search-patient="${item.patient_id}"
                      >
                        ${
                          C.lang==='ar'
                            ? 'فتح المريض'
                            : 'Open patient'
                        }
                      </button>

                      ${
                        item.visit_id
                          ? `
                            <button
                              type="button"
                              class="table-action success-outline"
                              data-clinical-search-visit="${item.visit_id}"
                            >
                              ${
                                C.lang==='ar'
                                  ? 'فتح الزيارة'
                                  : 'Open visit'
                              }
                            </button>
                          `
                          : ''
                      }

                    </div>

                  </article>
                `
              ).join('')}

            </div>
          `
          : `
            <div class="clinical-search-empty">
              ${
                C.lang==='ar'
                  ? 'لا توجد تشخيصات أو ملاحظات مطابقة في زياراتك.'
                  : 'No matching diagnoses or notes in your clinical visits.'
              }
            </div>
          `
      }
    `;


    host
      .querySelectorAll(
        '[data-clinical-search-patient]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>C.route(
              'patient-detail',
              {
                patientId:
                  button.dataset
                    .clinicalSearchPatient
              }
            );
        }
      );


    host
      .querySelectorAll(
        '[data-clinical-search-visit]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>C.route(
              'clinical-visit',
              {
                visitId:
                  button.dataset
                    .clinicalSearchVisit,

                readOnly:
                  true
              }
            );
        }
      );
  }


  function enhancePatientsSearch(){

    if(!isDoctor()){
      return;
    }


    const search =
      document.getElementById(
        'patientSearch'
      );


    const table =
      document.getElementById(
        'patientTableArea'
      );


    if(
      !search
      ||
      !table
      ||
      search.dataset
        .clinicalSearchReady ===
          '1'
    ){
      return;
    }


    search.dataset
      .clinicalSearchReady =
        '1';


    search.placeholder =
      C.lang==='ar'
        ? 'الاسم / MRN / الموبايل / التشخيص / الملاحظات'
        : 'Name / MRN / Mobile / Diagnosis / Notes';


    const toolbarText =
      document.querySelector(
        '.page-toolbar .muted'
      );


    if(toolbarText){

      toolbarText.textContent =
        C.lang==='ar'
          ? 'ابحث بالاسم أو رقم الملف أو الموبايل أو التشخيص أو الملاحظات الطبية.'
          : 'Search by name, MRN, mobile, diagnosis or clinical notes.';
    }


    const host =
      document.createElement(
        'section'
      );


    host.id =
      'clinicalPatientSearchMatches';


    host.className =
      'clinical-search-results hidden';


    table.insertAdjacentElement(
      'beforebegin',
      host
    );


    let timer =
      null;


    async function run(){

      const term =
        search.value.trim();


      if(
        term.length < 2
      ){

        renderClinicalMatches(
          host,
          [],
          ''
        );

        return;
      }


      try{

        const matches =
          await searchClinicalRecords(
            term
          );


        renderClinicalMatches(
          host,
          matches,
          term
        );

      }
      catch(error){

        console.error(
          'Clinical patient search failed',
          error
        );


        host.classList.remove(
          'hidden'
        );


        host.innerHTML = `
          <div class="clinical-search-empty">
            ${escapeText(
              error.message
            )}
          </div>
        `;
      }
    }


    search.addEventListener(
      'input',
      ()=>{

        clearTimeout(
          timer
        );


        timer =
          setTimeout(
            run,
            280
          );
      }
    );


    document
      .getElementById(
        'patientSearchBtn'
      )
      ?.addEventListener(
        'click',
        run
      );
  }


  const originalPatients =
    window.ClinicPages?.patients;


  if(
    typeof originalPatients ===
    'function'
  ){

    window.ClinicPages.patients =
      async function(...args){

        const result =
          await originalPatients(
            ...args
          );


        enhancePatientsSearch();


        return result;
      };
  }


  /*
   * Styles kept here so no css file is required.
   */
  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .doctor-clinical-ready {
      border-color: #efb3b3 !important;
      background: #fff7f7 !important;
    }

    .doctor-clinical-hint {
      display: block;
      margin-top: 3px;
      color: #b42318;
      font-size: 9px;
      font-weight: 800;
    }

    .clinical-search-results {
      margin: 12px 0 16px;
      padding: 14px;

      border: 1px solid #b7d9d1;
      border-radius: 15px;

      background: #f6fcfa;
    }

    .clinical-search-results.hidden {
      display: none;
    }

    .clinical-search-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      margin-bottom: 10px;
    }

    .clinical-search-head > div {
      display: grid;
      gap: 3px;
    }

    .clinical-search-count {
      min-width: 28px;
      height: 28px;

      display: grid;
      place-items: center;

      border-radius: 999px;

      background: #0f8b78;
      color: white;

      font-size: 11px;
      font-weight: 900;
    }

    .clinical-search-list {
      display: grid;
      gap: 8px;
    }

    .clinical-search-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;

      padding: 11px 12px;

      border: 1px solid #dbe7e3;
      border-radius: 12px;

      background: white;
    }

    .clinical-search-main {
      min-width: 0;

      display: grid;
      gap: 3px;
    }

    .clinical-search-main strong {
      color: #10233c;
    }

    .clinical-search-main small {
      color: #6b7b8d;
    }

    .clinical-search-main p {
      margin: 4px 0 0;

      color: #425466;

      font-size: 11px;
      line-height: 1.55;

      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;

      overflow: hidden;
    }

    .clinical-search-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .clinical-search-empty {
      padding: 10px;

      color: #6b7b8d;

      text-align: center;
      font-size: 11px;
    }

    @media (max-width: 650px) {
      .clinical-search-card {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `;


  document.head.appendChild(
    style
  );


  window.ClinicDoctorClinicalAccess = {
    openCheckedInPatient
  };

})();
