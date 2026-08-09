(function(){
  const C=()=>window.Clinic;

  async function patientMap(ids){
    const c=C();
    const uniq=[...new Set((ids||[]).filter(Boolean))];

    if(!uniq.length){
      return new Map();
    }

    const {data}=await c.sb
      .from('patients')
      .select(
        'id,medical_record_number,english_name,arabic_name'
      )
      .in('id',uniq);

    return new Map(
      (data||[]).map(
        p=>[p.id,p]
      )
    );
  }


  async function renderFinance(){
    const c=C();

    if(!c.isReception()){
      return c.route('dashboard');
    }

    c.setTitle(c.t('finance'));

    const today=c.cairoDate();


    const [
      incomeResult,
      bookingIncomeResult,
      invoiceResult,
      servicesResult,
      closingResult,
      logisticsRequestResult,
      clinicExpenseResult,
      expenseCategoryResult,
      checkedInResult,
      feeEditsResult
    ] = await Promise.all([

      c.sb.rpc(
        'frontend_booking_income_summary',
        {
          p_from:today,
          p_to:today
        }
      ),

      c.sb
        .from('booking_income')
        .select('*')
        .order(
          'received_at',
          {ascending:false}
        )
        .limit(200),

      c.sb
        .from('invoices')
        .select('*')
        .order(
          'created_at',
          {ascending:false}
        )
        .limit(80),

      c.sb
        .from('clinic_services')
        .select('*')
        .order(
          'is_active',
          {ascending:false}
        )
        .order('name_en'),

      c.sb
        .from('cash_closings')
        .select('*')
        .order(
          'closing_date',
          {ascending:false}
        )
        .limit(20),

      c.sb
        .from('logistics_requests')
        .select('*')
        .in(
          'status',
          ['approved','paid']
        )
        .order(
          'requested_at',
          {ascending:false}
        )
        .limit(100),

      c.sb
        .from('clinic_expenses')
        .select('*')
        .order(
          'expense_at',
          {ascending:false}
        )
        .limit(200),

      c.sb
        .from('expense_categories')
        .select('*')
        .eq(
          'is_active',
          true
        )
        .order('name_en'),

      c.sb
        .from('appointments')
        .select(
          'id,appointment_number,patient_id,doctor_id,status,scheduled_start,checked_in_at'
        )
        .not(
          'checked_in_at',
          'is',
          null
        )
        .order(
          'checked_in_at',
          {ascending:false}
        )
        .limit(300),

      c.sb
        .from('booking_income_edits')
        .select('*')
        .order(
          'edited_at',
          {ascending:false}
        )
        .limit(500)
    ]);


    const incomeSummary=
      incomeResult.data||{};

    const bookingIncome=
      bookingIncomeResult.data||[];

    const invoices=
      invoiceResult.data||[];

    const services=
      servicesResult.data||[];

    const closings=
      closingResult.data||[];

    const logisticsRequests=
      logisticsRequestResult.data||[];

    const clinicExpenses=
      clinicExpenseResult.data||[];

    const expenseCategories=
      expenseCategoryResult.data||[];

    const expenseCategoryMap=
      new Map(
        expenseCategories.map(
          x=>[x.id,x]
        )
      );

    const checkedInCases=
      checkedInResult.data||[];

    const feeEdits=
      feeEditsResult.data||[];

    const incomeByAppointment=
      new Map(
        bookingIncome
          .filter(x=>!x.is_voided)
          .map(x=>[
            x.appointment_id,
            x
          ])
      );

    const latestFeeEditByAppointment=
      new Map();

    feeEdits.forEach(edit=>{
      if(
        !latestFeeEditByAppointment.has(
          edit.appointment_id
        )
      ){
        latestFeeEditByAppointment.set(
          edit.appointment_id,
          edit
        );
      }
    });


    const allPatientIds=[
      ...bookingIncome.map(x=>x.patient_id),
      ...invoices.map(x=>x.patient_id),
      ...checkedInCases.map(x=>x.patient_id)
    ];

    const pm=
      await patientMap(allPatientIds);


    document.getElementById('mainContent').innerHTML=`

      <section class="page-toolbar">

        <div>
          <span class="eyebrow">
            FINANCE
          </span>

          <h2>
            ${c.lang==='ar'
              ?'المالية'
              :'Finance'}
          </h2>

          <p class="muted">
            ${c.lang==='ar'
              ?'دخل الحجز، الفواتير، الخدمات والإغلاق النقدي.'
              :'Booking income, invoices, services and cash closing.'}
          </p>
        </div>


        <div class="toolbar-actions">

          <button
            id="newInvoice"
            class="primary-button compact"
          >
            + ${c.lang==='ar'
              ?'فاتورة'
              :'Invoice'}
          </button>

          ${c.hasRole('owner')
            ? `<button
                 id="resetFinanceTest"
                 class="danger-button compact"
               >
                 ${c.lang==='ar'
                   ?'إعادة ضبط المالية'
                   :'Reset finance'}
               </button>`
            : ''
          }

        </div>

      </section>


      <section class="dashboard-grid">

        <article class="stat-card">

          <span class="stat-icon">
            💰
          </span>

          <span class="stat-label">
            ${c.lang==='ar'
              ?'دخل اليوم'
              :'Income today'}
          </span>

          <strong>
            ${c.formatMoney(
              incomeSummary.total_income||0
            )}
          </strong>

        </article>


        <article class="stat-card">

          <span class="stat-icon">
            💵
          </span>

          <span class="stat-label">
            ${c.lang==='ar'
              ?'نقدي'
              :'Cash'}
          </span>

          <strong>
            ${c.formatMoney(
              incomeSummary.cash_income||0
            )}
          </strong>

        </article>


        <article class="stat-card">

          <span class="stat-icon">
            📲
          </span>

          <span class="stat-label">
            InstaPay
          </span>

          <strong>
            ${c.formatMoney(
              incomeSummary.instapay_income||0
            )}
          </strong>

        </article>


        <article class="stat-card">

          <span class="stat-icon">
            🧾
          </span>

          <span class="stat-label">
            ${c.lang==='ar'
              ?'عمليات دخل اليوم'
              :'Income entries today'}
          </span>

          <strong>
            ${incomeSummary.income_count||0}
          </strong>

        </article>

      </section>


      <div
        class="tabs"
        id="financeTabs"
      >

        <button
          class="tab active"
          data-tab="checked-in"
        >
          ${c.lang==='ar'
            ?'الحالات المسجلة وصولها'
            :'Checked-in cases'}
        </button>

        <button
          class="tab"
          data-tab="income"
        >
          ${c.lang==='ar'
            ?'الدخل'
            :'Income'}
        </button>

        <button
          class="tab"
          data-tab="logistics-expenses"
        >
          ${c.lang==='ar'
            ?'مصروفات الاحتياجات'
            :'Logistics expenses'}
        </button>

        <button
          class="tab"
          data-tab="invoices"
        >
          ${c.lang==='ar'
            ?'الفواتير'
            :'Invoices'}
        </button>

        <button
          class="tab"
          data-tab="services"
        >
          ${c.lang==='ar'
            ?'الخدمات والأسعار'
            :'Services'}
        </button>

        <button
          class="tab"
          data-tab="closing"
        >
          ${c.lang==='ar'
            ?'الإغلاق النقدي'
            :'Cash closing'}
        </button>

      </div>


      <section class="content-card">

        <div id="financeArea"></div>

      </section>
    `;


    const area=
      document.getElementById(
        'financeArea'
      );


    function showCheckedInCases(){

      area.innerHTML=checkedInCases.length
        ? `
          <div class="section-head">
            <div>
              <span class="eyebrow">
                ${c.lang==='ar'
                  ?'الحالات التي تم تسجيل وصولها'
                  :'CHECKED-IN CASES'}
              </span>

              <h3>
                ${c.lang==='ar'
                  ?'كل المرضى الذين تم تسجيل وصولهم'
                  :'All checked-in patients'}
              </h3>

              <p class="muted">
                ${c.lang==='ar'
                  ?'يمكن تعديل الرسوم أو طريقة الدفع، ويجب كتابة سبب كل تعديل.'
                  :'Fee or payment method can be edited, and every edit requires a reason.'}
              </p>
            </div>
          </div>


          <div class="table-wrap">
            <table class="data-table finance-checkin-table">

              <thead>
                <tr>
                  <th>${c.lang==='ar'?'المريض':'Patient'}</th>
                  <th>${c.lang==='ar'?'الطبيب':'Doctor'}</th>
                  <th>${c.lang==='ar'?'تسجيل الوصول':'Check-in'}</th>
                  <th>${c.lang==='ar'?'الحالة':'Status'}</th>
                  <th>${c.lang==='ar'?'الرسوم':'Fee'}</th>
                  <th>${c.lang==='ar'?'الدفع':'Method'}</th>
                  <th>${c.lang==='ar'?'آخر سبب تعديل':'Last edit reason'}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                ${checkedInCases.map(a=>{
                  const p=
                    pm.get(a.patient_id)||{};

                  const income=
                    incomeByAppointment.get(a.id);

                  const lastEdit=
                    latestFeeEditByAppointment.get(a.id);

                  return `
                    <tr>
                      <td>
                        <strong>
                          ${c.escape(
                            p.english_name||
                            p.arabic_name||
                            'Patient'
                          )}
                        </strong>

                        <div class="subline">
                          ${c.escape(
                            p.medical_record_number||
                            a.appointment_number||
                            ''
                          )}
                        </div>
                      </td>

                      <td>
                        ${c.escape(
                          c.doctorName(
                            a.doctor_id
                          )
                        )}
                      </td>

                      <td>
                        ${c.formatDate(
                          a.checked_in_at,
                          {
                            hour:'2-digit',
                            minute:'2-digit'
                          }
                        )}
                      </td>

                      <td>
                        ${c.statusPill(
                          a.status
                        )}
                      </td>

                      <td>
                        <strong>
                          ${
                            income
                              ? c.formatMoney(
                                  income.amount
                                )
                              : (
                                  c.lang==='ar'
                                    ?'غير مسجل'
                                    :'Not recorded'
                                )
                          }
                        </strong>
                      </td>

                      <td>
                        ${c.escape(
                          income?.payment_method||
                          '—'
                        )}
                      </td>

                      <td>
                        <small>
                          ${c.escape(
                            lastEdit?.reason||
                            '—'
                          )}
                        </small>
                      </td>

                      <td>
                        <button
                          class="table-action"
                          data-edit-checkin-fee="${a.id}"
                        >
                          ${c.lang==='ar'
                            ?'تعديل'
                            :'Edit'}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>

            </table>
          </div>
        `
        : `
          <div class="empty-state">
            ${c.lang==='ar'
              ?'لا توجد حالات تم تسجيل وصولها حتى الآن.'
              :'No checked-in cases yet.'}
          </div>
        `;


      area
        .querySelectorAll(
          '[data-edit-checkin-fee]'
        )
        .forEach(button=>{

          button.onclick=()=>{

            const appointment=
              checkedInCases.find(
                x=>x.id===
                  button.dataset.editCheckinFee
              );

            const income=
              incomeByAppointment.get(
                appointment.id
              );

            editCheckedInFeeModal(
              appointment,
              income
            );
          };

        });
    }


    function editCheckedInFeeModal(
      appointment,
      income
    ){
      const patient=
        pm.get(
          appointment.patient_id
        )||{};

      c.showModal({
        title:
          c.lang==='ar'
            ?'تعديل بيانات الرسوم'
            :'Edit check-in fee',

        body:`
          <form
            id="editCheckinFeeForm"
            class="form-grid"
          >

            <div class="finance-patient-edit-summary full-span">
              <div>
                <strong>
                  ${c.escape(
                    patient.english_name||
                    patient.arabic_name||
                    'Patient'
                  )}
                </strong>

                <small>
                  ${c.escape(
                    patient.medical_record_number||
                    appointment.appointment_number||
                    ''
                  )}
                  •
                  ${c.formatDate(
                    appointment.checked_in_at,
                    {
                      hour:'2-digit',
                      minute:'2-digit'
                    }
                  )}
                </small>
              </div>
            </div>


            <label>
              ${c.lang==='ar'
                ?'الرسوم'
                :'Fee'}

              <input
                id="editFeeAmount"
                class="control"
                type="number"
                min="0.01"
                step="0.01"
                value="${income?.amount||''}"
                required
              >
            </label>


            <label>
              ${c.lang==='ar'
                ?'طريقة الدفع'
                :'Payment method'}

              <select
                id="editFeeMethod"
                class="control"
                required
              >
                ${[
                  ['cash','Cash'],
                  ['instapay','InstaPay'],
                  ['card','Card'],
                  ['bank_transfer','Bank transfer'],
                  ['other','Other']
                ].map(([value,label])=>`
                  <option
                    value="${value}"
                    ${
                      (income?.payment_method||'cash')===value
                        ?'selected'
                        :''
                    }
                  >
                    ${label}
                  </option>
                `).join('')}
              </select>
            </label>


            <label class="full-span">
              ${c.lang==='ar'
                ?'سبب التعديل'
                :'Reason for edit'}

              <textarea
                id="editFeeReason"
                class="control"
                required
                placeholder="${
                  c.lang==='ar'
                    ?'اكتب سبب التعديل بوضوح'
                    :'Write the reason for this edit'
                }"
              ></textarea>
            </label>


            <label class="full-span">
              ${c.lang==='ar'
                ?'ملاحظة مالية (اختياري)'
                :'Finance note (optional)'}

              <textarea
                id="editFeeNote"
                class="control"
              >${c.escape(
                income?.note||
                ''
              )}</textarea>
            </label>


            <div class="form-actions full-span">
              <button
                type="submit"
                class="primary-button compact"
              >
                ${c.lang==='ar'
                  ?'حفظ التعديل'
                  :'Save edit'}
              </button>
            </div>

          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#editCheckinFeeForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();

              const reason=
                root
                  .querySelector(
                    '#editFeeReason'
                  )
                  .value
                  .trim();

              if(!reason){
                return c.toast(
                  c.lang==='ar'
                    ?'سبب التعديل مطلوب.'
                    :'Edit reason is required.',
                  'error'
                );
              }


              const {error}=await c.sb.rpc(
                'finance_edit_checkin_fee',
                {
                  p_appointment_id:
                    appointment.id,

                  p_amount:
                    Number(
                      root
                        .querySelector(
                          '#editFeeAmount'
                        )
                        .value
                    ),

                  p_payment_method:
                    root
                      .querySelector(
                        '#editFeeMethod'
                      )
                      .value,

                  p_reason:
                    reason,

                  p_note:
                    root
                      .querySelector(
                        '#editFeeNote'
                      )
                      .value||
                    null
                }
              );


              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }


              c.closeModal();

              c.toast(
                c.lang==='ar'
                  ?'تم حفظ التعديل وسبب التعديل.'
                  :'Fee edit and reason saved.'
              );

              c.route('finance');
            };
        }
      });
    }


    function showIncome(){

      area.innerHTML=bookingIncome.length
        ? `

          <div class="section-head">

            <div>

              <span class="eyebrow">
                ${c.lang==='ar'
                  ?'رسوم الحجز'
                  :'BOOKING FEES'}
              </span>

              <h3>
                ${c.lang==='ar'
                  ?'الدخل'
                  :'Income'}
              </h3>

            </div>

          </div>


          <div class="table-wrap">

            <table class="data-table">

              <thead>

                <tr>

                  <th>
                    ${c.lang==='ar'
                      ?'التاريخ'
                      :'Date'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'المريض'
                      :'Patient'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'الطبيب'
                      :'Doctor'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'القيمة'
                      :'Fees'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'الدفع'
                      :'Method'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'الحالة'
                      :'Status'}
                  </th>

                  <th></th>

                </tr>

              </thead>


              <tbody>

                ${bookingIncome.map(entry=>{

                  const p=
                    pm.get(entry.patient_id)||{};

                  return `

                    <tr>

                      <td>

                        ${c.formatDate(
                          entry.received_at,
                          {
                            hour:'2-digit',
                            minute:'2-digit'
                          }
                        )}

                      </td>


                      <td>

                        <strong>

                          ${c.escape(
                            p.english_name||
                            p.arabic_name||
                            'Patient'
                          )}

                        </strong>

                        <div class="subline">

                          ${c.escape(
                            p.medical_record_number||
                            ''
                          )}

                        </div>

                      </td>


                      <td>

                        ${c.escape(
                          c.doctorName(
                            entry.doctor_id
                          )
                        )}

                      </td>


                      <td>

                        <strong>

                          ${c.formatMoney(
                            entry.amount
                          )}

                        </strong>

                      </td>


                      <td>

                        ${c.escape(
                          entry.payment_method
                        )}

                      </td>


                      <td>

                        ${entry.is_voided
                          ? c.statusPill('voided')
                          : c.statusPill('paid')
                        }

                      </td>


                      <td>

                        ${c.isManagement() &&
                          !entry.is_voided

                          ? `

                            <button

                              class="table-action danger-outline"

                              data-void-booking-income="${entry.id}"

                            >

                              ${c.lang==='ar'
                                ?'إلغاء'
                                :'Void'}

                            </button>

                          `

                          : ''
                        }

                      </td>

                    </tr>
                  `;

                }).join('')}

              </tbody>

            </table>

          </div>
        `

        : `

          <div class="empty-state">

            ${c.lang==='ar'
              ?'لا يوجد دخل مسجل من الحجوزات بعد.'
              :'No booking-fee income has been recorded yet.'}

          </div>
        `;


      area
        .querySelectorAll(
          '[data-void-booking-income]'
        )
        .forEach(button=>{

          button.onclick=async()=>{

            const reason=prompt(
              c.lang==='ar'
                ?'سبب إلغاء الدخل'
                :'Reason for voiding this income entry'
            );

            if(!reason){
              return;
            }

            const {error}=await c.sb.rpc(
              'void_booking_income',
              {
                p_income_id:
                  button.dataset.voidBookingIncome,

                p_reason:
                  reason
              }
            );

            if(error){
              return c.toast(
                error.message,
                'error'
              );
            }

            c.toast(
              c.lang==='ar'
                ?'تم إلغاء قيد الدخل'
                :'Income entry voided'
            );

            c.route('finance');
          };

        });
    }


    function showLogisticsExpenses(){

      const approved=
        logisticsRequests.filter(
          x=>x.status==='approved'
        );

      const paid=
        logisticsRequests.filter(
          x=>x.status==='paid'
        );


      area.innerHTML=`

        <div class="section-head">

          <div>

            <span class="eyebrow">
              ${c.lang==='ar'
                ?'احتياجات تمت الموافقة عليها'
                :'APPROVED LOGISTICS'}
            </span>

            <h3>
              ${c.lang==='ar'
                ?'إدخال السعر الفعلي'
                :'Enter actual purchase price'}
            </h3>

            <p class="muted">
              ${c.lang==='ar'
                ?'بعد موافقة الإدارة، تسجل السكرتارية السعر الفعلي هنا. سيصبح مصروفاً مالياً مرتبطاً بطلب الاحتياج.'
                :'After management approval, the secretary records the actual price here. It becomes a Finance expense linked to the logistics order.'}
            </p>

          </div>

        </div>


        ${
          approved.length

          ? `

            <div class="finance-logistics-pending">

              ${approved.map(request=>`

                <article class="finance-logistics-card">

                  <div>

                    <span class="deficiency-tag">
                      ${c.lang==='ar'
                        ?'مطلوب شراء'
                        :'TO PURCHASE'}
                    </span>

                    <strong>
                      ${c.escape(
                        request.item_name
                      )}
                    </strong>

                    <small>
                      ${request.quantity||'—'}
                      ${c.escape(
                        request.unit||
                        ''
                      )}
                      •
                      ${c.formatDate(
                        request.requested_at
                      )}
                    </small>

                  </div>


                  <button
                    class="primary-button compact"
                    data-record-logistics-price="${request.id}"
                  >
                    ${c.lang==='ar'
                      ?'إدخال السعر'
                      :'Enter price'}
                  </button>

                </article>

              `).join('')}

            </div>

          `

          : `

            <div class="empty-state compact-empty">

              ${c.lang==='ar'
                ?'لا توجد طلبات احتياجات معتمدة بانتظار السعر.'
                :'No approved logistics orders are waiting for a price.'}

            </div>

          `
        }


        <div class="section-head space-top">

          <div>

            <span class="eyebrow">
              ${c.lang==='ar'
                ?'سجل المصروفات'
                :'EXPENSE LEDGER'}
            </span>

            <h3>
              ${c.lang==='ar'
                ?'مصروفات العيادة'
                :'Clinic expenses'}
            </h3>

          </div>

        </div>


        ${
          clinicExpenses.length

          ? `

            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>

                    <th>
                      ${c.lang==='ar'
                        ?'رقم'
                        :'No.'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الوصف'
                        :'Description'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الفئة'
                        :'Category'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'المبلغ'
                        :'Amount'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الدفع'
                        :'Method'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'التاريخ'
                        :'Date'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الحالة'
                        :'Status'}
                    </th>

                  </tr>

                </thead>


                <tbody>

                  ${clinicExpenses.map(expense=>`

                    <tr>

                      <td>
                        <strong>
                          ${c.escape(
                            expense.expense_number
                          )}
                        </strong>
                      </td>

                      <td>
                        ${c.escape(
                          expense.description
                        )}
                      </td>

                      <td>
                        ${c.escape(
                          expenseCategoryMap
                            .get(expense.category_id)
                            ?.name_en||
                          '—'
                        )}
                      </td>

                      <td>
                        <strong>
                          ${c.formatMoney(
                            expense.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        ${c.escape(
                          expense.payment_method
                        )}
                      </td>

                      <td>
                        ${c.formatDate(
                          expense.expense_at,
                          {
                            hour:'2-digit',
                            minute:'2-digit'
                          }
                        )}
                      </td>

                      <td>
                        ${expense.is_voided
                          ? c.statusPill('voided')
                          : c.statusPill('paid')
                        }
                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>

          `

          : `

            <div class="empty-state">

              ${c.lang==='ar'
                ?'لم يتم تسجيل مصروفات بعد.'
                :'No clinic expenses recorded yet.'}

            </div>

          `
        }
      `;


      area
        .querySelectorAll(
          '[data-record-logistics-price]'
        )
        .forEach(button=>{

          button.onclick=()=>{

            const request=
              logisticsRequests.find(
                x=>x.id===
                  button.dataset.recordLogisticsPrice
              );

            logisticsPriceModal(
              request
            );
          };

        });
    }


    function logisticsPriceModal(request){

      if(!request){
        return;
      }


      c.showModal({

        title:
          c.lang==='ar'
            ?'إدخال سعر الاحتياج'
            :'Record logistics purchase price',

        body:`

          <form
            id="logisticsPriceForm"
            class="form-grid"
          >

            <div
              class="finance-logistics-item-summary full-span"
            >

              <span>📦</span>

              <div>

                <strong>
                  ${c.escape(
                    request.item_name
                  )}
                </strong>

                <small>
                  ${request.quantity||'—'}
                  ${c.escape(
                    request.unit||
                    ''
                  )}
                </small>

              </div>

            </div>


            <label>

              ${c.lang==='ar'
                ?'الفئة'
                :'Expense category'}

              <select
                id="logPriceCategory"
                class="control"
                required
              >

                ${expenseCategories.map(cat=>`

                  <option
                    value="${cat.id}"
                    ${
                      cat.id===
                      request.category_id
                        ?'selected'
                        :''
                    }
                  >
                    ${c.escape(
                      cat.name_en
                    )}
                  </option>

                `).join('')}

              </select>

            </label>


            <label>

              ${c.lang==='ar'
                ?'السعر الفعلي'
                :'Actual price'}

              <input
                id="logPriceAmount"
                class="control"
                type="number"
                min="0.01"
                step="0.01"
                required
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'طريقة الدفع'
                :'Payment method'}

              <select
                id="logPriceMethod"
                class="control"
              >
                <option value="cash">
                  Cash
                </option>

                <option value="instapay">
                  InstaPay
                </option>

                <option value="card">
                  Card
                </option>

                <option value="bank_transfer">
                  Bank transfer
                </option>

                <option value="other">
                  Other
                </option>
              </select>

            </label>


            <label>

              ${c.lang==='ar'
                ?'المورد'
                :'Vendor'}

              <input
                id="logPriceVendor"
                class="control"
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'مرجع / رقم إيصال'
                :'Reference / receipt no.'}

              <input
                id="logPriceRef"
                class="control"
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'التاريخ والوقت'
                :'Date / time'}

              <input
                id="logPriceDate"
                class="control"
                type="datetime-local"
              >

            </label>


            <label class="full-span">

              ${c.lang==='ar'
                ?'ملاحظات'
                :'Notes'}

              <textarea
                id="logPriceNotes"
                class="control"
              ></textarea>

            </label>


            <div class="form-actions full-span">

              <button
                class="primary-button compact"
                type="submit"
              >
                ${c.lang==='ar'
                  ?'تسجيل المصروف'
                  :'Record expense'}
              </button>

            </div>

          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#logisticsPriceForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();


              const local=
                root
                  .querySelector(
                    '#logPriceDate'
                  )
                  .value;


              const args={

                p_category_id:
                  root
                    .querySelector(
                      '#logPriceCategory'
                    )
                    .value,

                p_description:
                  request.item_name,

                p_amount:
                  Number(
                    root
                      .querySelector(
                        '#logPriceAmount'
                      )
                      .value
                  ),

                p_method:
                  root
                    .querySelector(
                      '#logPriceMethod'
                    )
                    .value,

                p_logistics_request_id:
                  request.id,

                p_vendor:
                  root
                    .querySelector(
                      '#logPriceVendor'
                    )
                    .value||
                  null,

                p_reference:
                  root
                    .querySelector(
                      '#logPriceRef'
                    )
                    .value||
                  null,

                p_notes:
                  root
                    .querySelector(
                      '#logPriceNotes'
                    )
                    .value||
                  null,

                p_receipt_path:
                  null,

                p_receipt_original_name:
                  null
              };


              if(local){
                args.p_expense_at=
                  `${local}:00+03:00`;
              }


              const {error}=await c.sb.rpc(
                'record_clinic_expense',
                args
              );


              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }


              c.closeModal();


              c.toast(
                c.lang==='ar'
                  ?'تم تسجيل السعر كمصروف مالي.'
                  :'Purchase price recorded in Finance.'
              );


              window
                .ClinicNotifications
                ?.refresh?.();


              c.route(
                'finance'
              );
            };
        }
      });
    }


    function showInvoices(){

      area.innerHTML=invoices.length
        ? `

          <div class="table-wrap">

            <table class="data-table">

              <thead>

                <tr>

                  <th>
                    ${c.lang==='ar'
                      ?'الفاتورة'
                      :'Invoice'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'المريض'
                      :'Patient'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'الإجمالي'
                      :'Total'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'المدفوع'
                      :'Paid'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'المتبقي'
                      :'Balance'}
                  </th>

                  <th>
                    ${c.lang==='ar'
                      ?'الحالة'
                      :'Status'}
                  </th>

                  <th></th>

                </tr>

              </thead>


              <tbody>

                ${invoices.map(invoice=>{

                  const p=
                    pm.get(invoice.patient_id)||{};

                  return `

                    <tr>

                      <td>

                        <strong>
                          ${c.escape(
                            invoice.invoice_number
                          )}
                        </strong>

                        <div class="subline">
                          ${c.formatDate(
                            invoice.created_at
                          )}
                        </div>

                      </td>

                      <td>

                        ${c.escape(
                          p.english_name||
                          p.arabic_name||
                          'Patient'
                        )}

                        <div class="subline">

                          ${c.escape(
                            p.medical_record_number||
                            ''
                          )}

                        </div>

                      </td>

                      <td>
                        ${c.formatMoney(
                          invoice.total_amount
                        )}
                      </td>

                      <td>
                        ${c.formatMoney(
                          invoice.paid_amount
                        )}
                      </td>

                      <td>
                        ${c.formatMoney(
                          invoice.balance_due
                        )}
                      </td>

                      <td>
                        ${c.statusPill(
                          invoice.status
                        )}
                      </td>

                      <td>

                        <button
                          class="table-action"
                          data-open-invoice="${invoice.id}"
                        >
                          ${c.lang==='ar'
                            ?'فتح'
                            :'Open'}
                        </button>

                      </td>

                    </tr>
                  `;

                }).join('')}

              </tbody>

            </table>

          </div>
        `

        : `

          <div class="empty-state">
            ${c.t('noData')}
          </div>
        `;


      area
        .querySelectorAll(
          '[data-open-invoice]'
        )
        .forEach(button=>{

          button.onclick=
            ()=>openInvoice(
              button.dataset.openInvoice
            );

        });
    }


    function showServices(){

      area.innerHTML=`

        <div class="section-head">

          <h3>

            ${c.lang==='ar'
              ?'قائمة الخدمات'
              :'Service price list'}

          </h3>

          ${c.isManagement()
            ? `

              <button
                id="addService"
                class="primary-button compact"
              >
                + ${c.lang==='ar'
                  ?'خدمة'
                  :'Service'}
              </button>

            `
            : ''
          }

        </div>


        ${services.length
          ? `

            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>

                    <th>
                      ${c.lang==='ar'
                        ?'الخدمة'
                        :'Service'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الفئة'
                        :'Category'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'السعر'
                        :'Price'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الحالة'
                        :'Status'}
                    </th>

                    ${c.isManagement()
                      ? '<th></th>'
                      : ''
                    }

                  </tr>

                </thead>


                <tbody>

                  ${services.map(service=>`

                    <tr>

                      <td>

                        <strong>
                          ${c.escape(
                            service.name_en
                          )}
                        </strong>

                        ${service.name_ar
                          ? `

                            <div class="subline">
                              ${c.escape(
                                service.name_ar
                              )}
                            </div>

                          `
                          : ''
                        }

                      </td>

                      <td>
                        ${c.escape(
                          service.category||
                          '—'
                        )}
                      </td>

                      <td>
                        ${c.formatMoney(
                          service.default_price
                        )}
                      </td>

                      <td>
                        ${c.statusPill(
                          service.is_active
                            ? 'active'
                            : 'inactive'
                        )}
                      </td>

                      ${c.isManagement()
                        ? `

                          <td>

                            <button
                              class="table-action"
                              data-edit-service="${service.id}"
                            >
                              ${c.lang==='ar'
                                ?'تعديل'
                                :'Edit'}
                            </button>

                          </td>

                        `
                        : ''
                      }

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>
          `

          : `

            <div class="empty-state">
              ${c.t('noData')}
            </div>
          `
        }
      `;


      if(c.isManagement()){

        document
          .getElementById('addService')
          ?.addEventListener(
            'click',
            ()=>serviceModal()
          );


        area
          .querySelectorAll(
            '[data-edit-service]'
          )
          .forEach(button=>{

            button.onclick=()=>serviceModal(
              services.find(
                x=>x.id===
                  button.dataset.editService
              )
            );

          });
      }
    }


    function showClosing(){

      area.innerHTML=`

        <div class="section-head">

          <h3>
            ${c.lang==='ar'
              ?'الإغلاق النقدي اليومي'
              :'Daily cash closing'}
          </h3>

          <button
            id="submitClosing"
            class="primary-button compact"
          >
            ${c.lang==='ar'
              ?'إرسال إغلاق'
              :'Submit closing'}
          </button>

        </div>


        ${closings.length
          ? `

            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>

                    <th>
                      ${c.lang==='ar'
                        ?'التاريخ'
                        :'Date'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'المتوقع'
                        :'Expected'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الفعلي'
                        :'Actual'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الفرق'
                        :'Difference'}
                    </th>

                    <th>
                      ${c.lang==='ar'
                        ?'الحالة'
                        :'Status'}
                    </th>

                    <th></th>

                  </tr>

                </thead>


                <tbody>

                  ${closings.map(x=>`

                    <tr>

                      <td>
                        ${c.formatDate(
                          x.closing_date
                        )}
                      </td>

                      <td>
                        ${c.formatMoney(
                          x.expected_cash
                        )}
                      </td>

                      <td>
                        ${c.formatMoney(
                          x.actual_cash
                        )}
                      </td>

                      <td class="${
                        Number(x.discrepancy)<0
                          ? 'text-danger'
                          : ''
                      }">
                        ${c.formatMoney(
                          x.discrepancy
                        )}
                      </td>

                      <td>
                        ${c.statusPill(
                          x.status
                        )}
                      </td>

                      <td>

                        ${c.isManagement() &&
                          x.status==='submitted'

                          ? `

                            <button
                              class="table-action success-outline"
                              data-close-review="${x.id}"
                              data-action="approve"
                            >
                              ✓
                            </button>

                            <button
                              class="table-action danger-outline"
                              data-close-review="${x.id}"
                              data-action="reject"
                            >
                              ✕
                            </button>

                          `

                          : ''
                        }

                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>
          `

          : `

            <div class="empty-state">
              ${c.t('noData')}
            </div>
          `
        }
      `;


      document
        .getElementById('submitClosing')
        ?.addEventListener(
          'click',
          submitClosingModal
        );


      area
        .querySelectorAll(
          '[data-close-review]'
        )
        .forEach(button=>{

          button.onclick=()=>reviewClosing(
            button.dataset.closeReview,
            button.dataset.action
          );

        });
    }


    document
      .querySelectorAll(
        '#financeTabs .tab'
      )
      .forEach(button=>{

        button.onclick=()=>{

          document
            .querySelectorAll(
              '#financeTabs .tab'
            )
            .forEach(
              x=>x.classList.remove(
                'active'
              )
            );

          button.classList.add(
            'active'
          );


          if(
            button.dataset.tab==='checked-in'
          ){
            showCheckedInCases();
          }

          if(
            button.dataset.tab==='income'
          ){
            showIncome();
          }

          if(
            button.dataset.tab==='logistics-expenses'
          ){
            showLogisticsExpenses();
          }

          if(
            button.dataset.tab==='invoices'
          ){
            showInvoices();
          }

          if(
            button.dataset.tab==='services'
          ){
            showServices();
          }

          if(
            button.dataset.tab==='closing'
          ){
            showClosing();
          }
        };

      });


    document
      .getElementById('newInvoice')
      .onclick=newInvoiceModal;


    document
      .getElementById('resetFinanceTest')
      ?.addEventListener(
        'click',
        async()=>{
          const phrase=prompt(
            c.lang==='ar'
              ?'هذا سيحذف كل معاملات المالية التجريبية: الدخل، الفواتير، المدفوعات، الإغلاق النقدي والمصروفات. قائمة أسعار الخدمات ستبقى. اكتب RESET FINANCE للمتابعة.'
              :'This deletes all test finance transactions: income, invoices, payments, cash closings and expenses. The service price list is preserved. Type RESET FINANCE to continue.'
          );

          if(phrase!=='RESET FINANCE'){
            return;
          }

          const {error}=await c.sb.rpc(
            'owner_reset_finance_test_data',
            {
              p_confirmation:
                phrase
            }
          );

          if(error){
            return c.toast(
              error.message,
              'error'
            );
          }

          c.toast(
            c.lang==='ar'
              ?'تمت إعادة ضبط البيانات المالية التجريبية.'
              :'Test finance data reset.'
          );

          c.route('finance');
        }
      );


    showCheckedInCases();
  }


  async function newInvoiceModal(){
    const c=C();

    const [
      {data:patients},
      {data:appointments}
    ]=await Promise.all([

      c.sb
        .from('patients')
        .select(
          'id,medical_record_number,english_name,arabic_name'
        )
        .eq('is_active',true)
        .order(
          'created_at',
          {ascending:false}
        )
        .limit(300),

      c.sb
        .from('appointments')
        .select(
          'id,appointment_number,patient_id,doctor_id,scheduled_start,status'
        )
        .order(
          'scheduled_start',
          {ascending:false}
        )
        .limit(200)
    ]);


    c.showModal({

      title:
        c.lang==='ar'
          ?'فاتورة جديدة'
          :'New invoice',

      body:`

        <form
          id="invoiceForm"
          class="form-grid"
        >

          <label class="full-span">

            ${c.lang==='ar'
              ?'المريض'
              :'Patient'}

            <select
              id="invPatient"
              class="control"
              required
            >

              <option value="">
                —
              </option>

              ${(patients||[]).map(p=>`

                <option value="${p.id}">

                  ${c.escape(
                    p.english_name||
                    p.arabic_name||
                    'Patient'
                  )}

                  •

                  ${c.escape(
                    p.medical_record_number||
                    ''
                  )}

                </option>

              `).join('')}

            </select>

          </label>


          <label class="full-span">

            ${c.lang==='ar'
              ?'الحجز (اختياري)'
              :'Appointment (optional)'}

            <select
              id="invAppointment"
              class="control"
            >
              <option value="">
                —
              </option>
            </select>

          </label>


          <label class="full-span">

            ${c.lang==='ar'
              ?'ملاحظات'
              :'Notes'}

            <textarea
              id="invNotes"
              class="control"
            ></textarea>

          </label>


          <div class="form-actions full-span">

            <button
              class="primary-button compact"
              type="submit"
            >
              ${c.lang==='ar'
                ?'إنشاء'
                :'Create'}
            </button>

          </div>

        </form>
      `,


      onOpen:(root)=>{

        const patientSelect=
          root.querySelector(
            '#invPatient'
          );

        const appointmentSelect=
          root.querySelector(
            '#invAppointment'
          );


        function loadAppointments(){

          appointmentSelect.innerHTML=

            '<option value="">—</option>'

            +

            (
              (appointments||[])

                .filter(
                  a=>
                    a.patient_id===
                    patientSelect.value
                )

                .map(a=>`

                  <option value="${a.id}">

                    ${c.formatDate(
                      a.scheduled_start,
                      {
                        hour:'2-digit',
                        minute:'2-digit'
                      }
                    )}

                    •

                    ${a.status}

                  </option>

                `)

                .join('')
            );
        }


        patientSelect.onchange=
          loadAppointments;


        root
          .querySelector('#invoiceForm')
          .onsubmit=async event=>{

            event.preventDefault();


            const {data,error}=
              await c.sb.rpc(
                'create_invoice',
                {
                  p_patient_id:
                    patientSelect.value,

                  p_appointment_id:
                    appointmentSelect.value||
                    null,

                  p_notes:
                    root
                      .querySelector('#invNotes')
                      .value||
                    null
                }
              );


            if(error){

              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();


            c.toast(
              c.lang==='ar'
                ?'تم إنشاء الفاتورة'
                :'Invoice created'
            );


            await c.route(
              'finance'
            );


            if(data?.id){

              setTimeout(
                ()=>openInvoice(
                  data.id
                ),
                100
              );
            }
          };
      }
    });
  }


  async function openInvoice(id){
    const c=C();

    const [
      {data:invoice,error},
      {data:items},
      {data:payments},
      {data:services}
    ]=await Promise.all([

      c.sb
        .from('invoices')
        .select('*')
        .eq('id',id)
        .single(),

      c.sb
        .from('invoice_items')
        .select('*')
        .eq('invoice_id',id)
        .order('created_at'),

      c.sb
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id',id)
        .order('received_at'),

      c.sb
        .from('clinic_services')
        .select('*')
        .eq('is_active',true)
        .order('name_en')
    ]);


    if(error){
      return c.toast(
        error.message,
        'error'
      );
    }


    const patientRows=
      await patientMap([
        invoice.patient_id
      ]);

    const p=
      patientRows.get(
        invoice.patient_id
      )||{};


    c.showModal({

      title:
        `${invoice.invoice_number} — ${
          c.escape(
            p.english_name||
            p.arabic_name||
            'Patient'
          )
        }`,

      wide:true,

      body:`

        <div class="invoice-total-grid">

          <div>
            <span>
              ${c.lang==='ar'
                ?'الإجمالي'
                :'Total'}
            </span>
            <strong>
              ${c.formatMoney(
                invoice.total_amount
              )}
            </strong>
          </div>

          <div>
            <span>
              ${c.lang==='ar'
                ?'المدفوع'
                :'Paid'}
            </span>
            <strong>
              ${c.formatMoney(
                invoice.paid_amount
              )}
            </strong>
          </div>

          <div>
            <span>
              ${c.lang==='ar'
                ?'المتبقي'
                :'Balance'}
            </span>
            <strong>
              ${c.formatMoney(
                invoice.balance_due
              )}
            </strong>
          </div>

          <div>
            <span>
              ${c.lang==='ar'
                ?'الحالة'
                :'Status'}
            </span>

            ${c.statusPill(
              invoice.status
            )}
          </div>

        </div>


        <div class="section-head space-top">

          <h3>
            ${c.lang==='ar'
              ?'البنود'
              :'Items'}
          </h3>

          ${invoice.status!=='voided'
            ? `

              <button
                id="invoiceAddItem"
                class="secondary-button"
              >
                + ${c.lang==='ar'
                  ?'بند'
                  :'Item'}
              </button>

            `
            : ''
          }

        </div>


        <div class="table-wrap">

          <table class="data-table">

            <thead>

              <tr>
                <th>
                  ${c.lang==='ar'
                    ?'البند'
                    :'Item'}
                </th>
                <th>Qty</th>
                <th>
                  ${c.lang==='ar'
                    ?'السعر'
                    :'Price'}
                </th>
                <th>
                  ${c.lang==='ar'
                    ?'الخصم'
                    :'Discount'}
                </th>
                <th>
                  ${c.lang==='ar'
                    ?'الإجمالي'
                    :'Total'}
                </th>
              </tr>

            </thead>


            <tbody>

              ${(items||[]).map(item=>`

                <tr>

                  <td>
                    ${c.escape(
                      item.item_name_en
                    )}
                  </td>

                  <td>
                    ${item.quantity}
                  </td>

                  <td>
                    ${c.formatMoney(
                      item.unit_price
                    )}
                  </td>

                  <td>
                    ${c.formatMoney(
                      item.discount_amount
                    )}
                  </td>

                  <td>
                    ${c.formatMoney(
                      item.line_total
                    )}
                  </td>

                </tr>

              `).join('')

              ||

              '<tr><td colspan="5">—</td></tr>'
              }

            </tbody>

          </table>

        </div>


        <div class="section-head space-top">

          <h3>
            ${c.lang==='ar'
              ?'المدفوعات'
              :'Payments'}
          </h3>

          ${
            invoice.status!=='voided'
            &&
            Number(invoice.balance_due)>0

            ? `

              <button
                id="invoiceAddPayment"
                class="primary-button compact"
              >
                + ${c.lang==='ar'
                  ?'دفعة'
                  :'Payment'}
              </button>

            `

            : ''
          }

        </div>


        <div class="table-wrap">

          <table class="data-table">

            <thead>

              <tr>

                <th>
                  ${c.lang==='ar'
                    ?'القيمة'
                    :'Amount'}
                </th>

                <th>
                  ${c.lang==='ar'
                    ?'الطريقة'
                    :'Method'}
                </th>

                <th>
                  ${c.lang==='ar'
                    ?'التاريخ'
                    :'Date'}
                </th>

                <th>
                  ${c.lang==='ar'
                    ?'الحالة'
                    :'Status'}
                </th>

              </tr>

            </thead>


            <tbody>

              ${(payments||[]).map(payment=>`

                <tr>

                  <td>
                    ${c.formatMoney(
                      payment.amount
                    )}
                  </td>

                  <td>
                    ${c.escape(
                      payment.payment_method
                    )}
                  </td>

                  <td>
                    ${c.formatDate(
                      payment.received_at,
                      {
                        hour:'2-digit',
                        minute:'2-digit'
                      }
                    )}
                  </td>

                  <td>
                    ${payment.is_voided
                      ? c.statusPill('voided')
                      : c.statusPill('paid')
                    }
                  </td>

                </tr>

              `).join('')

              ||

              '<tr><td colspan="4">—</td></tr>'
              }

            </tbody>

          </table>

        </div>


        ${
          c.isManagement()
          &&
          invoice.status!=='voided'

          ? `

            <div class="form-actions space-top">

              <button
                id="invoiceDiscount"
                class="secondary-button"
              >
                ${c.lang==='ar'
                  ?'خصم الفاتورة'
                  :'Invoice discount'}
              </button>

              <button
                id="invoiceVoid"
                class="danger-button"
              >
                ${c.lang==='ar'
                  ?'إلغاء الفاتورة'
                  :'Void invoice'}
              </button>

            </div>

          `

          : ''
        }
      `,


      onOpen:(root)=>{

        root
          .querySelector('#invoiceAddItem')
          ?.addEventListener(
            'click',
            ()=>addItemModal(
              invoice,
              services||[]
            )
          );


        root
          .querySelector('#invoiceAddPayment')
          ?.addEventListener(
            'click',
            ()=>paymentModal(
              invoice
            )
          );


        root
          .querySelector('#invoiceDiscount')
          ?.addEventListener(
            'click',
            async()=>{

              const val=prompt(
                c.lang==='ar'
                  ?'قيمة الخصم'
                  :'Discount amount',

                invoice.invoice_discount||0
              );

              if(val===null){
                return;
              }

              const {error}=await c.sb.rpc(
                'set_invoice_discount',
                {
                  p_invoice_id:
                    invoice.id,

                  p_discount:
                    Number(val)
                }
              );

              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }

              c.closeModal();
              c.toast('Updated');

              openInvoice(
                invoice.id
              );
            }
          );


        root
          .querySelector('#invoiceVoid')
          ?.addEventListener(
            'click',
            async()=>{

              const reason=prompt(
                c.lang==='ar'
                  ?'سبب الإلغاء'
                  :'Void reason'
              );

              if(!reason){
                return;
              }

              const {error}=await c.sb.rpc(
                'void_invoice',
                {
                  p_invoice_id:
                    invoice.id,

                  p_reason:
                    reason
                }
              );

              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }

              c.closeModal();
              c.toast('Updated');

              c.route(
                'finance'
              );
            }
          );
      }
    });
  }


  function addItemModal(
    invoice,
    services
  ){
    const c=C();

    c.showModal({

      title:
        c.lang==='ar'
          ?'إضافة بند'
          :'Add invoice item',

      body:`

        <form
          id="itemForm"
          class="form-grid"
        >

          <label class="full-span">

            ${c.lang==='ar'
              ?'الخدمة'
              :'Service'}

            <select
              id="itemService"
              class="control"
              required
            >

              ${services.map(service=>`

                <option value="${service.id}">

                  ${c.escape(
                    service.name_en
                  )}

                  —

                  ${c.formatMoney(
                    service.default_price
                  )}

                </option>

              `).join('')}

            </select>

          </label>


          <label>
            Qty

            <input
              id="itemQty"
              class="control"
              type="number"
              min="0.01"
              step="0.01"
              value="1"
            >
          </label>


          ${c.isManagement()
            ? `

              <label>

                ${c.lang==='ar'
                  ?'سعر بديل'
                  :'Override price'}

                <input
                  id="itemPrice"
                  class="control"
                  type="number"
                  min="0"
                  step="0.01"
                >

              </label>


              <label>

                ${c.lang==='ar'
                  ?'خصم'
                  :'Discount'}

                <input
                  id="itemDiscount"
                  class="control"
                  type="number"
                  min="0"
                  step="0.01"
                  value="0"
                >

              </label>

            `
            : ''
          }


          <div class="form-actions full-span">

            <button
              class="primary-button compact"
              type="submit"
            >
              ${c.lang==='ar'
                ?'إضافة'
                :'Add'}
            </button>

          </div>

        </form>
      `,


      onOpen:(root)=>{

        root
          .querySelector('#itemForm')
          .onsubmit=async event=>{

            event.preventDefault();


            const {error}=await c.sb.rpc(
              'add_invoice_item',
              {
                p_invoice_id:
                  invoice.id,

                p_service_id:
                  root
                    .querySelector('#itemService')
                    .value,

                p_quantity:
                  Number(
                    root
                      .querySelector('#itemQty')
                      .value||
                    1
                  ),

                p_override_price:
                  c.isManagement()
                  &&
                  root
                    .querySelector('#itemPrice')
                    ?.value

                    ? Number(
                        root
                          .querySelector('#itemPrice')
                          .value
                      )

                    : null,

                p_discount_amount:
                  c.isManagement()

                    ? Number(
                        root
                          .querySelector('#itemDiscount')
                          ?.value||
                        0
                      )

                    : 0
              }
            );


            if(error){

              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();

            c.toast('Added');

            openInvoice(
              invoice.id
            );
          };
      }
    });
  }


  function paymentModal(invoice){
    const c=C();

    c.showModal({

      title:
        c.lang==='ar'
          ?'تسجيل دفعة'
          :'Record payment',

      body:`

        <form
          id="payForm"
          class="form-grid"
        >

          <label>

            ${c.lang==='ar'
              ?'القيمة'
              :'Amount'}

            <input
              id="payAmount"
              class="control"
              type="number"
              min="0.01"
              step="0.01"
              max="${invoice.balance_due}"
              value="${invoice.balance_due}"
              required
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'الطريقة'
              :'Method'}

            <select
              id="payMethod"
              class="control"
            >
              <option value="cash">
                Cash
              </option>
              <option value="card">
                Card
              </option>
              <option value="instapay">
                InstaPay
              </option>
              <option value="bank_transfer">
                Bank transfer
              </option>
              <option value="other">
                Other
              </option>
            </select>

          </label>


          <label class="full-span">

            ${c.lang==='ar'
              ?'مرجع'
              :'Reference'}

            <input
              id="payRef"
              class="control"
            >

          </label>


          <label class="full-span">

            ${c.lang==='ar'
              ?'ملاحظات'
              :'Notes'}

            <textarea
              id="payNotes"
              class="control"
            ></textarea>

          </label>


          <div class="form-actions full-span">

            <button
              class="primary-button compact"
              type="submit"
            >
              ${c.lang==='ar'
                ?'حفظ'
                :'Save'}
            </button>

          </div>

        </form>
      `,


      onOpen:(root)=>{

        root
          .querySelector('#payForm')
          .onsubmit=async event=>{

            event.preventDefault();


            const {error}=await c.sb.rpc(
              'record_invoice_payment',
              {
                p_invoice_id:
                  invoice.id,

                p_amount:
                  Number(
                    root
                      .querySelector('#payAmount')
                      .value
                  ),

                p_method:
                  root
                    .querySelector('#payMethod')
                    .value,

                p_reference:
                  root
                    .querySelector('#payRef')
                    .value||
                  null,

                p_notes:
                  root
                    .querySelector('#payNotes')
                    .value||
                  null
              }
            );


            if(error){

              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();

            c.toast(
              c.lang==='ar'
                ?'تم تسجيل الدفعة'
                :'Payment recorded'
            );

            openInvoice(
              invoice.id
            );
          };
      }
    });
  }


  function serviceModal(service=null){
    const c=C();

    c.showModal({

      title:
        service
          ? (
              c.lang==='ar'
                ?'تعديل خدمة'
                :'Edit service'
            )
          : (
              c.lang==='ar'
                ?'خدمة جديدة'
                :'New service'
            ),

      body:`

        <form
          id="serviceForm"
          class="form-grid"
        >

          <label>

            ${c.lang==='ar'
              ?'الاسم بالإنجليزية'
              :'English name'}

            <input
              id="svcEn"
              class="control"
              value="${c.escape(
                service?.name_en||
                ''
              )}"
              required
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'الاسم بالعربية'
              :'Arabic name'}

            <input
              id="svcAr"
              class="control"
              value="${c.escape(
                service?.name_ar||
                ''
              )}"
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'الفئة'
              :'Category'}

            <input
              id="svcCat"
              class="control"
              value="${c.escape(
                service?.category||
                ''
              )}"
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'السعر'
              :'Price'}

            <input
              id="svcPrice"
              class="control"
              type="number"
              min="0"
              step="0.01"
              value="${service?.default_price||0}"
              required
            >

          </label>


          <label class="inline-check">

            <input
              id="svcActive"
              type="checkbox"
              ${
                service?.is_active===false
                  ? ''
                  : 'checked'
              }
            >

            ${c.lang==='ar'
              ?'نشط'
              :'Active'}

          </label>


          <div class="form-actions full-span">

            <button
              class="primary-button compact"
              type="submit"
            >
              ${c.lang==='ar'
                ?'حفظ'
                :'Save'}
            </button>

          </div>

        </form>
      `,


      onOpen:(root)=>{

        root
          .querySelector('#serviceForm')
          .onsubmit=async event=>{

            event.preventDefault();


            const {error}=await c.sb.rpc(
              'save_clinic_service',
              {
                p_service_id:
                  service?.id||
                  null,

                p_name_en:
                  root
                    .querySelector('#svcEn')
                    .value,

                p_name_ar:
                  root
                    .querySelector('#svcAr')
                    .value||
                  null,

                p_category:
                  root
                    .querySelector('#svcCat')
                    .value||
                  null,

                p_price:
                  Number(
                    root
                      .querySelector('#svcPrice')
                      .value
                  ),

                p_doctor_id:
                  service?.doctor_id||
                  null,

                p_is_active:
                  root
                    .querySelector('#svcActive')
                    .checked
              }
            );


            if(error){

              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();
            c.toast('Saved');
            c.route('finance');
          };
      }
    });
  }


  function submitClosingModal(){
    const c=C();
    const today=c.cairoDate();

    c.showModal({

      title:
        c.lang==='ar'
          ?'إغلاق نقدي'
          :'Cash closing',

      body:`

        <form
          id="closeForm"
          class="form-grid"
        >

          <label>

            ${c.lang==='ar'
              ?'التاريخ'
              :'Date'}

            <input
              id="closeDate"
              class="control"
              type="date"
              value="${today}"
              required
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'رصيد بداية اليوم'
              :'Opening cash'}

            <input
              id="openCash"
              class="control"
              type="number"
              min="0"
              step="0.01"
              value="0"
              required
            >

          </label>


          <label>

            ${c.lang==='ar'
              ?'النقد الفعلي'
              :'Actual cash'}

            <input
              id="actualCash"
              class="control"
              type="number"
              min="0"
              step="0.01"
              required
            >

          </label>


          <label class="full-span">

            ${c.lang==='ar'
              ?'ملاحظات'
              :'Notes'}

            <textarea
              id="closeNotes"
              class="control"
            ></textarea>

          </label>


          <div class="form-actions full-span">

            <button
              class="primary-button compact"
              type="submit"
            >
              ${c.lang==='ar'
                ?'إرسال'
                :'Submit'}
            </button>

          </div>

        </form>
      `,


      onOpen:(root)=>{

        root
          .querySelector('#closeForm')
          .onsubmit=async event=>{

            event.preventDefault();


            const {error}=await c.sb.rpc(
              'submit_cash_closing',
              {
                p_closing_date:
                  root
                    .querySelector('#closeDate')
                    .value,

                p_opening_cash:
                  Number(
                    root
                      .querySelector('#openCash')
                      .value
                  ),

                p_actual_cash:
                  Number(
                    root
                      .querySelector('#actualCash')
                      .value
                  ),

                p_notes:
                  root
                    .querySelector('#closeNotes')
                    .value||
                  null
              }
            );


            if(error){

              return c.toast(
                error.message,
                'error'
              );
            }


            c.closeModal();
            c.toast('Submitted');
            c.route('finance');
          };
      }
    });
  }


  async function reviewClosing(
    id,
    action
  ){
    const c=C();
    let note=null;

    if(action==='reject'){

      note=prompt(
        c.lang==='ar'
          ?'سبب الرفض'
          :'Rejection reason'
      );

      if(!note){
        return;
      }
    }


    const {error}=await c.sb.rpc(
      'review_cash_closing',
      {
        p_closing_id:id,
        p_action:action,
        p_note:note
      }
    );


    if(error){
      return c.toast(
        error.message,
        'error'
      );
    }


    c.toast('Updated');

    c.route(
      'finance'
    );
  }


  window.ClinicPages['finance']=
    renderFinance;

})();
