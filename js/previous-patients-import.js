(() => {

  const C = window.Clinic;

  if (!C) {
    console.error('Clinic V34: Clinic core was not found.');
    return;
  }

  C.labels.en.previousPatients = 'Previous patients';
  C.labels.ar.previousPatients = 'المرضى السابقون';

  const originalBuildNavigation = C.buildNavigation.bind(C);

  C.buildNavigation = function () {
    originalBuildNavigation();

    const nav = document.getElementById('navigation');

    if (
      !nav ||
      nav.querySelector('[data-page="previous-patients-import"]')
    ) {
      return;
    }

    const holder = document.createElement('div');

    holder.innerHTML = C.navItem(
      '📥',
      'previousPatients',
      'previous-patients-import'
    );

    const item = holder.firstElementChild;

    item?.addEventListener(
      'click',
      () => C.route('previous-patients-import')
    );

    const patientsItem =
      nav.querySelector('[data-page="patients"]');

    if (patientsItem) {
      patientsItem.insertAdjacentElement(
        'afterend',
        item
      );
    } else {
      nav.appendChild(item);
    }
  };


  function esc(value) {
    return C.escape(value ?? '');
  }


  function normalizeHeader(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
  }


  function splitVisitDates(value) {
    return String(value ?? '')
      .split(/[;,|]/)
      .map(x => x.trim())
      .filter(Boolean);
  }


  async function parseWorkbook(file) {

    if (!window.XLSX) {
      throw new Error(
        'Excel library is not loaded. Add the XLSX script in app.html.'
      );
    }

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(
      buffer,
      {
        type: 'array',
        cellDates: true
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
          header: 1,
          defval: '',
          raw: false
        }
      );

    if (!rows.length) {
      throw new Error('The Excel sheet is empty.');
    }

    const headers =
      rows[0].map(normalizeHeader);

    const aliases = {
      name: [
        'name',
        'patient name',
        'الاسم',
        'اسم المريض'
      ],

      age: [
        'age',
        'age in years',
        'العمر',
        'العمر بالسنوات'
      ],

      whatsapp: [
        'whatsapp number',
        'whatsapp',
        'mobile',
        'phone',
        'رقم واتساب',
        'رقم الواتساب',
        'واتساب',
        'الموبايل'
      ],

      visit_dates: [
        'dates of visiting',
        'visit dates',
        'dates of visits',
        'previous visit dates',
        'تواريخ الزيارة',
        'تواريخ الزيارات'
      ]
    };


    function findColumn(key) {
      return headers.findIndex(
        header =>
          aliases[key].includes(header)
      );
    }


    const indexes = {
      name: findColumn('name'),
      age: findColumn('age'),
      whatsapp: findColumn('whatsapp'),
      visit_dates: findColumn('visit_dates')
    };


    for (const [key, index] of Object.entries(indexes)) {
      if (index < 0) {
        throw new Error(
          `Missing required Excel column: ${key}`
        );
      }
    }


    return rows
      .slice(1)
      .map((row, i) => ({
        row_number: i + 2,
        name:
          String(
            row[indexes.name] ?? ''
          ).trim(),

        age:
          String(
            row[indexes.age] ?? ''
          ).trim(),

        whatsapp:
          String(
            row[indexes.whatsapp] ?? ''
          ).trim(),

        visit_dates:
          String(
            row[indexes.visit_dates] ?? ''
          ).trim()
      }))
      .filter(
        row =>
          row.name ||
          row.age ||
          row.whatsapp ||
          row.visit_dates
      );
  }


  async function addOne(form) {

    const fd = new FormData(form);

    const { data, error } =
      await C.sb.rpc(
        'v34_import_previous_patient',
        {
          p_name:
            String(
              fd.get('name') || ''
            ).trim(),

          p_age:
            Number(
              fd.get('age') || 0
            ),

          p_whatsapp:
            String(
              fd.get('whatsapp') || ''
            ).trim(),

          p_visit_dates:
            String(
              fd.get('visit_dates') || ''
            ).trim()
        }
      );

    if (error) {
      throw error;
    }

    return data;
  }


  async function addBulk(rows) {

    const { data, error } =
      await C.sb.rpc(
        'v34_import_previous_patients_bulk',
        {
          p_rows: rows
        }
      );

    if (error) {
      throw error;
    }

    return data;
  }


  window.ClinicPages[
    'previous-patients-import'
  ] =
    async function () {

      C.setTitle(
        C.lang === 'ar'
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
                  C.lang === 'ar'
                    ? 'رفع المرضى السابقين'
                    : 'Upload previous patients'
                }
              </h2>

              <p class="muted">
                ${
                  C.lang === 'ar'
                    ? 'متاح لكل فريق العيادة. أضف مريضاً واحداً بسهولة أو ارفع ملف Excel كاملاً. كل مريض جديد يحصل على رقم ملف فريد تلقائياً.'
                    : 'Available to the whole clinic team. Add one patient easily or import a complete Excel sheet. Every new patient receives a unique MRN automatically.'
                }
              </p>
            </div>

          </section>


          <section class="v34-grid">

            <article class="content-card">

              <div class="section-head">
                <div>
                  <span class="eyebrow">
                    ONE BY ONE
                  </span>

                  <h3>
                    ${
                      C.lang === 'ar'
                        ? 'إضافة مريض واحد'
                        : 'Add one patient'
                    }
                  </h3>
                </div>
              </div>


              <form
                id="v34OnePatient"
                class="form-grid"
              >

                <label class="full-span">
                  ${
                    C.lang === 'ar'
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
                    C.lang === 'ar'
                      ? 'العمر بالسنوات'
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

                  <small>
                    ${
                      C.lang === 'ar'
                        ? 'سيتم حفظ سنة الميلاد داخلياً حتى يتحدث العمر تلقائياً كل سنة.'
                        : 'Birth year is stored internally so age updates automatically each year.'
                    }
                  </small>
                </label>


                <label>
                  ${
                    C.lang === 'ar'
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
                    C.lang === 'ar'
                      ? 'تواريخ الزيارة السابقة'
                      : 'Dates of visiting'
                  }

                  <input
                    name="visit_dates"
                    class="control"
                    placeholder="${
                      C.lang === 'ar'
                        ? 'مثال: 10/03/2024, 15/09/2025'
                        : 'Example: 10/03/2024, 15/09/2025'
                    }"
                    required
                  >

                  <small>
                    ${
                      C.lang === 'ar'
                        ? 'لأكثر من زيارة افصل التواريخ بفاصلة.'
                        : 'Separate multiple visit dates with commas.'
                    }
                  </small>
                </label>


                <div class="form-actions full-span">
                  <button
                    type="submit"
                    class="primary-button"
                  >
                    ${
                      C.lang === 'ar'
                        ? '+ إضافة المريض'
                        : '+ Add patient'
                    }
                  </button>
                </div>

              </form>


              <div
                id="v34OneResult"
                class="v34-result hidden"
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
                      C.lang === 'ar'
                        ? 'رفع ملف Excel'
                        : 'Upload Excel sheet'
                    }
                  </h3>
                </div>
              </div>


              <div class="v34-headings-box">

                <strong>
                  ${
                    C.lang === 'ar'
                      ? 'العناوين المطلوبة في أول صف'
                      : 'Required headings in row 1'
                  }
                </strong>

                <div class="v34-heading-pills">
                  <span>Name</span>
                  <span>Age</span>
                  <span>WhatsApp number</span>
                  <span>Dates of visiting</span>
                </div>

                <small>
                  ${
                    C.lang === 'ar'
                      ? 'يمكن استخدام العناوين العربية المكافئة أيضاً.'
                      : 'Equivalent Arabic headings are accepted too.'
                  }
                </small>

              </div>


              <label class="v34-upload">

                <input
                  id="v34ExcelFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                >

                <span>📊</span>

                <strong>
                  ${
                    C.lang === 'ar'
                      ? 'اختر ملف Excel'
                      : 'Choose Excel file'
                  }
                </strong>

                <small>
                  .xlsx / .xls / .csv
                </small>

              </label>


              <div
                id="v34Preview"
                class="hidden"
              ></div>


              <div class="form-actions">
                <button
                  id="v34ImportButton"
                  type="button"
                  class="primary-button"
                  disabled
                >
                  ${
                    C.lang === 'ar'
                      ? 'استيراد المرضى'
                      : 'Import patients'
                  }
                </button>
              </div>


              <div
                id="v34BulkResult"
                class="v34-result hidden"
              ></div>

            </article>

          </section>
        `;


      const oneForm =
        document.getElementById(
          'v34OnePatient'
        );

      const oneResult =
        document.getElementById(
          'v34OneResult'
        );


      oneForm.onsubmit =
        async event => {

          event.preventDefault();

          oneResult.className =
            'v34-result';

          oneResult.textContent =
            C.lang === 'ar'
              ? 'جارٍ الحفظ...'
              : 'Saving...';

          try {

            const result =
              await addOne(
                oneForm
              );

            oneResult.className =
              'v34-result success';

            oneResult.innerHTML = `
              <strong>
                ${
                  result?.matched_existing
                    ? (
                        C.lang === 'ar'
                          ? 'تم العثور على ملف موجود وربط الزيارات به.'
                          : 'Existing patient found; visits were linked to the same record.'
                      )
                    : (
                        C.lang === 'ar'
                          ? 'تم إنشاء المريض بنجاح.'
                          : 'Patient created successfully.'
                      )
                }
              </strong>

              <span>
                ${
                  C.lang === 'ar'
                    ? 'رقم الملف الفريد:'
                    : 'Unique MRN:'
                }
                <b>
                  ${esc(
                    result?.medical_record_number || ''
                  )}
                </b>
              </span>
            `;

            oneForm.reset();

          }
          catch (error) {

            oneResult.className =
              'v34-result error';

            oneResult.textContent =
              error.message;
          }
        };


      const fileInput =
        document.getElementById(
          'v34ExcelFile'
        );

      const preview =
        document.getElementById(
          'v34Preview'
        );

      const importButton =
        document.getElementById(
          'v34ImportButton'
        );

      const bulkResult =
        document.getElementById(
          'v34BulkResult'
        );

      let parsedRows = [];


      fileInput.onchange =
        async () => {

          parsedRows = [];
          importButton.disabled = true;
          preview.classList.add('hidden');

          const file =
            fileInput.files?.[0];

          if (!file) {
            return;
          }

          try {

            parsedRows =
              await parseWorkbook(
                file
              );

            preview.classList.remove(
              'hidden'
            );

            preview.innerHTML = `
              <div class="v34-preview-title">
                <strong>
                  ${
                    C.lang === 'ar'
                      ? 'معاينة قبل الاستيراد'
                      : 'Preview before import'
                  }
                </strong>

                <span>
                  ${parsedRows.length}
                  ${
                    C.lang === 'ar'
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
                      <th>WhatsApp number</th>
                      <th>Dates of visiting</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${parsedRows
                      .slice(0, 10)
                      .map(
                        row => `
                          <tr>
                            <td>${esc(row.name)}</td>
                            <td>${esc(row.age)}</td>
                            <td>${esc(row.whatsapp)}</td>
                            <td>${esc(row.visit_dates)}</td>
                          </tr>
                        `
                      )
                      .join('')
                    }
                  </tbody>
                </table>
              </div>

              ${
                parsedRows.length > 10
                  ? `
                    <small>
                      ${
                        C.lang === 'ar'
                          ? 'المعاينة تعرض أول 10 صفوف فقط.'
                          : 'Preview shows the first 10 rows only.'
                      }
                    </small>
                  `
                  : ''
              }
            `;

            importButton.disabled =
              !parsedRows.length;

          }
          catch (error) {

            preview.classList.remove(
              'hidden'
            );

            preview.innerHTML = `
              <div class="v34-result error">
                ${esc(error.message)}
              </div>
            `;
          }
        };


      importButton.onclick =
        async () => {

          if (!parsedRows.length) {
            return;
          }

          importButton.disabled = true;

          bulkResult.className =
            'v34-result';

          bulkResult.textContent =
            C.lang === 'ar'
              ? 'جارٍ استيراد المرضى...'
              : 'Importing patients...';

          try {

            const result =
              await addBulk(
                parsedRows
              );

            bulkResult.className =
              'v34-result success';

            bulkResult.innerHTML = `
              <strong>
                ${
                  C.lang === 'ar'
                    ? 'اكتمل الاستيراد'
                    : 'Import complete'
                }
              </strong>

              <span>
                ${
                  C.lang === 'ar'
                    ? 'مرضى جدد:'
                    : 'New patients:'
                }
                ${Number(result?.inserted || 0)}
              </span>

              <span>
                ${
                  C.lang === 'ar'
                    ? 'ملفات موجودة تم ربط الزيارات بها:'
                    : 'Existing patient records matched:'
                }
                ${Number(result?.matched || 0)}
              </span>

              <span>
                ${
                  C.lang === 'ar'
                    ? 'صفوف بها أخطاء:'
                    : 'Rows with errors:'
                }
                ${Number(result?.errors || 0)}
              </span>

              ${
                result?.error_rows?.length
                  ? `
                    <details>
                      <summary>
                        ${
                          C.lang === 'ar'
                            ? 'عرض الصفوف التي بها أخطاء'
                            : 'Show import errors'
                        }
                      </summary>

                      <div class="v34-error-list">
                        ${result.error_rows
                          .map(
                            row => `
                              <div>
                                Row ${esc(row.row_number)} —
                                ${esc(row.name)}:
                                ${esc(row.error)}
                              </div>
                            `
                          )
                          .join('')
                        }
                      </div>
                    </details>
                  `
                  : ''
              }
            `;

            parsedRows = [];
            fileInput.value = '';
            preview.classList.add(
              'hidden'
            );

          }
          catch (error) {

            bulkResult.className =
              'v34-result error';

            bulkResult.textContent =
              error.message;

          }
          finally {

            importButton.disabled =
              !parsedRows.length;
          }
        };
    };


  const style =
    document.createElement(
      'style'
    );

  style.textContent = `
    .v34-grid {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
      gap: 14px;
    }

    .v34-headings-box {
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid #c9e3dc;
      border-radius: 12px;
      background: #f5fcfa;
    }

    .v34-heading-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }

    .v34-heading-pills span {
      padding: 5px 8px;
      border: 1px solid #d9e5e2;
      border-radius: 999px;
      background: #fff;
      font-size: 10px;
      font-weight: 800;
    }

    .v34-upload {
      min-height: 165px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 6px;
      border: 2px dashed #abd5cb;
      border-radius: 14px;
      background: #fbfefd;
      text-align: center;
      cursor: pointer;
    }

    .v34-upload input {
      display: none;
    }

    .v34-upload > span {
      font-size: 32px;
    }

    .v34-result {
      display: grid;
      gap: 4px;
      margin-top: 12px;
      padding: 11px;
      border-radius: 11px;
      font-size: 11px;
    }

    .v34-result.hidden,
    #v34Preview.hidden {
      display: none;
    }

    .v34-result.success {
      border: 1px solid #b5e3d6;
      background: #f0faf7;
      color: #087260;
    }

    .v34-result.error {
      border: 1px solid #efb4b4;
      background: #fff5f5;
      color: #b42318;
    }

    .v34-preview-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 13px 0 8px;
    }

    .v34-error-list {
      display: grid;
      gap: 5px;
      margin-top: 8px;
    }

    @media (max-width: 860px) {
      .v34-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);

})();
