(() => {
  const C = window.Clinic;
  if (!C || !window.ClinicPages) return;

  const esc = (value) => C.escape(value ?? "");
  const txt = (en, ar) => C.lang === "ar" ? ar : en;
  const isAdmin = () =>
    !!(C.hasRole?.("owner") || C.hasRole?.("manager") || C.hasRole?.("deputy_manager"));

  let currentFilter = "all";
  let currentSearch = "";

  const categoryLabels = {
    drinks: ["Drinks", "مشروبات"],
    cleaning: ["Cleaning", "نظافة"],
    stationery: ["Stationery", "أدوات مكتبية"],
    disposable: ["Disposable", "مستهلكات"],
    equipment: ["Equipment", "معدات"],
    other: ["Other", "أخرى"]
  };

  const typeLabels = {
    consumable: ["Consumable", "مستهلك"],
    equipment: ["Equipment", "معدات"]
  };

  const equipmentLabels = {
    working: ["Working", "يعمل"],
    maintenance: ["Needs maintenance", "يحتاج صيانة"],
    broken: ["Broken", "معطل"]
  };

  function tPair(pair) { return C.lang === "ar" ? pair[1] : pair[0]; }
  function displayName(item) {
    return C.lang === "ar"
      ? (item.arabic_name || item.english_name || "عنصر")
      : (item.english_name || item.arabic_name || "Item");
  }

  async function loadItems() {
    const { data, error } = await C.sb.rpc("v61_logistics_items");
    if (error) throw error;
    return data || [];
  }

  async function uploadImage(file) {
    if (!file || !(file instanceof File) || !file.size) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `v61/${crypto.randomUUID()}.${ext}`;
    const { error } = await C.sb.storage
      .from("clinic-item-images")
      .upload(path, file, { upsert: false, cacheControl: "3600" });
    if (error) throw error;
    const { data } = C.sb.storage.from("clinic-item-images").getPublicUrl(path);
    return data.publicUrl;
  }

  function modal(html) {
    const root = document.getElementById("modalRoot");
    if (!root) return null;
    root.innerHTML = html;
    root.classList.remove("hidden");
    root.querySelectorAll("[data-v61-close]").forEach((b) => {
      b.onclick = () => { root.classList.add("hidden"); root.innerHTML = ""; };
    });
    return root;
  }

  function stockStatus(item) {
    if (item.item_type === "equipment") return item.equipment_status || "working";
    const n = Number(item.available_stock || 0);
    const min = Number(item.min_stock || 0);
    if (n <= 0) return "out";
    if (n <= min) return "low";
    return "ok";
  }

  function statusLabel(item) {
    if (item.item_type === "equipment") {
      return tPair(equipmentLabels[item.equipment_status || "working"] || equipmentLabels.working);
    }
    const s = stockStatus(item);
    if (s === "out") return txt("Out of stock", "نفد");
    if (s === "low") return txt("Low stock", "مخزون منخفض");
    return txt("In stock", "متوفر");
  }

  function editItem(item = null) {
    if (!isAdmin()) return;
    const root = modal(`
      <div class="modal-backdrop">
        <div class="modal-card v61-modal">
          <div class="modal-header">
            <div>
              <span class="eyebrow">LOGISTICS</span>
              <h3>${item ? txt("Edit item","تعديل العنصر") : txt("Add item","إضافة عنصر")}</h3>
            </div>
            <button class="icon-button" type="button" data-v61-close>✕</button>
          </div>

          <form id="v61ItemForm" class="v61-form">
            <div class="v61-form-grid">
              <label>
                <span>${txt("English name","الاسم بالإنجليزية")}</span>
                <input class="control" name="english_name" value="${esc(item?.english_name || "")}">
              </label>
              <label>
                <span>${txt("Arabic name","الاسم بالعربية")}</span>
                <input class="control" name="arabic_name" required value="${esc(item?.arabic_name || "")}">
              </label>
            </div>

            <div class="v61-form-grid">
              <label>
                <span>${txt("Type","النوع")}</span>
                <select class="control" name="item_type" id="v61Type">
                  <option value="consumable" ${item?.item_type !== "equipment" ? "selected" : ""}>${tPair(typeLabels.consumable)}</option>
                  <option value="equipment" ${item?.item_type === "equipment" ? "selected" : ""}>${tPair(typeLabels.equipment)}</option>
                </select>
              </label>
              <label>
                <span>${txt("Category","التصنيف")}</span>
                <select class="control" name="category">
                  ${Object.entries(categoryLabels).map(([k,v]) =>
                    `<option value="${k}" ${item?.category === k ? "selected" : ""}>${tPair(v)}</option>`
                  ).join("")}
                </select>
              </label>
            </div>

            <div id="v61ConsumableFields" class="v61-form-grid">
              <label>
                <span>${txt("Current stock","المخزون الحالي")}</span>
                <input class="control" type="number" min="0" step="1" name="stock" value="${Number(item?.available_stock ?? 1)}">
              </label>
              <label>
                <span>${txt("Minimum stock","الحد الأدنى للمخزون")}</span>
                <input class="control" type="number" min="0" step="1" name="min_stock" value="${Number(item?.min_stock ?? 2)}">
              </label>
            </div>

            <div id="v61EquipmentFields" class="v61-form-grid">
              <label>
                <span>${txt("Equipment status","حالة الجهاز")}</span>
                <select class="control" name="equipment_status">
                  ${Object.entries(equipmentLabels).map(([k,v]) =>
                    `<option value="${k}" ${item?.equipment_status === k ? "selected" : ""}>${tPair(v)}</option>`
                  ).join("")}
                </select>
              </label>
              <label>
                <span>${txt("Next maintenance","الصيانة القادمة")}</span>
                <input class="control" type="date" name="maintenance_due_date" value="${esc(item?.maintenance_due_date || "")}">
              </label>
            </div>

            <label class="v61-photo-field">
              <span>${txt("Item photo","صورة العنصر")}</span>
              ${item?.image_url ? `<img class="v61-edit-preview" src="${esc(item.image_url)}" alt="">` : ""}
              <input class="control" type="file" name="image" accept="image/*">
              <small>${txt("Leave empty to keep the current photo.","اتركها فارغة للاحتفاظ بالصورة الحالية.")}</small>
            </label>

            <div class="form-actions">
              <button class="primary-button" type="submit">${txt("Save","حفظ")}</button>
            </div>
          </form>
        </div>
      </div>
    `);

    const form = root?.querySelector("#v61ItemForm");
    if (!form) return;

    const typeSelect = form.querySelector("#v61Type");
    const cFields = form.querySelector("#v61ConsumableFields");
    const eFields = form.querySelector("#v61EquipmentFields");
    const syncType = () => {
      const equipment = typeSelect.value === "equipment";
      cFields.style.display = equipment ? "none" : "";
      eFields.style.display = equipment ? "" : "none";
    };
    typeSelect.onchange = syncType;
    syncType();

    form.onsubmit = async (event) => {
      event.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const fd = new FormData(form);
        let imageUrl = item?.image_url || null;
        const uploaded = await uploadImage(fd.get("image"));
        if (uploaded) imageUrl = uploaded;

        const { error } = await C.sb.rpc("v61_save_inventory_item", {
          p_item: item?.id || null,
          p_arabic_name: String(fd.get("arabic_name") || "").trim(),
          p_english_name: String(fd.get("english_name") || "").trim(),
          p_image_url: imageUrl,
          p_item_type: String(fd.get("item_type") || "consumable"),
          p_category: String(fd.get("category") || "other"),
          p_available_stock: Number(fd.get("stock") || 0),
          p_min_stock: Number(fd.get("min_stock") || 0),
          p_equipment_status: String(fd.get("equipment_status") || "working"),
          p_maintenance_due_date: fd.get("maintenance_due_date") || null
        });
        if (error) throw error;
        root.classList.add("hidden"); root.innerHTML = "";
        C.toast(txt("Item saved.","تم حفظ العنصر."));
        C.route("logistics");
      } catch (err) {
        C.toast(err.message, "error");
        btn.disabled = false;
      }
    };
  }

  async function adjustStock(item, delta) {
    if (!isAdmin() || item.item_type === "equipment") return;
    const { error } = await C.sb.rpc("v61_adjust_inventory_stock", {
      p_item: item.id,
      p_delta: delta,
      p_note: delta > 0 ? "Quick +1" : "Quick -1"
    });
    if (error) return C.toast(error.message, "error");
    C.route("logistics");
  }

  async function removeItem(item) {
    if (!isAdmin()) return;
    if (!confirm(txt(`Remove "${displayName(item)}"?`, `حذف "${displayName(item)}"؟`))) return;
    const { error } = await C.sb.rpc("v60_remove_inventory_item", { p_item: item.id });
    if (error) return C.toast(error.message, "error");
    C.toast(txt("Item removed.","تم حذف العنصر."));
    C.route("logistics");
  }

  function purchaseModal(item) {
    const root = modal(`
      <div class="modal-backdrop">
        <div class="modal-card v61-modal">
          <div class="modal-header">
            <h3>${txt("Purchase request","طلب شراء")}</h3>
            <button class="icon-button" data-v61-close>✕</button>
          </div>
          <form id="v61PurchaseForm" class="v61-form">
            <div class="v61-request-head">
              ${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : `<div class="v61-no-photo">📦</div>`}
              <div><strong>${esc(displayName(item))}</strong><small>${txt("Current stock","المخزون الحالي")}: ${Number(item.available_stock || 0)}</small></div>
            </div>
            <div class="v61-form-grid">
              <label><span>${txt("Quantity","الكمية")}</span><input class="control" name="quantity" type="number" min="1" step="1" value="1" required></label>
              <label><span>${txt("Estimated cost","التكلفة المتوقعة")}</span><input class="control" name="cost" type="number" min="0" step="0.01" value="0"></label>
            </div>
            <label><span>${txt("Note","ملاحظة")}</span><textarea class="control" rows="3" name="note"></textarea></label>
            <div class="form-actions"><button class="primary-button" type="submit">${txt("Create request","إنشاء الطلب")}</button></div>
          </form>
        </div>
      </div>
    `);
    const form = root?.querySelector("#v61PurchaseForm");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const { error } = await C.sb.rpc("v61_create_purchase_request", {
        p_item: item.id,
        p_quantity: Number(fd.get("quantity") || 1),
        p_estimated_cost: Number(fd.get("cost") || 0),
        p_note: String(fd.get("note") || "").trim()
      });
      if (error) return C.toast(error.message, "error");
      root.classList.add("hidden"); root.innerHTML = "";
      C.toast(txt("Purchase request created.","تم إنشاء طلب الشراء."));
    };
  }

  function historyModal(item) {
    (async () => {
      const { data, error } = await C.sb.rpc("v61_inventory_history", { p_item: item.id });
      if (error) return C.toast(error.message, "error");
      modal(`
        <div class="modal-backdrop">
          <div class="modal-card v61-modal v61-history-modal">
            <div class="modal-header">
              <div><span class="eyebrow">HISTORY</span><h3>${esc(displayName(item))}</h3></div>
              <button class="icon-button" data-v61-close>✕</button>
            </div>
            <div class="v61-history-list">
              ${(data || []).length ? (data || []).map(r => `
                <div class="v61-history-row">
                  <div><strong>${r.delta > 0 ? "+" : ""}${Number(r.delta || 0)}</strong><span>${esc(r.note || "")}</span></div>
                  <small>${esc(r.changed_by_name || "")} · ${esc(r.changed_at_label || "")}</small>
                </div>
              `).join("") : `<div class="empty-state">${txt("No history yet.","لا يوجد سجل بعد.")}</div>`}
            </div>
          </div>
        </div>
      `);
    })();
  }

  function card(item) {
    const s = stockStatus(item);
    const equipment = item.item_type === "equipment";
    return `
      <article class="v61-item-card" data-v61-item="${esc(item.id)}">
        <button class="v61-photo-button" type="button" data-v61-history="${esc(item.id)}">
          <div class="v61-photo-wrap">
            ${item.image_url
              ? `<img class="v61-item-photo" src="${esc(item.image_url)}" alt="${esc(displayName(item))}" loading="lazy">`
              : `<div class="v61-photo-placeholder">📦</div>`}
            ${equipment
              ? `<span class="v61-status-badge ${esc(s)}">${esc(statusLabel(item))}</span>`
              : `<span class="v61-stock-badge ${esc(s)}">${Number(item.available_stock || 0)}</span>`}
          </div>
          <div class="v61-item-name">${esc(displayName(item))}</div>
          <div class="v61-item-meta">${esc(tPair(categoryLabels[item.category] || categoryLabels.other))}</div>
        </button>

        ${equipment ? `
          <div class="v61-equipment-status ${esc(s)}">${esc(statusLabel(item))}</div>
          ${item.maintenance_due_date ? `<div class="v61-maintenance">${txt("Maintenance","صيانة")}: ${esc(item.maintenance_due_date)}</div>` : ""}
        ` : `
          <div class="v61-stock-line ${esc(s)}">
            <span>${esc(statusLabel(item))}</span>
            <small>${txt("Min","الحد")}: ${Number(item.min_stock || 0)}</small>
          </div>
          ${isAdmin() ? `
            <div class="v61-stepper">
              <button type="button" data-v61-minus="${esc(item.id)}">−</button>
              <strong>${Number(item.available_stock || 0)}</strong>
              <button type="button" data-v61-plus="${esc(item.id)}">＋</button>
            </div>
          ` : ""}
        `}

        <div class="v61-card-actions">
          <button type="button" class="secondary-button" data-v61-buy="${esc(item.id)}">🛒 ${txt("Buy","شراء")}</button>
          ${isAdmin() ? `
            <button type="button" class="secondary-button" data-v61-edit="${esc(item.id)}">✎ ${txt("Edit","تعديل")}</button>
            <button type="button" class="danger-button v61-remove" data-v61-remove="${esc(item.id)}">🗑</button>
          ` : ""}
        </div>
      </article>
    `;
  }

  function passesFilter(item) {
    const name = `${item.arabic_name || ""} ${item.english_name || ""}`.toLowerCase();
    if (currentSearch && !name.includes(currentSearch.toLowerCase())) return false;
    const status = stockStatus(item);
    if (currentFilter === "all") return true;
    if (currentFilter === "low") return item.item_type !== "equipment" && status === "low";
    if (currentFilter === "out") return item.item_type !== "equipment" && status === "out";
    if (currentFilter === "equipment") return item.item_type === "equipment";
    if (currentFilter.startsWith("cat:")) return item.category === currentFilter.slice(4);
    return true;
  }

  function bindGallery(main, rows) {
    main.querySelector("#v61AddItem")?.addEventListener("click", () => editItem(null));

    main.querySelectorAll("[data-v61-edit]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61Edit); if (item) editItem(item);
    });
    main.querySelectorAll("[data-v61-remove]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61Remove); if (item) removeItem(item);
    });
    main.querySelectorAll("[data-v61-plus]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61Plus); if (item) adjustStock(item, +1);
    });
    main.querySelectorAll("[data-v61-minus]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61Minus); if (item) adjustStock(item, -1);
    });
    main.querySelectorAll("[data-v61-buy]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61Buy); if (item) purchaseModal(item);
    });
    main.querySelectorAll("[data-v61-history]").forEach(b => b.onclick = () => {
      const item = rows.find(r => r.id === b.dataset.v61History); if (item) historyModal(item);
    });

    main.querySelectorAll("[data-v61-filter]").forEach(b => b.onclick = () => {
      currentFilter = b.dataset.v61Filter;
      C.route("logistics");
    });

    const search = main.querySelector("#v61Search");
    if (search) {
      search.value = currentSearch;
      search.addEventListener("input", () => {
        currentSearch = search.value.trim();
        const grid = main.querySelector("#v61Grid");
        const filtered = rows.filter(passesFilter);
        grid.innerHTML = filtered.length ? filtered.map(card).join("") :
          `<section class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</section>`;
        bindGallery(main, rows);
      });
    }
  }

  window.ClinicPages.logistics = async function () {
    C.setTitle(txt("Logistics","اللوجستيات"));
    const main = document.getElementById("mainContent");
    if (!main) return;
    main.innerHTML = `<section class="content-card empty-state">${txt("Loading logistics...","جارٍ تحميل اللوجستيات...")}</section>`;

    let rows;
    try { rows = await loadItems(); }
    catch (e) { main.innerHTML = `<section class="content-card empty-state">${esc(e.message)}</section>`; return; }

    const lowCount = rows.filter(r => r.item_type !== "equipment" && stockStatus(r) === "low").length;
    const outCount = rows.filter(r => r.item_type !== "equipment" && stockStatus(r) === "out").length;
    const equipmentCount = rows.filter(r => r.item_type === "equipment").length;
    const filtered = rows.filter(passesFilter);

    main.innerHTML = `
      <section class="v61-logistics-page">
        <header class="v61-header">
          <div>
            <span class="eyebrow">CLINIC LOGISTICS</span>
            <h2>${txt("Clinic items","احتياجات العيادة")}</h2>
            <p class="muted">${txt("Stock, purchasing and equipment control in one place.","المخزون والشراء والمعدات في مكان واحد.")}</p>
          </div>
          ${isAdmin() ? `<button class="primary-button v61-add" id="v61AddItem">＋ ${txt("Add item","إضافة عنصر")}</button>` : ""}
        </header>

        <section class="v61-summary">
          <button class="${currentFilter==="all"?"active":""}" data-v61-filter="all"><strong>${rows.length}</strong><span>${txt("All","الكل")}</span></button>
          <button class="${currentFilter==="low"?"active":""}" data-v61-filter="low"><strong>${lowCount}</strong><span>${txt("Low stock","مخزون منخفض")}</span></button>
          <button class="${currentFilter==="out"?"active":""}" data-v61-filter="out"><strong>${outCount}</strong><span>${txt("Out","نفد")}</span></button>
          <button class="${currentFilter==="equipment"?"active":""}" data-v61-filter="equipment"><strong>${equipmentCount}</strong><span>${txt("Equipment","معدات")}</span></button>
        </section>

        <section class="v61-toolbar">
          <input id="v61Search" class="control v61-search" placeholder="${txt("Search items...","ابحث عن عنصر...")}">
          <div class="v61-chips">
            ${Object.entries(categoryLabels).map(([k,v]) =>
              `<button class="${currentFilter===`cat:${k}`?"active":""}" data-v61-filter="cat:${k}">${esc(tPair(v))}</button>`
            ).join("")}
          </div>
        </section>

        <div class="v61-gallery" id="v61Grid">
          ${filtered.length ? filtered.map(card).join("") :
            `<section class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</section>`}
        </div>
      </section>
    `;

    bindGallery(main, rows);
  };

  const style = document.createElement("style");
  style.textContent = `
    .v61-logistics-page{display:grid;gap:16px}
    .v61-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
    .v61-header h2{margin:4px 0 4px}
    .v61-add{width:auto!important;min-width:130px}
    .v61-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .v61-summary button{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:14px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer}
    .v61-summary button strong{font-size:22px}
    .v61-summary button span{color:var(--muted,#6b7280);font-size:13px}
    .v61-summary button.active{border-color:#112238;box-shadow:0 0 0 2px rgba(17,34,56,.08)}
    .v61-toolbar{display:grid;gap:10px}
    .v61-search{max-width:420px}
    .v61-chips{display:flex;gap:8px;flex-wrap:wrap}
    .v61-chips button{border:1px solid rgba(17,34,56,.12);background:#fff;border-radius:999px;padding:7px 11px;cursor:pointer;font-weight:700;font-size:12px}
    .v61-chips button.active{background:#112238;color:#fff}
    .v61-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px}
    .v61-item-card{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 20px rgba(17,34,56,.05);min-width:0}
    .v61-photo-button{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;cursor:pointer}
    .v61-photo-wrap{position:relative;aspect-ratio:1/1;border-radius:13px;overflow:hidden;background:#f4f6f8}
    .v61-item-photo{width:100%;height:100%;object-fit:cover;display:block}
    .v61-photo-placeholder,.v61-no-photo{width:100%;height:100%;display:grid;place-items:center;font-size:42px;background:#f4f6f8}
    .v61-stock-badge,.v61-status-badge{position:absolute;top:9px;right:9px;min-width:31px;height:31px;padding:0 9px;display:grid;place-items:center;border-radius:999px;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.14);font-weight:800;font-size:12px}
    .v61-stock-badge.ok{background:#eaf8ef;color:#157a3d}
    .v61-stock-badge.low{background:#fff4df;color:#9d5a00}
    .v61-stock-badge.out{background:#ffeaea;color:#a32626}
    .v61-status-badge.working{background:#eaf8ef;color:#157a3d}
    .v61-status-badge.maintenance{background:#fff4df;color:#9d5a00}
    .v61-status-badge.broken{background:#ffeaea;color:#a32626}
    .v61-item-name{text-align:center;font-weight:800;font-size:14px;line-height:1.35;padding:10px 3px 2px;min-height:43px;display:grid;place-items:center}
    .v61-item-meta{text-align:center;color:var(--muted,#6b7280);font-size:11px;padding-bottom:7px}
    .v61-stock-line{display:flex;align-items:center;justify-content:space-between;padding:7px 2px;font-size:12px;font-weight:700}
    .v61-stock-line.ok{color:#157a3d}.v61-stock-line.low{color:#9d5a00}.v61-stock-line.out{color:#a32626}
    .v61-stock-line small{color:var(--muted,#6b7280);font-weight:600}
    .v61-stepper{display:grid;grid-template-columns:36px 1fr 36px;align-items:center;border:1px solid rgba(17,34,56,.1);border-radius:10px;overflow:hidden;margin-bottom:8px}
    .v61-stepper button{height:34px;border:0;background:#f7f8fa;cursor:pointer;font-size:20px}
    .v61-stepper strong{text-align:center}
    .v61-card-actions{display:grid;grid-template-columns:1fr auto auto;gap:6px}
    .v61-card-actions button{padding:8px 7px;min-width:0;font-size:12px}
    .v61-remove{background:#fff2f2!important;color:#a32626!important;border:1px solid #ffd3d3!important}
    .v61-equipment-status{text-align:center;font-size:12px;font-weight:800;padding:7px;border-radius:9px;margin-bottom:6px}
    .v61-equipment-status.working{background:#eaf8ef;color:#157a3d}.v61-equipment-status.maintenance{background:#fff4df;color:#9d5a00}.v61-equipment-status.broken{background:#ffeaea;color:#a32626}
    .v61-maintenance{text-align:center;font-size:11px;color:var(--muted,#6b7280);margin-bottom:7px}
    .v61-modal{max-width:620px}.v61-form{display:grid;gap:14px}.v61-form label{display:grid;gap:7px}
    .v61-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v61-edit-preview{width:150px;height:150px;object-fit:cover;border-radius:13px;border:1px solid rgba(17,34,56,.12)}
    .v61-photo-field small{color:var(--muted,#6b7280)}
    .v61-request-head{display:flex;gap:12px;align-items:center;padding:12px;background:#f6f8fa;border-radius:14px}
    .v61-request-head img,.v61-request-head .v61-no-photo{width:74px;height:74px;border-radius:11px;object-fit:cover;flex:none}
    .v61-request-head div:last-child{display:grid;gap:4px}
    .v61-history-list{display:grid;gap:8px;max-height:60vh;overflow:auto}
    .v61-history-row{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(17,34,56,.08);border-radius:12px;padding:10px}
    .v61-history-row>div{display:flex;gap:10px}.v61-history-row strong{min-width:34px}.v61-history-row small{color:var(--muted,#6b7280);white-space:nowrap}
    @media(max-width:760px){
      .v61-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
      .v61-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .v61-form-grid{grid-template-columns:1fr}
      .v61-card-actions{grid-template-columns:1fr 1fr}.v61-card-actions .v61-remove{grid-column:auto}
      .v61-add{width:100%!important}
    }
  `;
  document.head.appendChild(style);
})();
