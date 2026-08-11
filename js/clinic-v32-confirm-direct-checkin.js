(() => {

  const C = window.Clinic;

  if(!C){
    console.error('Clinic V32: core not loaded');
    return;
  }

  let lastAppointmentId = null;


  function normalizePhone(value=''){
    return String(value).replace(/\D/g,'');
  }


  function validWhatsapp(value=''){
    const n = normalizePhone(value);

    return (
      /^01\d{9}$/.test(n)
      ||
      /^20\d{10}$/.test(n)
      ||
      /^0020\d{10}$/.test(n)
    );
  }


  async function loadAppointmentBundle(appointmentId){

    const {data:a,error} =
      await C.sb
        .from('appointments')
        .select(`
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
          )
        `)
        .eq('id',appointmentId)
        .maybeSingle();

    if(error) throw error;
    if(!a) throw new Error('Appointment not found');

    return {
      appointment:a,
      patient:a.patient || {}
    };
  }


  async function performDirectCheckin(appointmentId){

    const {data:a,error:aError} =
      await C.sb
        .from('appointments')
        .select('id,appointment_type')
        .eq('id',appointmentId)
        .maybeSingle();

    if(aError) throw aError;
    if(!a) throw new Error('Appointment not found');

    const standardFee =
      a.appointment_type === 'follow_up'
        ? 150
        : 350;

    C.showModal({
      title:
        C.lang==='ar'
          ? 'تسجيل الوصول'
          : 'Check in',

      body:`
        <form id="v32DirectCheckinForm" class="form-grid">

          <div class="arrival-fee-message full-span">
            <span>✓</span>
            <div>
              <strong>
                ${
                  C.lang==='ar'
                    ? 'تم تأكيد المعلومات'
                    : 'Information confirmed'
                }
              </strong>
              <small>
                ${
                  C.lang==='ar'
                    ? 'يمكنك الآن تسجيل وصول المريض مباشرة.'
                    : 'You can now check the patient in directly.'
                }
              </small>
            </div>
          </div>

          <label>
            ${
              C.lang==='ar'
                ? 'الرسوم (جنيه)'
                : 'Fees (EGP)'
            }

            <input
              id="v32Fee"
              class="control"
              type="number"
              min="0"
              step="1"
              value="${standardFee}"
              required
            >

            <small>
              ${
                a.appointment_type === 'follow_up'
                  ? (
                      C.lang==='ar'
                        ? 'الرسوم القياسية للاستشارة: 150 جنيه'
                        : 'Standard consultation fee: 150 EGP'
                    )
                  : (
                      C.lang==='ar'
                        ? 'الرسوم القياسية للكشف: 350 جنيه'
                        : 'Standard examination fee: 350 EGP'
                    )
              }
            </small>
          </label>

          <label>
            ${
              C.lang==='ar'
                ? 'طريقة الدفع'
                : 'Payment method'
            }

            <select
              id="v32Payment"
              class="control"
            >
              <option value="cash">
                ${
                  C.lang==='ar'
                    ? 'نقدي'
                    : 'Cash'
                }
              </option>

              <option value="instapay">
                InstaPay
              </option>

              <option value="card">
                ${
                  C.lang==='ar'
                    ? 'بطاقة'
                    : 'Card'
                }
              </option>

              <option value="bank_transfer">
                ${
                  C.lang==='ar'
                    ? 'تحويل بنكي'
                    : 'Bank transfer'
                }
              </option>

              <option value="other">
                ${
                  C.lang==='ar'
                    ? 'أخرى'
                    : 'Other'
                }
              </option>
            </select>
          </label>

          <label class="full-span">
            ${
              C.lang==='ar'
                ? 'سبب تغيير الرسوم'
                : 'Reason for fee change'
            }

            <textarea
              id="v32FeeReason"
              class="control"
              placeholder="${
                C.lang==='ar'
                  ? 'يصبح إجبارياً فقط إذا تم تغيير السعر القياسي'
                  : 'Required only if the standard fee is changed'
              }"
            ></textarea>
          </label>

          <div class="form-actions full-span">
            <button
              type="submit"
              class="primary-button compact"
            >
              ${
                C.lang==='ar'
                  ? '✓ تسجيل الوصول وإضافة للطابور'
                  : '✓ Check in & add to queue'
              }
            </button>
          </div>

        </form>
      `,

      onOpen:root=>{

        const form =
          root.querySelector(
            '#v32DirectCheckinForm'
          );

        form.onsubmit =
          async event=>{

            event.preventDefault();

            const fee =
              Number(
                root.querySelector(
                  '#v32Fee'
                ).value || 0
              );

            const reason =
              root.querySelector(
                '#v32FeeReason'
              ).value.trim();

            if(
              fee !== standardFee
              &&
              !reason
            ){
              return C.toast(
                C.lang==='ar'
                  ? 'يجب كتابة سبب تغيير الرسوم.'
                  : 'A reason is required when changing the standard fee.',
                'error'
              );
            }

            const result =
              await C.sb.rpc(
                'frontend_check_in_with_fee',
                {
                  p_id:
                    appointmentId,

                  p_fee:
                    fee,

                  p_payment_method:
                    root.querySelector(
                      '#v32Payment'
                    ).value,

                  p_note:
                    reason || null
                }
              );

            if(result.error){
              return C.toast(
                result.error.message,
                'error'
              );
            }

            C.closeModal();

            C.toast(
              C.lang==='ar'
                ? 'تم تسجيل الوصول وإضافة المريض تلقائياً إلى طابور الطبيب.'
                : 'Patient checked in and added automatically to the doctor queue.'
            );

            window.ClinicNotifications
              ?.refresh?.();

            C.route(
              C.currentPage
            );
          };
      }
    });
  }


  function injectStyles(){

    if(
      document.getElementById(
        'clinicV32Styles'
      )
    ){
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      'clinicV32Styles';

    style.textContent = `
      .v32-missing-required {
        border-color: #f0a8a8 !important;
        background: #fff7f7 !important;
      }

      .v32-required-note {
        margin-top: 8px;
        padding: 9px 10px;
        border: 1px solid #fecaca;
        border-radius: 10px;
        background: #fff7f7;
        color: #b42318;
        font-size: 10px;
        font-weight: 800;
        line-height: 1.6;
      }

      .v32-confirm-success-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
    `;

    document.head.appendChild(
      style
    );
  }


  async function patchConfirmModal(root){

    const button =
      root.querySelector(
        '#confirmAppointmentInformationNow'
      );

    if(
      !button
      ||
      button.dataset.v32Ready === '1'
      ||
      !lastAppointmentId
    ){
      return;
    }

    button.dataset.v32Ready =
      '1';

    let bundle;

    try{
      bundle =
        await loadAppointmentBundle(
          lastAppointmentId
        );
    }
    catch(error){
      console.warn(error);
      return;
    }

    const patient =
      bundle.patient;

    const mobile =
      patient.mobile || '';

    /*
     * WhatsApp is mandatory when missing/invalid.
     */
    if(
      !validWhatsapp(
        mobile
      )
    ){

      const note =
        document.createElement(
          'div'
        );

      note.className =
        'v32-required-note';

      note.textContent =
        C.lang==='ar'
          ? 'رقم واتساب مفقود أو غير صحيح. يجب تعديل بيانات المريض وإدخال رقم واتساب صحيح قبل تأكيد المعلومات.'
          : 'WhatsApp is missing or invalid. Edit the patient information and enter a valid WhatsApp number before confirming.';

      const actions =
        root.querySelector(
          '.appointment-info-actions'
        );

      actions?.insertAdjacentElement(
        'beforebegin',
        note
      );

      button.disabled =
        true;

      button.classList.add(
        'v32-missing-required'
      );

      button.title =
        C.lang==='ar'
          ? 'أدخل رقم واتساب صحيح أولاً'
          : 'Enter a valid WhatsApp number first';

      return;
    }


    /*
     * Replace the old success behavior:
     * after confirmation, immediately offer Check in.
     */
    button.onclick =
      async()=>{

        try{

          const result =
            await C.sb.rpc(
              'frontend_confirm_appointment_information',
              {
                p_appointment_id:
                  lastAppointmentId
              }
            );

          if(result.error){
            throw result.error;
          }

          const actions =
            root.querySelector(
              '.appointment-info-actions'
            );

          if(!actions){
            return;
          }

          actions.innerHTML = `
            <div class="v32-confirm-success-actions">

              <button
                id="v32CheckinNow"
                type="button"
                class="primary-button compact"
              >
                ${
                  C.lang==='ar'
                    ? '✓ المعلومات صحيحة — تسجيل الوصول الآن'
                    : '✓ Information correct — Check in now'
                }
              </button>

              <button
                id="v32CloseAfterConfirm"
                type="button"
                class="secondary-button compact"
              >
                ${
                  C.lang==='ar'
                    ? 'إغلاق'
                    : 'Close'
                }
              </button>

            </div>
          `;

          root.querySelector(
            '#v32CheckinNow'
          ).onclick =
            ()=>{

              C.closeModal();

              performDirectCheckin(
                lastAppointmentId
              );
            };

          root.querySelector(
            '#v32CloseAfterConfirm'
          ).onclick =
            ()=>{

              C.closeModal();

              C.route(
                C.currentPage
              );
            };

        }
        catch(error){

          C.toast(
            error.message,
            'error'
          );
        }
      };
  }


  /*
   * Capture appointment before modal opens.
   */
  document.addEventListener(
    'click',
    event=>{

      const target =
        event.target.closest(
          '[data-appointment-id]'
        );

      if(
        target?.dataset?.appointmentId
      ){
        lastAppointmentId =
          target.dataset.appointmentId;
      }
    },
    true
  );


  const observer =
    new MutationObserver(
      ()=>{

        const modal =
          document.getElementById(
            'modalRoot'
          );

        if(
          modal
          &&
          !modal.classList.contains(
            'hidden'
          )
        ){
          patchConfirmModal(
            modal
          );
        }
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


  window.ClinicV32 = {
    performDirectCheckin
  };

})();
