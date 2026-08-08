const sb =
  window.supabaseClient;


const translations = {

  en: {

    clinicName:
      "Operation Clinic",

    clinicSubtitle:
      "Secure Clinic Management System",

    doctor1:
      "Dr. Ahmed Alaa",

    doctor2:
      "Dr. Mohamed Alaa",

    welcome:
      "Welcome back",

    signInText:
      "Sign in to continue",

    email:
      "Email",

    password:
      "Password",

    login:
      "Sign In",

    loggingIn:
      "Signing in...",

    secure:
      "Authorized clinic staff only",

    invalidLogin:
      "Unable to sign in. Please check your email and password."
  },


  ar: {

    clinicName:
      "عيادة العمليات",

    clinicSubtitle:
      "نظام إدارة العيادة الآمن",

    doctor1:
      "د. أحمد علاء",

    doctor2:
      "د. محمد علاء",

    welcome:
      "مرحباً بعودتك",

    signInText:
      "قم بتسجيل الدخول للمتابعة",

    email:
      "البريد الإلكتروني",

    password:
      "كلمة المرور",

    login:
      "تسجيل الدخول",

    loggingIn:
      "جاري تسجيل الدخول...",

    secure:
      "مخصص لأعضاء العيادة المصرح لهم فقط",

    invalidLogin:
      "تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور."
  }

};


let currentLanguage =
  localStorage.getItem(
    "clinic_language"
  ) || "ar";



function setLanguage(lang) {

  currentLanguage = lang;

  localStorage.setItem(
    "clinic_language",
    lang
  );


  document.documentElement.lang =
    lang;

  document.documentElement.dir =
    lang === "ar"
      ? "rtl"
      : "ltr";


  document
    .querySelectorAll(
      "[data-i18n]"
    )
    .forEach((element) => {

      const key =
        element.dataset.i18n;

      if (
        translations[lang][key]
      ) {

        element.textContent =
          translations[lang][key];

      }

    });


  document
    .querySelectorAll(
      ".lang-btn"
    )
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.lang === lang
      );

    });

}



document
  .querySelectorAll(
    ".lang-btn"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        setLanguage(
          button.dataset.lang
        );

      }
    );

  });



document
  .getElementById(
    "togglePassword"
  )
  .addEventListener(
    "click",
    () => {

      const input =
        document.getElementById(
          "password"
        );


      input.type =
        input.type === "password"
          ? "text"
          : "password";

    }
  );



document
  .getElementById(
    "loginForm"
  )
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const email =
        document
          .getElementById("email")
          .value
          .trim();


      const password =
        document
          .getElementById(
            "password"
          )
          .value;


      const button =
        document.getElementById(
          "loginButton"
        );


      const errorBox =
        document.getElementById(
          "loginError"
        );


      errorBox.classList.add(
        "hidden"
      );


      button.disabled = true;

      button.querySelector(
        "span"
      ).textContent =
        translations[
          currentLanguage
        ].loggingIn;


      const {
        data,
        error
      } =
        await sb.auth.signInWithPassword({
          email,
          password
        });


      if (error || !data.user) {

        errorBox.textContent =
          translations[
            currentLanguage
          ].invalidLogin;

        errorBox.classList.remove(
          "hidden"
        );


        button.disabled =
          false;

        button.querySelector(
          "span"
        ).textContent =
          translations[
            currentLanguage
          ].login;

        return;
      }


      window.location.href =
        "app.html";

    }
  );



async function checkExistingLogin() {

  const {
    data: {
      user
    }
  } =
    await sb.auth.getUser();


  if (user) {

    window.location.href =
      "app.html";

  }

}


setLanguage(
  currentLanguage
);

checkExistingLogin();
