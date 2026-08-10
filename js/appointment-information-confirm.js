(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  let lastAppointmentId =
    null;


  function canConfirmInformation(){

    return (
      C.hasRole('owner')
      ||
      C.hasRole('manager')
      ||
      C.hasRole('deputy_manager')
      ||
      C.hasRole('secretary')
      ||
      C.hasRole('doctor')
    );
  }


  function canEditBeforeCheckin(){

    return (
      C.hasRole('owner')
      ||
      C.hasRole('manager')
      ||
      C.hasRole('deputy_manager')
      ||
      C.hasRole('secretary')
    );
  }


  function injectStyles(){

    if(
      document.getElementById(
        'appointmentInformationConfirmStyles'
      )
    ){
      return;
    }


    const style =
      document.createElement(
        'style'
      );


    style.id =
      'appointmentInformationConfirmStyles';


    style.textContent = `
      .appointment-info-confirm-button {
        border-color: #a7d9ce !important;
        background: #eefbf7 !important;
        color: #087161 !important;
      }

      .appointment-info-confirmed-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;

        padding: 7px 10px;

        border: 1px solid #bbf7d0;
        border-radius: 999px;

        background: #f0fdf4;
        color: #15803d;

        font-size: 10px;
        font-weight: 900;
      }

      .appointment-info-confirm-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .appointment-info-confirm-item {
        min-width: 0;

        padding: 11px 12px;

        border: 1px solid #e2e8f0;
        border-radius: 12px;

        background: #f8fafc;
      }

      .appointment-info-confirm-item.full {
        grid-column: 1 / -1;
      }

      .appointment-info-confirm-item span {
        display: block;

        margin-bottom: 4px;

        color: #718096;

        font-size: 9px;
        font-weight: 800;
      }

      .appointment-info-confirm-item strong {
        display: block;

        overflow-wrap: anywhere;

        color: #10233c;

        font-size: 12px;
        line-height: 1.6;
      }

      .appointment-info-confirm-note {
        margin-top: 12px;
        padding: 11px 12px;

        border: 1px solid #bfdbfe;
        border-radius: 12px;

        background: #eff6ff;
        color: #1e3a8a;

        font-size: 10px;
        line-height: 1.7;
      }

      .appointment-info-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        margin-top: 14px;
      }

      @media (max-width: 650px) {
        .appointment-info-confirm-grid {
          grid-template-columns: 1fr;
        }

        .appointment-info-confirm-item.full {
          grid-column: auto;
        }
      }
    `;


    document.head.appendChild(
      style
    );
  }


  function displayName(patient){

    return (
      patient?.english_name
      ||
      patient?.arabic_name
      ||
      'Patient'
    );
  }


  function genderLabel(value){

    const labels = {
      male:
        C.lang==='ar'
          ? 'ذكر'
          : 'Male',

      female:
        C.lang==='ar'
          ? 'أنثى'
          : 'Female'
    };


    return (
      labels[value]
      ||
      '—'
    );
  }


  async function loadAppointmentBundle(
    appointmentId
  ){

    const {
      data:appointment,
      error:appointmentError
    } =
      await C.sb
        .from(
          'appointments'
        )
        .select(
          `
            *,
            patient:patients(
              id,
              medical_record_number,
              arabic_name,
              english_name,
              birth_year,
              gender,
              mobile,
              residency_area,
              address
            ),
            doctor:profiles!appointments_doctor_id_fkey(
              id,
              display_name,
              username
            )
          `
        )
        .eq(
          'id',
          appointmentId
        )
        .maybeSingle();


    /*
     * Some database builds do not expose the relationship alias above.
     * Fall back to simple separate queries.
     */
    if(
      appointmentError
      ||
      !appointment
    ){

      const simple =
        await C.sb
          .from(
            'appointments'
          )
          .select('*')
          .eq(
            'id',
            appointmentId
          )
          .maybeSingle();


      if(
        simple.error
        ||
        !simple.data
      ){

        throw (
          simple.error
          ||
          appointmentError
          ||
          new Error(
            'Appointment not found'
          )
        );
      }


      const patientResult =
        await C.sb
          .from(
            'patients'
          )
          .select(
            `
              id,
              medical_record_number,
              arabic_name,
              english_name,
              birth_year,
              gender,
              mobile,
              residency_area,
              address
            `
          )
          .eq(
            'id',
            simple.data.patient_id
          )
          .maybeSingle();


      const doctorResult =
        await C.sb
          .from(
            'profiles'
          )
          .select(
            'id,display_name,username'
          )
          .eq(
            'id',
            simple.data.doctor_id
          )
          .maybeSingle();


      return {
        appointment:
          simple.data,

        patient:
          patientResult.data
          ||
          {},

        doctor:
          doctorResult.data
          ||
          {}
      };
    }


    return {
      appointment,

      patient:
        appointment.patient
        ||
        {},

      doctor:
        appointment.doctor
        ||
        {}
    };
  }


  async function confirmInformation(
    appointmentId
  ){

    const {
      error
    } =
      await C.sb.rpc(
        'frontend_confirm_appointment_information',
        {
          p_appointment_id:
            appointmentId
        }
      );


    if(error){
      throw error;
    }
  }


  async function clearConfirmation(
    appointmentId
  ){

    const {
      error
    } =
      await C.sb.rpc(
        'frontend_clear_appointment_information_confirmation',
        {
          p_appointment_id:
            appointmentId
        }
      );


    if(error){
      throw error;
    }
  }


  async function showConfirmationModal(
    appointmentId
  ){

    let bundle;


    try{

      bundle =
        await loadAppointmentBundle(
          appointmentId
        );

    }
    catch(error){

      return C.toast(
        error.message,
        'error'
      );
    }


    const {
      appointment,
      patient,
      doctor
    } =
      bundle;


    if(
      ![
        'booked',
        'confirmed'
      ].includes(
        appointment.status
      )
    ){

      return C.toast(
        C.lang==='ar'
          ? 'لا يمكن تأكيد البيانات بعد تسجيل الوصول.'
          : 'Information can only be confirmed before check-in.',
        'error'
      );
    }


    const doctorName =
      doctor.display_name
      ||
      doctor.username
      ||
      '—';


    C.showModal({
      title:
        C.lang==='ar'
          ? 'تأكيد بيانات المريض والموعد'
          : 'Confirm patient & appointment information',

      wide:true,

      body:`
        <div class="appointment-info-confirm-grid">

          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'الرقم الطبي':'MRN'}
            </span>

            <strong>
              ${C.escape(
                patient.medical_record_number
                ||
                '—'
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'الاسم':'Patient name'}
            </span>

            <strong>
              ${C.escape(
                displayName(
                  patient
                )
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'سنة الميلاد':'Year of birth'}
            </span>

            <strong>
              ${patient.birth_year||'—'}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'النوع':'Gender'}
            </span>

            <strong>
              ${C.escape(
                genderLabel(
                  patient.gender
                )
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'الموبايل / واتساب':'Mobile / WhatsApp'}
            </span>

            <strong dir="ltr">
              ${C.escape(
                patient.mobile
                ||
                '—'
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'منطقة السكن':'Residency area'}
            </span>

            <strong>
              ${C.escape(
                patient.residency_area
                ||
                '—'
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item full">
            <span>
              ${C.lang==='ar'?'العنوان':'Address'}
            </span>

            <strong>
              ${C.escape(
                patient.address
                ||
                '—'
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'الطبيب':'Doctor'}
            </span>

            <strong>
              ${C.escape(
                doctorName
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item">
            <span>
              ${C.lang==='ar'?'رقم الحجز':'Appointment number'}
            </span>

            <strong>
              ${C.escape(
                appointment.appointment_number
                ||
                '—'
              )}
            </strong>
          </div>


          <div class="appointment-info-confirm-item full">
            <span>
              ${C.lang==='ar'?'الموعد':'Appointment'}
            </span>

            <strong>
              ${C.formatDate(
                appointment.scheduled_start
              )}
              •
              ${C.formatTime(
                appointment.scheduled_start
              )}
              –
              ${C.formatTime(
                appointment.scheduled_end
              )}
            </strong>
          </div>

        </div>


        <div class="appointment-info-confirm-note">
          ${
            C.lang==='ar'
              ? 'راجع البيانات مع المريض قبل تسجيل الوصول. إذا كان هناك خطأ استخدم «تعديل الحجز»، ثم أكد المعلومات مرة أخرى.'
              : 'Review these details with the patient before check-in. If anything is incorrect, edit the booking and confirm the information again.'
          }
        </div>


        <div class="appointment-info-actions">

          <button
            id="confirmAppointmentInformationNow"
            type="button"
            class="primary-button compact"
          >
            ${
              C.lang==='ar'
                ? '✓ المعلومات صحيحة'
                : '✓ Information is correct'
            }
          </button>


          ${
            canEditBeforeCheckin()
              ? `
                <button
                  id="editFromInformationConfirm"
                  type="button"
                  class="secondary-button compact"
                >
                  ${
                    C.lang==='ar'
                      ? 'تعديل الحجز'
                      : 'Edit booking'
                  }
                </button>
              `
              : ''
          }

        </div>
      `,

      onOpen:root=>{

        root
          .querySelector(
            '#confirmAppointmentInformationNow'
          )
          .onclick =
            async()=>{

              try{

                await confirmInformation(
                  appointmentId
                );


                C.closeModal();


                C.toast(
                  C.lang==='ar'
                    ? 'تم تأكيد معلومات المريض والموعد.'
                    : 'Patient and appointment information confirmed.'
                );


                C.route(
                  C.currentPage
                );

              }
              catch(error){

                C.toast(
                  error.message,
                  'error'
                );
              }
            };


        root
          .querySelector(
            '#editFromInformationConfirm'
          )
          ?.addEventListener(
            'click',
            async()=>{

              try{

                await clearConfirmation(
                  appointmentId
                );

              }
              catch(error){

                console.warn(
                  'Could not clear information confirmation',
                  error
                );
              }


              C.closeModal();


              const editor =
                window
                  .ClinicBookingWorkflow
                  ?.showEditBookingModal;


              if(editor){

                editor(
                  appointmentId
                );

              }
              else{

                C.toast(
                  C.lang==='ar'
                    ? 'تعذر فتح محرر الحجز.'
                    : 'Could not open the booking editor.',
                  'error'
                );
              }
            }
          );
      }
    });
  }


  async function patchAppointmentDetails(
    card
  ){

    if(
      card.dataset.confirmInfoReady
      ||
      card.dataset.confirmInfoPending
      ||
      !lastAppointmentId
      ||
      !canConfirmInformation()
    ){
      return;
    }


    /*
     * V29 race lock:
     * MutationObserver can fire several times while the Supabase query
     * is still pending. Lock immediately, before awaiting anything.
     */
    card.dataset.confirmInfoPending =
      '1';


    const appointmentId =
      lastAppointmentId;


    let appointment;


    try{

      const result =
        await C.sb
          .from(
            'appointments'
          )
          .select(
            `
              id,
              status,
              information_confirmed_at,
              information_confirmed_by
            `
          )
          .eq(
            'id',
            appointmentId
          )
          .maybeSingle();


      if(result.error){
        throw result.error;
      }


      appointment =
        result.data;

    }
    catch(error){

      console.warn(
        'Information confirmation fields are unavailable. Run the SQL patch.',
        error
      );

      delete card.dataset.confirmInfoPending;

      return;
    }


    if(
      !appointment
      ||
      ![
        'booked',
        'confirmed'
      ].includes(
        appointment.status
      )
    ){
      delete card.dataset.confirmInfoPending;

      return;
    }


    /*
     * Remove any duplicate controls created by an older cached script
     * before adding the single V29 control.
     */
    card
      .querySelectorAll(
        '.appointment-info-confirm-button'
      )
      .forEach(
        button=>
          button.remove()
      );


    card.dataset.confirmInfoReady =
      '1';

    delete card.dataset.confirmInfoPending;


    let actions =
      card.querySelector(
        '.appointment-detail-actions'
      );


    if(!actions){

      actions =
        document.createElement(
          'div'
        );


      actions.className =
        'appointment-detail-actions';


      card.appendChild(
        actions
      );
    }


    if(
      appointment.information_confirmed_at
    ){

      const badge =
        document.createElement(
          'span'
        );


      badge.className =
        'appointment-info-confirmed-badge';


      badge.textContent =
        C.lang==='ar'
          ? '✓ تم تأكيد المعلومات'
          : '✓ Information confirmed';


      actions.prepend(
        badge
      );

    }
    else{

      const button =
        document.createElement(
          'button'
        );


      button.type =
        'button';


      button.className =
        'secondary-button compact appointment-info-confirm-button';


      button.textContent =
        C.lang==='ar'
          ? 'تأكيد المعلومات'
          : 'Confirm information';


      button.onclick =
        ()=>{

          C.closeModal();


          showConfirmationModal(
            appointmentId
          );
        };


      actions.prepend(
        button
      );
    }


  }


  /*
   * Capture the appointment ID before appointments.js opens the modal.
   */
  document.addEventListener(
    'click',
    event=>{

      const target =
        event.target.closest(
          '[data-appointment-id]'
        );


      if(target){

        lastAppointmentId =
          target.dataset
            .appointmentId;
      }
    },
    true
  );


  const observer =
    new MutationObserver(
      ()=>{

        document
          .querySelectorAll(
            '.appointment-detail-card'
          )
          .forEach(
            patchAppointmentDetails
          );
      }
    );


  injectStyles();


  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );


  window.ClinicAppointmentInformation = {
    show:
      showConfirmationModal
  };

})();
