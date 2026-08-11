(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function esc(value){
    return C.escape(value ?? '');
  }


  function canEditSummary(){
    return (
      C.isDoctor?.()
      ||
      C.hasRole?.('owner')
    );
  }


  async function loadSummary(patientId){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v36_get_patient_summary',
        {
          p_patient:
            patientId
        }
      );


    if(error){
      throw error;
    }


    return (
      data
      ||
      {
        diagnosis:'',
        most_important_notes:''
      }
    );
  }


  async function saveSummary(
    patientId,
    diagnosis,
    importantNotes
  ){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v36_save_patient_summary',
        {
          p_patient:
            patientId,

          p_diagnosis:
            diagnosis,

          p_important_notes:
            importantNotes
        }
      );


    if(error){
      throw error;
    }


    return data;
  }


  async function injectSummaryCard(
    patientId
  ){

    if(
      !canEditSummary()
    ){
      return;
    }


    const body =
      document.getElementById(
        'patientTabBody'
      );


    const active =
      document.querySelector(
        '#patientTabs .tab.active'
      );


    if(
      !body
      ||
      active?.dataset?.tab !==
        'overview'
      ||
      body.querySelector(
        '#v36PatientSummaryCard'
      )
    ){
      return;
    }


    let summary;


    try{

      summary =
        await loadSummary(
          patientId
        );

    }
    catch(error){

      C.toast(
        error.message,
        'error'
      );

      return;
    }


    const editable =
      canEditSummary();


    const card =
      document.createElement(
        'section'
      );


    card.id =
      'v36PatientSummaryCard';


    card.className =
      'v36-patient-summary-card';


    card.innerHTML = `
      <div class="v36-summary-head">

        <div>
          <span class="eyebrow">
            ${
              C.lang==='ar'
                ? 'الملخص الطبي الدائم'
                : 'PERMANENT CLINICAL SUMMARY'
            }
          </span>

          <h3>
            ${
              C.lang==='ar'
                ? 'التشخيص وأهم الملاحظات'
                : 'Diagnosis & most important notes'
            }
          </h3>

          <small>
            ${
              C.lang==='ar'
                ? 'يبقى هذان القسمان في ملف المريض حتى بعد إغلاق الزيارة.'
                : 'These two sections remain in the patient record even after a consultation is closed.'
            }
          </small>
        </div>

        <span class="v36-retained-badge">
          ${
            C.lang==='ar'
              ? 'محفوظ دائماً'
              : 'Always retained'
          }
        </span>

      </div>


      <div class="v36-summary-grid">

        <label>
          <span>
            ${
              C.lang==='ar'
                ? 'التشخيص'
                : 'Diagnosis'
            }
          </span>

          <textarea
            id="v36PatientDiagnosis"
            class="control"
            rows="5"
            ${editable ? '' : 'disabled'}
          >${esc(
            summary.diagnosis
            ||
            ''
          )}</textarea>
        </label>


        <label>
          <span>
            ${
              C.lang==='ar'
                ? 'أهم الملاحظات'
                : 'Most important notes'
            }
          </span>

          <textarea
            id="v36PatientImportantNotes"
            class="control"
            rows="5"
            ${editable ? '' : 'disabled'}
          >${esc(
            summary.most_important_notes
            ||
            ''
          )}</textarea>
        </label>

      </div>


      ${
        editable
          ? `
            <div class="v36-summary-actions">

              <button
                id="v36SavePatientSummary"
                type="button"
                class="primary-button compact"
              >
                ${
                  C.lang==='ar'
                    ? 'حفظ الملخص'
                    : 'Save clinical summary'
                }
              </button>

              <small>
                ${
                  C.lang==='ar'
                    ? 'يمكن للطبيب أو المالك تعديل هذين القسمين في أي وقت.'
                    : 'Doctor or owner can revise these fields at any time.'
                }
              </small>

            </div>
          `
          : ''
      }
    `;


    body.insertAdjacentElement(
      'afterbegin',
      card
    );


    document
      .getElementById(
        'v36SavePatientSummary'
      )
      ?.addEventListener(
        'click',
        async()=>{

          try{

            await saveSummary(
              patientId,

              document
                .getElementById(
                  'v36PatientDiagnosis'
                )
                .value
                .trim(),

              document
                .getElementById(
                  'v36PatientImportantNotes'
                )
                .value
                .trim()
            );


            C.toast(
              C.lang==='ar'
                ? 'تم حفظ التشخيص وأهم الملاحظات.'
                : 'Diagnosis and most important notes saved.'
            );

          }
          catch(error){

            C.toast(
              error.message,
              'error'
            );
          }
        }
      );
  }


  /*
   * Wrap Patient Detail.
   */
  const oldPatientDetail =
    window.ClinicPages?.[
      'patient-detail'
    ];


  if(
    typeof oldPatientDetail ===
    'function'
  ){

    window.ClinicPages[
      'patient-detail'
    ] =
      async function(params={}){

        const result =
          await oldPatientDetail(
            params
          );


        const patientId =
          params.patientId;


        if(!patientId){
          return result;
        }


        await injectSummaryCard(
          patientId
        );


        /*
         * Overview is re-rendered when tabs change,
         * so inject again when the user returns to it.
         */
        document
          .querySelectorAll(
            '#patientTabs .tab'
          )
          .forEach(
            button=>{

              button.addEventListener(
                'click',
                ()=>{

                  setTimeout(
                    ()=>injectSummaryCard(
                      patientId
                    ),
                    0
                  );
                }
              );
            }
          );


        return result;
      };
  }


  // =========================================================
  // PREVIOUS PATIENTS - NEW V36 PAGE WITH 6 COLUMNS
  // =========================================================

  function normalizeHeader(value){

    return String(
      value ?? ''
    )
    .trim()
    .toLowerCase()
    .replace(/_/g,' ')
    .replace(/\s+/g,' ');
  }


  async function parseExcel(
    file
  ){

    if(!window.XLSX){

      throw new Error(
        'Excel library is not loaded.'
      );
    }


    const buffer =
      await file.arrayBuffer();


    const workbook =
      XLSX.read(
        buffer,
        {
          type:'array',
          cellDates:true
        }
      );


    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];


    const rows =
      XLSX.utils.sheet_to_json(
        sheet,
        {
          header:1,
          defval:'',
          raw:false
        }
      );


    if(!rows.length){

      throw new Error(
        'The Excel sheet is empty.'
      );
    }


    const headers =
      rows[0].map(
        normalizeHeader
      );


    const aliases = {

      name:[
        'name',
        'patient name',
        'الاسم',
        'اسم المريض'
      ],

      age:[
        'age',
        'age in years',
        'العمر',
        'العمر بالسنوات'
      ],

      whatsapp:[
        'whatsapp number',
        'whatsapp',
        'mobile',
        'phone',
        'رقم واتساب',
        'رقم الواتساب',
        'واتساب',
        'الموبايل'
      ],

      visit_dates:[
        'dates of visiting',
        'visit dates',
        'dates of visits',
        'previous visit dates',
        'تواريخ الزيارة',
        'تواريخ الزيارات'
      ],

      diagnosis:[
        'diagnosis',
        'diagnoses',
        'التشخيص',
        'التشخيصات'
      ],

      important_notes:[
        'most important notes',
        'important notes',
        'most important note',
        'أهم الملاحظات',
        'الملاحظات المهمة'
      ]
    };


    function col(
      key
    ){

      return headers.findIndex(
        header=>
          aliases[
            key
          ]
          .includes(
            header
          )
      );
    }


    const indexes = {
      name:
        col('name'),
      age:
        col('age'),
      whatsapp:
        col('whatsapp'),
      visit_dates:
        col('visit_dates'),
      diagnosis:
        col('diagnosis'),
      important_notes:
        col('important_notes')
    };


    for(
      const [
        key,
        index
      ]
      of Object.entries(
        indexes
      )
    ){

      if(index < 0){

        throw new Error(
          `Missing required Excel column: ${key}`
        );
      }
    }


    return rows
      .slice(1)
      .map(
        (row,index)=>({

          row_number:
            index+2,

          name:
            String(
              row[
                indexes.name
              ]
              ??
              ''
            ).trim(),

          age:
            String(
              row[
                indexes.age
              ]
              ??
              ''
            ).trim(),

          whatsapp:
            String(
              row[
                indexes.whatsapp
              ]
              ??
              ''
            ).trim(),

          visit_dates:
            String(
              row[
                indexes.visit_dates
              ]
              ??
              ''
            ).trim(),

          diagnosis:
            String(
              row[
                indexes.diagnosis
              ]
              ??
              ''
            ).trim(),

          important_notes:
            String(
              row[
                indexes.important_notes
              ]
              ??
              ''
            ).trim()
        })
      )
      .filter(
        row=>
          row.name
          ||
          row.whatsapp
      );
  }


  async function importOne(
    form
  ){

    const fd =
      new FormData(
        form
      );


    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v36_import_previous_patient',
        {
          p_name:
            String(
              fd.get('name')
              ||
              ''
            ).trim(),

          p_age:
            Number(
              fd.get('age')
              ||
              0
            ),

          p_whatsapp:
            String(
              fd.get('whatsapp')
              ||
              ''
            ).trim(),

          p_visit_dates:
            String(
              fd.get('visit_dates')
              ||
              ''
            ).trim(),

          p_diagnosis:
            String(
              fd.get('diagnosis')
              ||
              ''
            ).trim(),

          p_important_notes:
            String(
              fd.get('important_notes')
              ||
              ''
            ).trim()
        }
      );


    if(error){
      throw error;
    }


    return data;
  }


  async function importBulk(
    rows
  ){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v36_import_previous_patients_bulk',
        {
          p_rows:
            rows
        }
      );


    if(error){
      throw error;
    }


    return data;
  }


  window.ClinicPages[
    'previous-patients-import'
  ] =
    async function(){

      C.setTitle(
        C.lang==='ar'
          ? 'المرضى السابقون'
          : 'Previous patients'
      );


      document
        .getElementById(
          'mainContent'
        )
        .innerHTML = `
          <section class="page-toolbar">

            <div>
              <span class="eyebrow">
                PATIENT REGISTRY
              </span>

              <h2>
                ${
                  C.lang==='ar'
                    ? 'رفع المرضى السابقين'
                    : 'Upload previous patients'
                }
              </h2>

              <p class="muted">
                ${
                  C.lang==='ar'
                    ? 'إضافة فردية أو Excel، مع التشخيص وأهم الملاحظات لكل مريض.'
                    : 'Add individually or by Excel, including diagnosis and most important notes.'
                }
              </p>
            </div>

          </section>


          <section class="v36-import-grid">

            <article class="content-card">

              <div class="section-head">
                <div>
                  <span class="eyebrow">
                    ONE BY ONE
                  </span>

                  <h3>
                    ${
                      C.lang==='ar'
                        ? 'إضافة مريض واحد'
                        : 'Add one patient'
                    }
                  </h3>
                </div>
              </div>


              <form
                id="v36OnePatient"
                class="form-grid"
              >

                <label class="full-span">
                  ${
                    C.lang==='ar'
                      ? 'الاسم'
                      : 'Name'
                  }

                  <input
                    name="name"
                    class="control"
                    required
                  >
                </label>


                <label>
                  ${
                    C.lang==='ar'
                      ? 'العمر'
                      : 'Age'
                  }

                  <input
                    name="age"
                    class="control"
                    type="number"
                    min="0"
                    max="120"
                    required
                  >
                </label>


                <label>
                  ${
                    C.lang==='ar'
                      ? 'رقم واتساب'
                      : 'WhatsApp number'
                  }

                  <input
                    name="whatsapp"
                    class="control"
                    inputmode="tel"
                    placeholder="01xxxxxxxxx"
                    required
                  >
                </label>


                <label class="full-span">
                  ${
                    C.lang==='ar'
                      ? 'تواريخ الزيارة السابقة'
                      : 'Dates of visiting'
                  }

                  <input
                    name="visit_dates"
                    class="control"
                    placeholder="10/03/2024, 15/09/2025"
                    required
                  >
                </label>


                <label class="full-span">
                  ${
                    C.lang==='ar'
                      ? 'التشخيص'
                      : 'Diagnosis'
                  }

                  <textarea
                    name="diagnosis"
                    class="control"
                    rows="3"
                  ></textarea>
                </label>


                <label class="full-span">
                  ${
                    C.lang==='ar'
                      ? 'أهم الملاحظات'
                      : 'Most important notes'
                  }

                  <textarea
                    name="important_notes"
                    class="control"
                    rows="3"
                  ></textarea>
                </label>


                <div class="form-actions full-span">

                  <button
                    type="submit"
                    class="primary-button"
                  >
                    ${
                      C.lang==='ar'
                        ? '+ إضافة المريض'
                        : '+ Add patient'
                    }
                  </button>

                </div>

              </form>


              <div
                id="v36OneResult"
                class="v36-import-result hidden"
              ></div>

            </article>


            <article class="content-card">

              <div class="section-head">
                <div>
                  <span class="eyebrow">
                    EXCEL
                  </span>

                  <h3>
                    ${
                      C.lang==='ar'
                        ? 'رفع ملف Excel'
                        : 'Upload Excel sheet'
                    }
                  </h3>
                </div>
              </div>


              <div class="v36-excel-headings">

                <strong>
                  ${
                    C.lang==='ar'
                      ? 'العناوين الستة المطلوبة'
                      : 'Six required headings'
                  }
                </strong>

                <div>
                  <span>Name</span>
                  <span>Age</span>
                  <span>WhatsApp number</span>
                  <span>Dates of visiting</span>
                  <span>Diagnosis</span>
                  <span>Most important notes</span>
                </div>

              </div>


              <label class="v36-upload-box">

                <input
                  id="v36ExcelFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                >

                <b>📊</b>

                <strong>
                  ${
                    C.lang==='ar'
                      ? 'اختر ملف Excel'
                      : 'Choose Excel file'
                  }
                </strong>

                <small>
                  .xlsx / .xls / .csv
                </small>

              </label>


              <div
                id="v36Preview"
                class="hidden"
              ></div>


              <div class="form-actions">

                <button
                  id="v36ImportExcel"
                  type="button"
                  class="primary-button"
                  disabled
                >
                  ${
                    C.lang==='ar'
                      ? 'استيراد المرضى'
                      : 'Import patients'
                  }
                </button>

              </div>


              <div
                id="v36BulkResult"
                class="v36-import-result hidden"
              ></div>

            </article>

          </section>
        `;


      const oneForm =
        document.getElementById(
          'v36OnePatient'
        );


      const oneResult =
        document.getElementById(
          'v36OneResult'
        );


      oneForm.onsubmit =
        async event=>{

          event.preventDefault();


          try{

            const result =
              await importOne(
                oneForm
              );


            oneResult.className =
              'v36-import-result success';


            oneResult.innerHTML = `
              <strong>
                ${
                  result?.matched_existing
                    ? (
                        C.lang==='ar'
                          ? 'تم ربط البيانات بملف المريض الموجود.'
                          : 'Matched and updated the existing patient.'
                      )
                    : (
                        C.lang==='ar'
                          ? 'تم إنشاء المريض.'
                          : 'Patient created.'
                      )
                }
              </strong>

              <span>
                MRN:
                <b>
                  ${esc(
                    result
                      ?.medical_record_number
                    ||
                    ''
                  )}
                </b>
              </span>
            `;


            oneForm.reset();

          }
          catch(error){

            oneResult.className =
              'v36-import-result error';


            oneResult.textContent =
              error.message;
          }
        };


      const fileInput =
        document.getElementById(
          'v36ExcelFile'
        );


      const preview =
        document.getElementById(
          'v36Preview'
        );


      const importButton =
        document.getElementById(
          'v36ImportExcel'
        );


      const bulkResult =
        document.getElementById(
          'v36BulkResult'
        );


      let rows =
        [];


      fileInput.onchange =
        async()=>{

          rows =
            [];


          importButton.disabled =
            true;


          const file =
            fileInput.files?.[0];


          if(!file){
            return;
          }


          try{

            rows =
              await parseExcel(
                file
              );


            preview.classList.remove(
              'hidden'
            );


            preview.innerHTML = `
              <div class="v36-preview-head">
                <strong>
                  ${
                    C.lang==='ar'
                      ? 'معاينة'
                      : 'Preview'
                  }
                </strong>

                <span>
                  ${rows.length}
                  ${
                    C.lang==='ar'
                      ? ' مريض'
                      : ' patients'
                  }
                </span>
              </div>

              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Age</th>
                      <th>WhatsApp</th>
                      <th>Dates</th>
                      <th>Diagnosis</th>
                      <th>Most important notes</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${rows.slice(0,10).map(
                      row=>`
                        <tr>
                          <td>${esc(row.name)}</td>
                          <td>${esc(row.age)}</td>
                          <td>${esc(row.whatsapp)}</td>
                          <td>${esc(row.visit_dates)}</td>
                          <td>${esc(row.diagnosis)}</td>
                          <td>${esc(row.important_notes)}</td>
                        </tr>
                      `
                    ).join('')}
                  </tbody>
                </table>
              </div>
            `;


            importButton.disabled =
              !rows.length;

          }
          catch(error){

            preview.classList.remove(
              'hidden'
            );


            preview.innerHTML = `
              <div class="v36-import-result error">
                ${esc(
                  error.message
                )}
              </div>
            `;
          }
        };


      importButton.onclick =
        async()=>{

          if(!rows.length){
            return;
          }


          importButton.disabled =
            true;


          try{

            const result =
              await importBulk(
                rows
              );


            bulkResult.className =
              'v36-import-result success';


            bulkResult.innerHTML = `
              <strong>
                ${
                  C.lang==='ar'
                    ? 'تم الاستيراد.'
                    : 'Import completed.'
                }
              </strong>

              <span>
                ${
                  C.lang==='ar'
                    ? 'جدد:'
                    : 'New:'
                }
                ${Number(
                  result?.inserted
                  ||
                  0
                )}
              </span>

              <span>
                ${
                  C.lang==='ar'
                    ? 'ملفات موجودة:'
                    : 'Matched:'
                }
                ${Number(
                  result?.matched
                  ||
                  0
                )}
              </span>

              <span>
                ${
                  C.lang==='ar'
                    ? 'أخطاء:'
                    : 'Errors:'
                }
                ${Number(
                  result?.errors
                  ||
                  0
                )}
              </span>
            `;


            rows =
              [];


            fileInput.value =
              '';


            preview.classList.add(
              'hidden'
            );

          }
          catch(error){

            bulkResult.className =
              'v36-import-result error';


            bulkResult.textContent =
              error.message;

          }
          finally{

            importButton.disabled =
              !rows.length;
          }
        };
    };


  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .v36-patient-summary-card {
      margin-bottom: 16px;
      padding: 15px;
      border: 1px solid #aad8cd;
      border-radius: 14px;
      background:
        linear-gradient(
          135deg,
          #f1faf7,
          #ffffff
        );
    }

    .v36-summary-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .v36-summary-head h3 {
      margin: 3px 0 4px;
    }

    .v36-summary-head small {
      color: #6b7b8c;
    }

    .v36-retained-badge {
      flex: 0 0 auto;
      padding: 6px 9px;
      border-radius: 999px;
      background: #0f8b78;
      color: white;
      font-size: 9px;
      font-weight: 900;
    }

    .v36-summary-grid {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0,1fr)
        );
      gap: 10px;
    }

    .v36-summary-grid label {
      display: grid;
      gap: 5px;
      font-weight: 800;
    }

    .v36-summary-actions {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .v36-summary-actions small {
      color: #738095;
    }

    .v36-import-grid {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0,1fr)
        );
      gap: 14px;
    }

    .v36-excel-headings {
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid #cce2dc;
      border-radius: 12px;
      background: #f6fbfa;
    }

    .v36-excel-headings > div {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .v36-excel-headings span {
      padding: 5px 8px;
      border: 1px solid #d8e4e0;
      border-radius: 999px;
      background: white;
      font-size: 9px;
      font-weight: 800;
    }

    .v36-upload-box {
      min-height: 155px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 6px;
      border: 2px dashed #add3ca;
      border-radius: 14px;
      cursor: pointer;
      background: #fcfefd;
    }

    .v36-upload-box input {
      display: none;
    }

    .v36-upload-box b {
      font-size: 30px;
    }

    .v36-preview-head {
      display: flex;
      justify-content: space-between;
      margin: 12px 0 7px;
    }

    .v36-import-result {
      display: grid;
      gap: 4px;
      margin-top: 10px;
      padding: 10px;
      border-radius: 10px;
      font-size: 10px;
    }

    .v36-import-result.hidden,
    #v36Preview.hidden {
      display: none;
    }

    .v36-import-result.success {
      border: 1px solid #b9e0d6;
      background: #eff9f6;
      color: #087260;
    }

    .v36-import-result.error {
      border: 1px solid #f0b5b5;
      background: #fff5f5;
      color: #b42318;
    }

    @media (max-width: 820px) {

      .v36-summary-grid,
      .v36-import-grid {
        grid-template-columns: 1fr;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();
