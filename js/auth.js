const sb = window.supabaseClient;

const translations = {
  en: {
    clinicName: "Operation Clinic",
    clinicSubtitle: "Secure Clinic Management System",
    doctor1: "Dr. Ahmed Alaa",
    doctor2: "Dr. Mohamed Alaa",
    welcome: "Welcome back",
    signInText: "Sign in to continue",
    email: "Email",
    password: "Password",
    login: "Sign In",
    loggingIn: "Signing in...",
    secure: "Authorized clinic staff only",
    invalidLogin: "Incorrect email or password.",
    networkError: "Cannot reach the clinic server. Please check the connection and try again.",
    emailNotConfirmed: "This account email is not confirmed.",
    rateLimited: "Too many sign-in attempts. Please wait a moment and try again.",
    serverError: "Clinic authentication service is temporarily unavailable. Please try again shortly."
  },
  ar: {
    clinicName: "عيادة العمليات",
    clinicSubtitle: "نظام إدارة العيادة الآمن",
    doctor1: "د. أحمد علاء",
    doctor2: "د. محمد علاء",
    welcome: "مرحباً بعودتك",
    signInText: "قم بتسجيل الدخول للمتابعة",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login: "تسجيل الدخول",
    loggingIn: "جاري تسجيل الدخول...",
    secure: "مخصص لأعضاء العيادة المصرح لهم فقط",
    invalidLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    networkError: "تعذر الاتصال بسيرفر العيادة. تحقق من الإنترنت وحاول مرة أخرى.",
    emailNotConfirmed: "البريد الإلكتروني لهذا الحساب غير مؤكد.",
    rateLimited: "محاولات تسجيل دخول كثيرة. انتظر قليلاً ثم حاول مرة أخرى.",
    serverError: "خدمة تسجيل الدخول للعيادة غير متاحة مؤقتاً. حاول مرة أخرى بعد قليل."
  }
};

let currentLanguage = localStorage.getItem("clinic_language") || "ar";

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("clinic_language", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[lang][key]) element.textContent = translations[lang][key];
  });

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
}

document.querySelectorAll(".lang-btn").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});

document.getElementById("togglePassword").addEventListener("click", () => {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
});

function getLoginErrorKey(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);

  if (message.includes("invalid login credentials")) return "invalidLogin";
  if (message.includes("email not confirmed")) return "emailNotConfirmed";
  if (status === 429 || message.includes("rate limit")) return "rateLimited";
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("fetch")
  ) return "networkError";
  if (status >= 500) return "serverError";

  return "serverError";
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const button = document.getElementById("loginButton");
  const errorBox = document.getElementById("loginError");

  errorBox.classList.add("hidden");
  button.disabled = true;
  button.querySelector("span").textContent = translations[currentLanguage].loggingIn;

  try {
    if (!sb?.auth) throw new Error("Supabase client unavailable");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      const key = getLoginErrorKey(error);
      errorBox.textContent = translations[currentLanguage][key];
      errorBox.classList.remove("hidden");
      return;
    }

    window.location.replace("app.html");
  } catch (error) {
    const key = getLoginErrorKey(error);
    errorBox.textContent = translations[currentLanguage][key];
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = translations[currentLanguage].login;
  }
});

async function checkExistingLogin() {
  try {
    if (!sb?.auth) return;
    const { data, error } = await sb.auth.getSession();
    if (!error && data?.session?.user) window.location.replace("app.html");
  } catch (_) {
    // Keep the login page usable even if session restoration fails.
  }
}

setLanguage(currentLanguage);
checkExistingLogin();
