(() => {
  const C =
    window.Clinic;

  if (!C) {
    return;
  }


  // =========================================================
  // 1. Booking modal cleanup
  //
  // - English name is visibly optional.
  // - Arabic name is the required patient name.
  // - Remove "Example: 36 / مثال: 36" from the age box.
  // =========================================================

  function patchBookingModal() {
    const form =
      document.getElementById(
        'bookingForm'
      );

    if (!form) {
      return;
    }


    const englishInput =
      form.querySelector(
        '#bookingEnglishName'
      );

    if (englishInput) {
      const label =
        englishInput.closest(
          'label'
        );

      if (label) {
        const current =
          label.childNodes[0]
          ?.textContent
          ?.trim();

        if (
          C.lang === 'ar'
          &&
          !label.dataset.optionalLabelFixed
        ) {
          label.childNodes[0].textContent =
            'الاسم بالإنجليزية (اختياري) ';

          label.dataset.optionalLabelFixed =
            '1';
        }

        if (
          C.lang !== 'ar'
          &&
          !label.dataset.optionalLabelFixedEn
        ) {
          label.childNodes[0].textContent =
            'English name (optional) ';

          label.dataset.optionalLabelFixedEn =
            '1';
        }
      }
    }


    const ageInput =
      form.querySelector(
        '#bookingAgeYears'
      );

    if (ageInput) {
      ageInput.removeAttribute(
        'placeholder'
      );
    }


    // Also remove any future booking placeholder that is literally
    // an "example"; this keeps data-entry boxes visually clean.
    form
      .querySelectorAll(
        'input[placeholder]'
      )
      .forEach(input=>{
        const p =
          String(
            input.getAttribute(
              'placeholder'
            )
            ||
            ''
          )
          .trim()
          .toLowerCase();

        if (
          p.startsWith('مثال')
          ||
          p.startsWith('example')
        ) {
          input.removeAttribute(
            'placeholder'
          );
        }
      });


    if (
      !form.dataset.arabicNameGuard
    ) {
      form.dataset.arabicNameGuard =
        '1';

      form.addEventListener(
        'submit',
        event=>{
          const newPanel =
            form.querySelector(
              '#newPatientPanel'
            );

          const newPatientMode =
            newPanel
            &&
            !newPanel.classList.contains(
              'hidden'
            );

          if (!newPatientMode) {
            return;
          }

          const arabicName =
            form
              .querySelector(
                '#bookingArabicName'
              )
              ?.value
              ?.trim();

          if (!arabicName) {
            event.preventDefault();
            event.stopImmediatePropagation();

            C.toast(
              C.lang==='ar'
                ?'الاسم بالعربية مطلوب. الاسم بالإنجليزية اختياري.'
                :'Arabic name is required. English name is optional.',
              'error'
            );
          }
        },
        true
      );
    }
  }


  const modalObserver =
    new MutationObserver(
      patchBookingModal
    );

  modalObserver.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );


  // =========================================================
  // 2. Performance
  //
  // The booking popup currently asks for the doctor list with force=true
  // every time it opens. Keep a short in-memory cache instead of repeating
  // the Supabase request on every booking.
  // =========================================================

  const originalLoadDoctors =
    C.loadDoctors.bind(C);

  let lastDoctorNetworkLoad =
    0;

  C.loadDoctors =
    async function(force=false) {
      const now =
        Date.now();

      if (
        this.doctors?.length
        &&
        (
          !force
          ||
          (
            force
            &&
            now-lastDoctorNetworkLoad
              < 5*60*1000
          )
        )
      ) {
        // Re-localize cached doctor names without another network call.
        if (
          typeof this.localizedPersonName
            === 'function'
        ) {
          this.doctors =
            this.doctors.map(
              doctor=>({
                ...doctor,

                display_name:
                  this.localizedPersonName(
                    doctor
                  )
              })
            );
        }

        return this.doctors;
      }

      const result =
        await originalLoadDoctors(
          force
        );

      lastDoctorNetworkLoad =
        Date.now();

      return result;
    };


  // =========================================================
  // 3. Dashboard refresh performance
  //
  // Current dashboard refreshes every 12 sec and also re-fetches
  // notifications on every silent dashboard refresh.
  //
  // Notifications already have their own 60 sec timer, so:
  // - keep dashboard live
  // - refresh it every 30 sec
  // - do not reload notifications on silent refreshes
  // =========================================================

  const originalDashboard =
    window.ClinicPages
      ?.dashboard;

  if (originalDashboard) {
    window.ClinicPages.dashboard =
      async function(params={}) {
        let originalNotificationRefresh =
          null;

        if (
          params.silent
          &&
          window.ClinicNotifications
            ?.refresh
        ) {
          originalNotificationRefresh =
            window.ClinicNotifications
              .refresh;

          window.ClinicNotifications
            .refresh =
              async()=>{};
        }

        try {
          await originalDashboard(
            params
          );
        }
        finally {
          if (
            originalNotificationRefresh
          ) {
            window.ClinicNotifications
              .refresh =
                originalNotificationRefresh;
          }
        }


        clearTimeout(
          window.__clinicDashboardRefreshTimer
        );

        window.__clinicDashboardRefreshTimer =
          setTimeout(
            ()=>{
              if (
                C.currentPage
                  === 'dashboard'
                &&
                !document.hidden
              ) {
                window
                  .ClinicPages
                  .dashboard({
                    silent:true
                  });
              }
            },
            30000
          );
      };
  }


  // Pause expensive background timers while browser tab is hidden.
  document.addEventListener(
    'visibilitychange',
    ()=>{
      if (
        document.hidden
      ) {
        clearTimeout(
          window.__clinicDashboardRefreshTimer
        );
      }
      else if (
        C.currentPage
          === 'dashboard'
      ) {
        window
          .ClinicPages
          ?.dashboard?.({
            silent:true
          });
      }
    }
  );


  patchBookingModal();
})();