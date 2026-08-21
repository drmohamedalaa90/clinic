(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => C.lang === "ar" ? ar : en;
  const esc = v => C.escape(v ?? "");

  function cairoDateKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function closeModal() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  async function getCriticalItems() {
    const { data, error } = await C.sb.rpc("v62_logistics_items");
    if (error) throw error;
    return (data || []).filter(i => i.is_critical);
  }

  function showDailyEntryAlert(items) {
    const root = document.getElementById("modalRoot");
    if (!root || !items.length) return;

    root.innerHTML = `
      <div class="modal-backdrop v65-entry-backdrop">
        <div class="modal-card v65-entry-alert">
          <div class="v65-entry-icon">🚨</div>
          <div class="v65-entry-copy">
            <h3>${txt("Critical logistics","لوجستيات حرجة")}</h3>
            <p>${txt(
              "Critical items still need restocking.",
              "ما زالت هناك عناصر حرجة تحتاج إلى إعادة شراء."
            )}</p>
          </div>

          <div class="v65-entry-list">
            ${items.slice(0, 4).map(i => `
              <div class="v65-entry-row">
                ${i.image_url
                  ? `<img src="${esc(i.image_url)}" alt="">`
                  : `<div class="v65-entry-placeholder">📦</div>`}
                <strong>${esc(C.lang === "ar"
                  ? (i.arabic_name || i.english_name || "عنصر")
                  : (i.english_name || i.arabic_name || "Item"))}</strong>
              </div>
            `).join("")}
            ${items.length > 4
              ? `<div class="v65-more">+${items.length - 4} ${txt("more","أخرى")}</div>`
              : ""}
          </div>

          <div class="v65-entry-actions">
            <button type="button" class="secondary-button" id="v65DismissEntry">
              ${txt("Close","إغلاق")}
            </button>
            <button type="button" class="primary-button" id="v65OpenLogistics">
              ${txt("Open Logistics","فتح اللوجستيات")}
            </button>
          </div>
        </div>
      </div>
    `;

    root.classList.remove("hidden");

    root.querySelector("#v65DismissEntry")?.addEventListener("click", closeModal);
    root.querySelector("#v65OpenLogistics")?.addEventListener("click", () => {
      closeModal();
      C.route("logistics");
    });
  }

  async function maybeShowDailyEntryAlert() {
    if (!C.user?.id || !C.sb) return;

    const key = `clinic-v65-critical-login-alert:${C.user.id}`;
    const today = cairoDateKey();

    if (localStorage.getItem(key) === today) return;

    try {
      const items = await getCriticalItems();
      if (!items.length) return;

      // Mark once-per-day only when an alert is actually shown.
      localStorage.setItem(key, today);

      const waitForFreeModal = () => {
        const root = document.getElementById("modalRoot");
        if (!root) return;

        if (!root.classList.contains("hidden")) {
          setTimeout(waitForFreeModal, 900);
          return;
        }

        showDailyEntryAlert(items);
      };

      setTimeout(waitForFreeModal, 850);
    } catch (e) {
      console.warn("V65 daily logistics alert failed", e);
    }
  }

  // First authenticated app entry: once per user per Cairo calendar day.
  const boot = setInterval(() => {
    if (!C.user?.id || !C.sb) return;
    clearInterval(boot);
    maybeShowDailyEntryAlert();
  }, 250);

  const style = document.createElement("style");
  style.textContent = `
    /* ======================================================
       V65 — COMPACT CRITICAL LOGISTICS POPUPS
       No horizontal scrolling; designed to fit desktop/mobile.
       ====================================================== */

    #modalRoot .v62-critical-modal{
      width:min(480px,calc(100vw - 32px))!important;
      max-width:480px!important;
      max-height:min(72vh,620px)!important;
      padding:16px!important;
      overflow-x:hidden!important;
      overflow-y:auto!important;
      border-radius:18px!important;
    }

    #modalRoot .v62-critical-modal .v62-alarm-icon{
      font-size:34px!important;
      line-height:1!important;
      margin:0 0 4px!important;
    }

    #modalRoot .v62-critical-modal h2{
      font-size:22px!important;
      line-height:1.2!important;
      margin:6px 0!important;
    }

    #modalRoot .v62-critical-modal > p{
      font-size:13px!important;
      line-height:1.35!important;
      margin:0 auto 12px!important;
      max-width:420px!important;
    }

    #modalRoot .v62-critical-list{
      display:grid!important;
      gap:7px!important;
      margin:10px 0 12px!important;
      width:100%!important;
      min-width:0!important;
    }

    #modalRoot .v62-critical-row{
      display:grid!important;
      grid-template-columns:42px minmax(0,1fr) auto!important;
      gap:8px!important;
      align-items:center!important;
      width:100%!important;
      min-width:0!important;
      padding:7px!important;
      border-radius:10px!important;
      overflow:hidden!important;
    }

    #modalRoot .v62-critical-row img,
    #modalRoot .v62-critical-row .v62-mini-placeholder{
      width:42px!important;
      height:42px!important;
      min-width:42px!important;
      border-radius:8px!important;
    }

    #modalRoot .v62-critical-row > div:nth-child(2){
      min-width:0!important;
      overflow:hidden!important;
    }

    #modalRoot .v62-critical-row strong{
      display:block!important;
      font-size:13px!important;
      line-height:1.25!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }

    #modalRoot .v62-critical-row small{
      display:block!important;
      font-size:10px!important;
      line-height:1.2!important;
      margin-top:2px!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }

    #modalRoot .v62-critical-row .primary-button{
      width:auto!important;
      min-width:72px!important;
      padding:8px 10px!important;
      font-size:12px!important;
      white-space:nowrap!important;
    }

    #modalRoot .v62-critical-modal > .secondary-button{
      width:auto!important;
      padding:8px 14px!important;
      font-size:12px!important;
    }

    #modalRoot .v62-critical-modal,
    #modalRoot .v62-critical-modal *{
      box-sizing:border-box!important;
    }

    /* Daily first-login compact alert */
    #modalRoot .v65-entry-alert{
      width:min(420px,calc(100vw - 32px))!important;
      max-width:420px!important;
      max-height:70vh!important;
      overflow:auto!important;
      overflow-x:hidden!important;
      padding:18px!important;
      border-radius:18px!important;
      border:1px solid #f3b3ae!important;
      box-shadow:0 22px 60px rgba(20,30,45,.24)!important;
    }

    .v65-entry-icon{
      text-align:center;
      font-size:34px;
      line-height:1;
      margin-bottom:5px;
    }

    .v65-entry-copy{
      text-align:center;
    }

    .v65-entry-copy h3{
      margin:3px 0 4px;
      color:#b42318;
      font-size:21px;
    }

    .v65-entry-copy p{
      margin:0 0 12px;
      color:#667085;
      font-size:13px;
    }

    .v65-entry-list{
      display:grid;
      gap:6px;
      margin-bottom:12px;
    }

    .v65-entry-row{
      display:grid;
      grid-template-columns:38px minmax(0,1fr);
      gap:8px;
      align-items:center;
      padding:7px;
      border:1px solid #ffd5d1;
      background:#fff5f4;
      border-radius:10px;
      min-width:0;
    }

    .v65-entry-row img,
    .v65-entry-placeholder{
      width:38px;
      height:38px;
      object-fit:cover;
      display:grid;
      place-items:center;
      border-radius:7px;
      background:#fff;
    }

    .v65-entry-row strong{
      min-width:0;
      font-size:13px;
      line-height:1.25;
      overflow-wrap:anywhere;
    }

    .v65-more{
      text-align:center;
      color:#b42318;
      font-size:12px;
      font-weight:800;
    }

    .v65-entry-actions{
      display:grid;
      grid-template-columns:1fr 1.4fr;
      gap:8px;
    }

    .v65-entry-actions button{
      width:100%!important;
      min-width:0!important;
      padding:9px 10px!important;
      font-size:12px!important;
    }

    @media(max-width:520px){
      #modalRoot .v62-critical-modal{
        width:calc(100vw - 24px)!important;
        max-height:76vh!important;
        padding:13px!important;
      }

      #modalRoot .v62-critical-row{
        grid-template-columns:38px minmax(0,1fr) auto!important;
      }

      #modalRoot .v62-critical-row img,
      #modalRoot .v62-critical-row .v62-mini-placeholder{
        width:38px!important;
        height:38px!important;
        min-width:38px!important;
      }

      #modalRoot .v62-critical-row .primary-button{
        min-width:62px!important;
        padding:7px 8px!important;
        font-size:11px!important;
      }

      #modalRoot .v65-entry-alert{
        width:calc(100vw - 24px)!important;
        padding:14px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();