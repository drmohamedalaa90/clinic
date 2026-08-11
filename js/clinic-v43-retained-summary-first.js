(() => {

  /*
   * CLINIC V43
   * CLINICAL VISIT — RETAINED SUMMARY FIRST
   *
   * When a doctor opens a patient from My Queue:
   * - Diagnosis
   * - Most important notes
   *
   * are moved to the VERY TOP of the consultation page,
   * inside a prominent permanent-summary frame.
   *
   * The rest of the clinical form stays below and is treated
   * as temporary/non-retained detail for the editable PDF workflow.
   *
   * This patch intentionally REUSES the existing fields created
   * by V35, so it does not create duplicate diagnosis/notes fields.
   */

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function languageIsArabic(){

    return (
      C.lang === 'ar'
      ||
      document.documentElement.dir ===
        'rtl'
    );
  }


  function findDiagnosisField(){

    const textarea =
      document.querySelector(
        '#clinicalForm textarea[name="diagnosis_summary"]'
      );


    if(!textarea){
      return null;
    }


    return (
      textarea.closest(
        '.clinical-field'
      )
      ||
      textarea.parentElement
    );
  }


  function findImportantField(){

    const textarea =
      document.getElementById(
        'v35MostImportantNotes'
      );


    if(!textarea){
      return null;
    }


    return (
      textarea.closest(
        '.clinical-field'
      )
      ||
      textarea.parentElement
    );
  }


  function findClinicalForm(){

    return document.getElementById(
      'clinicalForm'
    );
  }


  function buildPermanentSummary(){

    const form =
      findClinicalForm();


    const diagnosisField =
      findDiagnosisField();


    const importantField =
      findImportantField();


    if(
      !form
      ||
      !diagnosisField
      ||
      !importantField
    ){
      return false;
    }


    /*
     * Already done.
     */
    if(
      document.getElementById(
        'v43PermanentClinicalSummary'
      )
    ){
      return true;
    }


    const arabic =
      languageIsArabic();


    const box =
      document.createElement(
        'section'
      );


    box.id =
      'v43PermanentClinicalSummary';


    box.className =
      'v43-permanent-clinical-summary';


    box.innerHTML = `
      <div class="v43-retained-head">

        <div>
          <span class="v43-eyebrow">
            ${
              arabic
                ? 'الملخص الطبي الدائم'
                : 'PERMANENT CLINICAL SUMMARY'
            }
          </span>

          <h2>
            ${
              arabic
                ? 'التشخيص وأهم الملاحظات'
                : 'Diagnosis & most important notes'
            }
          </h2>

          <p>
            ${
              arabic
                ? 'اكتب هذين القسمين أولاً. سيظلان محفوظين في ملف المريض بعد إغلاق الزيارة وتصدير الـ PDF.'
                : 'Complete these two fields first. They remain in the patient record after the consultation is closed and the PDF is exported.'
            }
          </p>
        </div>


        <span class="v43-retained-badge">
          ${
            arabic
              ? 'محفوظ دائماً'
              : 'Always retained'
          }
        </span>

      </div>


      <div
        id="v43RetainedFields"
        class="v43-retained-grid"
      ></div>


      <div class="v43-temporary-note">
        <span>ⓘ</span>

        <span>
          ${
            arabic
              ? 'باقي بيانات الزيارة الموجودة أسفل هذا الإطار هي تفاصيل مؤقتة: تدخل في ملف الـ PDF ثم تُحذف من الموقع بعد التصدير النهائي.'
              : 'The clinical details below this frame are temporary: they are included in the PDF and then removed from the website after final export.'
          }
        </span>
      </div>
    `;


    /*
     * Put it BEFORE everything else in the clinical form.
     */
    form.insertBefore(
      box,
      form.firstChild
    );


    const holder =
      box.querySelector(
        '#v43RetainedFields'
      );


    /*
     * Move the REAL existing field nodes.
     * Their IDs, names and current JS handlers remain unchanged.
     */
    diagnosisField.classList.add(
      'v43-retained-field'
    );


    importantField.classList.add(
      'v43-retained-field'
    );


    /*
     * Remove any old V35 visual treatment so V43 is the single frame.
     */
    diagnosisField.classList.remove(
      'v35-retained-field',
      'v35-important-field'
    );


    importantField.classList.remove(
      'v35-retained-field',
      'v35-important-field'
    );


    const diagnosisLabel =
      diagnosisField.querySelector(
        'span'
      );


    if(diagnosisLabel){

      diagnosisLabel.textContent =
        arabic
          ? 'التشخيص'
          : 'Diagnosis';
    }


    const importantLabel =
      importantField.querySelector(
        'span'
      );


    if(importantLabel){

      importantLabel.textContent =
        arabic
          ? 'أهم الملاحظات'
          : 'Most important notes';
    }


    holder.appendChild(
      diagnosisField
    );


    holder.appendChild(
      importantField
    );


    /*
     * Focus retained information first when doctor opens from queue.
     */
    const firstTextarea =
      diagnosisField.querySelector(
        'textarea'
      );


    if(
      firstTextarea
      &&
      !firstTextarea.disabled
    ){

      setTimeout(
        ()=>{
          firstTextarea.focus({
            preventScroll:true
          });
        },
        120
      );
    }


    return true;
  }


  /*
   * V35 creates "Most important notes" after the original clinical
   * page renders, so wait briefly until both real fields exist.
   */
  function ensureBuilt(){

    if(
      C.currentPage !==
        'clinical-visit'
    ){
      return;
    }


    if(
      buildPermanentSummary()
    ){
      return;
    }


    let attempts =
      0;


    const timer =
      setInterval(
        ()=>{

          attempts++;


          if(
            C.currentPage !==
              'clinical-visit'
          ){

            clearInterval(
              timer
            );

            return;
          }


          if(
            buildPermanentSummary()
            ||
            attempts >= 30
          ){

            clearInterval(
              timer
            );
          }

        },
        100
      );
  }


  /*
   * Wrap the final clinical page.
   * V43 should load AFTER V35 clinical PDF patch.
   */
  const oldClinicalPage =
    window.ClinicPages?.[
      'clinical-visit'
    ];


  if(
    typeof oldClinicalPage ===
    'function'
  ){

    window.ClinicPages[
      'clinical-visit'
    ] =
      async function(
        params={}
      ){

        const result =
          await oldClinicalPage(
            params
          );


        ensureBuilt();


        return result;
      };
  }


  /*
   * Also handle DOM rerenders / old routes.
   */
  const observer =
    new MutationObserver(
      ()=>{

        if(
          C.currentPage ===
            'clinical-visit'
        ){

          requestAnimationFrame(
            ensureBuilt
          );
        }
      }
    );


  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'clinicV43RetainedTopStyles';


  style.textContent = `
    .v43-permanent-clinical-summary {
      width: 100%;
      margin: 0 0 18px;
      padding: 18px;
      border: 1.5px solid #91d1c3;
      border-radius: 16px;
      background:
        linear-gradient(
          135deg,
          #f0faf7 0%,
          #ffffff 78%
        );
      box-shadow:
        0 8px 26px
        rgba(12, 76, 67, 0.05);
    }

    .v43-retained-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 15px;
    }

    .v43-eyebrow {
      display: block;
      margin-bottom: 4px;
      color: #0b8a76;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .06em;
    }

    .v43-retained-head h2 {
      margin: 0 0 5px;
      color: #10233c;
      font-size: 22px;
      line-height: 1.2;
    }

    .v43-retained-head p {
      max-width: 900px;
      margin: 0;
      color: #718097;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.5;
    }

    .v43-retained-badge {
      flex: 0 0 auto;
      padding: 7px 10px;
      border-radius: 999px;
      background: #0d927c;
      color: #ffffff;
      font-size: 9px;
      font-weight: 900;
      white-space: nowrap;
    }

    .v43-retained-grid {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
      gap: 14px;
    }

    .v43-retained-field {
      display: grid;
      gap: 6px;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    .v43-retained-field > span {
      color: #10233c !important;
      font-size: 14px !important;
      font-weight: 900 !important;
    }

    .v43-retained-field textarea {
      min-height: 130px !important;
      width: 100% !important;
      padding: 13px !important;
      border: 1px solid #d9e3e9 !important;
      border-radius: 12px !important;
      background: #ffffff !important;
      color: #10233c !important;
      resize: vertical;
    }

    .v43-retained-field textarea:focus {
      border-color: #56b7a5 !important;
      box-shadow:
        0 0 0 3px
        rgba(86, 183, 165, .12) !important;
      outline: none !important;
    }

    .v43-retained-field small {
      color: #748196 !important;
      font-size: 9px !important;
      line-height: 1.45;
    }

    .v43-temporary-note {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      margin-top: 13px;
      padding: 9px 11px;
      border-radius: 10px;
      background: #f7f9fb;
      color: #778497;
      font-size: 10px;
      line-height: 1.5;
    }


    /*
     * Make the rest of the clinical form visually secondary.
     */
    #clinicalForm
    > :not(
      #v43PermanentClinicalSummary
    ) {
      position: relative;
    }


    @media (max-width: 760px) {

      .v43-permanent-clinical-summary {
        padding: 13px;
        border-radius: 13px;
      }

      .v43-retained-head {
        gap: 8px;
      }

      .v43-retained-head h2 {
        font-size: 18px;
      }

      .v43-retained-head p {
        font-size: 10px;
      }

      .v43-retained-badge {
        padding: 5px 7px;
        font-size: 8px;
      }

      .v43-retained-grid {
        grid-template-columns:
          1fr;
        gap: 11px;
      }

      .v43-retained-field textarea {
        min-height: 110px !important;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();
