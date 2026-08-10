(() => {

  const C =
    window.Clinic;


  if(!C){
    console.error(
      'Clinic V31: Clinic core not loaded.'
    );

    return;
  }


  // ===============================================================
  // LABELS + NAVIGATION
  // ===============================================================

  C.labels.en.chat =
    'Clinic Chat';

  C.labels.ar.chat =
    'محادثات العيادة';


  const originalBuildNavigation =
    C.buildNavigation.bind(
      C
    );


  C.buildNavigation =
    function(){

      originalBuildNavigation();


      const nav =
        document.getElementById(
          'navigation'
        );


      if(!nav){
        return;
      }


      function addItem(
        icon,
        key,
        page,
        beforePage=null
      ){

        if(
          nav.querySelector(
            `[data-page="${page}"]`
          )
        ){
          return;
        }


        const holder =
          document.createElement(
            'div'
          );


        holder.innerHTML =
          C.navItem(
            icon,
            key,
            page
          );


        const item =
          holder.firstElementChild;


        if(!item){
          return;
        }


        item.addEventListener(
          'click',
          ()=>C.route(
            page
          )
        );


        const before =
          beforePage
            ? nav.querySelector(
                `[data-page="${beforePage}"]`
              )
            : null;


        if(before){

          nav.insertBefore(
            item,
            before
          );

        }
        else{

          nav.appendChild(
            item
          );
        }
      }


      /*
       * Doctors get their own read-only finance view.
       */
      if(
        C.isDoctor()
        &&
        !C.isReception()
      ){

        addItem(
          '💳',
          'finance',
          'finance',
          'referrals'
        );
      }


      /*
       * Chat:
       * - doctors
       * - secretary
       * - owner (audit/read-all)
       */
      if(
        C.isDoctor()
        ||
        C.hasRole(
          'secretary'
        )
        ||
        C.hasRole(
          'owner'
        )
      ){

        addItem(
          '💬',
          'chat',
          'clinic-chat',
          'profile'
        );
      }
    };


  // ===============================================================
  // COMMON HELPERS
  // ===============================================================

  function esc(
    value
  ){

    return C.escape(
      value
      ??
      ''
    );
  }


  function todayBounds(){

    const today =
      C.cairoDate();


    return {
      start:
        `${today}T00:00:00+03:00`,

      end:
        `${today}T23:59:59+03:00`
    };
  }


  function appointmentPriority(
    status
  ){

    const order = {

      waiting:
        1,

      with_doctor:
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
      order[
        status
      ]
      ??
      99
    );
  }


  function visitIdFromRpc(
    value
  ){

    const row =
      Array.isArray(
        value
      )
        ? value[0]
        : value;


    if(
      typeof row ===
      'string'
    ){
      return row;
    }


    return (
      row?.id
      ||
      row?.visit_id
      ||
      null
    );
  }


  // ===============================================================
  // 1) DOCTOR FLOW:
  //    checked-in -> queue -> editable visit -> close
  // ===============================================================

  async function findTodayDoctorAppointment(
    patientId
  ){

    const {
      start,
      end
    } =
      todayBounds();


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
            scheduled_end,
            appointment_type,
            checked_in_at
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
          appointmentPriority(
            a.status
          )
          -
          appointmentPriority(
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


  async function clinicalVisitForAppointment(
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
          `
            id,
            appointment_id,
            patient_id,
            doctor_id,
            finalized_at
          `
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


  async function openDoctorPatient(
    patientId
  ){

    if(
      !C.isDoctor()
    ){

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
        await findTodayDoctorAppointment(
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
     * Not checked in yet:
     * patient file can be viewed, but diagnosis/note entry must wait.
     */
    if(
      [
        'booked',
        'confirmed'
      ].includes(
        appointment.status
      )
    ){

      C.toast(
        C.lang==='ar'
          ? 'يجب تأكيد البيانات وتسجيل الوصول أولاً.'
          : 'Confirm information and check the patient in first.',
        'error'
      );


      return C.route(
        'patient-detail',
        {
          patientId
        }
      );
    }


    /*
     * Legacy arrived case.
     * New V31 check-ins automatically become WAITING.
     */
    if(
      appointment.status ===
      'arrived'
    ){

      const send =
        await C.sb.rpc(
          'frontend_send_to_doctor',
          {
            p_id:
              appointment.id
          }
        );


      if(
        send.error
      ){

        return C.toast(
          send.error.message,
          'error'
        );
      }


      appointment.status =
        'waiting';
    }


    /*
     * Start waiting consultation.
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


      if(
        start.error
      ){

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


      if(
        open.error
      ){

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
            ? 'تعذر فتح الكشف الطبي.'
            : 'Could not open the clinical visit.',
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
     * Already with the doctor: reopen same draft.
     */
    if(
      appointment.status ===
      'with_doctor'
    ){

      let visit =
        await clinicalVisitForAppointment(
          appointment.id
        );


      if(!visit){

        const open =
          await C.sb.rpc(
            'frontend_open_clinical_visit',
            {
              p_appointment:
                appointment.id
            }
          );


        if(
          open.error
        ){

          return C.toast(
            open.error.message,
            'error'
          );
        }


        const visitId =
          visitIdFromRpc(
            open.data
          );


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
     * Completed: historical record only.
     */
    if(
      appointment.status ===
      'completed'
    ){

      const visit =
        await clinicalVisitForAppointment(
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


    return C.route(
      'patient-detail',
      {
        patientId
      }
    );
  }


  function enhanceTodayClinic(){

    if(
      !C.isDoctor()
    ){
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
              .v31DoctorReady ===
            '1'
          ){
            return;
          }


          button.dataset
            .v31DoctorReady =
              '1';


          button.onclick =
            event=>{

              event.preventDefault();
              event.stopPropagation();


              openDoctorPatient(
                button.dataset
                  .doctorHomePatient
              );
            };


          const main =
            button.querySelector(
              '.doctor-clinic-patient-main'
            );


          if(
            main
            &&
            !main.querySelector(
              '.v31-clinical-hint'
            )
          ){

            const hint =
              document.createElement(
                'small'
              );


            hint.className =
              'v31-clinical-hint';


            hint.textContent =
              C.lang==='ar'
                ? 'بعد تسجيل الوصول: افتح التشخيص والملاحظات'
                : 'After check-in: open diagnosis & notes';


            main.appendChild(
              hint
            );
          }
        }
      );
  }


  const originalTodayClinic =
    window
      .ClinicPages[
        'today-clinic'
      ];


  if(
    typeof originalTodayClinic ===
    'function'
  ){

    window
      .ClinicPages[
        'today-clinic'
      ] =
      async function(
        ...args
      ){

        const result =
          await originalTodayClinic(
            ...args
          );


        enhanceTodayClinic();


        return result;
      };
  }


  /*
   * Clinical visit wrapper:
   * adds one clear "Save & Close Consultation" button.
   */
  const originalClinicalVisit =
    window
      .ClinicPages[
        'clinical-visit'
      ];


  if(
    typeof originalClinicalVisit ===
    'function'
  ){

    window
      .ClinicPages[
        'clinical-visit'
      ] =
      async function(
        params={}
      ){

        const result =
          await originalClinicalVisit(
            params
          );


        if(
          !C.isDoctor()
        ){
          return result;
        }


        const form =
          document.getElementById(
            'clinicalForm'
          );


        const saveDraft =
          document.getElementById(
            'saveDraft'
          );


        const visitId =
          params.visitId;


        if(
          !form
          ||
          !visitId
        ){
          return result;
        }


        let {
          data: visit,
          error
        } =
          await C.sb
            .from(
              'clinical_visits'
            )
            .select(
              `
                id,
                appointment_id,
                doctor_id,
                finalized_at
              `
            )
            .eq(
              'id',
              visitId
            )
            .single();


        if(
          error
          ||
          !visit
          ||
          visit.doctor_id !==
            C.user.id
        ){
          return result;
        }


        /*
         * If draft is editable, add unified close.
         */
        if(
          saveDraft
          &&
          !visit.finalized_at
        ){

          document
            .getElementById(
              'finalizeVisit'
            )
            ?.remove();


          const actions =
            document.querySelector(
              '.consult-actions'
            );


          if(
            actions
            &&
            !document.getElementById(
              'v31SaveCloseConsultation'
            )
          ){

            const closeButton =
              document.createElement(
                'button'
              );


            closeButton.id =
              'v31SaveCloseConsultation';

            closeButton.type =
              'button';

            closeButton.className =
              'primary-button compact';

            closeButton.textContent =
              C.lang==='ar'
                ? '✓ حفظ وإنهاء الكشف'
                : '✓ Save & close consultation';


            actions.appendChild(
              closeButton
            );


            closeButton.onclick =
              async()=>{

                if(
                  !confirm(
                    C.lang==='ar'
                      ? 'سيتم حفظ الملاحظات والتشخيص ثم قفل الزيارة وإنهاء الكشف. متابعة؟'
                      : 'Save the note and diagnosis, lock the visit, and close the consultation?'
                  )
                ){
                  return;
                }


                closeButton.disabled =
                  true;


                const f =
                  new FormData(
                    form
                  );


                const payload =
                  {};


                [
                  'chief_complaint',
                  'history_present_illness',
                  'past_medical_history',
                  'family_history',
                  'social_history',
                  'allergies',
                  'current_medications',
                  'examination',
                  'diagnosis_summary',
                  'workup_plan',
                  'treatment_plan',
                  'clinical_notes',
                  'follow_up_plan'
                ]
                .forEach(
                  key=>
                    payload[
                      key
                    ] =
                      f.get(
                        key
                      )
                      ||
                      null
                );


                const vitals =
                  {};


                [
                  'systolic_bp',
                  'diastolic_bp',
                  'heart_rate',
                  'respiratory_rate',
                  'oxygen_saturation',
                  'temperature_c',
                  'weight_kg',
                  'height_cm',
                  'random_glucose_mg_dl'
                ]
                .forEach(
                  key=>{

                    const value =
                      f.get(
                        `v_${key}`
                      );


                    if(
                      value !==
                      ''
                      &&
                      value !==
                      null
                    ){

                      vitals[
                        key
                      ] =
                        Number(
                          value
                        );
                    }
                  }
                );


                if(
                  Object.keys(
                    vitals
                  ).length
                ){

                  payload.vitals =
                    vitals;
                }


                const save =
                  await C.sb.rpc(
                    'frontend_save_clinical_visit',
                    {
                      p_visit:
                        visitId,

                      p_payload:
                        payload
                    }
                  );


                if(
                  save.error
                ){

                  closeButton.disabled =
                    false;


                  return C.toast(
                    save.error.message,
                    'error'
                  );
                }


                const finalize =
                  await C.sb.rpc(
                    'frontend_finalize_clinical_visit',
                    {
                      p_visit:
                        visitId
                    }
                  );


                if(
                  finalize.error
                ){

                  closeButton.disabled =
                    false;


                  return C.toast(
                    finalize.error.message,
                    'error'
                  );
                }


                const appointmentId =
                  visit.appointment_id
                  ||
                  params.appointmentId;


                if(
                  appointmentId
                ){

                  const complete =
                    await C.sb.rpc(
                      'frontend_complete_consultation',
                      {
                        p_id:
                          appointmentId
                      }
                    );


                  if(
                    complete.error
                  ){

                    closeButton.disabled =
                      false;


                    return C.toast(
                      complete.error.message,
                      'error'
                    );
                  }
                }


                C.toast(
                  C.lang==='ar'
                    ? 'تم حفظ التشخيص والملاحظات وإنهاء الكشف.'
                    : 'Diagnosis and notes saved. Consultation closed.'
                );


                window
                  .ClinicNotifications
                  ?.refresh?.();


                C.route(
                  'today-clinic'
                );
              };
          }
        }


        /*
         * Already finalized but appointment not yet completed:
         * simplify wording.
         */
        const oldComplete =
          document.getElementById(
            'completeConsultation'
          );


        if(oldComplete){

          oldComplete.textContent =
            C.lang==='ar'
              ? '✓ إنهاء الكشف'
              : '✓ Close consultation';
        }


        return result;
      };
  }


  // ===============================================================
  // 2) PATIENT SEARCH IN DIAGNOSIS + NOTES
  // ===============================================================

  async function clinicalSearch(
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
      !C.isDoctor()
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


  function renderClinicalSearch(
    host,
    rows,
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

      host.classList.add(
        'hidden'
      );

      host.innerHTML =
        '';

      return;
    }


    host.classList.remove(
      'hidden'
    );


    host.innerHTML = `
      <div class="v31-search-head">
        <div>
          <span class="eyebrow">
            CLINICAL SEARCH
          </span>

          <strong>
            ${
              C.lang==='ar'
                ? 'نتائج من التشخيص والملاحظات'
                : 'Matches in diagnosis & clinical notes'
            }
          </strong>
        </div>

        <span class="v31-count">
          ${rows.length}
        </span>
      </div>

      ${
        rows.length
          ? rows.map(
              row=>`
                <article class="v31-search-card">

                  <div class="v31-search-main">

                    <span class="eyebrow">
                      ${esc(
                        row.medical_record_number
                        ||
                        ''
                      )}
                    </span>

                    <strong>
                      ${esc(
                        row.patient_name
                        ||
                        'Patient'
                      )}
                    </strong>

                    <small>
                      ${esc(
                        row.match_source
                        ||
                        ''
                      )}
                      ${
                        row.visit_date
                          ? ` • ${
                              C.formatDate(
                                row.visit_date
                              )
                            }`
                          : ''
                      }
                    </small>

                    <p>
                      ${esc(
                        row.matched_text
                        ||
                        ''
                      )}
                    </p>
                  </div>

                  <div class="v31-search-actions">

                    <button
                      type="button"
                      class="table-action"
                      data-v31-patient="${row.patient_id}"
                    >
                      ${
                        C.lang==='ar'
                          ? 'فتح المريض'
                          : 'Open patient'
                      }
                    </button>

                    ${
                      row.visit_id
                        ? `
                          <button
                            type="button"
                            class="table-action success-outline"
                            data-v31-visit="${row.visit_id}"
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
            ).join('')
          : `
              <div class="empty-state compact-empty">
                ${
                  C.lang==='ar'
                    ? 'لا توجد تشخيصات أو ملاحظات مطابقة في زياراتك.'
                    : 'No matching diagnoses or notes in your visits.'
                }
              </div>
            `
      }
    `;


    host
      .querySelectorAll(
        '[data-v31-patient]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>C.route(
              'patient-detail',
              {
                patientId:
                  button.dataset
                    .v31Patient
              }
            );
        }
      );


    host
      .querySelectorAll(
        '[data-v31-visit]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>C.route(
              'clinical-visit',
              {
                visitId:
                  button.dataset
                    .v31Visit,

                readOnly:
                  true
              }
            );
        }
      );
  }


  function enhancePatientsPage(){

    if(
      !C.isDoctor()
    ){
      return;
    }


    const search =
      document.getElementById(
        'patientSearch'
      );


    const area =
      document.getElementById(
        'patientTableArea'
      );


    if(
      !search
      ||
      !area
      ||
      search.dataset
        .v31ClinicalSearch ===
          '1'
    ){
      return;
    }


    search.dataset
      .v31ClinicalSearch =
        '1';


    search.placeholder =
      C.lang==='ar'
        ? 'الاسم / MRN / الموبايل / التشخيص / الملاحظات'
        : 'Name / MRN / Mobile / Diagnosis / Notes';


    const host =
      document.createElement(
        'section'
      );


    host.id =
      'v31ClinicalSearchResults';

    host.className =
      'v31-clinical-search hidden';


    area.insertAdjacentElement(
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

        renderClinicalSearch(
          host,
          [],
          ''
        );

        return;
      }


      try{

        const rows =
          await clinicalSearch(
            term
          );


        renderClinicalSearch(
          host,
          rows,
          term
        );

      }
      catch(error){

        host.classList.remove(
          'hidden'
        );


        host.innerHTML = `
          <div class="empty-state compact-empty">
            ${esc(
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
            250
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


  const originalPatientsPage =
    window
      .ClinicPages[
        'patients'
      ];


  if(
    typeof originalPatientsPage ===
    'function'
  ){

    window
      .ClinicPages[
        'patients'
      ] =
      async function(
        ...args
      ){

        const result =
          await originalPatientsPage(
            ...args
          );


        enhancePatientsPage();


        return result;
      };
  }


  // ===============================================================
  // 3) CHECK-IN FEES
  //    كشف = 350
  //    استشارة = 150
  //    changed fee => reason required
  // ===============================================================

  let lastAppointmentId =
    null;


  document.addEventListener(
    'click',
    event=>{

      const appointmentButton =
        event.target.closest(
          '[data-appointment-id]'
        );


      if(
        appointmentButton
          ?.dataset
          ?.appointmentId
      ){

        lastAppointmentId =
          appointmentButton
            .dataset
            .appointmentId;
      }
    },
    true
  );


  async function patchArrivalFeeModal(
    form
  ){

    if(
      !form
      ||
      form.dataset
        .v31FeeReady ===
        '1'
    ){
      return;
    }


    form.dataset
      .v31FeeReady =
        '1';


    if(!lastAppointmentId){
      return;
    }


    const {
      data: appointment,
      error
    } =
      await C.sb
        .from(
          'appointments'
        )
        .select(
          `
            id,
            appointment_type,
            information_confirmed_at
          `
        )
        .eq(
          'id',
          lastAppointmentId
        )
        .maybeSingle();


    if(
      error
      ||
      !appointment
    ){
      return;
    }


    const standardFee =
      appointment
        .appointment_type ===
        'follow_up'
          ? 150
          : 350;


    const fee =
      form.querySelector(
        '#arrivalFee'
      );


    const note =
      form.querySelector(
        '#arrivalFeeNote'
      );


    if(
      fee
      &&
      !fee.value
    ){

      fee.value =
        String(
          standardFee
        );
    }


    const feeLabel =
      fee?.closest(
        'label'
      );


    if(feeLabel){

      const hint =
        document.createElement(
          'small'
        );


      hint.className =
        'v31-fee-hint';


      hint.textContent =
        appointment
          .appointment_type ===
          'follow_up'
            ? (
                C.lang==='ar'
                  ? 'الرسوم القياسية للاستشارة: 150 جنيه'
                  : 'Standard consultation fee: 150 EGP'
              )
            : (
                C.lang==='ar'
                  ? 'الرسوم القياسية للكشف: 350 جنيه'
                  : 'Standard examination fee: 350 EGP'
              );


      feeLabel.appendChild(
        hint
      );
    }


    const noteLabel =
      note?.closest(
        'label'
      );


    const originalNoteTitle =
      C.lang==='ar'
        ? 'ملاحظة مالية (اختياري)'
        : 'Finance note (optional)';


    function syncReasonRequirement(){

      if(
        !fee
        ||
        !note
      ){
        return;
      }


      const changed =
        Number(
          fee.value
        )
        !==
        standardFee;


      note.required =
        changed;


      if(noteLabel){

        const textNode =
          [...noteLabel.childNodes]
            .find(
              node=>
                node.nodeType ===
                Node.TEXT_NODE
                &&
                node.textContent
                  .trim()
            );


        if(textNode){

          textNode.textContent =
            changed
              ? (
                  C.lang==='ar'
                    ? 'سبب تغيير الرسوم (إجباري) '
                    : 'Reason for fee change (required) '
                )
              : `${originalNoteTitle} `;
        }
      }


      note.placeholder =
        changed
          ? (
              C.lang==='ar'
                ? 'اكتب سبب تغيير الرسوم عن السعر القياسي'
                : 'Write why the standard fee was changed'
            )
          : '';
    }


    fee?.addEventListener(
      'input',
      syncReasonRequirement
    );


    syncReasonRequirement();


    /*
     * Capture validation BEFORE appointments.js submits.
     */
    form.addEventListener(
      'submit',
      event=>{

        if(
          Number(
            fee?.value
          )
          !==
          standardFee
          &&
          !note?.value
            ?.trim()
        ){

          event.preventDefault();
          event.stopImmediatePropagation();


          C.toast(
            C.lang==='ar'
              ? 'يجب كتابة سبب تغيير الرسوم.'
              : 'A reason is required when changing the standard fee.',
            'error'
          );
        }
      },
      true
    );
  }


  async function patchAppointmentDetailFlow(){

    const detail =
      document.querySelector(
        '.appointment-detail-card'
      );


    if(
      !detail
      ||
      detail.dataset
        .v31FlowReady ===
        '1'
      ||
      !lastAppointmentId
    ){
      return;
    }


    detail.dataset
      .v31FlowReady =
        '1';


    const {
      data: appointment
    } =
      await C.sb
        .from(
          'appointments'
        )
        .select(
          `
            id,
            status,
            information_confirmed_at,
            checked_in_at
          `
        )
        .eq(
          'id',
          lastAppointmentId
        )
        .maybeSingle();


    if(!appointment){
      return;
    }


    const actions =
      detail.querySelector(
        '.appointment-detail-actions'
      );


    if(actions){

      const strip =
        document.createElement(
          'div'
        );


      strip.className =
        'v31-flow-strip';


      const confirmed =
        Boolean(
          appointment
            .information_confirmed_at
        );


      const checked =
        Boolean(
          appointment
            .checked_in_at
        );


      const doctorStarted =
        [
          'with_doctor',
          'completed'
        ].includes(
          appointment.status
        );


      const closed =
        appointment.status ===
        'completed';


      strip.innerHTML = `
        <span class="v31-step done">
          1 ${
            C.lang==='ar'
              ? 'حجز'
              : 'Booked'
          }
        </span>

        <span class="v31-step ${
          confirmed
            ? 'done'
            : 'active'
        }">
          2 ${
            C.lang==='ar'
              ? 'تأكيد البيانات'
              : 'Confirm info'
          }
        </span>

        <span class="v31-step ${
          checked
            ? 'done'
            : (
                confirmed
                  ? 'active'
                  : ''
              )
        }">
          3 ${
            C.lang==='ar'
              ? 'تسجيل الوصول'
              : 'Check-in'
          }
        </span>

        <span class="v31-step ${
          doctorStarted
            ? 'done'
            : (
                checked
                  ? 'active'
                  : ''
              )
        }">
          4 ${
            C.lang==='ar'
              ? 'الكشف'
              : 'Consult'
          }
        </span>

        <span class="v31-step ${
          closed
            ? 'done'
            : ''
        }">
          5 ${
            C.lang==='ar'
              ? 'إغلاق'
              : 'Close'
          }
        </span>
      `;


      actions.insertAdjacentElement(
        'beforebegin',
        strip
      );
    }


    /*
     * Reception cannot check-in until information is confirmed.
     */
    const checkin =
      detail.querySelector(
        '[data-appt-action="checkin"]'
      );


    if(
      checkin
      &&
      !appointment
        .information_confirmed_at
    ){

      checkin.disabled =
        true;

      checkin.title =
        C.lang==='ar'
          ? 'أكد بيانات المريض أولاً'
          : 'Confirm patient information first';

      checkin.classList.add(
        'v31-disabled-action'
      );
    }


    /*
     * V31 auto-queues at check-in. The old manual Send button
     * is no longer part of the normal workflow.
     */
    detail
      .querySelector(
        '[data-appt-action="send"]'
      )
      ?.remove();
  }


  // ===============================================================
  // 4) CLOSE PASSED SLOTS
  // ===============================================================

  function closePastSlots(
    root=document
  ){

    const now =
      Date.now();


    root
      .querySelectorAll?.(
        '[data-book-slot]'
      )
      .forEach(
        button=>{

          const start =
            new Date(
              button.dataset
                .start
              ||
              ''
            )
            .getTime();


          if(
            Number.isFinite(
              start
            )
            &&
            start <= now
          ){

            button.disabled =
              true;

            button.classList.add(
              'v31-slot-closed'
            );


            if(
              !button.dataset
                .v31ClosedLabel
            ){

              button.dataset
                .v31ClosedLabel =
                  '1';


              const badge =
                document.createElement(
                  'small'
                );


              badge.className =
                'v31-slot-closed-label';

              badge.textContent =
                C.lang==='ar'
                  ? 'مغلق'
                  : 'Closed';


              button.appendChild(
                badge
              );
            }
          }
        }
      );


    [
      '#bookingSlot',
      '#rescheduleSlot'
    ]
    .forEach(
      selector=>{

        const select =
          root.querySelector?.(
            selector
          );


        if(!select){
          return;
        }


        [...select.options]
          .forEach(
            option=>{

              if(
                !option.value
                ||
                !option.value.includes(
                  '|'
                )
              ){
                return;
              }


              const [
                start
              ] =
                option.value.split(
                  '|'
                );


              const stamp =
                new Date(
                  start
                ).getTime();


              if(
                Number.isFinite(
                  stamp
                )
                &&
                stamp <= now
              ){

                option.remove();
              }
            }
          );
      }
    );
  }


  // ===============================================================
  // 5) DOCTOR FINANCE — OWN CASES, READ ONLY
  // ===============================================================

  function financeRange(
    params={}
  ){

    const mode =
      params.periodMode
      ||
      localStorage.getItem(
        'doctor_finance_period_mode'
      )
      ||
      'day';


    const selected =
      params.periodDate
      ||
      localStorage.getItem(
        'doctor_finance_period_date'
      )
      ||
      C.cairoDate();


    if(
      mode ===
      'all'
    ){

      return {
        mode,
        selected,
        from:
          '2000-01-01',
        to:
          C.cairoDate()
      };
    }


    if(
      mode ===
      'month'
    ){

      const [
        year,
        month
      ] =
        selected
          .slice(
            0,
            7
          )
          .split(
            '-'
          )
          .map(
            Number
          );


      const last =
        new Date(
          Date.UTC(
            year,
            month,
            0
          )
        )
        .getUTCDate();


      return {
        mode,
        selected:
          `${String(
            year
          ).padStart(
            4,
            '0'
          )}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-01`,

        from:
          `${String(
            year
          ).padStart(
            4,
            '0'
          )}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-01`,

        to:
          `${String(
            year
          ).padStart(
            4,
            '0'
          )}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-${String(
            last
          ).padStart(
            2,
            '0'
          )}`
      };
    }


    return {
      mode:
        'day',

      selected,

      from:
        selected,

      to:
        selected
    };
  }


  async function renderDoctorFinance(
    params={}
  ){

    const range =
      financeRange(
        params
      );


    C.setTitle(
      C.t(
        'finance'
      )
    );


    const {
      data,
      error
    } =
      await C.sb.rpc(
        'doctor_finance_snapshot',
        {
          p_from:
            range.from,

          p_to:
            range.to
        }
      );


    if(error){

      document
        .getElementById(
          'mainContent'
        )
        .innerHTML = `
          <section class="content-card empty-state">
            ${esc(
              error.message
            )}
          </section>
        `;

      return;
    }


    const snapshot =
      data
      ||
      {};


    const rows =
      snapshot.rows
      ||
      [];


    document
      .getElementById(
        'mainContent'
      )
      .innerHTML = `
        <section class="page-toolbar">

          <div>
            <span class="eyebrow">
              MY FINANCE
            </span>

            <h2>
              ${
                C.lang==='ar'
                  ? 'المالية — حالات الطبيب'
                  : 'Finance — My cases'
              }
            </h2>

            <p class="muted">
              ${
                C.lang==='ar'
                  ? 'عرض فقط: دخل حالاتك المسجلة وصولها ورسومها.'
                  : 'Read-only view of income and fees for your checked-in cases.'
              }
            </p>
          </div>
        </section>

        <section class="content-card v31-finance-filter">

          <div class="v31-period-buttons">

            <button
              type="button"
              class="secondary-button ${
                range.mode==='day'
                  ? 'active'
                  : ''
              }"
              data-v31-finance-mode="day"
            >
              ${
                C.lang==='ar'
                  ? 'يوم'
                  : 'Day'
              }
            </button>

            <button
              type="button"
              class="secondary-button ${
                range.mode==='month'
                  ? 'active'
                  : ''
              }"
              data-v31-finance-mode="month"
            >
              ${
                C.lang==='ar'
                  ? 'شهر'
                  : 'Month'
              }
            </button>

            <button
              type="button"
              class="secondary-button ${
                range.mode==='all'
                  ? 'active'
                  : ''
              }"
              data-v31-finance-mode="all"
            >
              ${
                C.lang==='ar'
                  ? 'الإجمالي'
                  : 'All'
              }
            </button>
          </div>

          ${
            range.mode==='day'
              ? `
                <input
                  id="v31DoctorFinanceDate"
                  type="date"
                  class="control"
                  value="${range.selected}"
                >
              `
              : ''
          }

          ${
            range.mode==='month'
              ? `
                <input
                  id="v31DoctorFinanceMonth"
                  type="month"
                  class="control"
                  value="${range.selected.slice(0,7)}"
                >
              `
              : ''
          }

        </section>

        <section class="dashboard-grid finance-summary-grid">

          <article class="stat-card">
            <span class="stat-icon">💰</span>
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'الدخل'
                  : 'Income'
              }
            </span>

            <strong>
              ${C.formatMoney(
                snapshot.total_income
                ||
                0
              )}
            </strong>
          </article>

          <article class="stat-card">
            <span class="stat-icon">👥</span>
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'الحالات'
                  : 'Cases'
              }
            </span>

            <strong>
              ${Number(
                snapshot.case_count
                ||
                0
              )}
            </strong>
          </article>

          <article class="stat-card">
            <span class="stat-icon">💵</span>
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'نقدي'
                  : 'Cash'
              }
            </span>

            <strong>
              ${C.formatMoney(
                snapshot.cash_income
                ||
                0
              )}
            </strong>
          </article>

          <article class="stat-card">
            <span class="stat-icon">📲</span>
            <span class="stat-label">
              InstaPay
            </span>

            <strong>
              ${C.formatMoney(
                snapshot.instapay_income
                ||
                0
              )}
            </strong>
          </article>
        </section>

        <section class="content-card">

          ${
            rows.length
              ? `
                <div class="table-wrap">
                  <table class="data-table">

                    <thead>
                      <tr>
                        <th>
                          ${
                            C.lang==='ar'
                              ? 'التاريخ'
                              : 'Date'
                          }
                        </th>

                        <th>
                          ${
                            C.lang==='ar'
                              ? 'المريض'
                              : 'Patient'
                          }
                        </th>

                        <th>
                          ${
                            C.lang==='ar'
                              ? 'النوع'
                              : 'Type'
                          }
                        </th>

                        <th>
                          ${
                            C.lang==='ar'
                              ? 'الرسوم'
                              : 'Fee'
                          }
                        </th>

                        <th>
                          ${
                            C.lang==='ar'
                              ? 'الدفع'
                              : 'Method'
                          }
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      ${rows.map(
                        row=>`
                          <tr>

                            <td>
                              ${C.formatDate(
                                row.received_at,
                                {
                                  hour:
                                    '2-digit',

                                  minute:
                                    '2-digit'
                                }
                              )}
                            </td>

                            <td>
                              <strong>
                                ${esc(
                                  row.patient_name
                                  ||
                                  'Patient'
                                )}
                              </strong>

                              <div class="subline">
                                ${esc(
                                  row.medical_record_number
                                  ||
                                  ''
                                )}
                              </div>
                            </td>

                            <td>
                              ${
                                row.appointment_type ===
                                'follow_up'
                                  ? (
                                      C.lang==='ar'
                                        ? 'استشارة'
                                        : 'Consultation'
                                    )
                                  : (
                                      C.lang==='ar'
                                        ? 'كشف'
                                        : 'Examination'
                                    )
                              }
                            </td>

                            <td>
                              <strong>
                                ${C.formatMoney(
                                  row.amount
                                  ||
                                  0
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                row.payment_method
                                ||
                                '—'
                              )}
                            </td>
                          </tr>
                        `
                      ).join('')}
                    </tbody>
                  </table>
                </div>
              `
              : `
                <div class="empty-state">
                  ${
                    C.lang==='ar'
                      ? 'لا توجد رسوم مسجلة لحالاتك في هذه الفترة.'
                      : 'No recorded fees for your cases in this period.'
                  }
                </div>
              `
          }

        </section>
      `;


    function routeMode(
      mode,
      date=range.selected
    ){

      localStorage.setItem(
        'doctor_finance_period_mode',
        mode
      );

      localStorage.setItem(
        'doctor_finance_period_date',
        date
      );


      C.route(
        'finance',
        {
          periodMode:
            mode,

          periodDate:
            date
        }
      );
    }


    document
      .querySelectorAll(
        '[data-v31-finance-mode]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>routeMode(
              button.dataset
                .v31FinanceMode
            );
        }
      );


    document
      .getElementById(
        'v31DoctorFinanceDate'
      )
      ?.addEventListener(
        'change',
        event=>
          routeMode(
            'day',
            event.target.value
          )
      );


    document
      .getElementById(
        'v31DoctorFinanceMonth'
      )
      ?.addEventListener(
        'change',
        event=>
          routeMode(
            'month',
            `${event.target.value}-01`
          )
      );
  }


  const originalFinancePage =
    window
      .ClinicPages[
        'finance'
      ];


  if(
    typeof originalFinancePage ===
    'function'
  ){

    window
      .ClinicPages[
        'finance'
      ] =
      async function(
        params={}
      ){

        if(
          C.isDoctor()
          &&
          !C.isReception()
        ){

          return renderDoctorFinance(
            params
          );
        }


        return originalFinancePage(
          params
        );
      };
  }


  // ===============================================================
  // 6) CLINIC CHAT
  //    doctor <-> doctor / secretary
  //    owner sees every conversation
  // ===============================================================

  let chatTimer =
    null;


  function stopChatTimer(){

    clearInterval(
      chatTimer
    );

    chatTimer =
      null;
  }


  async function chatParticipants(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'clinic_chat_participants'
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


  async function chatMessages(){

    let query =
      C.sb
        .from(
          'clinic_chat_messages'
        )
        .select(
          `
            id,
            sender_id,
            recipient_id,
            body,
            created_at,
            read_at
          `
        )
        .order(
          'created_at',
          {
            ascending:
              true
          }
        )
        .limit(
          1000
        );


    /*
     * RLS also enforces this, but the client-side filter
     * keeps the payload smaller for normal participants.
     */
    if(
      !C.hasRole(
        'owner'
      )
    ){

      query =
        query.or(
          `sender_id.eq.${C.user.id},recipient_id.eq.${C.user.id}`
        );
    }


    const {
      data,
      error
    } =
      await query;


    if(error){
      throw error;
    }


    return (
      data
      ||
      []
    );
  }


  function participantName(
    participant
  ){

    return C.localizedPersonName(
      participant
      ||
      {}
    );
  }


  function pairKey(
    a,
    b
  ){

    return [
      a,
      b
    ]
    .sort()
    .join(
      '|'
    );
  }


  window
    .ClinicPages[
      'clinic-chat'
    ] =
    async function(){

      stopChatTimer();


      C.setTitle(
        C.lang==='ar'
          ? 'محادثات العيادة'
          : 'Clinic Chat'
      );


      let participants;
      let messages;


      try{

        [
          participants,
          messages
        ] =
          await Promise.all([
            chatParticipants(),
            chatMessages()
          ]);

      }
      catch(error){

        document
          .getElementById(
            'mainContent'
          )
          .innerHTML = `
            <section class="content-card empty-state">
              ${esc(
                error.message
              )}
            </section>
          `;

        return;
      }


      const people =
        new Map(
          participants.map(
            person=>[
              person.id,
              person
            ]
          )
        );


      /*
       * Owner = audit mode, grouped by participant pair.
       */
      if(
        C.hasRole(
          'owner'
        )
        &&
        !C.hasRole(
          'secretary'
        )
        &&
        !C.isDoctor()
      ){

        const groups =
          new Map();


        messages.forEach(
          message=>{

            const key =
              pairKey(
                message.sender_id,
                message.recipient_id
              );


            if(
              !groups.has(
                key
              )
            ){

              groups.set(
                key,
                []
              );
            }


            groups
              .get(
                key
              )
              .push(
                message
              );
          }
        );


        const conversations =
          [...groups.entries()]
            .sort(
              (
                [
                  ,
                  a
                ],
                [
                  ,
                  b
                ]
              )=>
                new Date(
                  b[
                    b.length-1
                  ]
                  ?.created_at
                  ||
                  0
                )
                -
                new Date(
                  a[
                    a.length-1
                  ]
                  ?.created_at
                  ||
                  0
                )
            );


        document
          .getElementById(
            'mainContent'
          )
          .innerHTML = `
            <section class="page-toolbar">
              <div>
                <span class="eyebrow">
                  OWNER AUDIT
                </span>

                <h2>
                  ${
                    C.lang==='ar'
                      ? 'محادثات الأطباء والسكرتارية'
                      : 'Doctors & secretary conversations'
                  }
                </h2>

                <p class="muted">
                  ${
                    C.lang==='ar'
                      ? 'المالك يمكنه الاطلاع على كل المحادثات. هذا العرض للمتابعة فقط.'
                      : 'The owner can review every clinic conversation. Audit view is read-only.'
                  }
                </p>
              </div>
            </section>

            <section class="v31-chat-audit-grid">

              ${
                conversations.length
                  ? conversations.map(
                      (
                        [
                          key,
                          rows
                        ]
                      )=>{

                        const [
                          firstId,
                          secondId
                        ] =
                          key.split(
                            '|'
                          );


                        const first =
                          people.get(
                            firstId
                          );

                        const second =
                          people.get(
                            secondId
                          );


                        const last =
                          rows[
                            rows.length-1
                          ];


                        return `
                          <button
                            type="button"
                            class="content-card v31-conversation-card"
                            data-v31-owner-pair="${key}"
                          >
                            <strong>
                              ${esc(
                                participantName(
                                  first
                                )
                              )}
                              ↔
                              ${esc(
                                participantName(
                                  second
                                )
                              )}
                            </strong>

                            <small>
                              ${C.formatDate(
                                last.created_at,
                                {
                                  hour:
                                    '2-digit',

                                  minute:
                                    '2-digit'
                                }
                              )}
                            </small>

                            <span>
                              ${esc(
                                last.body
                              )}
                            </span>
                          </button>
                        `;
                      }
                    ).join('')
                  : `
                    <div class="content-card empty-state">
                      ${
                        C.lang==='ar'
                          ? 'لا توجد محادثات حتى الآن.'
                          : 'No conversations yet.'
                      }
                    </div>
                  `
              }

            </section>

            <section
              id="v31OwnerChatThread"
              class="content-card hidden"
            ></section>
          `;


        document
          .querySelectorAll(
            '[data-v31-owner-pair]'
          )
          .forEach(
            button=>{

              button.onclick =
                ()=>{

                  const key =
                    button.dataset
                      .v31OwnerPair;


                  const rows =
                    groups.get(
                      key
                    )
                    ||
                    [];


                  const [
                    firstId,
                    secondId
                  ] =
                    key.split(
                      '|'
                    );


                  const first =
                    people.get(
                      firstId
                    );

                  const second =
                    people.get(
                      secondId
                    );


                  const thread =
                    document.getElementById(
                      'v31OwnerChatThread'
                    );


                  thread.classList.remove(
                    'hidden'
                  );


                  thread.innerHTML = `
                    <div class="section-head">
                      <div>
                        <span class="eyebrow">
                          AUDIT THREAD
                        </span>

                        <h3>
                          ${esc(
                            participantName(
                              first
                            )
                          )}
                          ↔
                          ${esc(
                            participantName(
                              second
                            )
                          )}
                        </h3>
                      </div>
                    </div>

                    <div class="v31-message-list">

                      ${rows.map(
                        message=>{

                          const sender =
                            people.get(
                              message.sender_id
                            );


                          return `
                            <article class="v31-message audit-message">
                              <strong>
                                ${esc(
                                  participantName(
                                    sender
                                  )
                                )}
                              </strong>

                              <p>
                                ${esc(
                                  message.body
                                )}
                              </p>

                              <small>
                                ${C.formatDate(
                                  message.created_at,
                                  {
                                    hour:
                                      '2-digit',

                                    minute:
                                      '2-digit'
                                  }
                                )}
                              </small>
                            </article>
                          `;
                        }
                      ).join('')}

                    </div>
                  `;


                  thread.scrollIntoView({
                    behavior:
                      'smooth',

                    block:
                      'start'
                  });
                };
            }
          );


        return;
      }


      /*
       * Normal doctor / secretary messaging view.
       */
      const contacts =
        participants
          .filter(
            person=>
              person.id !==
              C.user.id
          );


      const lastByContact =
        new Map();


      contacts.forEach(
        contact=>{

          const thread =
            messages.filter(
              message=>
                (
                  message.sender_id ===
                    C.user.id
                  &&
                  message.recipient_id ===
                    contact.id
                )
                ||
                (
                  message.sender_id ===
                    contact.id
                  &&
                  message.recipient_id ===
                    C.user.id
                )
            );


          if(
            thread.length
          ){

            lastByContact.set(
              contact.id,
              thread[
                thread.length-1
              ]
            );
          }
        }
      );


      document
        .getElementById(
          'mainContent'
        )
        .innerHTML = `
          <section class="page-toolbar">
            <div>
              <span class="eyebrow">
                INTERNAL
              </span>

              <h2>
                ${
                  C.lang==='ar'
                    ? 'محادثات العيادة'
                    : 'Clinic Chat'
                }
              </h2>

              <p class="muted">
                ${
                  C.lang==='ar'
                    ? 'محادثة داخلية بين الأطباء والسكرتارية. جميع الرسائل ظاهرة للمالك.'
                    : 'Internal chat between doctors and the secretary. All messages are visible to the owner.'
                }
              </p>
            </div>
          </section>

          <section class="v31-chat-layout">

            <aside class="content-card v31-chat-contacts">

              ${
                contacts.length
                  ? contacts.map(
                      contact=>{

                        const last =
                          lastByContact.get(
                            contact.id
                          );


                        const unread =
                          messages.filter(
                            message=>
                              message.sender_id ===
                                contact.id
                              &&
                              message.recipient_id ===
                                C.user.id
                              &&
                              !message.read_at
                          )
                          .length;


                        return `
                          <button
                            type="button"
                            class="v31-contact"
                            data-v31-contact="${contact.id}"
                          >
                            <div>
                              <strong>
                                ${esc(
                                  participantName(
                                    contact
                                  )
                                )}
                              </strong>

                              <small>
                                ${esc(
                                  contact.roles
                                  ||
                                  ''
                                )}
                              </small>
                            </div>

                            ${
                              unread
                                ? `
                                  <span class="v31-unread">
                                    ${unread}
                                  </span>
                                `
                                : ''
                            }

                            ${
                              last
                                ? `
                                  <p>
                                    ${esc(
                                      last.body
                                    )}
                                  </p>
                                `
                                : ''
                            }
                          </button>
                        `;
                      }
                    ).join('')
                  : `
                    <div class="empty-state compact-empty">
                      ${
                        C.lang==='ar'
                          ? 'لا يوجد أعضاء متاحون للمحادثة.'
                          : 'No chat contacts available.'
                      }
                    </div>
                  `
              }

            </aside>

            <section
              id="v31ChatThread"
              class="content-card v31-chat-thread"
            >
              <div class="empty-state">
                ${
                  C.lang==='ar'
                    ? 'اختر شخصاً لفتح المحادثة.'
                    : 'Choose a person to open the conversation.'
                }
              </div>
            </section>

          </section>
        `;


      async function openThread(
        contactId,
        focusComposer=false
      ){

        const contact =
          people.get(
            contactId
          );


        if(!contact){
          return;
        }


        await C.sb.rpc(
          'clinic_mark_chat_read',
          {
            p_other:
              contactId
          }
        );


        const freshMessages =
          await chatMessages();


        const threadRows =
          freshMessages.filter(
            message=>
              (
                message.sender_id ===
                  C.user.id
                &&
                message.recipient_id ===
                  contactId
              )
              ||
              (
                message.sender_id ===
                  contactId
                &&
                message.recipient_id ===
                  C.user.id
              )
          );


        const thread =
          document.getElementById(
            'v31ChatThread'
          );


        if(!thread){
          return;
        }


        thread.dataset.contact =
          contactId;


        thread.innerHTML = `
          <div class="section-head">
            <div>
              <span class="eyebrow">
                CONVERSATION
              </span>

              <h3>
                ${esc(
                  participantName(
                    contact
                  )
                )}
              </h3>
            </div>
          </div>

          <div
            id="v31MessageList"
            class="v31-message-list"
          >

            ${
              threadRows.length
                ? threadRows.map(
                    message=>`
                      <article
                        class="v31-message ${
                          message.sender_id ===
                            C.user.id
                            ? 'mine'
                            : 'theirs'
                        }"
                      >
                        <p>
                          ${esc(
                            message.body
                          )}
                        </p>

                        <small>
                          ${C.formatDate(
                            message.created_at,
                            {
                              hour:
                                '2-digit',

                              minute:
                                '2-digit'
                            }
                          )}
                        </small>
                      </article>
                    `
                  ).join('')
                : `
                  <div class="empty-state compact-empty">
                    ${
                      C.lang==='ar'
                        ? 'ابدأ المحادثة.'
                        : 'Start the conversation.'
                    }
                  </div>
                `
            }

          </div>

          <form
            id="v31ChatComposer"
            class="v31-chat-composer"
          >

            <textarea
              id="v31ChatBody"
              class="control"
              maxlength="4000"
              rows="3"
              required
              placeholder="${
                C.lang==='ar'
                  ? 'اكتب الرسالة...'
                  : 'Write a message...'
              }"
            ></textarea>

            <button
              type="submit"
              class="primary-button compact"
            >
              ${
                C.lang==='ar'
                  ? 'إرسال'
                  : 'Send'
              }
            </button>

          </form>
        `;


        const list =
          document.getElementById(
            'v31MessageList'
          );


        if(list){

          list.scrollTop =
            list.scrollHeight;
        }


        const composer =
          document.getElementById(
            'v31ChatComposer'
          );


        composer.onsubmit =
          async event=>{

            event.preventDefault();


            const body =
              document
                .getElementById(
                  'v31ChatBody'
                )
                .value
                .trim();


            if(!body){
              return;
            }


            const result =
              await C.sb.rpc(
                'clinic_send_chat_message',
                {
                  p_recipient:
                    contactId,

                  p_body:
                    body
                }
              );


            if(
              result.error
            ){

              return C.toast(
                result.error.message,
                'error'
              );
            }


            await openThread(
              contactId,
              true
            );
          };


        if(focusComposer){

          document
            .getElementById(
              'v31ChatBody'
            )
            ?.focus();
        }
      }


      document
        .querySelectorAll(
          '[data-v31-contact]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>openThread(
                button.dataset
                  .v31Contact,
                true
              );
          }
        );


      chatTimer =
        setInterval(
          async()=>{

            if(
              C.currentPage !==
              'clinic-chat'
            ){

              stopChatTimer();

              return;
            }


            const thread =
              document.getElementById(
                'v31ChatThread'
              );


            const contactId =
              thread?.dataset
                ?.contact;


            if(
              contactId
              &&
              !document
                .getElementById(
                  'v31ChatBody'
                )
                ?.matches(
                  ':focus'
                )
            ){

              try{

                await openThread(
                  contactId,
                  false
                );

              }
              catch(error){

                console.warn(
                  'Chat refresh failed',
                  error
                );
              }
            }
          },
          4000
        );
    };


  // ===============================================================
  // GLOBAL MUTATION OBSERVER
  // ===============================================================

  const observer =
    new MutationObserver(
      ()=>{

        closePastSlots(
          document
        );


        patchArrivalFeeModal(
          document.getElementById(
            'arrivalFeeForm'
          )
        );


        patchAppointmentDetailFlow();
      }
    );


  observer.observe(
    document.body,
    {
      childList:
        true,

      subtree:
        true
    }
  );


  closePastSlots(
    document
  );


  // ===============================================================
  // STYLE
  // ===============================================================

  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .v31-clinical-hint {
      display: block;
      margin-top: 4px;
      color: #b42318;
      font-size: 9px;
      font-weight: 800;
    }

    .v31-clinical-search {
      margin: 12px 0;
      padding: 13px;
      border: 1px solid #b8ddd4;
      border-radius: 14px;
      background: #f5fcfa;
    }

    .v31-clinical-search.hidden {
      display: none;
    }

    .v31-search-head,
    .v31-search-card,
    .v31-search-actions,
    .v31-period-buttons {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .v31-search-head,
    .v31-search-card {
      justify-content: space-between;
    }

    .v31-search-head {
      margin-bottom: 9px;
    }

    .v31-count,
    .v31-unread {
      display: inline-grid;
      place-items: center;
      min-width: 25px;
      height: 25px;
      border-radius: 999px;
      background: #0f8b78;
      color: white;
      font-size: 10px;
      font-weight: 900;
    }

    .v31-search-card {
      margin-top: 7px;
      padding: 10px 11px;
      border: 1px solid #dbe7e3;
      border-radius: 11px;
      background: white;
    }

    .v31-search-main {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .v31-search-main p {
      margin: 3px 0 0;
      color: #526273;
      font-size: 11px;
      line-height: 1.5;
    }

    .v31-flow-strip {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin: 4px 0 10px;
    }

    .v31-step {
      padding: 5px 8px;
      border: 1px solid #d9e2ea;
      border-radius: 999px;
      background: #f7f9fb;
      color: #7a8796;
      font-size: 9px;
      font-weight: 800;
    }

    .v31-step.active {
      border-color: #e8b15d;
      background: #fff8eb;
      color: #946200;
    }

    .v31-step.done {
      border-color: #a9dccf;
      background: #eefaf6;
      color: #087260;
    }

    .v31-disabled-action {
      opacity: .45;
      cursor: not-allowed !important;
    }

    .v31-fee-hint {
      display: block;
      margin-top: 5px;
      color: #0f766e;
      font-size: 10px;
      font-weight: 700;
    }

    .v31-slot-closed {
      opacity: .5 !important;
      cursor: not-allowed !important;
    }

    .v31-slot-closed-label {
      display: inline-block;
      margin-inline-start: 5px;
      color: #a33;
      font-size: 9px;
      font-weight: 900;
    }

    .v31-finance-filter {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
    }

    .v31-finance-filter .control {
      width: auto;
      min-width: 170px;
    }

    .v31-chat-layout {
      display: grid;
      grid-template-columns: minmax(210px, 280px) minmax(0, 1fr);
      gap: 12px;
    }

    .v31-chat-contacts {
      display: grid;
      align-content: start;
      gap: 7px;
      padding: 9px;
    }

    .v31-contact,
    .v31-conversation-card {
      width: 100%;
      text-align: inherit;
      border: 1px solid #dce5ed;
      border-radius: 11px;
      background: white;
      color: inherit;
      cursor: pointer;
    }

    .v31-contact {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 5px 8px;
      padding: 10px;
    }

    .v31-contact div {
      display: grid;
      gap: 2px;
    }

    .v31-contact small,
    .v31-contact p {
      color: #728094;
      font-size: 10px;
    }

    .v31-contact p {
      grid-column: 1 / -1;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .v31-chat-thread {
      min-height: 420px;
      display: flex;
      flex-direction: column;
    }

    .v31-message-list {
      flex: 1;
      display: grid;
      align-content: start;
      gap: 7px;
      max-height: 520px;
      overflow: auto;
      padding: 5px 0 10px;
    }

    .v31-message {
      width: min(82%, 560px);
      padding: 9px 11px;
      border-radius: 12px;
      background: #f2f5f8;
    }

    .v31-message.mine {
      justify-self: end;
      background: #eaf8f4;
      border: 1px solid #c5e8df;
    }

    .v31-message.theirs {
      justify-self: start;
      border: 1px solid #e0e6ec;
    }

    .v31-message.audit-message {
      width: 100%;
    }

    .v31-message p {
      margin: 0 0 4px;
      white-space: pre-wrap;
      line-height: 1.55;
    }

    .v31-message small {
      color: #7d8998;
      font-size: 9px;
    }

    .v31-chat-composer {
      display: grid;
      grid-template-columns: minmax(0,1fr) auto;
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid #e3e9ee;
    }

    .v31-chat-composer textarea {
      min-height: 72px;
      resize: vertical;
    }

    .v31-chat-audit-grid {
      display: grid;
      gap: 9px;
      margin-bottom: 12px;
    }

    .v31-conversation-card {
      display: grid;
      gap: 4px;
      padding: 12px;
    }

    .v31-conversation-card span,
    .v31-conversation-card small {
      color: #6f7e90;
      font-size: 10px;
    }

    @media (max-width: 760px) {
      .v31-chat-layout {
        grid-template-columns: 1fr;
      }

      .v31-chat-thread {
        min-height: 360px;
      }

      .v31-search-card {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `;


  document.head.appendChild(
    style
  );


  window.ClinicV31 = {
    openDoctorPatient,
    closePastSlots
  };

})();
