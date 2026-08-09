(function(){
  async function fetchPatients(search=''){
    let q=Clinic.sb
      .from('patients')
      .select('*')
      .eq('is_active',true)
      .order('created_at',{ascending:false})
      .limit(100);

    if(search){
      const term=search.replaceAll(',',' ');

      q=q.or(
        `medical_record_number.ilike.%${term}%` +
        `,arabic_name.ilike.%${term}%` +
        `,english_name.ilike.%${term}%` +
        `,mobile.ilike.%${term}%`
      );
    }

    const {data,error}=await q;

    if(error) throw error;

    return data||[];
  }


  async function renderList(search=''){
    const C=Clinic;
    const rows=await fetchPatients(search);
    const area=document.getElementById('patientTableArea');

    if(!rows.length){
      area.innerHTML=`
        <div class="empty-state">
          ${C.lang==='ar'
            ?'لا يوجد مرضى مطابقون.'
            :'No matching patients.'}
        </div>
      `;
      return;
    }

    area.innerHTML=`
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>MRN</th>
              <th>${C.lang==='ar'?'الاسم':'Name'}</th>
              <th>${C.lang==='ar'?'سنة الميلاد':'Year of birth'}</th>
              <th>${C.lang==='ar'?'العمر':'Age'}</th>
              <th>${C.lang==='ar'?'الموبايل':'Mobile'}</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(p=>{
              const birthYear=C.birthYearFromPatient(p);

              return `
                <tr>
                  <td>
                    <strong>${C.escape(p.medical_record_number)}</strong>
                  </td>

                  <td>
                    ${C.escape(p.english_name||p.arabic_name||'—')}
                    <div class="subline">
                      ${C.escape(p.arabic_name||'')}
                    </div>
                  </td>

                  <td>${birthYear||'—'}</td>

                  <td>
                    ${C.ageFromBirthYear(
                      birthYear,
                      p.date_of_birth
                    )}
                  </td>

                  <td>${C.escape(p.mobile||'—')}</td>

                  <td>
                    <button
                      class="table-action"
                      data-open-patient="${p.id}"
                    >
                      ${C.lang==='ar'?'فتح':'Open'}
                    </button>

                    ${C.isReception()
                      ? `<button
                           class="table-action success-outline"
                           data-book-patient="${p.id}"
                         >
                           + ${C.lang==='ar'?'حجز':'Book'}
                         </button>`
                      : ''
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    area
      .querySelectorAll('[data-open-patient]')
      .forEach(b=>{
        b.onclick=()=>ClinicPages['patient-detail']({
          patientId:b.dataset.openPatient
        });
      });

    area
      .querySelectorAll('[data-book-patient]')
      .forEach(b=>{
        b.onclick=()=>ClinicPages['appointments']({
          patientId:b.dataset.bookPatient,
          openBooking:true
        });
      });
  }


  window.ClinicPages['patients']=async function(){
    const C=Clinic;

    C.setTitle(C.t('patients'));

    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar">
        <div>
          <span class="eyebrow">
            ${C.lang==='ar'?'السجل':'REGISTRY'}
          </span>

          <h2>
            ${C.lang==='ar'?'المرضى':'Patients'}
          </h2>

          <p class="muted">
            ${C.lang==='ar'
              ?'بحث بالاسم أو رقم الملف أو الموبايل.'
              :'Search by name, MRN or mobile.'}
          </p>
        </div>

        <div class="toolbar-actions">
          ${C.isReception()
            ? `<button
                 id="newPatientBtn"
                 class="primary-button compact"
               >
                 + ${C.lang==='ar'?'مريض جديد':'New Patient'}
               </button>`
            : ''
          }

          ${C.hasRole('owner')
            ? `<button
                 id="resetPatientsTest"
                 class="danger-button compact"
               >
                 ${C.lang==='ar'
                   ?'إعادة ضبط كل المرضى'
                   :'Reset all patients'}
               </button>`
            : ''
          }
        </div>
      </section>

      <section class="content-card">
        <div class="search-row">
          <input
            id="patientSearch"
            class="control"
            placeholder="${C.lang==='ar'
              ?'الاسم / MRN / الموبايل'
              :'Name / MRN / Mobile'}"
          >

          <button
            id="patientSearchBtn"
            class="secondary-button"
          >
            ${C.lang==='ar'?'بحث':'Search'}
          </button>
        </div>

        <div
          id="patientTableArea"
          class="space-top"
        ></div>
      </section>
    `;

    const search=()=>renderList(
      document.getElementById('patientSearch').value.trim()
    ).catch(e=>C.toast(e.message,'error'));

    document.getElementById('patientSearchBtn').onclick=search;

    document
      .getElementById('patientSearch')
      .addEventListener('keydown',e=>{
        if(e.key==='Enter') search();
      });


    document
      .getElementById('resetPatientsTest')
      ?.addEventListener(
        'click',
        async()=>{
          const phrase=prompt(
            C.lang==='ar'
              ?'هذا سيحذف كل المرضى التجريبيين وكل المواعيد والزيارات والتحويلات والفواتير المرتبطة بهم. جداول الأطباء والمستخدمون سيبقون. سيبدأ رقم المريض التالي من OPC-000001. اكتب RESET PATIENTS للمتابعة.'
              :'This deletes ALL test patients and their appointments, visits, referrals and patient-linked finance records. Users and doctor schedules are preserved. The next patient will start again at OPC-000001. Type RESET PATIENTS to continue.'
          );

          if(phrase!=='RESET PATIENTS'){
            return;
          }

          const {data,error}=await C.sb.rpc(
            'owner_reset_all_patients_test_data',
            {
              p_confirmation:
                phrase
            }
          );

          if(error){
            return C.toast(
              error.message,
              'error'
            );
          }

          C.toast(
            C.lang==='ar'
              ?'تمت إعادة ضبط كل المرضى. المريض التالي سيبدأ من رقم 1.'
              :'All patients reset. The next patient starts from number 1.'
          );

          window.ClinicNotifications?.refresh?.();
          C.route('patients');
        }
      );


    if(C.isReception()){
      document.getElementById('newPatientBtn').onclick=()=>{
        const currentYear = Number(
          new Intl.DateTimeFormat('en-GB',{
            timeZone:'Africa/Cairo',
            year:'numeric'
          }).format(new Date())
        );

        C.showModal({
          title:C.lang==='ar'
            ?'إضافة مريض'
            :'New patient',

          body:`
            <form
              id="newPatientForm"
              class="form-grid"
            >
              <label>
                ${C.lang==='ar'
                  ?'الاسم بالعربية'
                  :'Arabic name'}
                <input
                  name="arabic_name"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'
                  ?'الاسم بالإنجليزية'
                  :'English name'}
                <input
                  name="english_name"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'
                  ?'سنة الميلاد'
                  :'Year of birth'}
                <input
                  name="birth_year"
                  type="number"
                  inputmode="numeric"
                  min="1900"
                  max="${currentYear}"
                  step="1"
                  placeholder="1985"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'?'النوع':'Gender'}
                <select
                  name="gender"
                  class="control"
                >
                  <option value="">—</option>
                  <option value="male">
                    ${C.lang==='ar'?'ذكر':'Male'}
                  </option>
                  <option value="female">
                    ${C.lang==='ar'?'أنثى':'Female'}
                  </option>
                </select>
              </label>

              <label>
                ${C.lang==='ar'?'الموبايل':'Mobile'}
                <input
                  name="mobile"
                  inputmode="tel"
                  class="control"
                >
              </label>

              <label>
                ${C.lang==='ar'?'العنوان':'Address'}
                <input
                  name="address"
                  class="control"
                >
              </label>

              <div class="form-actions full-span">
                <button
                  class="primary-button compact"
                  type="submit"
                >
                  ${C.lang==='ar'
                    ?'حفظ'
                    :'Save patient'}
                </button>
              </div>
            </form>
          `,

          onOpen:(root)=>{
            root
              .querySelector('#newPatientForm')
              .onsubmit=async e=>{
                e.preventDefault();

                const f=new FormData(e.currentTarget);

                if(
                  !f.get('arabic_name') &&
                  !f.get('english_name')
                ){
                  return C.toast(
                    C.lang==='ar'
                      ?'أدخل اسم المريض'
                      :'Enter patient name',
                    'error'
                  );
                }

                const yearText=String(
                  f.get('birth_year')||''
                ).trim();

                const birthYear=yearText
                  ? Number(yearText)
                  : null;

                if(
                  birthYear &&
                  (
                    !Number.isInteger(birthYear) ||
                    birthYear < 1900 ||
                    birthYear > currentYear
                  )
                ){
                  return C.toast(
                    C.lang==='ar'
                      ?'أدخل سنة ميلاد صحيحة.'
                      :'Enter a valid year of birth.',
                    'error'
                  );
                }

                const payload={
                  arabic_name:
                    f.get('arabic_name')||null,

                  english_name:
                    f.get('english_name')||null,

                  birth_year:
                    birthYear,

                  gender:
                    f.get('gender')||null,

                  mobile:
                    f.get('mobile')||null,

                  address:
                    f.get('address')||null,

                  created_by:
                    C.user.id,

                  updated_by:
                    C.user.id
                };

                const result=await C.sb
                  .from('patients')
                  .insert(payload)
                  .select()
                  .single();

                if(result.error){
                  return C.toast(
                    result.error.message,
                    'error'
                  );
                }

                C.closeModal();

                C.toast(
                  C.lang==='ar'
                    ?'تم إنشاء ملف المريض'
                    :'Patient created'
                );

                ClinicPages['patient-detail']({
                  patientId:result.data.id
                });
              };
          }
        });
      };
    }

    renderList();
  };


  window.ClinicPages['patient-detail']=async function({
    patientId
  }){
    const C=Clinic;

    C.setLoading();

    const {data:p,error}=await C.sb
      .from('patients')
      .select('*')
      .eq('id',patientId)
      .single();

    if(error){
      return C.toast(error.message,'error');
    }

    C.setTitle(
      p.english_name||
      p.arabic_name||
      'Patient'
    );

    const [
      {data:appts},
      {data:visits},
      {data:refs},
      {data:invoices}
    ] = await Promise.all([
      C.sb
        .from('appointments')
        .select('*')
        .eq('patient_id',patientId)
        .order('scheduled_start',{ascending:false})
        .limit(30),

      C.sb
        .from('clinical_visits')
        .select('*')
        .eq('patient_id',patientId)
        .order('created_at',{ascending:false})
        .limit(20),

      C.isDoctor()
        ? C.sb
            .from('referrals')
            .select('*')
            .eq('patient_id',patientId)
            .order('created_at',{ascending:false})
            .limit(20)
        : Promise.resolve({data:[]}),

      C.isReception()
        ? C.sb
            .from('invoices')
            .select('*')
            .eq('patient_id',patientId)
            .order('created_at',{ascending:false})
            .limit(20)
        : Promise.resolve({data:[]})
    ]);

    const birthYear=C.birthYearFromPatient(p);
    const age=C.ageFromBirthYear(
      birthYear,
      p.date_of_birth
    );

    document.getElementById('mainContent').innerHTML=`
      <section class="patient-hero content-card">
        <div class="patient-avatar">
          ${C.escape(
            (p.english_name||p.arabic_name||'P').charAt(0)
          )}
        </div>

        <div class="patient-hero-main">
          <span class="eyebrow">
            ${C.escape(p.medical_record_number)}
          </span>

          <h2>
            ${C.escape(
              p.english_name||
              p.arabic_name||
              'Patient'
            )}
          </h2>

          <div class="patient-meta">
            <span>
              ${age}
              ${C.lang==='ar'?'سنة':'y'}
            </span>

            <span>
              ${C.escape(p.gender||'—')}
            </span>

            <span>
              ${C.escape(p.mobile||'—')}
            </span>
          </div>
        </div>

        <div class="patient-hero-actions">
          ${C.isReception()
            ? `<button
                 class="primary-button compact"
                 id="bookFromProfile"
               >
                 + ${C.lang==='ar'
                   ?'حجز موعد'
                   :'Book Appointment'}
               </button>`
            : ''
          }
        </div>
      </section>

      <div
        class="tabs"
        id="patientTabs"
      >
        <button
          class="tab active"
          data-tab="overview"
        >
          ${C.lang==='ar'?'ملخص':'Overview'}
        </button>

        <button
          class="tab"
          data-tab="appointments"
        >
          ${C.lang==='ar'?'المواعيد':'Appointments'}
        </button>

        ${C.isDoctor()
          ? `
            <button
              class="tab"
              data-tab="clinical"
            >
              ${C.lang==='ar'
                ?'الزيارات الطبية'
                :'Clinical Visits'}
            </button>

            <button
              class="tab"
              data-tab="referrals"
            >
              ${C.lang==='ar'
                ?'التحويلات'
                :'Referrals'}
            </button>
          `
          : ''
        }

        ${C.isReception()
          ? `<button
               class="tab"
               data-tab="billing"
             >
               ${C.lang==='ar'
                 ?'الفواتير'
                 :'Billing'}
             </button>`
          : ''
        }
      </div>

      <section
        id="patientTabBody"
        class="content-card"
      ></section>
    `;

    const body=document.getElementById('patientTabBody');

    function show(tab){
      document
        .querySelectorAll('#patientTabs .tab')
        .forEach(x=>{
          x.classList.toggle(
            'active',
            x.dataset.tab===tab
          );
        });

      if(tab==='overview'){
        body.innerHTML=`
          <div class="detail-grid">
            <div>
              <span class="field-label">
                ${C.lang==='ar'
                  ?'سنة الميلاد'
                  :'Year of birth'}
              </span>

              <strong>${birthYear||'—'}</strong>
            </div>

            <div>
              <span class="field-label">
                ${C.lang==='ar'
                  ?'العمر التقريبي'
                  :'Approx. age'}
              </span>

              <strong>
                ${age}
                ${age!=='—'
                  ? (C.lang==='ar'?' سنة':' years')
                  : ''
                }
              </strong>
            </div>

            <div>
              <span class="field-label">
                ${C.lang==='ar'
                  ?'الموبايل'
                  :'Mobile'}
              </span>

              <strong>
                ${C.escape(p.mobile||'—')}
              </strong>
            </div>

            <div class="wide">
              <span class="field-label">
                ${C.lang==='ar'
                  ?'العنوان'
                  :'Address'}
              </span>

              <strong>
                ${C.escape(p.address||'—')}
              </strong>
            </div>
          </div>
        `;
      }

      if(tab==='appointments'){
        body.innerHTML=appts?.length
          ? `<div class="stack-list">
              ${appts.map(a=>`
                <article class="list-card">
                  <div>
                    <div class="list-title">
                      ${C.formatDate(a.scheduled_start)}
                      •
                      ${C.formatTime(a.scheduled_start)}
                    </div>

                    <div class="muted">
                      ${C.escape(C.doctorName(a.doctor_id))}
                    </div>
                  </div>

                  ${C.statusPill(a.status)}
                </article>
              `).join('')}
            </div>`
          : `<div class="empty-state">
               ${C.t('noData')}
             </div>`;
      }

      if(tab==='clinical'){
        body.innerHTML=visits?.length
          ? `<div class="stack-list">
              ${visits.map(v=>`
                <article class="list-card">
                  <div>
                    <div class="list-title">
                      ${C.formatDate(v.created_at)}
                    </div>

                    <div class="muted">
                      ${C.escape(
                        v.diagnosis_summary||
                        v.chief_complaint||
                        'Clinical visit'
                      )}
                    </div>
                  </div>

                  <button
                    class="table-action"
                    data-open-visit="${v.id}"
                  >
                    ${C.lang==='ar'?'فتح':'Open'}
                  </button>
                </article>
              `).join('')}
            </div>`
          : `<div class="empty-state">
               ${C.lang==='ar'
                 ?'لا توجد زيارات طبية متاحة لك.'
                 :'No clinical visits available to you.'}
             </div>`;
      }

      if(tab==='referrals'){
        body.innerHTML=refs?.length
          ? `<div class="stack-list">
              ${refs.map(r=>`
                <article class="list-card">
                  <div>
                    <div class="list-title">
                      ${C.escape(r.referral_reason)}
                    </div>

                    <div class="muted">
                      ${C.formatDate(r.created_at)}
                      •
                      ${C.escape(r.urgency)}
                    </div>
                  </div>

                  ${C.statusPill(r.status)}
                </article>
              `).join('')}
            </div>`
          : `<div class="empty-state">
               ${C.t('noData')}
             </div>`;
      }

      if(tab==='billing'){
        body.innerHTML=invoices?.length
          ? `<div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  ${invoices.map(i=>`
                    <tr>
                      <td>
                        <strong>
                          ${C.escape(i.invoice_number)}
                        </strong>
                      </td>
                      <td>${C.formatMoney(i.total_amount)}</td>
                      <td>${C.formatMoney(i.paid_amount)}</td>
                      <td>${C.formatMoney(i.balance_due)}</td>
                      <td>${C.statusPill(i.status)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          : `<div class="empty-state">
               ${C.t('noData')}
             </div>`;
      }

      body
        .querySelectorAll('[data-open-visit]')
        .forEach(b=>{
          b.onclick=()=>C.route(
            'clinical-visit',
            {
              visitId:b.dataset.openVisit,
              readOnly:true
            }
          );
        });
    }

    document
      .querySelectorAll('#patientTabs .tab')
      .forEach(b=>{
        b.onclick=()=>show(b.dataset.tab);
      });

    if(C.isReception()){
      document.getElementById('bookFromProfile').onclick=()=>{
        C.route(
          'appointments',
          {
            patientId,
            openBooking:true
          }
        );
      };
    }

    show('overview');
  };
  function adminLocalDateTimeParts(value){
    if(!value){
      return {
        date:'',
        time:''
      };
    }

    const d=new Date(value);

    const parts=
      new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:'Africa/Cairo',
          year:'numeric',
          month:'2-digit',
          day:'2-digit',
          hour:'2-digit',
          minute:'2-digit',
          hour12:false
        }
      )
      .formatToParts(d);

    const get=type=>
      parts.find(
        x=>x.type===type
      )?.value||'';

    return {
      date:
        `${get('year')}-${get('month')}-${get('day')}`,

      time:
        `${get('hour')}:${get('minute')}`
    };
  }


  window.ClinicPages['admin-records']=async function(){
    const C=Clinic;

    if(!C.hasRole('owner')){
      return C.route('dashboard');
    }


    C.setTitle(
      C.lang==='ar'
        ?'السجلات الإدارية'
        :'Admin Records'
    );


    await C.loadDoctors(true);


    document.getElementById('mainContent').innerHTML=`
      <section class="page-toolbar">

        <div>
          <span class="eyebrow">
            OWNER
          </span>

          <h2>
            ${C.lang==='ar'
              ?'كل المرضى والحجوزات السابقة'
              :'All patients & appointment history'}
          </h2>

          <p class="muted">
            ${C.lang==='ar'
              ?'راجع السجلات القديمة، صحح الأخطاء، أو احذف سجلات الاختبار بشكل فردي.'
              :'Review old records, correct mistakes, or individually delete test records.'}
          </p>
        </div>

      </section>


      <div class="admin-records-filter-bar">

        <input
          id="adminRecordsSearch"
          class="control"
          placeholder="${
            C.lang==='ar'
              ?'بحث بالاسم / رقم الملف / رقم الحجز / الموبايل'
              :'Search name / MRN / appointment no. / mobile'
          }"
        >

        <button
          id="adminRecordsRefresh"
          class="secondary-button"
        >
          ${C.lang==='ar'
            ?'تحديث'
            :'Refresh'}
        </button>

      </div>


      <div
        id="adminRecordTabs"
        class="tabs"
      >
        <button
          class="tab active"
          data-admin-record-tab="appointments"
        >
          ${C.lang==='ar'
            ?'كل الحجوزات'
            :'All appointments'}
        </button>

        <button
          class="tab"
          data-admin-record-tab="patients"
        >
          ${C.lang==='ar'
            ?'كل المرضى'
            :'All patients'}
        </button>
      </div>


      <section class="content-card">
        <div
          id="adminRecordsArea"
          class="centered"
        >
          <div class="loader"></div>
        </div>
      </section>
    `;


    const area=
      document.getElementById(
        'adminRecordsArea'
      );

    let payload={
      appointments:[],
      patients:[]
    };

    let activeTab='appointments';


    async function load(){
      area.innerHTML=`
        <div class="centered">
          <div class="loader"></div>
        </div>
      `;

      const query=
        document
          .getElementById(
            'adminRecordsSearch'
          )
          .value
          .trim();

      const {data,error}=await C.sb.rpc(
        'owner_admin_records',
        {
          p_search:
            query||
            null,

          p_limit:
            3000
        }
      );


      if(error){
        area.innerHTML=`
          <div class="empty-state">
            ${C.escape(error.message)}
          </div>
        `;
        return;
      }


      payload=
        data||
        {
          appointments:[],
          patients:[]
        };


      render();
    }


    function render(){
      if(activeTab==='appointments'){
        const rows=
          payload.appointments||
          [];

        area.innerHTML=rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table admin-record-table">
                <thead>
                  <tr>
                    <th>
                      ${C.lang==='ar'
                        ?'الحجز'
                        :'Appointment'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'المريض'
                        :'Patient'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'الطبيب'
                        :'Doctor'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'الموعد'
                        :'Date / time'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'النوع'
                        :'Type'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'الحالة'
                        :'Status'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'المصدر'
                        :'Source'}
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  ${rows.map(a=>`
                    <tr>
                      <td>
                        <strong>
                          ${C.escape(
                            a.appointment_number||
                            ''
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          ${C.escape(
                            a.patient_name||
                            'Patient'
                          )}
                        </strong>

                        <div class="subline">
                          ${C.escape(
                            a.medical_record_number||
                            ''
                          )}
                        </div>
                      </td>

                      <td>
                        ${C.escape(
                          a.doctor_name||
                          'Doctor'
                        )}
                      </td>

                      <td>
                        ${C.formatDate(
                          a.scheduled_start,
                          {
                            hour:'2-digit',
                            minute:'2-digit'
                          }
                        )}
                      </td>

                      <td>
                        ${C.escape(
                          a.appointment_type||
                          '—'
                        )}
                      </td>

                      <td>
                        ${C.statusPill(
                          a.status
                        )}
                      </td>

                      <td>
                        <span class="admin-source-chip">
                          ${C.escape(
                            a.booking_source||
                            'staff'
                          )}
                        </span>
                      </td>

                      <td>
                        <div class="admin-record-actions">
                          <button
                            class="table-action"
                            data-admin-edit-appointment="${a.id}"
                          >
                            ${C.lang==='ar'
                              ?'تعديل'
                              :'Edit'}
                          </button>

                          <button
                            class="table-action danger-outline"
                            data-admin-delete-appointment="${a.id}"
                          >
                            ${C.lang==='ar'
                              ?'حذف اختبار'
                              :'Delete test'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : `
            <div class="empty-state">
              ${C.t('noData')}
            </div>
          `;


        area
          .querySelectorAll(
            '[data-admin-edit-appointment]'
          )
          .forEach(button=>{

            button.onclick=()=>{

              const row=
                rows.find(
                  x=>x.id===
                    button.dataset.adminEditAppointment
                );

              editAppointment(
                row
              );
            };

          });


        area
          .querySelectorAll(
            '[data-admin-delete-appointment]'
          )
          .forEach(button=>{

            button.onclick=async()=>{

              const row=
                rows.find(
                  x=>x.id===
                    button.dataset.adminDeleteAppointment
                );

              const reason=prompt(
                C.lang==='ar'
                  ?`سبب حذف الحجز ${row?.appointment_number||''}`
                  :`Reason for deleting appointment ${row?.appointment_number||''}`
              );

              if(!reason){
                return;
              }


              if(
                !confirm(
                  C.lang==='ar'
                    ?'سيتم حذف حجز الاختبار والبيانات المرتبطة به نهائياً. متابعة؟'
                    :'This permanently deletes the test appointment and its linked test data. Continue?'
                )
              ){
                return;
              }


              const {error}=await C.sb.rpc(
                'owner_delete_test_appointment',
                {
                  p_appointment_id:
                    button.dataset.adminDeleteAppointment,

                  p_reason:
                    reason
                }
              );


              if(error){
                return C.toast(
                  error.message,
                  'error'
                );
              }


              C.toast(
                C.lang==='ar'
                  ?'تم حذف حجز الاختبار.'
                  :'Test appointment deleted.'
              );

              load();
            };

          });
      }

      else {
        const rows=
          payload.patients||
          [];

        area.innerHTML=rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table admin-record-table">
                <thead>
                  <tr>
                    <th>MRN</th>

                    <th>
                      ${C.lang==='ar'
                        ?'الاسم'
                        :'Name'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'سنة الميلاد'
                        :'Birth year'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'الموبايل'
                        :'Mobile'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'المنطقة / العنوان'
                        :'Area / address'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'المصدر'
                        :'Source'}
                    </th>

                    <th>
                      ${C.lang==='ar'
                        ?'تاريخ الإنشاء'
                        :'Created'}
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  ${rows.map(p=>`
                    <tr>
                      <td>
                        <strong>
                          ${C.escape(
                            p.medical_record_number||
                            ''
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          ${C.escape(
                            p.english_name||
                            p.arabic_name||
                            'Patient'
                          )}
                        </strong>

                        ${
                          p.english_name
                          &&
                          p.arabic_name

                            ? `<div class="subline">
                                 ${C.escape(
                                   p.arabic_name
                                 )}
                               </div>`

                            : ''
                        }
                      </td>

                      <td>
                        ${p.birth_year||'—'}
                      </td>

                      <td>
                        ${C.escape(
                          p.mobile||
                          '—'
                        )}
                      </td>

                      <td>
                        ${C.escape(
                          p.residency_area||
                          p.address||
                          '—'
                        )}
                      </td>

                      <td>
                        <span class="admin-source-chip">
                          ${C.escape(
                            p.registration_source||
                            'staff'
                          )}
                        </span>
                      </td>

                      <td>
                        ${C.formatDate(
                          p.created_at
                        )}
                      </td>

                      <td>
                        <div class="admin-record-actions">
                          <button
                            class="table-action"
                            data-admin-edit-patient="${p.id}"
                          >
                            ${C.lang==='ar'
                              ?'تعديل'
                              :'Edit'}
                          </button>

                          <button
                            class="table-action danger-outline"
                            data-admin-delete-patient="${p.id}"
                          >
                            ${C.lang==='ar'
                              ?'حذف اختبار'
                              :'Delete test'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : `
            <div class="empty-state">
              ${C.t('noData')}
            </div>
          `;


        area
          .querySelectorAll(
            '[data-admin-edit-patient]'
          )
          .forEach(button=>{

            button.onclick=()=>{

              const row=
                rows.find(
                  x=>x.id===
                    button.dataset.adminEditPatient
                );

              editPatient(
                row
              );
            };

          });


        area
          .querySelectorAll(
            '[data-admin-delete-patient]'
          )
          .forEach(button=>{

            button.onclick=async()=>{

              const row=
                rows.find(
                  x=>x.id===
                    button.dataset.adminDeletePatient
                );

              const reason=prompt(
                C.lang==='ar'
                  ?`سبب حذف المريض ${row?.medical_record_number||''}`
                  :`Reason for deleting patient ${row?.medical_record_number||''}`
              );

              if(!reason){
                return;
              }


              if(
                !confirm(
                  C.lang==='ar'
                    ?'سيتم حذف مريض الاختبار وكل حجوزاته وبيانات الاختبار المرتبطة به نهائياً. متابعة؟'
                    :'This permanently deletes the test patient, their appointments and linked test records. Continue?'
                )
              ){
                return;
              }


              const {error}=await C.sb.rpc(
                'owner_delete_test_patient',
                {
                  p_patient_id:
                    button.dataset.adminDeletePatient,

                  p_reason:
                    reason
                }
              );


              if(error){
                return C.toast(
                  error.message,
                  'error'
                );
              }


              C.toast(
                C.lang==='ar'
                  ?'تم حذف مريض الاختبار.'
                  :'Test patient deleted.'
              );

              load();
            };

          });
      }
    }


    function editPatient(p){
      if(!p){
        return;
      }

      C.showModal({
        title:
          C.lang==='ar'
            ?'تعديل بيانات المريض'
            :'Edit patient record',

        body:`
          <form
            id="adminEditPatientForm"
            class="form-grid"
          >
            <label>
              ${C.lang==='ar'
                ?'الاسم بالعربية'
                :'Arabic name'}

              <input
                id="aepArabic"
                class="control"
                value="${C.escape(
                  p.arabic_name||
                  ''
                )}"
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'الاسم بالإنجليزية'
                :'English name'}

              <input
                id="aepEnglish"
                class="control"
                value="${C.escape(
                  p.english_name||
                  ''
                )}"
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'سنة الميلاد'
                :'Birth year'}

              <input
                id="aepYear"
                type="number"
                class="control"
                min="1900"
                max="2100"
                value="${p.birth_year||''}"
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'النوع'
                :'Gender'}

              <select
                id="aepGender"
                class="control"
              >
                <option value="">
                  —
                </option>

                <option
                  value="male"
                  ${p.gender==='male'?'selected':''}
                >
                  ${C.lang==='ar'?'ذكر':'Male'}
                </option>

                <option
                  value="female"
                  ${p.gender==='female'?'selected':''}
                >
                  ${C.lang==='ar'?'أنثى':'Female'}
                </option>
              </select>
            </label>

            <label>
              ${C.lang==='ar'
                ?'الموبايل'
                :'Mobile'}

              <input
                id="aepMobile"
                class="control"
                value="${C.escape(
                  p.mobile||
                  ''
                )}"
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'منطقة السكن'
                :'Residency area'}

              <input
                id="aepArea"
                class="control"
                value="${C.escape(
                  p.residency_area||
                  ''
                )}"
              >
            </label>

            <label class="full-span">
              ${C.lang==='ar'
                ?'العنوان'
                :'Address'}

              <input
                id="aepAddress"
                class="control"
                value="${C.escape(
                  p.address||
                  ''
                )}"
              >
            </label>

            <label class="full-span">
              ${C.lang==='ar'
                ?'سبب التعديل'
                :'Reason for edit'}

              <textarea
                id="aepReason"
                class="control"
                required
              ></textarea>
            </label>

            <div class="form-actions full-span">
              <button
                class="primary-button compact"
                type="submit"
              >
                ${C.lang==='ar'
                  ?'حفظ'
                  :'Save'}
              </button>
            </div>
          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#adminEditPatientForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();

              const reason=
                root
                  .querySelector(
                    '#aepReason'
                  )
                  .value
                  .trim();

              if(!reason){
                return C.toast(
                  C.lang==='ar'
                    ?'سبب التعديل مطلوب.'
                    :'Edit reason is required.',
                  'error'
                );
              }


              const yearText=
                root
                  .querySelector(
                    '#aepYear'
                  )
                  .value;


              const {error}=await C.sb.rpc(
                'owner_edit_patient_record',
                {
                  p_patient_id:
                    p.id,

                  p_arabic_name:
                    root
                      .querySelector(
                        '#aepArabic'
                      )
                      .value||
                    null,

                  p_english_name:
                    root
                      .querySelector(
                        '#aepEnglish'
                      )
                      .value||
                    null,

                  p_birth_year:
                    yearText
                      ? Number(yearText)
                      : null,

                  p_gender:
                    root
                      .querySelector(
                        '#aepGender'
                      )
                      .value||
                    null,

                  p_mobile:
                    root
                      .querySelector(
                        '#aepMobile'
                      )
                      .value||
                    null,

                  p_residency_area:
                    root
                      .querySelector(
                        '#aepArea'
                      )
                      .value||
                    null,

                  p_address:
                    root
                      .querySelector(
                        '#aepAddress'
                      )
                      .value||
                    null,

                  p_reason:
                    reason
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
                  ?'تم تحديث بيانات المريض.'
                  :'Patient record updated.'
              );

              load();
            };
        }
      });
    }


    function editAppointment(a){
      if(!a){
        return;
      }


      const start=
        adminLocalDateTimeParts(
          a.scheduled_start
        );

      const end=
        adminLocalDateTimeParts(
          a.scheduled_end
        );


      C.showModal({
        title:
          C.lang==='ar'
            ?'تعديل الحجز'
            :'Edit appointment',

        wide:true,

        body:`
          <form
            id="adminEditAppointmentForm"
            class="form-grid"
          >
            <label>
              ${C.lang==='ar'
                ?'الطبيب'
                :'Doctor'}

              <select
                id="aeaDoctor"
                class="control"
                required
              >
                ${C.doctors.map(d=>`
                  <option
                    value="${d.id}"
                    ${d.id===a.doctor_id?'selected':''}
                  >
                    ${C.escape(
                      d.display_name||
                      d.username
                    )}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>
              ${C.lang==='ar'
                ?'التاريخ'
                :'Date'}

              <input
                id="aeaDate"
                type="date"
                class="control"
                value="${start.date}"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'من'
                :'Start'}

              <input
                id="aeaStart"
                type="time"
                class="control"
                value="${start.time}"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'إلى'
                :'End'}

              <input
                id="aeaEnd"
                type="time"
                class="control"
                value="${end.time}"
                required
              >
            </label>

            <label>
              ${C.lang==='ar'
                ?'النوع'
                :'Type'}

              <select
                id="aeaType"
                class="control"
              >
                <option
                  value="new"
                  ${a.appointment_type==='new'?'selected':''}
                >
                  ${C.lang==='ar'?'جديد':'New'}
                </option>

                <option
                  value="follow_up"
                  ${a.appointment_type==='follow_up'?'selected':''}
                >
                  ${C.lang==='ar'?'متابعة':'Follow-up'}
                </option>
              </select>
            </label>

            <label>
              ${C.lang==='ar'
                ?'الحالة'
                :'Status'}

              <select
                id="aeaStatus"
                class="control"
              >
                ${[
                  'booked',
                  'confirmed',
                  'arrived',
                  'waiting',
                  'with_doctor',
                  'completed',
                  'cancelled',
                  'no_show',
                  'rescheduled'
                ].map(status=>`
                  <option
                    value="${status}"
                    ${a.status===status?'selected':''}
                  >
                    ${status.replaceAll('_',' ')}
                  </option>
                `).join('')}
              </select>
            </label>

            <label class="full-span">
              ${C.lang==='ar'
                ?'سبب التعديل'
                :'Reason for edit'}

              <textarea
                id="aeaReason"
                class="control"
                required
              ></textarea>
            </label>

            <div class="form-actions full-span">
              <button
                class="primary-button compact"
                type="submit"
              >
                ${C.lang==='ar'
                  ?'حفظ التعديل'
                  :'Save edit'}
              </button>
            </div>
          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#adminEditAppointmentForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();


              const date=
                root
                  .querySelector(
                    '#aeaDate'
                  )
                  .value;

              const startTime=
                root
                  .querySelector(
                    '#aeaStart'
                  )
                  .value;

              const endTime=
                root
                  .querySelector(
                    '#aeaEnd'
                  )
                  .value;

              const reason=
                root
                  .querySelector(
                    '#aeaReason'
                  )
                  .value
                  .trim();


              if(!reason){
                return C.toast(
                  C.lang==='ar'
                    ?'سبب التعديل مطلوب.'
                    :'Edit reason is required.',
                  'error'
                );
              }


              const {error}=await C.sb.rpc(
                'owner_edit_appointment_record',
                {
                  p_appointment_id:
                    a.id,

                  p_doctor_id:
                    root
                      .querySelector(
                        '#aeaDoctor'
                      )
                      .value,

                  p_start:
                    `${date}T${startTime}:00+03:00`,

                  p_end:
                    `${date}T${endTime}:00+03:00`,

                  p_type:
                    root
                      .querySelector(
                        '#aeaType'
                      )
                      .value,

                  p_status:
                    root
                      .querySelector(
                        '#aeaStatus'
                      )
                      .value,

                  p_reason:
                    reason
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
                  ?'تم تحديث الحجز.'
                  :'Appointment updated.'
              );

              load();
            };
        }
      });
    }


    document
      .querySelectorAll(
        '[data-admin-record-tab]'
      )
      .forEach(button=>{

        button.onclick=()=>{

          document
            .querySelectorAll(
              '[data-admin-record-tab]'
            )
            .forEach(
              x=>x.classList.remove(
                'active'
              )
            );

          button.classList.add(
            'active'
          );

          activeTab=
            button.dataset.adminRecordTab;

          render();
        };

      });


    document
      .getElementById(
        'adminRecordsRefresh'
      )
      .onclick=
        load;


    document
      .getElementById(
        'adminRecordsSearch'
      )
      .addEventListener(
        'keydown',
        event=>{
          if(event.key==='Enter'){
            load();
          }
        }
      );


    await load();
  };

})();
