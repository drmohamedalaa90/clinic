(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  // =========================================================
  // HELPERS
  // =========================================================

  function esc(value){
    return C.escape(value ?? '');
  }


  function money(value){
    return C.formatMoney(
      Number(value || 0)
    );
  }


  function dateLabel(ymd){

    if(!ymd){
      return '—';
    }


    /*
     * Desired style:
     * Saturday, 15/08/2026
     * السبت 15/08/2026
     */
    return C.formatFullDate(
      `${ymd}T12:00:00+03:00`,
      true
    );
  }


  function routeState(){

    return (
      C.loadRouteState?.()
      ||
      {
        page:
          C.currentPage,

        params:{}
      }
    );
  }


  // =========================================================
  // 1) SECRETARY: REMOVE FINANCE, ADD DAILY CLINIC CLOSING
  // =========================================================

  C.labels.en.dailyClinicClose =
    "Close today's clinic account";

  C.labels.ar.dailyClinicClose =
    'تقفيل حساب عيادة اليوم';


  const oldBuildNavigation =
    C.buildNavigation.bind(C);


  C.buildNavigation =
    function(){

      oldBuildNavigation();


      const nav =
        document.getElementById(
          'navigation'
        );


      if(!nav){
        return;
      }


      if(
        C.hasRole(
          'secretary'
        )
        &&
        !C.isManagement()
      ){

        /*
         * Sara has NO Finance page.
         */
        nav
          .querySelector(
            '[data-page="finance"]'
          )
          ?.remove();


        if(
          !nav.querySelector(
            '[data-page="secretary-daily-close"]'
          )
        ){

          const holder =
            document.createElement(
              'div'
            );


          holder.innerHTML =
            C.navItem(
              '🧾',
              'dailyClinicClose',
              'secretary-daily-close'
            );


          const item =
            holder.firstElementChild;


          item?.addEventListener(
            'click',
            ()=>C.route(
              'secretary-daily-close'
            )
          );


          const attendance =
            nav.querySelector(
              '[data-page="attendance"]'
            );


          if(attendance){

            attendance.insertAdjacentElement(
              'afterend',
              item
            );

          }
          else{

            nav.appendChild(
              item
            );
          }
        }
      }
    };


  /*
   * Direct URL/page access guard too.
   */
  const oldFinancePage =
    window.ClinicPages?.finance;


  if(
    typeof oldFinancePage ===
    'function'
  ){

    window.ClinicPages.finance =
      async function(params={}){

        if(
          C.hasRole(
            'secretary'
          )
          &&
          !C.isManagement()
        ){

          return C.route(
            'secretary-daily-close'
          );
        }


        /*
         * Finance opens TODAY by default, never an old
         * locally remembered day.
         */
        const effectiveParams =
          Object.keys(
            params || {}
          ).length
            ? params
            : {
                periodMode:
                  'day',

                periodDate:
                  C.cairoDate()
              };


        const result =
          await oldFinancePage(
            effectiveParams
          );


        /*
         * Make the visible day explicit:
         * Saturday, DD/MM/YYYY etc.
         */
        const label =
          document.getElementById(
            'financePeriodLabel'
          );


        if(
          label
          &&
          (
            effectiveParams
              .periodMode
            ||
            'day'
          )
          ===
          'day'
        ){

          label.textContent =
            dateLabel(
              effectiveParams
                .periodDate
              ||
              C.cairoDate()
            );
        }


        await injectSavedClosings(
          document.getElementById(
            'mainContent'
          ),
          'finance'
        );


        return result;
      };
  }


  // =========================================================
  // 2) SECRETARY DAILY CLOSING PAGE
  // =========================================================

  async function getPreview(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v41_secretary_daily_close_preview'
      );


    if(error){
      throw error;
    }


    return data || {};
  }


  window.ClinicPages[
    'secretary-daily-close'
  ] =
    async function(){

      if(
        !C.hasRole(
          'secretary'
        )
        ||
        C.isManagement()
      ){

        return C.route(
          'dashboard'
        );
      }


      C.setTitle(
        C.lang==='ar'
          ? 'تقفيل حساب عيادة اليوم'
          : "Close today's clinic account"
      );


      const main =
        document.getElementById(
          'mainContent'
        );


      let data;


      try{

        data =
          await getPreview();

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(error.message)}
          </section>
        `;

        return;
      }


      const incomeRows =
        data.income_rows
        ||
        [];


      const expenseRows =
        data.expense_rows
        ||
        [];


      const invoiceRows =
        data.invoice_rows
        ||
        [];


      main.innerHTML = `
        <section class="page-toolbar">

          <div>
            <span class="eyebrow">
              DAILY CLINIC CLOSING
            </span>

            <h2>
              ${
                C.lang==='ar'
                  ? 'تقفيل حساب عيادة اليوم'
                  : "Close today's clinic account"
              }
            </h2>

            <p class="muted">
              <strong>
                ${dateLabel(
                  data.report_date
                  ||
                  C.cairoDate()
                )}
              </strong>
              •
              ${
                C.lang==='ar'
                  ? 'هذه الصفحة تعرض عيادة اليوم فقط.'
                  : "This page shows today's clinic only."
              }
            </p>
          </div>

        </section>


        ${
          data.already_closed
            ? `
              <section class="v41-closed-banner">
                ✓ ${
                    C.lang==='ar'
                      ? 'تم تقفيل حساب العيادة لهذا اليوم بالفعل.'
                      : "Today's clinic account is already closed."
                  }
              </section>
            `
            : ''
        }


        <section class="dashboard-grid v41-summary-grid">

          <article class="stat-card">
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'عدد الحالات'
                  : 'Cases'
              }
            </span>
            <strong>
              ${Number(
                data.case_count
                ||
                0
              )}
            </strong>
          </article>


          <article class="stat-card">
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'دخل اليوم'
                  : "Today's income"
              }
            </span>
            <strong>
              ${money(
                data.total_income
              )}
            </strong>
          </article>


          <article class="stat-card">
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'مصروفات اليوم'
                  : "Today's expenses"
              }
            </span>
            <strong>
              ${money(
                data.total_expenses
              )}
            </strong>
          </article>


          <article class="stat-card v41-net-card">
            <span class="stat-label">
              ${
                C.lang==='ar'
                  ? 'صافي الرصيد'
                  : 'Net balance'
              }
            </span>
            <strong>
              ${money(
                data.net_balance
              )}
            </strong>
          </article>

        </section>


        <section class="content-card">

          <div class="section-head">
            <div>
              <span class="eyebrow">
                INCOME PER CASE
              </span>

              <h3>
                ${
                  C.lang==='ar'
                    ? 'دخل اليوم - كل حالة'
                    : 'Today income - per case'
                }
              </h3>
            </div>
          </div>


          ${
            incomeRows.length
              ? `
                <div class="table-wrap">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>MRN</th>
                        <th>${
                          C.lang==='ar'
                            ? 'المريض'
                            : 'Patient'
                        }</th>
                        <th>${
                          C.lang==='ar'
                            ? 'الطبيب'
                            : 'Doctor'
                        }</th>
                        <th>${
                          C.lang==='ar'
                            ? 'النوع'
                            : 'Type'
                        }</th>
                        <th>${
                          C.lang==='ar'
                            ? 'الرسوم'
                            : 'Fee'
                        }</th>
                        <th>${
                          C.lang==='ar'
                            ? 'الدفع'
                            : 'Payment'
                        }</th>
                      </tr>
                    </thead>

                    <tbody>
                      ${incomeRows.map(
                        row=>`
                          <tr>
                            <td>
                              ${esc(
                                row.medical_record_number
                                ||
                                '—'
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
                            </td>

                            <td>
                              ${esc(
                                row.doctor_name
                                ||
                                'Doctor'
                              )}
                            </td>

                            <td>
                              ${esc(
                                row.appointment_type
                                ||
                                '—'
                              )}
                            </td>

                            <td>
                              ${money(
                                row.amount
                              )}
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
                      ? 'لا توجد رسوم مسجلة اليوم.'
                      : 'No patient income recorded today.'
                  }
                </div>
              `
          }

        </section>


        <section class="v41-two-col">

          <article class="content-card">

            <div class="section-head">
              <div>
                <span class="eyebrow">
                  EXPENSES
                </span>

                <h3>
                  ${
                    C.lang==='ar'
                      ? 'هل تم شراء أو دفع أي مصروف؟'
                      : 'Purchases / expenses today'
                  }
                </h3>
              </div>
            </div>


            ${
              expenseRows.length
                ? `
                  <div class="stack-list">
                    ${expenseRows.map(
                      row=>`
                        <article class="list-card">
                          <div>
                            <strong>
                              ${esc(
                                row.description
                                ||
                                row.expense_number
                                ||
                                'Expense'
                              )}
                            </strong>

                            <div class="subline">
                              ${esc(
                                row.payment_method
                                ||
                                '—'
                              )}

                              ${
                                row.entered_by_me
                                  ? ` • ${
                                      C.lang==='ar'
                                        ? 'تم إدخاله بواسطة سارة'
                                        : 'Entered by Sara'
                                    }`
                                  : ''
                              }
                            </div>
                          </div>

                          <strong>
                            ${money(
                              row.amount
                            )}
                          </strong>
                        </article>
                      `
                    ).join('')}
                  </div>
                `
                : `
                  <div class="empty-state">
                    ${
                      C.lang==='ar'
                        ? 'لا توجد مصروفات مسجلة اليوم.'
                        : 'No expenses recorded today.'
                    }
                  </div>
                `
            }

          </article>


          <article class="content-card">

            <div class="section-head">
              <div>
                <span class="eyebrow">
                  INVOICE PAYMENTS
                </span>

                <h3>
                  ${
                    C.lang==='ar'
                      ? 'دفعات الفواتير اليوم'
                      : 'Invoice payments today'
                  }
                </h3>
              </div>
            </div>


            ${
              invoiceRows.length
                ? `
                  <div class="stack-list">
                    ${invoiceRows.map(
                      row=>`
                        <article class="list-card">
                          <div>
                            <strong>
                              ${
                                C.lang==='ar'
                                  ? 'دفعة فاتورة'
                                  : 'Invoice payment'
                              }
                            </strong>

                            <div class="subline">
                              ${esc(
                                row.payment_method
                                ||
                                '—'
                              )}

                              ${
                                row.reference
                                  ? ` • ${esc(
                                      row.reference
                                    )}`
                                  : ''
                              }

                              ${
                                row.entered_by_me
                                  ? ` • ${
                                      C.lang==='ar'
                                        ? 'سجلتها سارة'
                                        : 'Recorded by Sara'
                                    }`
                                  : ''
                              }
                            </div>
                          </div>

                          <strong>
                            ${money(
                              row.amount
                            )}
                          </strong>
                        </article>
                      `
                    ).join('')}
                  </div>
                `
                : `
                  <div class="empty-state">
                    ${
                      C.lang==='ar'
                        ? 'لا توجد دفعات فواتير مسجلة اليوم.'
                        : 'No invoice payments recorded today.'
                    }
                  </div>
                `
            }

          </article>

        </section>


        <section class="v41-confirm-box">

          <div>
            <strong>
              ${
                C.lang==='ar'
                  ? 'تأكيد مالية اليوم'
                  : "Confirm today's finance"
              }
            </strong>

            <p>
              ${
                C.lang==='ar'
                  ? 'بالتأكيد سيتم حفظ تقرير اليوم في المالية والتقارير، وسيتم تسجيل انصرافك تلقائياً.'
                  : 'Confirmation saves today’s report to Finance and Reports and automatically checks you out.'
              }
            </p>
          </div>


          <button
            id="v41ConfirmClose"
            class="primary-button"
            type="button"
            ${data.already_closed ? 'disabled' : ''}
          >
            ${
              data.already_closed
                ? (
                    C.lang==='ar'
                      ? '✓ تم التقفيل'
                      : '✓ Already closed'
                  )
                : (
                    C.lang==='ar'
                      ? '✓ تأكيد مالية اليوم وتقفيل العيادة'
                      : "✓ Confirm finance & close today's clinic"
                  )
            }
          </button>

        </section>
      `;


      document
        .getElementById(
          'v41ConfirmClose'
        )
        ?.addEventListener(
          'click',
          async event=>{

            if(
              !confirm(
                C.lang==='ar'
                  ? 'تأكيد تقفيل حساب عيادة اليوم؟ سيتم تسجيل الانصراف تلقائياً.'
                  : "Confirm today's clinic account? You will be checked out automatically."
              )
            ){
              return;
            }


            const button =
              event.currentTarget;


            button.disabled =
              true;


            const {
              data:result,
              error
            } =
              await C.sb.rpc(
                'v41_secretary_confirm_daily_close'
              );


            if(error){

              button.disabled =
                false;


              return C.toast(
                error.message,
                'error'
              );
            }


            C.toast(
              C.lang==='ar'
                ? 'تم تقفيل حساب العيادة وحفظ التقرير وتسجيل الانصراف.'
                : 'Clinic account closed, report saved, and attendance checked out.'
            );


            C.route(
              'secretary-daily-close'
            );
          }
        );
    };


  // =========================================================
  // 3) SAVED REPORTS IN FINANCE + REPORTS
  // =========================================================

  async function loadSavedClosings(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v41_list_daily_clinic_reports',
        {
          p_limit:
            60
        }
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function exportReportPdf(
    report
  ){

    if(
      !window.html2canvas
      ||
      !window.jspdf
    ){

      return C.toast(
        C.lang==='ar'
          ? 'مكتبة PDF غير محملة.'
          : 'PDF library is not loaded.',
        'error'
      );
    }


    const snapshot =
      report.snapshot
      ||
      {};


    const node =
      document.createElement(
        'div'
      );


    node.className =
      'v41-pdf-sheet';


    node.innerHTML = `
      <div class="v41-pdf-title">
        <h1>
          Alaa Clinic
        </h1>
        <h2>
          Daily Clinic Financial Closing
        </h2>
        <strong>
          ${esc(
            dateLabel(
              report.report_date
            )
          )}
        </strong>
      </div>

      <div class="v41-pdf-summary">
        <div>
          <span>Cases</span>
          <b>${Number(
            report.case_count
            ||
            0
          )}</b>
        </div>

        <div>
          <span>Income</span>
          <b>${money(
            report.total_income
          )}</b>
        </div>

        <div>
          <span>Expenses</span>
          <b>${money(
            report.total_expenses
          )}</b>
        </div>

        <div>
          <span>Net</span>
          <b>${money(
            report.net_balance
          )}</b>
        </div>
      </div>

      <h3>Income per case</h3>

      <table>
        <thead>
          <tr>
            <th>MRN</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Fee</th>
            <th>Method</th>
          </tr>
        </thead>

        <tbody>
          ${(snapshot.income_rows || []).map(
            row=>`
              <tr>
                <td>${esc(
                  row.medical_record_number
                  ||
                  '—'
                )}</td>
                <td>${esc(
                  row.patient_name
                  ||
                  'Patient'
                )}</td>
                <td>${esc(
                  row.doctor_name
                  ||
                  'Doctor'
                )}</td>
                <td>${money(
                  row.amount
                )}</td>
                <td>${esc(
                  row.payment_method
                  ||
                  '—'
                )}</td>
              </tr>
            `
          ).join('')}
        </tbody>
      </table>

      <h3>Expenses</h3>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
            <th>Method</th>
          </tr>
        </thead>

        <tbody>
          ${(snapshot.expense_rows || []).map(
            row=>`
              <tr>
                <td>${esc(
                  row.description
                  ||
                  row.expense_number
                  ||
                  'Expense'
                )}</td>
                <td>${money(
                  row.amount
                )}</td>
                <td>${esc(
                  row.payment_method
                  ||
                  '—'
                )}</td>
              </tr>
            `
          ).join('')}
        </tbody>
      </table>

      <p class="v41-pdf-footer">
        Submitted by:
        ${esc(
          report.submitted_by_name
          ||
          'Secretary'
        )}
      </p>
    `;


    document.body.appendChild(
      node
    );


    try{

      const canvas =
        await html2canvas(
          node,
          {
            scale:
              2,

            backgroundColor:
              '#ffffff'
          }
        );


      const {
        jsPDF
      } =
        window.jspdf;


      const pdf =
        new jsPDF(
          'p',
          'mm',
          'a4'
        );


      const image =
        canvas.toDataURL(
          'image/png'
        );


      const width =
        190;


      const height =
        canvas.height
        *
        width
        /
        canvas.width;


      const pageHeight =
        277;


      let position =
        10;


      let remaining =
        height;


      pdf.addImage(
        image,
        'PNG',
        10,
        position,
        width,
        height
      );


      remaining -=
        pageHeight;


      while(
        remaining > 0
      ){

        position =
          remaining
          -
          height
          +
          10;


        pdf.addPage();


        pdf.addImage(
          image,
          'PNG',
          10,
          position,
          width,
          height
        );


        remaining -=
          pageHeight;
      }


      pdf.save(
        `Clinic_Finance_${
          report.report_date
        }.pdf`
      );

    }
    finally{

      node.remove();
    }
  }


  async function injectSavedClosings(
    host,
    source
  ){

    if(
      !host
      ||
      host.querySelector(
        '#v41SavedClosings'
      )
    ){
      return;
    }


    let rows;


    try{

      rows =
        await loadSavedClosings();

    }
    catch(error){

      console.warn(
        error
      );

      return;
    }


    const section =
      document.createElement(
        'section'
      );


    section.id =
      'v41SavedClosings';


    section.className =
      'content-card v41-saved-reports';


    section.innerHTML = `
      <div class="section-head">

        <div>
          <span class="eyebrow">
            DAILY CLOSING REPORTS
          </span>

          <h3>
            ${
              C.lang==='ar'
                ? 'تقارير تقفيل حساب العيادة'
                : 'Daily clinic closing reports'
            }
          </h3>

          <p class="muted">
            ${
              C.lang==='ar'
                ? 'تقارير معتمدة بعد تأكيد السكرتارية لمالية اليوم.'
                : 'Saved reports created after the secretary confirms the daily account.'
            }
          </p>
        </div>

      </div>


      ${
        rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>${
                      C.lang==='ar'
                        ? 'التاريخ'
                        : 'Date'
                    }</th>
                    <th>${
                      C.lang==='ar'
                        ? 'الحالات'
                        : 'Cases'
                    }</th>
                    <th>${
                      C.lang==='ar'
                        ? 'الدخل'
                        : 'Income'
                    }</th>
                    <th>${
                      C.lang==='ar'
                        ? 'المصروفات'
                        : 'Expenses'
                    }</th>
                    <th>${
                      C.lang==='ar'
                        ? 'الصافي'
                        : 'Net'
                    }</th>
                    <th>${
                      C.lang==='ar'
                        ? 'أغلق بواسطة'
                        : 'Closed by'
                    }</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  ${rows.map(
                    row=>`
                      <tr>
                        <td>
                          <strong>
                            ${esc(
                              dateLabel(
                                row.report_date
                              )
                            )}
                          </strong>
                        </td>

                        <td>
                          ${Number(
                            row.case_count
                            ||
                            0
                          )}
                        </td>

                        <td>
                          ${money(
                            row.total_income
                          )}
                        </td>

                        <td>
                          ${money(
                            row.total_expenses
                          )}
                        </td>

                        <td>
                          <strong>
                            ${money(
                              row.net_balance
                            )}
                          </strong>
                        </td>

                        <td>
                          ${esc(
                            row.submitted_by_name
                            ||
                            'Secretary'
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            class="table-action"
                            data-v41-export="${row.id}"
                          >
                            PDF
                          </button>
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
                  ? 'لا توجد تقارير تقفيل محفوظة بعد.'
                  : 'No saved daily closing reports yet.'
              }
            </div>
          `
      }
    `;


    host.appendChild(
      section
    );


    section
      .querySelectorAll(
        '[data-v41-export]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>{

              const report =
                rows.find(
                  row=>
                    row.id ===
                    button.dataset
                      .v41Export
                );


              if(report){

                exportReportPdf(
                  report
                );
              }
            };
        }
      );
  }


  const oldReports =
    window.ClinicPages?.reports;


  if(
    typeof oldReports ===
    'function'
  ){

    window.ClinicPages.reports =
      async function(params={}){

        const result =
          await oldReports(
            params
          );


        await injectSavedClosings(
          document.getElementById(
            'mainContent'
          ),
          'reports'
        );


        return result;
      };
  }


  // =========================================================
  // 4) LIVE CHAT EVERYWHERE + ENTER = SEND
  // =========================================================

  let chatRefreshTimer =
    null;


  async function refreshCurrentChat(){

    clearTimeout(
      chatRefreshTimer
    );


    chatRefreshTimer =
      setTimeout(
        async()=>{

          const state =
            routeState();


          const chatPages =
            new Set([
              'clinic-chat',
              'clinic-chat-thread',
              'clinic-team-chat'
            ]);


          if(
            !chatPages.has(
              state.page
            )
          ){
            return;
          }


          /*
           * Never destroy a message the user is currently typing.
           */
          const typed =
            [
              '#v36ThreadText',
              '#v37TeamText',
              '#v35ChatBody'
            ]
            .map(
              selector=>
                document.querySelector(
                  selector
                )
            )
            .find(
              input=>
                input
                &&
                input.value
                  .trim()
            );


          if(typed){
            return;
          }


          await C.route(
            state.page,
            state.params
            ||
            {}
          );

        },
        180
      );
  }


  function installRealtime(){

    if(
      window
        .__clinicV41ChatRealtime
    ){
      return;
    }


    window
      .__clinicV41ChatRealtime =
        C.sb
          .channel(
            `clinic-v41-chat-${
              C.user?.id
              ||
              'user'
            }`
          )

          .on(
            'postgres_changes',
            {
              event:'*',
              schema:'public',
              table:
                'clinic_chat_messages'
            },
            refreshCurrentChat
          )

          .on(
            'postgres_changes',
            {
              event:'*',
              schema:'public',
              table:
                'clinic_team_chat_messages'
            },
            refreshCurrentChat
          )

          .subscribe();
  }


  /*
   * Enter sends. Shift+Enter makes a new line.
   * Works for private + whole-team + V35 fallback composer.
   */
  document.addEventListener(
    'keydown',
    event=>{

      if(
        event.key !==
          'Enter'
        ||
        event.shiftKey
        ||
        event.isComposing
      ){
        return;
      }


      const target =
        event.target;


      if(
        !target?.matches?.(
          '#v36ThreadText, #v37TeamText, #v35ChatBody'
        )
      ){
        return;
      }


      event.preventDefault();


      const form =
        target.closest(
          'form'
        );


      form?.requestSubmit();
    }
  );


  /*
   * Install once Clinic has a user.
   */
  const wait =
    setInterval(
      ()=>{

        if(
          C.user?.id
        ){

          clearInterval(
            wait
          );


          installRealtime();
        }

      },
      300
    );


  // =========================================================
  // STYLES
  // =========================================================

  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .v41-summary-grid {
      grid-template-columns:
        repeat(
          4,
          minmax(0,1fr)
        ) !important;
    }

    .v41-net-card {
      border-color:
        #9fd7cb !important;
      background:
        #effaf7 !important;
    }

    .v41-two-col {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0,1fr)
        );
      gap: 14px;
      margin-top: 14px;
    }

    .v41-confirm-box {
      margin-top: 14px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid #9fd7cb;
      border-radius: 14px;
      background:
        linear-gradient(
          135deg,
          #eef9f6,
          #ffffff
        );
    }

    .v41-confirm-box p {
      margin: 5px 0 0;
      color: #68778a;
    }

    .v41-closed-banner {
      margin-bottom: 14px;
      padding: 12px 14px;
      border: 1px solid #a8ddcf;
      border-radius: 12px;
      background: #effaf7;
      color: #087260;
      font-weight: 900;
    }

    .v41-saved-reports {
      margin-top: 16px;
    }

    .v41-pdf-sheet {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 900px;
      padding: 42px;
      background: white;
      color: #10233c;
      font-family:
        Arial,
        Tahoma,
        sans-serif;
    }

    .v41-pdf-title {
      text-align: center;
      margin-bottom: 28px;
    }

    .v41-pdf-title h1,
    .v41-pdf-title h2 {
      margin: 0 0 7px;
    }

    .v41-pdf-summary {
      display: grid;
      grid-template-columns:
        repeat(
          4,
          1fr
        );
      gap: 10px;
      margin-bottom: 24px;
    }

    .v41-pdf-summary > div {
      padding: 12px;
      border: 1px solid #dde4ea;
      border-radius: 8px;
    }

    .v41-pdf-summary span,
    .v41-pdf-summary b {
      display: block;
    }

    .v41-pdf-sheet table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    .v41-pdf-sheet th,
    .v41-pdf-sheet td {
      padding: 8px;
      border: 1px solid #dce3e9;
      text-align: left;
    }

    .v41-pdf-footer {
      margin-top: 30px;
      color: #64748b;
    }

    @media (max-width: 800px) {

      .v41-summary-grid,
      .v41-two-col {
        grid-template-columns:
          1fr !important;
      }

      .v41-confirm-box {
        align-items: stretch;
        flex-direction: column;
      }

      .v41-confirm-box button {
        width: 100%;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();
