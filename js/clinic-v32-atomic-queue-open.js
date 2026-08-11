(() => {

  const C =
    window.Clinic;


  if(
    !C
    ||
    !window.ClinicV31
  ){
    return;
  }


  /*
   * V32 replaces the unsafe two-step:
   * start_consultation -> open_clinical_visit
   *
   * with a single database transaction.
   */
  window.ClinicV31.openDoctorPatient =
    async function(
      patientId
    ){

      const today =
        C.cairoDate();


      const {
        data,
        error
      } =
        await C.sb
          .from(
            'appointments'
          )
          .select(
            `
              id,
              patient_id,
              doctor_id,
              status,
              checked_in_at,
              scheduled_start
            `
          )
          .eq(
            'doctor_id',
            C.user.id
          )
          .eq(
            'patient_id',
            patientId
          )
          .gte(
            'scheduled_start',
            `${today}T00:00:00+03:00`
          )
          .lte(
            'scheduled_start',
            `${today}T23:59:59+03:00`
          )
          .in(
            'status',
            [
              'waiting',
              'with_doctor',
              'completed'
            ]
          )
          .order(
            'scheduled_start',
            {
              ascending:false
            }
          )
          .limit(
            1
          );


      if(error){

        return C.toast(
          error.message,
          'error'
        );
      }


      const appointment =
        data?.[0];


      if(!appointment){

        return C.route(
          'patient-detail',
          {
            patientId
          }
        );
      }


      if(
        appointment.status ===
        'completed'
      ){

        const visit =
          await C.sb
            .from(
              'clinical_visits'
            )
            .select(
              'id'
            )
            .eq(
              'appointment_id',
              appointment.id
            )
            .maybeSingle();


        if(visit.error){

          return C.toast(
            visit.error.message,
            'error'
          );
        }


        if(
          visit.data?.id
        ){

          return C.route(
            'clinical-visit',
            {
              visitId:
                visit.data.id,

              appointmentId:
                appointment.id,

              readOnly:
                true
            }
          );
        }


        return;
      }


      const opened =
        await C.sb.rpc(
          'frontend_doctor_open_queued_patient',
          {
            p_appointment:
              appointment.id
          }
        );


      if(
        opened.error
      ){

        /*
         * Atomic RPC means an error leaves the patient in queue.
         */
        C.toast(
          opened.error.message,
          'error'
        );


        return C.route(
          'today-clinic'
        );
      }


      const visitId =
        opened.data?.visit_id;


      if(!visitId){

        C.toast(
          C.lang==='ar'
            ? 'تعذر فتح الكشف الطبي.'
            : 'Could not open clinical visit.',
          'error'
        );


        return C.route(
          'today-clinic'
        );
      }


      return C.route(
        'clinical-visit',
        {
          visitId,

          appointmentId:
            appointment.id,

          readOnly:
            false
        }
      );
    };


  /*
   * Replace existing doctor-card click behavior with V32 atomic opener.
   */
  document.addEventListener(
    'click',
    event=>{

      const button =
        event.target.closest(
          '[data-doctor-home-patient]'
        );


      if(
        !button
        ||
        !C.isDoctor()
      ){
        return;
      }


      event.preventDefault();

      event.stopImmediatePropagation();


      window
        .ClinicV31
        .openDoctorPatient(
          button.dataset
            .doctorHomePatient
        );

    },
    true
  );

})();
