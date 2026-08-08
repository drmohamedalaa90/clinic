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

        ${C.isReception()
          ? `<button
               id="newPatientBtn"
               class="primary-button compact"
             >
               + ${C.lang==='ar'?'مريض جديد':'New Patient'}
             </button>`
          : ''
        }
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
})();
