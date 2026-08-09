(() => {
  function applyLoginTitleFix() {
    const lang =
      document.documentElement.lang
      ||
      localStorage.getItem(
        'clinic_language'
      )
      ||
      'ar';

    const title =
      document.querySelector(
        '[data-i18n="clinicName"]'
      );

    const subtitle =
      document.querySelector(
        '[data-i18n="clinicSubtitle"]'
      );

    const doctor1 =
      document.querySelector(
        '[data-i18n="doctor1"]'
      );

    const doctor2 =
      document.querySelector(
        '[data-i18n="doctor2"]'
      );

    if (lang === 'ar') {
      if (title) {
        title.textContent =
          'إدارة العيادة';
      }

      if (subtitle) {
        subtitle.textContent =
          'نظام إدارة العيادة';
      }

      if (doctor1) {
        doctor1.textContent =
          'د أحمد علاء';
      }

      if (doctor2) {
        doctor2.textContent =
          'د محمد علاء';
      }

      document.title =
        'إدارة العيادة';
    }
    else {
      if (title) {
        title.textContent =
          'Operation Clinic';
      }

      if (subtitle) {
        subtitle.textContent =
          'Secure Clinic Management System';
      }

      if (doctor1) {
        doctor1.textContent =
          'Dr. Ahmed Alaa';
      }

      if (doctor2) {
        doctor2.textContent =
          'Dr. Mohamed Alaa';
      }

      document.title =
        'Operation Clinic';
    }
  }


  document
    .querySelectorAll(
      '.lang-btn'
    )
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>{
          setTimeout(
            applyLoginTitleFix,
            0
          );
        }
      );
    });


  const observer =
    new MutationObserver(
      applyLoginTitleFix
    );

  observer.observe(
    document.documentElement,
    {
      attributes:true,
      attributeFilter:[
        'lang',
        'dir'
      ]
    }
  );


  applyLoginTitleFix();
})();