(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => C.lang === "ar" ? ar : en;

  function adjustCriticalButtons() {
    document.querySelectorAll("[data-v62-critical]").forEach(btn => {
      const raw = (btn.textContent || "").trim();

      if (/clear critical/i.test(raw) || /إنهاء الحرج/.test(raw)) {
        btn.innerHTML = `✓ ${txt("Clear","إنهاء")}`;
        btn.title = txt("Clear critical status","إنهاء الحالة الحرجة");
      } else if (/mark critical/i.test(raw) || /تحديد كحرج/.test(raw)) {
        btn.innerHTML = `🚨 ${txt("Critical","حرج")}`;
        btn.title = txt("Mark as critical","تحديد كحرج");
      }
    });
  }

  const run = () => setTimeout(adjustCriticalButtons, 50);

  run();

  const root = document.getElementById("mainContent");
  if (root && !window.__v71CriticalButtonObserver) {
    window.__v71CriticalButtonObserver = new MutationObserver(run);
    window.__v71CriticalButtonObserver.observe(root, {
      childList: true,
      subtree: true
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    [data-v62-critical]{
      white-space:nowrap!important;
      font-size:11px!important;
      padding:8px 9px!important;
      min-width:0!important;
    }
  `;
  document.head.appendChild(style);
})();