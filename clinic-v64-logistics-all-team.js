(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => (C.lang === "ar" ? ar : en);

  let navObserver = null;
  let realtimeChannel = null;
  let refreshTimer = null;
  let lastCriticalCount = null;
  let applyingNav = false;

  function getNavigation() {
    return document.getElementById("navigation");
  }

  function getLogisticsItem() {
    return getNavigation()?.querySelector('[data-page="logistics"]') || null;
  }

  function createLogisticsItem() {
    const navigation = getNavigation();
    if (!navigation) return null;

    const finance = navigation.querySelector('[data-page="finance"]');
    const template = finance || navigation.querySelector('[data-page]');
    if (!template) return null;

    const tag = template.tagName?.toLowerCase() === "a" ? "a" : "button";
    const item = document.createElement(tag);

    if (template.className) item.className = template.className;
    if (tag === "button") item.type = "button";

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
    } else {
      navigation.appendChild(item);
    }

    return item;
  }

  function ensureLogisticsVisible() {
    if (applyingNav || !C.user?.id) return;

    const navigation = getNavigation();
    if (!navigation) return;

    applyingNav = true;
    try {
      let item = getLogisticsItem() || createLogisticsItem();
      if (!item) return;

      // IMPORTANT: only change properties when they actually need changing.
      // The old V64 repeatedly changed observed attributes and could cause
      // a MutationObserver loop that froze/collapsed the app.
      if (item.hidden) item.hidden = false;
      if (item.getAttribute("aria-hidden") === "true") item.removeAttribute("aria-hidden");
      if (item.classList.contains("hidden")) item.classList.remove("hidden");
      if (item.style.display === "none") item.style.removeProperty("display");

      item.classList.toggle("active", C.currentPage === "logistics");

      let badge = item.querySelector(".v64-logistics-alert");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "v64-logistics-alert hidden";
        badge.setAttribute("aria-label", "Critical logistics");
        badge.textContent = "⚠";
        item.appendChild(badge);
      }
    } finally {
      applyingNav = false;
    }
  }

  async function refreshCriticalAlert() {
    if (!C.user?.id || !C.sb) return;

    ensureLogisticsVisible();

    const item = getLogisticsItem();
    if (!item) return;

    let badge = item.querySelector(".v64-logistics-alert");
    if (!badge) return;

    try {
      const { data, error } = await C.sb.rpc("v62_critical_logistics_count");
      if (error) throw error;

      const count = Number(data || 0);

      // Avoid rewriting DOM unless the count changed.
      if (lastCriticalCount !== count) {
        lastCriticalCount = count;

        badge.classList.toggle("hidden", count <= 0);
        badge.textContent = count > 1 ? `⚠ ${count}` : "⚠";
        badge.title = txt(
          `${count} critical logistics item${count === 1 ? "" : "s"}`,
          `${count} عنصر لوجستي حرج`
        );
      }
    } catch (error) {
      console.warn("V64 logistics alert refresh failed:", error);
    }
  }

  function patchNavigationBuilder() {
    if (typeof C.buildNavigation !== "function") return;
    if (C.buildNavigation.__v64SafeWrapped) return;

    const original = C.buildNavigation.bind(C);

    function wrappedBuildNavigation(...args) {
      const result = original(...args);
      queueMicrotask(() => {
        ensureLogisticsVisible();
        refreshCriticalAlert();
      });
      return result;
    }

    wrappedBuildNavigation.__v64SafeWrapped = true;
    C.buildNavigation = wrappedBuildNavigation;
  }

  function installNavigationObserver() {
    const navigation = getNavigation();
    if (!navigation || navObserver) return;

    // SAFE FIX:
    // Observe only child insertion/removal. Do NOT observe class/style/hidden
    // attributes, because ensureLogisticsVisible itself updates those values.
    navObserver = new MutationObserver(() => {
      if (applyingNav) return;
      ensureLogisticsVisible();
    });

    navObserver.observe(navigation, {
      childList: true,
      subtree: false
    });
  }

  function installRealtime() {
    if (!C.sb || realtimeChannel) return;

    realtimeChannel = C.sb
      .channel(`clinic-v64-safe-logistics-${C.user?.id || "user"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clinic_inventory_items" },
        () => refreshCriticalAlert()
      )
      .subscribe();
  }

  function boot() {
    if (!C.user?.id || !C.sb) return false;

    patchNavigationBuilder();
    ensureLogisticsVisible();
    installNavigationObserver();
    installRealtime();
    refreshCriticalAlert();

    // Low-frequency fallback only; no aggressive DOM loop.
    if (!refreshTimer) {
      refreshTimer = window.setInterval(refreshCriticalAlert, 60000);
    }

    return true;
  }

  const bootTimer = window.setInterval(() => {
    if (boot()) window.clearInterval(bootTimer);
  }, 300);

  const style = document.createElement("style");
  style.textContent = `
    #navigation [data-page="logistics"]{
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
    }

    #navigation [data-page="logistics"] .v64-logistics-alert.hidden{
      display:none!important;
    }
  `;
  document.head.appendChild(style);
})();