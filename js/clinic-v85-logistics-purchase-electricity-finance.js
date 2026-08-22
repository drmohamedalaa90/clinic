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
        <div class="modal-card v85-modal">
          <div class="modal-header">
            <div><span class="eyebrow">LOGISTICS</span><h3>${txt("Request to buy","طلب شراء")}</h3></div>
            <button type="button" class="icon-button" data-v85-close>✕</button>
          </div>

          <div class="v85-head">
            ${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : `<div class="v85-placeholder">📦</div>`}
            <div><strong>${esc(displayName(item))}</strong><small>${txt("Current stock","المخزون الحالي")}: ${Number(item.available_stock||0)}</small></div>
          </div>

          <form id="v85RequestForm" class="v85-form">
            <label><span>${txt("Quantity needed","الكمية المطلوبة")}</span><input class="control" type="number" min="1" step="1" value="1" name="quantity" required></label>
            <label><span>${txt("Reason / note","السبب / ملاحظة")}</span><textarea class="control" rows="3" name="reason"></textarea></label>
            <button class="secondary-button" type="submit">${txt("Send purchase request","إرسال طلب الشراء")}</button>
          </form>
        </div>
      </div>`;
    root.classList.remove("hidden");
    root.querySelector("[data-v85-close]").onclick = () => { root.classList.add("hidden"); root.innerHTML=""; };

    root.querySelector("#v85RequestForm").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const btn = e.currentTarget.querySelector('[type="submit"]');
      btn.disabled = true;

      const {error} = await C.sb.rpc("v44_request_inventory_item",{
        p_item:item.id,
        p_quantity:Number(fd.get("quantity")||1),
        p_reason:String(fd.get("reason")||"").trim()
      });

      if (error) { btn.disabled=false; return C.toast(error.message,"error"); }
      root.classList.add("hidden"); root.innerHTML="";
      C.toast(txt("Purchase request sent.","تم إرسال طلب الشراء."));
    };
  }

  function openBought(item) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card v85-modal">
          <div class="modal-header">
            <div><span class="eyebrow">PURCHASE</span><h3>${txt("Bought / Restock","تم الشراء / إضافة مخزون")}</h3></div>
            <button type="button" class="icon-button" data-v85-close>✕</button>
          </div>

          <div class="v85-head">
            ${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : `<div class="v85-placeholder">📦</div>`}
            <div><strong>${esc(displayName(item))}</strong><small>${txt("Current stock","المخزون الحالي")}: ${Number(item.available_stock||0)}</small></div>
          </div>

          <form id="v85BoughtForm" class="v85-form">
            <div class="v85-grid2">
              <label><span>${txt("Quantity bought","الكمية المشتراة")}</span><input class="control" type="number" min="1" step="1" value="1" name="quantity" required></label>
              <label><span>${txt("Amount paid (EGP)","المبلغ المدفوع (جنيه)")}</span><input class="control" type="number" min="0.01" step="0.01" name="amount" required></label>
            </div>
            <label><span>${txt("Payment method","طريقة الدفع")}</span>
              <select class="control" name="payment_method">
                <option value="cash">${txt("Cash","نقدي")}</option>
                <option value="card">${txt("Card","بطاقة")}</option>
                <option value="instapay">Instapay</option>
                <option value="bank_transfer">${txt("Bank transfer","تحويل بنكي")}</option>
                <option value="other">${txt("Other","أخرى")}</option>
              </select>
            </label>
            <label><span>${txt("Purchase note","ملاحظة الشراء")}</span><textarea class="control" rows="3" name="note"></textarea></label>
            <button class="primary-button" type="submit">✓ ${txt("Save purchase & add Finance expense","حفظ الشراء وإضافته كمصروف")}</button>
          </form>
        </div>
      </div>`;
    root.classList.remove("hidden");
    root.querySelector("[data-v85-close]").onclick = () => { root.classList.add("hidden"); root.innerHTML=""; };

    root.querySelector("#v85BoughtForm").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const btn = e.currentTarget.querySelector('[type="submit"]');
      btn.disabled = true;

      const {error} = await C.sb.rpc("v85_record_inventory_purchase",{
        p_item:item.id,
        p_units_added:Number(fd.get("quantity")||1),
        p_amount_paid:Number(fd.get("amount")||0),
        p_payment_method:String(fd.get("payment_method")||"cash"),
        p_note:String(fd.get("note")||"").trim()
      });

      if (error) { btn.disabled=false; return C.toast(error.message,"error"); }

      root.classList.add("hidden"); root.innerHTML="";
      C.toast(txt(
        "Purchase saved and added to Finance expenses.",
        "تم حفظ الشراء وإضافته إلى المصروفات في المالية."
      ));
      renderSecretaryLogistics();
    };
  }

  async function openElectricity(item) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const {data:status,error:statusError} = await C.sb.rpc("v85_electricity_saturday_status");
    if (statusError) return C.toast(statusError.message,"error");

    if (!status?.is_saturday) {
      return C.toast(txt(
        "Electricity weekly note can be edited on Saturday.",
        "يمكن تعديل ملاحظة الكهرباء الأسبوعية يوم السبت."
      ),"error");
    }

    const note = status.note || "";
    const amount = Number(status.amount_paid || 0);
    const method = status.payment_method || "cash";
    const reading = status.meter_reading || "";

    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card v85-modal">
          <div class="modal-header">
            <div><span class="eyebrow">SATURDAY ELECTRICITY</span><h3>${txt("Electricity weekly note","ملاحظة الكهرباء الأسبوعية")}</h3></div>
            <button type="button" class="icon-button" data-v85-close>✕</button>
          </div>

          <div class="v85-head">
            ${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : `<div class="v85-placeholder">⚡</div>`}
            <div><strong>${esc(displayName(item))}</strong><small>${esc(status.saturday_date || "")}</small></div>
          </div>

          <form id="v85ElectricityForm" class="v85-form">
            <label><span>${txt("Meter reading (optional)","قراءة العداد (اختياري)")}</span><input class="control" name="reading" value="${esc(reading)}"></label>
            <label><span>${txt("Saturday note","ملاحظة السبت")}</span><textarea class="control" rows="4" name="note" required>${esc(note)}</textarea></label>
            <div class="v85-grid2">
              <label><span>${txt("Amount paid (EGP)","المبلغ المدفوع (جنيه)")}</span><input class="control" type="number" min="0" step="0.01" name="amount" value="${amount ? amount : ""}"></label>
              <label><span>${txt("Payment method","طريقة الدفع")}</span>
                <select class="control" name="payment_method">
                  <option value="cash" ${method==="cash"?"selected":""}>${txt("Cash","نقدي")}</option>
                  <option value="card" ${method==="card"?"selected":""}>${txt("Card","بطاقة")}</option>
                  <option value="instapay" ${method==="instapay"?"selected":""}>Instapay</option>
                  <option value="bank_transfer" ${method==="bank_transfer"?"selected":""}>${txt("Bank transfer","تحويل بنكي")}</option>
                  <option value="other" ${method==="other"?"selected":""}>${txt("Other","أخرى")}</option>
                </select>
              </label>
            </div>
            <div class="v85-note">${txt(
              "If an amount is entered, it is saved automatically as an Electricity expense in Finance. Editing the same Saturday updates the same expense rather than creating a duplicate.",
              "عند إدخال مبلغ يتم تسجيله تلقائياً كمصروف كهرباء في المالية. تعديل نفس يوم السبت يقوم بتحديث نفس المصروف ولا ينشئ مصروفاً مكرراً."
            )}</div>
            <button class="primary-button" type="submit">${txt("Save / Edit Saturday note","حفظ / تعديل ملاحظة السبت")}</button>
          </form>
        </div>
      </div>`;
    root.classList.remove("hidden");
    root.querySelector("[data-v85-close]").onclick = () => { root.classList.add("hidden"); root.innerHTML=""; };

    root.querySelector("#v85ElectricityForm").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const btn = e.currentTarget.querySelector('[type="submit"]');
      btn.disabled = true;

      const {error} = await C.sb.rpc("v85_save_electricity_saturday_note",{
        p_note:String(fd.get("note")||"").trim(),
        p_meter_reading:String(fd.get("reading")||"").trim(),
        p_amount_paid:Number(fd.get("amount")||0),
        p_payment_method:String(fd.get("payment_method")||"cash")
      });

      if (error) { btn.disabled=false; return C.toast(error.message,"error"); }

      root.classList.add("hidden"); root.innerHTML="";
      C.toast(txt(
        "Saturday electricity note saved.",
        "تم حفظ ملاحظة الكهرباء ليوم السبت."
      ));
      renderSecretaryLogistics();
    };
  }

  function matches(i) {
    const q = search.toLowerCase();
    const n = `${i.arabic_name||""} ${i.english_name||""}`.toLowerCase();
    if (q && !n.includes(q)) return false;
    if (filter==="all") return true;
    if (filter==="critical") return !!i.is_critical;
    if (filter==="equipment") return i.item_type==="equipment";
    return i.category===filter;
  }

  function card(i) {
    const s = itemState(i);
    const electricity = i.system_key === "electricity" || /electricity|الكهرباء/i.test(`${i.english_name||""} ${i.arabic_name||""}`);
    const equipment = i.item_type==="equipment";

    return `
      <article class="v85-card ${i.is_critical?"critical":""}">
        <div class="v85-photo">
          ${i.image_url ? `<img src="${esc(i.image_url)}" alt="${esc(displayName(i))}" loading="lazy">` : `<div class="v85-placeholder">${electricity?"⚡":"📦"}</div>`}
          <span class="v85-status ${esc(s.key)}">${s.key==="critical"?"🚨 ":s.key==="enough"||s.key==="working"?"✓ ":s.key==="low"||s.key==="maintenance"?"⚠ ":""}${esc(s.label)}</span>
        </div>

        <div class="v85-name">${esc(displayName(i))}</div>
        <div class="v85-category">${esc(catLabel(i.category))}</div>

        ${equipment
          ? `<div class="v85-equip ${esc(s.key)}"><span>${esc(s.label)}</span></div>`
          : `<div class="v85-stock"><span>${txt("Stock","المخزون")}</span><strong>${Number(i.available_stock||0)}</strong></div>`}

        ${electricity ? `
          <button type="button" class="secondary-button v85-electricity" data-v85-electricity="${esc(i.id)}">⚡ ${txt("Saturday note / amount","ملاحظة السبت / المبلغ")}</button>
        ` : `
          <div class="v85-actions">
            <button type="button" class="secondary-button" data-v85-request="${esc(i.id)}">🛒 ${txt("Request","طلب شراء")}</button>
            <button type="button" class="primary-button" data-v85-bought="${esc(i.id)}">✓ ${txt("Bought","تم الشراء")}</button>
          </div>
        `}
      </article>`;
  }

  function bind(main,items) {
    main.querySelectorAll("[data-v85-request]").forEach(btn => {
      btn.onclick = () => {
        const i = items.find(x=>x.id===btn.dataset.v85Request);
        if (i) openRequest(i);
      };
    });

    main.querySelectorAll("[data-v85-bought]").forEach(btn => {
      btn.onclick = () => {
        const i = items.find(x=>x.id===btn.dataset.v85Bought);
        if (i) openBought(i);
      };
    });

    main.querySelectorAll("[data-v85-electricity]").forEach(btn => {
      btn.onclick = () => {
        const i = items.find(x=>x.id===btn.dataset.v85Electricity);
        if (i) openElectricity(i);
      };
    });

    main.querySelectorAll("[data-v85-filter]").forEach(btn => {
      btn.onclick = () => { filter=btn.dataset.v85Filter; renderSecretaryLogistics(); };
    });

    const box = main.querySelector("#v85Search");
    if (box) {
      box.value = search;
      box.oninput = () => {
        search = box.value.trim();
        const filtered = items.filter(matches);
        main.querySelector("#v85Grid").innerHTML = filtered.length
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
    try { items = await loadItems(); }
    catch(e) { main.innerHTML=`<section class="content-card empty-state">${esc(e.message)}</section>`; return; }

    const filtered = items.filter(matches);
    const critical = items.filter(x=>x.is_critical).length;
    const equipment = items.filter(x=>x.item_type==="equipment").length;

    main.innerHTML = `
      <section class="v85-page">
        <header><span class="eyebrow">CLINIC LOGISTICS</span><h2>${txt("Logistics & Inventory","اللوجستيات والمخزون")}</h2><p class="muted">${txt(
          "Request items, record purchases and track Saturday electricity expenses.",
          "اطلب العناصر وسجل المشتريات وتابع مصروفات الكهرباء يوم السبت."
        )}</p></header>

        <div class="v85-summary">
          <button data-v85-filter="all" class="${filter==="all"?"active":""}"><strong>${items.length}</strong><span>${txt("All","الكل")}</span></button>
          <button data-v85-filter="critical" class="${filter==="critical"?"active":""}"><strong>${critical}</strong><span>🚨 ${txt("Critical","حرج")}</span></button>
          <button data-v85-filter="equipment" class="${filter==="equipment"?"active":""}"><strong>${equipment}</strong><span>${txt("Equipment","معدات")}</span></button>
        </div>

        <div class="v85-tools">
          <input id="v85Search" class="control" placeholder="${txt("Search items...","ابحث عن عنصر...")}">
          <div class="v85-chips">${[
            ["drinks",txt("Drinks","مشروبات")],["cleaning",txt("Cleaning","نظافة")],["stationery",txt("Stationery","أدوات مكتبية")],
            ["disposable",txt("Disposable","مستهلكات")],["equipment",txt("Equipment","معدات")],["other",txt("Other","أخرى")]
          ].map(([k,l])=>`<button data-v85-filter="${k}" class="${filter===k?"active":""}">${esc(l)}</button>`).join("")}</div>
        </div>

        <div id="v85Grid" class="v85-grid">${filtered.length?filtered.map(card).join(""):`<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`}</div>
      </section>`;

    bind(main,items);
  }

  window.ClinicPages.logistics = async function(...args) {
    if (isSecretaryNow()) return renderSecretaryLogistics();
    return previousLogistics?.(...args);
  };

  const style = document.createElement("style");
  style.textContent = `
    .v85-page{display:grid;gap:15px}.v85-page h2{margin:3px 0 5px}
    .v85-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .v85-summary button{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:14px;padding:11px 13px;display:flex;justify-content:space-between;cursor:pointer}
    .v85-summary button.active{border-color:#112238;box-shadow:0 0 0 2px rgba(17,34,56,.08)}
    .v85-summary strong{font-size:20px}.v85-summary span{font-size:12px;color:#667085}
    .v85-tools{display:grid;gap:9px}.v85-tools>.control{max-width:420px}
    .v85-chips{display:flex;gap:7px;flex-wrap:wrap}.v85-chips button{border:1px solid rgba(17,34,56,.12);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}.v85-chips button.active{background:#112238;color:#fff}
    .v85-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:13px}
    .v85-card{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 20px rgba(17,34,56,.05)}.v85-card.critical{border:2px solid #e5484d}
    .v85-photo{position:relative;aspect-ratio:1/1;border-radius:13px;overflow:hidden;background:#f4f6f8}.v85-photo img{width:100%;height:100%;object-fit:cover}.v85-placeholder{width:100%;height:100%;display:grid;place-items:center;font-size:42px}
    .v85-status{position:absolute;top:8px;right:8px;border-radius:999px;padding:6px 8px;font-size:10px;font-weight:900}.v85-status.enough,.v85-status.working{background:#eaf8ef;color:#157a3d}.v85-status.low,.v85-status.maintenance{background:#fff4df;color:#9d5a00}.v85-status.out,.v85-status.broken,.v85-status.critical{background:#d92d20;color:#fff}
    .v85-name{text-align:center;font-weight:850;padding:9px 3px 2px}.v85-category{text-align:center;color:#7a8699;font-size:11px;margin-bottom:7px}
    .v85-stock,.v85-equip{display:flex;justify-content:space-between;border-top:1px solid #eef0f3;padding:8px 2px;font-size:12px}.v85-stock strong{font-size:16px}
    .v85-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.v85-actions button,.v85-electricity{width:100%!important;padding:8px!important;font-size:11px!important}
    #modalRoot .v85-modal{width:min(500px,calc(100vw - 24px))!important;max-width:500px!important;padding:15px!important;border-radius:18px!important;overflow:hidden!important}
    .v85-head{display:flex;align-items:center;gap:10px;background:#f6f8fa;border-radius:12px;padding:9px;margin-bottom:11px}.v85-head img,.v85-head>.v85-placeholder{width:58px;height:58px;border-radius:9px;object-fit:cover;flex:none}.v85-head>div:last-child{display:grid;gap:3px}
    .v85-form{display:grid;gap:10px}.v85-form label{display:grid;gap:5px;font-size:12px;font-weight:800}.v85-form textarea.control{height:auto!important;min-height:70px!important}.v85-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v85-note{font-size:11px;color:#667085;background:#f8fafc;border-radius:10px;padding:8px}
    @media(max-width:700px){.v85-summary{grid-template-columns:1fr}.v85-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v85-grid2{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();