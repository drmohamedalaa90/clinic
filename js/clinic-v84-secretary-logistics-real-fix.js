(() => {
  const C = window.Clinic;
  if (!C || !window.ClinicPages) return;

  const previousLogistics = window.ClinicPages.logistics;
  const txt = (en, ar) => C.lang === "ar" ? ar : en;
  const esc = v => C.escape(v ?? "");
  let filter = "all";
  let search = "";

  function isSecretaryNow() {
    return Array.isArray(C.roles) && C.roles.includes("secretary") && !C.isManagement?.();
  }

  function displayName(i) {
    return C.lang === "ar"
      ? (i.arabic_name || i.english_name || "عنصر")
      : (i.english_name || i.arabic_name || "Item");
  }

  function catLabel(c) {
    const map = {
      drinks:["Drinks","مشروبات"],
      cleaning:["Cleaning","نظافة"],
      stationery:["Stationery","أدوات مكتبية"],
      disposable:["Disposable","مستهلكات"],
      equipment:["Equipment","معدات"],
      other:["Other","أخرى"]
    };
    const p = map[c] || map.other;
    return txt(p[0],p[1]);
  }

  function itemState(i) {
    if (i.item_type === "equipment") {
      const s = i.equipment_status || "working";
      return {
        key:s,
        label:s==="broken" ? txt("Broken","معطل")
          : s==="maintenance" ? txt("Needs maintenance","يحتاج صيانة")
          : txt("Working","يعمل")
      };
    }

    if (i.is_critical) return {key:"critical",label:txt("Critical","حرج")};

    const stock = Number(i.available_stock || 0);
    const min = Number(i.min_stock ?? 1);
    if (stock <= 0) return {key:"out",label:txt("Out of stock","نفد")};
    if (stock <= min) return {key:"low",label:txt("Low stock","مخزون منخفض")};
    return {key:"enough",label:txt("Enough","كافٍ")};
  }

  async function loadItems() {
    const {data,error} = await C.sb
      .from("clinic_inventory_items")
      .select("*")
      .eq("is_active",true)
      .order("english_name",{ascending:true,nullsFirst:false});
    if (error) throw error;
    return data || [];
  }

  function openRequest(item) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card v84-request-modal">
          <div class="modal-header">
            <div>
              <span class="eyebrow">LOGISTICS</span>
              <h3>${txt("Request to buy","طلب شراء")}</h3>
            </div>
            <button type="button" class="icon-button" data-v84-close>✕</button>
          </div>

          <div class="v84-request-head">
            ${item.image_url
              ? `<img src="${esc(item.image_url)}" alt="">`
              : `<div class="v84-placeholder">📦</div>`}
            <div>
              <strong>${esc(displayName(item))}</strong>
              <small>${txt("Current stock","المخزون الحالي")}: ${Number(item.available_stock || 0)}</small>
            </div>
          </div>

          <form id="v84RequestForm" class="v84-form">
            <label>
              <span>${txt("Quantity needed","الكمية المطلوبة")}</span>
              <input class="control" type="number" min="1" step="1" value="1" name="quantity" required>
            </label>

            <label>
              <span>${txt("Reason / note","السبب / ملاحظة")}</span>
              <textarea class="control" rows="3" name="reason"></textarea>
            </label>

            <button class="primary-button" type="submit">
              ${txt("Send purchase request","إرسال طلب الشراء")}
            </button>
          </form>
        </div>
      </div>`;

    root.classList.remove("hidden");

    root.querySelector("[data-v84-close]").onclick = () => {
      root.classList.add("hidden");
      root.innerHTML = "";
    };

    root.querySelector("#v84RequestForm").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const btn = e.currentTarget.querySelector('[type="submit"]');
      btn.disabled = true;

      const {error} = await C.sb.rpc("v44_request_inventory_item",{
        p_item:item.id,
        p_quantity:Number(fd.get("quantity") || 1),
        p_reason:String(fd.get("reason") || "").trim()
      });

      if (error) {
        btn.disabled = false;
        return C.toast(error.message,"error");
      }

      root.classList.add("hidden");
      root.innerHTML = "";
      C.toast(txt("Purchase request sent.","تم إرسال طلب الشراء."));
    };
  }

  function matches(i) {
    const q = search.toLowerCase();
    const n = `${i.arabic_name || ""} ${i.english_name || ""}`.toLowerCase();
    if (q && !n.includes(q)) return false;
    if (filter === "all") return true;
    if (filter === "critical") return !!i.is_critical;
    if (filter === "equipment") return i.item_type === "equipment";
    return i.category === filter;
  }

  function card(i) {
    const s = itemState(i);
    const equipment = i.item_type === "equipment";

    return `
      <article class="v84-card ${i.is_critical ? "critical" : ""}">
        <div class="v84-photo">
          ${i.image_url
            ? `<img src="${esc(i.image_url)}" alt="${esc(displayName(i))}" loading="lazy">`
            : `<div class="v84-placeholder">📦</div>`}

          <span class="v84-status ${esc(s.key)}">
            ${s.key==="critical" ? "🚨 "
              : s.key==="enough" || s.key==="working" ? "✓ "
              : s.key==="low" || s.key==="maintenance" ? "⚠ "
              : ""}${esc(s.label)}
          </span>
        </div>

        <div class="v84-name">${esc(displayName(i))}</div>
        <div class="v84-category">${esc(catLabel(i.category))}</div>

        ${equipment
          ? `<div class="v84-equipment ${esc(s.key)}">
               <span>${esc(s.label)}</span>
               ${i.maintenance_due_date
                 ? `<small>${txt("Maintenance","الصيانة")}: ${esc(i.maintenance_due_date)}</small>`
                 : ""}
             </div>`
          : `<div class="v84-stock">
               <span>${txt("Stock","المخزون")}</span>
               <strong>${Number(i.available_stock || 0)}</strong>
             </div>`}

        <button type="button" class="primary-button v84-buy" data-v84-buy="${esc(i.id)}">
          🛒 ${txt("Request to buy","طلب شراء")}
        </button>
      </article>`;
  }

  function bind(main,items) {
    main.querySelectorAll("[data-v84-buy]").forEach(btn => {
      btn.onclick = () => {
        const item = items.find(x => x.id === btn.dataset.v84Buy);
        if (item) openRequest(item);
      };
    });

    main.querySelectorAll("[data-v84-filter]").forEach(btn => {
      btn.onclick = () => {
        filter = btn.dataset.v84Filter;
        renderSecretaryLogistics();
      };
    });

    const searchBox = main.querySelector("#v84Search");
    if (searchBox) {
      searchBox.value = search;
      searchBox.oninput = () => {
        search = searchBox.value.trim();
        const filtered = items.filter(matches);
        main.querySelector("#v84Grid").innerHTML = filtered.length
          ? filtered.map(card).join("")
          : `<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`;
        bind(main,items);
      };
    }
  }

  async function renderSecretaryLogistics() {
    C.setTitle(txt("Logistics & Inventory","اللوجستيات والمخزون"));

    const main = document.getElementById("mainContent");
    if (!main) return;

    main.innerHTML = `<section class="content-card empty-state">${txt("Loading logistics...","جارٍ تحميل اللوجستيات...")}</section>`;

    let items;
    try {
      items = await loadItems();
    } catch (e) {
      main.innerHTML = `<section class="content-card empty-state">${esc(e.message)}</section>`;
      return;
    }

    const filtered = items.filter(matches);
    const critical = items.filter(x => x.is_critical).length;
    const equipment = items.filter(x => x.item_type === "equipment").length;

    main.innerHTML = `
      <section class="v84-page">
        <header class="v84-header">
          <div>
            <span class="eyebrow">CLINIC LOGISTICS</span>
            <h2>${txt("Logistics & Inventory","اللوجستيات والمخزون")}</h2>
            <p class="muted">${txt(
              "Same clinic inventory view with stock status, equipment status and purchase requests.",
              "نفس عرض مخزون العيادة مع حالة المخزون والمعدات وإمكانية إرسال طلب شراء."
            )}</p>
          </div>
        </header>

        <div class="v84-summary">
          <button data-v84-filter="all" class="${filter==="all"?"active":""}">
            <strong>${items.length}</strong><span>${txt("All","الكل")}</span>
          </button>
          <button data-v84-filter="critical" class="${filter==="critical"?"active":""}">
            <strong>${critical}</strong><span>🚨 ${txt("Critical","حرج")}</span>
          </button>
          <button data-v84-filter="equipment" class="${filter==="equipment"?"active":""}">
            <strong>${equipment}</strong><span>${txt("Equipment","معدات")}</span>
          </button>
        </div>

        <div class="v84-tools">
          <input id="v84Search" class="control" placeholder="${txt("Search items...","ابحث عن عنصر...")}">
          <div class="v84-chips">
            ${[
              ["drinks",txt("Drinks","مشروبات")],
              ["cleaning",txt("Cleaning","نظافة")],
              ["stationery",txt("Stationery","أدوات مكتبية")],
              ["disposable",txt("Disposable","مستهلكات")],
              ["equipment",txt("Equipment","معدات")],
              ["other",txt("Other","أخرى")]
            ].map(([k,l]) => `<button data-v84-filter="${k}" class="${filter===k?"active":""}">${esc(l)}</button>`).join("")}
          </div>
        </div>

        <div id="v84Grid" class="v84-grid">
          ${filtered.length
            ? filtered.map(card).join("")
            : `<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`}
        </div>
      </section>`;

    bind(main,items);
  }

  // CRITICAL FIX:
  // Do NOT check secretary role while scripts are loading.
  // Roles are loaded asynchronously later by core.js.
  // Check the role only when the Logistics route is actually opened.
  window.ClinicPages.logistics = async function (...args) {
    if (isSecretaryNow()) {
      return renderSecretaryLogistics();
    }
    return previousLogistics?.(...args);
  };

  const style = document.createElement("style");
  style.textContent = `
    .v84-page{display:grid;gap:15px}.v84-header h2{margin:3px 0 5px}
    .v84-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .v84-summary button{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:14px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
    .v84-summary button.active{border-color:#112238;box-shadow:0 0 0 2px rgba(17,34,56,.08)}
    .v84-summary strong{font-size:20px}.v84-summary span{font-size:12px;color:#667085}
    .v84-tools{display:grid;gap:9px}.v84-tools>.control{max-width:420px}
    .v84-chips{display:flex;gap:7px;flex-wrap:wrap}
    .v84-chips button{border:1px solid rgba(17,34,56,.12);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}
    .v84-chips button.active{background:#112238;color:#fff}
    .v84-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:13px}
    .v84-card{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 20px rgba(17,34,56,.05);min-width:0}
    .v84-card.critical{border:2px solid #e5484d;box-shadow:0 8px 22px rgba(229,72,77,.14)}
    .v84-photo{position:relative;aspect-ratio:1/1;border-radius:13px;overflow:hidden;background:#f4f6f8}
    .v84-photo img{width:100%;height:100%;object-fit:cover;display:block}
    .v84-placeholder{width:100%;height:100%;display:grid;place-items:center;font-size:42px}
    .v84-status{position:absolute;top:8px;right:8px;border-radius:999px;padding:6px 8px;font-size:10px;font-weight:900;box-shadow:0 3px 12px rgba(0,0,0,.12);white-space:nowrap}
    .v84-status.enough,.v84-status.working{background:#eaf8ef;color:#157a3d}
    .v84-status.low,.v84-status.maintenance{background:#fff4df;color:#9d5a00}
    .v84-status.out,.v84-status.broken,.v84-status.critical{background:#d92d20;color:#fff}
    .v84-name{text-align:center;font-weight:850;font-size:14px;padding:9px 3px 2px;min-height:42px;display:grid;place-items:center}
    .v84-category{text-align:center;color:#7a8699;font-size:11px;margin-bottom:7px}
    .v84-stock,.v84-equipment{border-top:1px solid #eef0f3;padding:8px 2px;font-size:12px;display:flex;justify-content:space-between;gap:8px}
    .v84-stock strong{font-size:16px}.v84-equipment{display:grid;text-align:center}
    .v84-buy{width:100%!important;margin-top:5px;padding:9px!important;font-size:12px!important}
    #modalRoot .v84-request-modal{width:min(460px,calc(100vw - 24px))!important;max-width:460px!important;padding:15px!important;border-radius:18px!important;overflow:hidden!important}
    .v84-request-head{display:flex;align-items:center;gap:10px;background:#f6f8fa;border-radius:12px;padding:9px;margin-bottom:11px}
    .v84-request-head img,.v84-request-head>.v84-placeholder{width:58px;height:58px;border-radius:9px;object-fit:cover;flex:none}
    .v84-request-head>div:last-child{display:grid;gap:3px}.v84-form{display:grid;gap:10px}.v84-form label{display:grid;gap:5px;font-size:12px;font-weight:800}
    .v84-form textarea.control{height:auto!important;min-height:70px!important}
    @media(max-width:700px){.v84-summary{grid-template-columns:1fr}.v84-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}}
  `;
  document.head.appendChild(style);
})();