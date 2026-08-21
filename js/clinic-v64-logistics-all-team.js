(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => C.lang === "ar" ? ar : en;

  function makeLogisticsNavVisible() {
    if (!C.user?.id) return;

    const navigation = document.getElementById("navigation");
    if (!navigation) return;

    let item = navigation.querySelector('[data-page="logistics"]');

    if (!item) {
      const finance = navigation.querySelector('[data-page="finance"]');
      const template = finance || navigation.querySelector('[data-page]');

      item = document.createElement(template?.tagName?.toLowerCase() === "a" ? "a" : "button");
      if (template?.className) item.className = template.className;
      if (item.tagName === "BUTTON") item.type = "button";

      item.dataset.page = "logistics";
      item.classList.add("v64-team-logistics-nav");
      item.innerHTML = `
        <span class="v64-logistics-icon">📦</span>
        <span class="v64-logistics-label">${txt("Logistics","اللوجستيات")}</span>
        <span class="v64-logistics-alert hidden" aria-label="Critical logistics">⚠</span>
      `;

      item.addEventListener("click", (event) => {
        event.preventDefault();
        C.route("logistics");
      });

      if (finance?.nextSibling) {
        navigation.insertBefore(item, finance.nextSibling);
      } else if (finance) {
        navigation.appendChild(item);
      } else {
        navigation.appendChild(item);
      }
    }

    item.style.display = "";
    item.hidden = false;
    item.removeAttribute("aria-hidden");
    item.classList.remove("hidden");

    // Keep route state visually consistent.
    if (C.currentPage === "logistics") item.classList.add("active");
  }

  async function refreshCriticalAlert() {
    if (!C.user?.id) return;

    makeLogisticsNavVisible();

    const item = document.querySelector('#navigation [data-page="logistics"]');
    if (!item) return;

    let badge = item.querySelector(".v64-logistics-alert");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "v64-logistics-alert hidden";
      badge.textContent = "⚠";
      item.appendChild(badge);
    }

    try {
      const { data, error } = await C.sb.rpc("v62_critical_logistics_count");
      if (error) throw error;

      const count = Number(data || 0);
      badge.classList.toggle("hidden", count <= 0);
      badge.textContent = count > 1 ? `⚠ ${count}` : "⚠";
      badge.title = txt(
        `${count} critical logistics item${count === 1 ? "" : "s"}`,
        `${count} عنصر لوجستي حرج`
      );

      // Ensure all team members also see the global notification count contribution.
      const top = document.getElementById("notificationBadge");
      if (top) {
        const existing = Number(top.textContent || 0);
        const old = Number(top.dataset.v64LogisticsCritical || 0);
        const base = Math.max(0, existing - old);
        const total = base + count;

        top.dataset.v64LogisticsCritical = String(count);
        top.textContent = String(total);
        top.classList.toggle("hidden", total <= 0);
      }
    } catch (e) {
      console.warn("V64 logistics alert refresh failed", e);
    }
  }

  function patchNavigationBuilder() {
    if (!C.buildNavigation || C.buildNavigation.__v64Wrapped) return;

    const original = C.buildNavigation.bind(C);
    const wrapped = function (...args) {
      const result = original(...args);
      setTimeout(() => {
        makeLogisticsNavVisible();
        refreshCriticalAlert();
      }, 0);
      return result;
    };

    wrapped.__v64Wrapped = true;
    C.buildNavigation = wrapped;
  }

  function observeNavigation() {
    const navigation = document.getElementById("navigation");
    if (!navigation || window.__v64NavObserver) return;

    window.__v64NavObserver = new MutationObserver(() => {
      makeLogisticsNavVisible();
    });

    window.__v64NavObserver.observe(navigation, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"]
    });
  }

  function installRealtime() {
    if (!C.sb || window.__v64LogisticsRealtime) return;

    window.__v64LogisticsRealtime = C.sb
      .channel(`clinic-v64-logistics-team-${C.user?.id || "user"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clinic_inventory_items" },
        () => refreshCriticalAlert()
      )
      .subscribe();
  }

  // All authenticated clinic team roles get the same Logistics visibility and alerts.
  const boot = setInterval(() => {
    if (!C.user?.id || !C.sb) return;

    clearInterval(boot);
    patchNavigationBuilder();
    makeLogisticsNavVisible();
    observeNavigation();
    installRealtime();
    refreshCriticalAlert();

    // Re-assert visibility after app shell/page changes.
    setTimeout(makeLogisticsNavVisible, 500);
    setTimeout(makeLogisticsNavVisible, 1500);
  }, 250);

  // Safety refresh in case realtime is temporarily unavailable.
  setInterval(() => {
    if (C.user?.id) refreshCriticalAlert();
  }, 30000);

  const style = document.createElement("style");
  style.textContent = `
    #navigation [data-page="logistics"].v64-team-logistics-nav{
      position:relative;
    }

    #navigation [data-page="logistics"] .v64-logistics-alert{
      margin-inline-start:auto;
      min-width:25px;
      height:25px;
      padding:0 6px;
      border-radius:999px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:#f59e0b;
      color:#fff;
      font-size:12px;
      font-weight:900;
      line-height:1;
      box-shadow:0 0 0 4px rgba(245,158,11,.15);
      animation:v64LogisticsAlertPulse 1.1s infinite alternate;
    }

    #navigation [data-page="logistics"] .v64-logistics-alert.hidden{
      display:none!important;
    }

    @keyframes v64LogisticsAlertPulse{
      from{ transform:scale(1); }
      to{ transform:scale(1.08); }
    }
  `;
  document.head.appendChild(style);
})();