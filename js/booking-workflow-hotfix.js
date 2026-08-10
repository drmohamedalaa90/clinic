(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  let lastAppointmentId=
    null;


  function isBookingStaff(){
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


  function canEditBooking(){
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
        'bookingWorkflowHotfixStyles'
      )
    ){
      return;
    }


    const style=
      document.createElement(
        'style'
      );


    style.id=
      'bookingWorkflowHotfixStyles';


    style.textContent=`
      .booking-phone-first {
        margin-bottom: 12px;
        padding: 12px;
        border: 1px solid #b7d9d1;
        border-radius: 14px;
        background: #f3fbf9;
      }

      .booking-phone-first-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .booking-phone-first-head strong {
        font-size: 12px;
      }

      .booking-phone-first-grid {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        gap: 8px;
      }

      .booking-phone-first-result {
        margin-top: 8px;
      }

      .booking-phone-match {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px;
        border: 1px solid #bbf7d0;
        border-radius: 11px;
        background: #f0fdf4;
      }

      .booking-phone-match > span {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .booking-phone-match small {
        color: #64748b;
      }

      .booking-phone-new {
        padding: 9px 10px;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e3a8a;
        font-size: 10px;
        font-weight: 800;
      }

      .booking-phone-matches {
        display: grid;
        gap: 6px;
      }

      .booking-phone-choice {
        width: 100%;
        padding: 9px 10px;
        border: 1px solid #d8e2ea;
        border-radius: 10px;
        background: white;
        text-align: inherit;
        cursor: pointer;
      }

      .booking-phone-choice:hover {
        border-color: #0f8b78;
        background: #f5fffc;
      }

      .booking-edit-current {
        padding: 10px 12px;
        border-radius: 12px;
        background: #f8fafc;
        color: #475569;
        font-size: 10px;
        line-height: 1.6;
      }

      .appointment-edit-button {
        border-color: #99d8ca !important;
        background: #f0fdfa !important;
        color: #0f766e !important;
      }

      @media (max-width: 700px) {
        .booking-phone-first-grid {
          grid-template-columns: 1fr;
        }
      }
    `;


    document.head.appendChild(
      style
    );
  }


  function normalizePhone(value=''){
    return String(value)
      .replace(/\D/g,'');
  }


  function patientDisplayName(patient){
    return (
      patient.english_name
      ||
      patient.arabic_name
      ||
      patient.medical_record_number
      ||
      'Patient'
    );
  }


  async function findPatientsByPhone(
    phone
  ){

    const {data,error}=
      await C.sb.rpc(
        'frontend_find_patient_by_phone',
        {
          p_phone:
            phone
        }
      );


    if(error){
      throw error;
    }


    return Array.isArray(
      data?.matches
    )
      ? data.matches
      : [];
  }


  function chooseExistingPatient(
    form,
    patient
  ){

    const existingButton=
      form.querySelector(
        '[data-patient-mode="existing"]'
      );


    existingButton?.click();


    const hidden=
      form.querySelector(
        '#selectedExistingPatient'
      );


    if(hidden){
      hidden.value=
        patient.id;
    }


    const search=
      form.querySelector(
        '#existingPatientSearch'
      );


    if(search){

      search.value=
        patient.mobile
        ||
        patient.medical_record_number
        ||
        patientDisplayName(
          patient
        );


      search.dispatchEvent(
        new Event(
          'input',
          {
            bubbles:true
          }
        )
      );
    }
  }


  function prepareNewPatient(
    form,
    phone
  ){

    form
      .querySelector(
        '[data-patient-mode="new"]'
      )
      ?.click();


    const mobile=
      form.querySelector(
        '#bookingMobile'
      );


    if(mobile){
      mobile.value=
        phone;
    }


    const hidden=
      form.querySelector(
        '#selectedExistingPatient'
      );


    if(hidden){
      hidden.value='';
    }
  }


  function renderPhoneMatches(
    form,
    resultBox,
    matches
  ){

    if(matches.length===1){

      const patient=
        matches[0];


      chooseExistingPatient(
        form,
        patient
      );


      resultBox.innerHTML=`
        <div class="booking-phone-match">
          <span>
            <strong>
              ${
                C.lang==='ar'
                  ?'تم العثور على ملف المريض'
                  :'Existing patient found'
              }
            </strong>

            <small>
              ${C.escape(
                patientDisplayName(
                  patient
                )
              )}
              •
              ${C.escape(
                patient.medical_record_number
                ||
                ''
              )}
            </small>
          </span>

          <button
            type="button"
            class="secondary-button compact"
            data-open-matched-patient="${patient.id}"
          >
            ${
              C.lang==='ar'
                ?'فتح الملف'
                :'Open file'
            }
          </button>
        </div>
      `;


      return;
    }


    if(matches.length>1){

      resultBox.innerHTML=`
        <div class="booking-phone-matches">

          <div class="booking-phone-new">
            ${
              C.lang==='ar'
                ?'يوجد أكثر من ملف بهذا الرقم. اختر المريض الصحيح.'
                :'More than one patient uses this number. Choose the correct record.'
            }
          </div>

          ${matches.map(
            patient=>`
              <button
                type="button"
                class="booking-phone-choice"
                data-phone-patient="${patient.id}"
              >
                <strong>
                  ${C.escape(
                    patientDisplayName(
                      patient
                    )
                  )}
                </strong>

                <small>
                  ${C.escape(
                    patient.medical_record_number
                    ||
                    ''
                  )}
                  ${
                    patient.birth_year
                      ? ` • ${patient.birth_year}`
                      : ''
                  }
                </small>
              </button>
            `
          ).join('')}

        </div>
      `;


      resultBox
        .querySelectorAll(
          '[data-phone-patient]'
        )
        .forEach(
          button=>{

            button.onclick=()=>{

              const patient=
                matches.find(
                  item=>
                    item.id===
                    button.dataset
                      .phonePatient
                );


              if(!patient){
                return;
              }


              chooseExistingPatient(
                form,
                patient
              );


              renderPhoneMatches(
                form,
                resultBox,
                [
                  patient
                ]
              );
            };
          }
        );


      return;
    }


    resultBox.innerHTML=`
      <div class="booking-phone-new">
        ${
          C.lang==='ar'
            ?'رقم جديد — أكمل بيانات المريض الجديد.'
            :'New number — complete the new patient details.'
        }
      </div>
    `;
  }


  function patchBookingForm(
    form
  ){

    if(
      !isBookingStaff()
      ||
      form.dataset.phoneFirstReady
    ){
      return;
    }


    form.dataset.phoneFirstReady=
      '1';


    const firstSection=
      form.querySelector(
        '.booking-form-section'
      );


    if(!firstSection){
      return;
    }


    const box=
      document.createElement(
        'section'
      );


    box.className=
      'booking-phone-first';


    box.innerHTML=`
      <div class="booking-phone-first-head">
        <strong>
          ${
            C.lang==='ar'
              ?'ابدأ برقم الهاتف'
              :'Start with the phone number'
          }
        </strong>

        <small class="muted">
          ${
            C.lang==='ar'
              ?'إذا كان مسجلاً سنستخدم ملف المريض الموجود تلقائياً.'
              :'If registered, the existing patient record is linked automatically.'
          }
        </small>
      </div>

      <div class="booking-phone-first-grid">

        <input
          id="bookingPhoneFirst"
          class="control"
          inputmode="tel"
          autocomplete="tel"
          placeholder="${
            C.lang==='ar'
              ?'رقم الموبايل / واتساب'
              :'Mobile / WhatsApp'
          }"
        >

        <button
          id="bookingPhoneLookup"
          type="button"
          class="secondary-button"
        >
          ${
            C.lang==='ar'
              ?'بحث'
              :'Find patient'
          }
        </button>

      </div>

      <div
        id="bookingPhoneFirstResult"
        class="booking-phone-first-result"
      ></div>
    `;


    firstSection.insertAdjacentElement(
      'afterend',
      box
    );


    const input=
      box.querySelector(
        '#bookingPhoneFirst'
      );


    const resultBox=
      box.querySelector(
        '#bookingPhoneFirstResult'
      );


    let timer=
      null;


    async function lookup(){

      const phone=
        input.value
          .trim();


      if(
        normalizePhone(
          phone
        ).length<8
      ){

        resultBox.innerHTML='';

        return;
      }


      resultBox.innerHTML=`
        <div class="booking-phone-new">
          ${
            C.lang==='ar'
              ?'جاري البحث...'
              :'Searching...'
          }
        </div>
      `;


      try{

        const matches=
          await findPatientsByPhone(
            phone
          );


        if(matches.length){

          renderPhoneMatches(
            form,
            resultBox,
            matches
          );

        }
        else{

          prepareNewPatient(
            form,
            phone
          );


          renderPhoneMatches(
            form,
            resultBox,
            []
          );
        }
      }
      catch(error){

        resultBox.innerHTML=`
          <div class="booking-phone-new">
            ${C.escape(
              error.message
            )}
          </div>
        `;
      }
    }


    input.addEventListener(
      'input',
      ()=>{

        clearTimeout(
          timer
        );


        timer=
          setTimeout(
            lookup,
            250
          );
      }
    );


    box
      .querySelector(
        '#bookingPhoneLookup'
      )
      .onclick=
        lookup;


    box.addEventListener(
      'click',
      event=>{

        const button=
          event.target.closest(
            '[data-open-matched-patient]'
          );


        if(!button){
          return;
        }


        C.closeModal();


        C.route(
          'patient-detail',
          {
            patientId:
              button.dataset
                .openMatchedPatient
          }
        );
      }
    );
  }


  async function showEditBookingModal(
    appointmentId
  ){

    const [
      appointmentResult
    ]=
      await Promise.all([
        C.sb
          .from(
            'appointments'
          )
          .select('*')
          .eq(
            'id',
            appointmentId
          )
          .maybeSingle()
      ]);


    if(
      appointmentResult.error
      ||
      !appointmentResult.data
    ){

      return C.toast(
        appointmentResult.error?.message
        ||
        (
          C.lang==='ar'
            ?'تعذر تحميل الموعد.'
            :'Could not load appointment.'
        ),
        'error'
      );
    }


    const appointment=
      appointmentResult.data;


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
          ?'يمكن تعديل الحجز فقط قبل تسجيل الوصول.'
          :'A booking can be edited only before check-in.',
        'error'
      );
    }


    const {data:patient,error:patientError}=
      await C.sb
        .from(
          'patients'
        )
        .select('*')
        .eq(
          'id',
          appointment.patient_id
        )
        .maybeSingle();


    if(
      patientError
      ||
      !patient
    ){

      return C.toast(
        patientError?.message
        ||
        'Patient not found',
        'error'
      );
    }


    const appointmentType=
      appointment.type
      ||
      appointment.appointment_type
      ||
      'new';


    C.showModal({
      title:
        C.lang==='ar'
          ?'تعديل الحجز قبل تسجيل الوصول'
          :'Edit booking before check-in',

      wide:true,

      body:`
        <form
          id="preCheckinBookingEditForm"
          class="form-grid"
        >

          <div class="booking-edit-current full-span">
            <strong>
              ${C.escape(
                patient.medical_record_number
                ||
                ''
              )}
            </strong>

            •
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

            <br>

            ${
              C.lang==='ar'
                ?'لتغيير التاريخ أو الساعة استخدم زر إعادة الجدولة.'
                :'Use Reschedule to change the appointment date or time.'
            }
          </div>


          <label>
            ${
              C.lang==='ar'
                ?'الموبايل / واتساب'
                :'Mobile / WhatsApp'
            }

            <input
              id="editBookingMobile"
              class="control"
              inputmode="tel"
              value="${C.escape(
                patient.mobile
                ||
                ''
              )}"
            >
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'الاسم بالعربية'
                :'Arabic name'
            }

            <input
              id="editBookingArabic"
              class="control"
              value="${C.escape(
                patient.arabic_name
                ||
                ''
              )}"
            >
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'الاسم بالإنجليزية (اختياري)'
                :'English name (optional)'
            }

            <input
              id="editBookingEnglish"
              class="control"
              value="${C.escape(
                patient.english_name
                ||
                ''
              )}"
            >
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'سنة الميلاد'
                :'Year of birth'
            }

            <input
              id="editBookingBirthYear"
              type="number"
              class="control"
              min="1900"
              max="2100"
              value="${patient.birth_year||''}"
            >
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'النوع'
                :'Gender'
            }

            <select
              id="editBookingGender"
              class="control"
            >
              <option value="">—</option>

              <option
                value="male"
                ${
                  patient.gender==='male'
                    ?'selected'
                    :''
                }
              >
                ${
                  C.lang==='ar'
                    ?'ذكر'
                    :'Male'
                }
              </option>

              <option
                value="female"
                ${
                  patient.gender==='female'
                    ?'selected'
                    :''
                }
              >
                ${
                  C.lang==='ar'
                    ?'أنثى'
                    :'Female'
                }
              </option>
            </select>
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'منطقة السكن'
                :'Residency area'
            }

            <input
              id="editBookingArea"
              class="control"
              value="${C.escape(
                patient.residency_area
                ||
                ''
              )}"
            >
          </label>


          <label class="full-span">
            ${
              C.lang==='ar'
                ?'العنوان'
                :'Address'
            }

            <input
              id="editBookingAddress"
              class="control"
              value="${C.escape(
                patient.address
                ||
                ''
              )}"
            >
          </label>


          <label>
            ${
              C.lang==='ar'
                ?'نوع الزيارة'
                :'Visit type'
            }

            <select
              id="editBookingType"
              class="control"
            >
              <option
                value="new"
                ${
                  appointmentType==='new'
                    ?'selected'
                    :''
                }
              >
                ${
                  C.lang==='ar'
                    ?'كشف'
                    :'Examination'
                }
              </option>

              <option
                value="follow_up"
                ${
                  appointmentType==='follow_up'
                    ?'selected'
                    :''
                }
              >
                ${
                  C.lang==='ar'
                    ?'استشارة'
                    :'Consultation'
                }
              </option>
            </select>
          </label>


          <label class="full-span">
            ${
              C.lang==='ar'
                ?'ملاحظات الحجز'
                :'Booking notes'
            }

            <textarea
              id="editBookingNotes"
              class="control"
            >${C.escape(
              appointment.notes
              ||
              ''
            )}</textarea>
          </label>


          <div class="form-actions full-span">

            <button
              type="submit"
              class="primary-button compact"
            >
              ${
                C.lang==='ar'
                  ?'حفظ التعديل'
                  :'Save changes'
              }
            </button>

          </div>

        </form>
      `,

      onOpen:root=>{

        root
          .querySelector(
            '#preCheckinBookingEditForm'
          )
          .onsubmit=
            async event=>{

              event.preventDefault();


              const getValue=
                selector=>
                  root
                    .querySelector(
                      selector
                    )
                    .value
                    .trim();


              const birthYearText=
                getValue(
                  '#editBookingBirthYear'
                );


              const {error}=
                await C.sb.rpc(
                  'frontend_edit_booking_before_checkin',
                  {
                    p_appointment_id:
                      appointmentId,

                    p_arabic_name:
                      getValue(
                        '#editBookingArabic'
                      )
                      ||
                      null,

                    p_english_name:
                      getValue(
                        '#editBookingEnglish'
                      )
                      ||
                      null,

                    p_birth_year:
                      birthYearText
                        ? Number(
                            birthYearText
                          )
                        : null,

                    p_gender:
                      getValue(
                        '#editBookingGender'
                      )
                      ||
                      null,

                    p_mobile:
                      getValue(
                        '#editBookingMobile'
                      )
                      ||
                      null,

                    p_residency_area:
                      getValue(
                        '#editBookingArea'
                      )
                      ||
                      null,

                    p_address:
                      getValue(
                        '#editBookingAddress'
                      )
                      ||
                      null,

                    p_type:
                      getValue(
                        '#editBookingType'
                      )
                      ||
                      'new',

                    p_notes:
                      getValue(
                        '#editBookingNotes'
                      )
                      ||
                      null
                  }
                );


              if(error){

                return C.toast(
                  error.message,
                  'error'
                );
              }


              C.closeModal();


              C.toast(
                C.lang==='ar'
                  ?'تم تحديث بيانات الحجز.'
                  :'Booking data updated.'
              );


              C.route(
                C.currentPage
              );
            };
      }
    });
  }


  async function patchAppointmentDetails(
    card
  ){

    /*
     * V29:
     * Do NOT place a separate Edit booking button in Appointment Details.
     * Editing is opened ONLY from inside Confirm information.
     */
    return;
  }


  /*
   * Capture the appointment ID BEFORE appointments.js opens its modal.
   */
  document.addEventListener(
    'click',
    event=>{

      const target=
        event.target.closest(
          '[data-appointment-id]'
        );


      if(target){

        lastAppointmentId=
          target.dataset
            .appointmentId;
      }
    },
    true
  );


  const observer=
    new MutationObserver(
      ()=>{

        document
          .querySelectorAll(
            '#bookingForm'
          )
          .forEach(
            patchBookingForm
          );


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


  window.ClinicBookingWorkflow = {
    showEditBookingModal
  };


  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );

})();
