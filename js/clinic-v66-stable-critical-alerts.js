(() => {
  const C = window.Clinic;
  if (!C) return;

  const txt = (en, ar) => C.lang === "ar" ? ar : en;
  const esc = v => C.escape(v ?? "");

  function cairoDay() {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      const get = type => parts.find(p => p.type === type)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    } catch (_) {
      return new Date().toISOString().slice(0,10);
    }
  }

  function closeRoot() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  async function getCriticalItems() {
    if (!C.user?.id || !C.sb) return [];
    const { data, error } = await C.sb.rpc("v62_logistics_items");
    if (error) throw error;
    return (data || []).filter(row => row.is_critical);
  }

  function showDailyAlert(items) {
    const root = document.getElementById("modalRoot");
    if (!root || !items.length || !root.classList.contains("hidden")) return false;

    root.innerHTML = `
      <div class="modal-backdrop v66-daily-backdrop">
        <div class="modal-card v66-daily-card">
          <div class="v66-alarm">🚨</div>
          <h3>${txt("Critical logistics","لوجستيات حرجة")}</h3>
          <p>${txt(
            "Items still need urgent restocking.",
            "ما زالت هناك عناصر تحتاج إلى إعادة شراء بشكل عاجل."
          )}</p>

          <div class="v66-daily-list">
            ${items.slice(0,5).map(item => `
              <div class="v66-daily-row">
                ${item.image_url
                  ? `<img src="${esc(item.image_url)}" alt="">`
                  : `<span class="v66-placeholder">📦</span>`}
                <strong>${esc(C.lang === "ar"
                  ? (item.arabic_name || item.english_name || "عنصر")
                  : (item.english_name || item.arabic_name || "Item"))}</strong>
              </div>
            `).join("")}
            ${items.length > 5 ? `<small class="v66-more">+${items.length - 5} ${txt("more","أخرى")}</small>` : ""}
          </div>

          <div class="v66-daily-actions">
            <button type="button" class="secondary-button" id="v66CloseDaily">${txt("Close","إغلاق")}</button>
            <button type="button" class="primary-button" id="v66OpenLogistics">${txt("Open Logistics","فتح اللوجستيات")}</button>
          </div>
        </div>
      </div>
    `;
    root.classList.remove("hidden");

    root.querySelector("#v66CloseDaily")?.addEventListener("click", closeRoot, {once:true});
    root.querySelector("#v66OpenLogistics")?.addEventListener("click", () => {
      closeRoot();
      C.route("logistics");
    }, {once:true});

    return true;
  }

  async function dailyEntryCheck() {
    if (!C.user?.id || !C.sb) return;

    const today = cairoDay();
    const key = `clinic_v66_daily_critical_alert_${C.user.id}`;

    if (localStorage.getItem(key) === today) return;

    let items = [];
    try {
      items = await getCriticalItems();
    } catch (error) {
      console.warn("V66 daily critical check skipped:", error);
      return;
    }

    if (!items.length) return;

    // Wait briefly for any startup modal to finish, but stop after a few attempts.
    let attempts = 0;
    const tryShow = () => {
      attempts += 1;
      const shown = showDailyAlert(items);
      if (shown) {
        localStorage.setItem(key, today);
        return;
      }
      if (attempts < 8) setTimeout(tryShow, 700);
    };
    setTimeout(tryShow, 900);
  }

  // One finite startup check only. No DOM observer, no recursive navigation patch.
  let attempts = 0;
  const startup = setInterval(() => {
    attempts += 1;
    if (C.user?.id && C.sb) {
      clearInterval(startup);
      dailyEntryCheck();
    } else if (attempts >= 40) {
      clearInterval(startup);
    }
  }, 250);

  const style = document.createElement("style");
  style.textContent = `
    /* V66: compact the existing V62 critical popup */
    #modalRoot .v62-critical-modal{
      width:min(470px,calc(100vw - 28px))!important;
      max-width:470px!important;
      max-height:78vh!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:15px!important;
      box-sizing:border-box!important;
    }

    #modalRoot .v62-critical-modal .v62-alarm-icon{
      font-size:32px!important;
      margin:0 0 4px!important;
      line-height:1!important;
    }

    #modalRoot .v62-critical-modal h2{
      margin:4px 0 5px!important;
      font-size:21px!important;
      line-height:1.2!important;
    }

    #modalRoot .v62-critical-modal>p{
      margin:0 0 10px!important;
      font-size:12px!important;
      line-height:1.35!important;
    }

    #modalRoot .v62-critical-list{
      width:100%!important;
      min-width:0!important;
      display:grid!important;
      gap:6px!important;
      margin:8px 0 10px!important;
    }

    #modalRoot .v62-critical-row{
      width:100%!important;
      min-width:0!important;
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr) auto!important;
      gap:7px!important;
      align-items:center!important;
      padding:7px!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }

    #modalRoot .v62-critical-row img,
    #modalRoot .v62-critical-row .v62-mini-placeholder{
      width:40px!important;
      height:40px!important;
      min-width:40px!important;
      object-fit:cover!important;
    }

    #modalRoot .v62-critical-row>div:nth-child(2){
      min-width:0!important;
    }

    #modalRoot .v62-critical-row strong,
    #modalRoot .v62-critical-row small{
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }

    #modalRoot .v62-critical-row .primary-button{
      width:auto!important;
      min-width:68px!important;
      padding:7px 9px!important;
      font-size:11px!important;
      white-space:nowrap!important;
    }

    /* Once-daily first-entry warning */
    #modalRoot .v66-daily-card{
      width:min(420px,calc(100vw - 28px))!important;
      max-width:420px!important;
      max-height:75vh!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:16px!important;
      border:1px solid #efaaa4!important;
      border-radius:18px!important;
      text-align:center!important;
      box-sizing:border-box!important;
    }

    .v66-alarm{font-size:32px;line-height:1;margin-bottom:4px}
    .v66-daily-card h3{font-size:20px;color:#b42318;margin:4px 0}
    .v66-daily-card>p{font-size:12px;color:#667085;margin:0 0 10px}
    .v66-daily-list{display:grid;gap:6px;margin-bottom:11px}
    .v66-daily-row{
      display:grid;
      grid-template-columns:38px minmax(0,1fr);
      gap:8px;
      align-items:center;
      text-align:start;
      padding:6px;
      background:#fff5f4;
      border:1px solid #ffd4cf;
      border-radius:9px;
      min-width:0;
    }
    .v66-daily-row img,.v66-placeholder{
      width:38px;height:38px;border-radius:7px;object-fit:cover;
      display:grid;place-items:center;background:#fff;
    }
    .v66-daily-row strong{font-size:12px;line-height:1.25;overflow-wrap:anywhere}
    .v66-more{color:#b42318;font-weight:800}
    .v66-daily-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:7px}
    .v66-daily-actions button{width:100%!important;padding:8px!important;font-size:12px!important}

    @media(max-width:520px){
      #modalRoot .v62-critical-modal,
      #modalRoot .v66-daily-card{
        width:calc(100vw - 20px)!important;
      }
      #modalRoot .v62-critical-row{
        grid-template-columns:36px minmax(0,1fr) auto!important;
      }
      #modalRoot .v62-critical-row img,
      #modalRoot .v62-critical-row .v62-mini-placeholder{
        width:36px!important;height:36px!important;min-width:36px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();