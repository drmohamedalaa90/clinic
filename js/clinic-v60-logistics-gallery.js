(() => {
  const C = window.Clinic;
  if (!C || !window.ClinicPages) return;

  const esc = (value) => C.escape(value ?? "");
  const isAdmin = () =>
    !!(
      C.hasRole?.("owner") ||
      C.hasRole?.("manager") ||
      C.hasRole?.("deputy_manager")
    );

  const txt = (en, ar) => C.lang === "ar" ? ar : en;

  async function loadItems() {
    const { data, error } = await C.sb.rpc("v60_logistics_items");
    if (error) throw error;
    return data || [];
  }

  async function uploadImage(file) {
    if (!file || !(file instanceof File) || !file.size) return null;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `v60/${crypto.randomUUID()}.${ext}`;

    const { error } = await C.sb.storage
      .from("clinic-item-images")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) throw error;

    const { data } = C.sb.storage
      .from("clinic-item-images")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  function displayName(item) {
    return C.lang === "ar"
      ? (item.arabic_name || item.english_name || "عنصر")
      : (item.english_name || item.arabic_name || "Item");
  }

  function modal(html) {
    const root = document.getElementById("modalRoot");
    if (!root) return null;

    root.innerHTML = html;
    root.classList.remove("hidden");

    root.querySelectorAll("[data-v60-close]").forEach((button) => {
      button.onclick = () => {
        root.classList.add("hidden");
        root.innerHTML = "";
      };
    });

    return root;
  }

  function editItem(item = null) {
    if (!isAdmin()) return;

    const root = modal(`
      <div class="modal-backdrop">
        <div class="modal-card v60-modal">
          <div class="modal-header">
            <div>
              <span class="eyebrow">LOGISTICS</span>
              <h3>${item ? txt("Edit item","تعديل العنصر") : txt("Add item","إضافة عنصر")}</h3>
            </div>
            <button type="button" class="icon-button" data-v60-close>✕</button>
          </div>

          <form id="v60ItemForm" class="v60-form">
            <label>
              <span>${txt("English name","الاسم بالإنجليزية")}</span>
              <input class="control" name="english_name" value="${esc(item?.english_name || "")}">
            </label>

            <label>
              <span>${txt("Arabic name","الاسم بالعربية")}</span>
              <input class="control" name="arabic_name" required value="${esc(item?.arabic_name || "")}">
            </label>

            <label>
              <span>${txt("Available stock","المخزون المتاح")}</span>
              <input class="control" type="number" min="0" step="1" name="stock"
                value="${Number(item?.available_stock ?? 1)}" required>
            </label>

            <label class="v60-photo-field">
              <span>${txt("Item photo","صورة العنصر")}</span>
              ${item?.image_url ? `<img class="v60-edit-preview" src="${esc(item.image_url)}" alt="">` : ""}
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

    const form = root?.querySelector("#v60ItemForm");
    if (!form) return;

    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        const fd = new FormData(form);
        let imageUrl = item?.image_url || null;
        const image = fd.get("image");
        const newUrl = await uploadImage(image);
        if (newUrl) imageUrl = newUrl;

        const { error } = await C.sb.rpc("v60_save_inventory_item", {
          p_item: item?.id || null,
          p_arabic_name: String(fd.get("arabic_name") || "").trim(),
          p_english_name: String(fd.get("english_name") || "").trim(),
          p_image_url: imageUrl,
          p_available_stock: Number(fd.get("stock") || 0)
        });

        if (error) throw error;

        root.classList.add("hidden");
        root.innerHTML = "";
        C.toast(txt("Item saved.","تم حفظ العنصر."));
        C.route("logistics");
      } catch (error) {
        C.toast(error.message, "error");
        button.disabled = false;
      }
    };
  }

  async function removeItem(item) {
    if (!isAdmin()) return;

    const ok = confirm(
      txt(
        `Remove "${displayName(item)}" from Logistics?`,
        `حذف "${displayName(item)}" من اللوجستيات؟`
      )
    );
    if (!ok) return;

    const { error } = await C.sb.rpc("v60_remove_inventory_item", {
      p_item: item.id
    });

    if (error) return C.toast(error.message, "error");

    C.toast(txt("Item removed.","تم حذف العنصر."));
    C.route("logistics");
  }

  function requestItem(item) {
    const root = modal(`
      <div class="modal-backdrop">
        <div class="modal-card v60-modal">
          <div class="modal-header">
            <h3>${txt("Request item","طلب عنصر")}</h3>
            <button type="button" class="icon-button" data-v60-close>✕</button>
          </div>

          <div class="v60-request-head">
            ${item.image_url
              ? `<img src="${esc(item.image_url)}" alt="">`
              : `<div class="v60-no-photo">📦</div>`}
            <div>
              <strong>${esc(displayName(item))}</strong>
              <small>${txt("Current stock","المخزون الحالي")}: ${Number(item.available_stock || 0)}</small>
            </div>
          </div>

          <form id="v60RequestForm" class="v60-form">
            <label>
              <span>${txt("Quantity","الكمية")}</span>
              <input class="control" type="number" min="1" step="1" name="quantity" value="1" required>
            </label>

            <label>
              <span>${txt("Reason / note","السبب / ملاحظة")}</span>
              <textarea class="control" rows="3" name="reason"></textarea>
            </label>

            <div class="form-actions">
              <button class="primary-button" type="submit">${txt("Send request","إرسال الطلب")}</button>
            </div>
          </form>
        </div>
      </div>
    `);

    const form = root?.querySelector("#v60RequestForm");
    if (!form) return;

    form.onsubmit = async (event) => {
      event.preventDefault();
      const fd = new FormData(form);

      const { error } = await C.sb.rpc("v44_request_inventory_item", {
        p_item: item.id,
        p_quantity: Number(fd.get("quantity") || 1),
        p_reason: String(fd.get("reason") || "").trim()
      });

      if (error) return C.toast(error.message, "error");

      root.classList.add("hidden");
      root.innerHTML = "";
      C.toast(txt("Request sent.","تم إرسال الطلب."));
      C.route("logistics");
    };
  }

  function card(item) {
    return `
      <article class="v60-item-card" data-v60-item="${esc(item.id)}">
        <button class="v60-photo-button" type="button" data-v60-request="${esc(item.id)}"
          aria-label="${esc(displayName(item))}">
          <div class="v60-photo-wrap">
            ${item.image_url
              ? `<img class="v60-item-photo" src="${esc(item.image_url)}" alt="${esc(displayName(item))}" loading="lazy">`
              : `<div class="v60-photo-placeholder">📦</div>`}
            <span class="v60-stock-badge ${Number(item.available_stock || 0) <= 1 ? "low" : ""}">
              ${Number(item.available_stock || 0)}
            </span>
          </div>
          <div class="v60-item-name">${esc(displayName(item))}</div>
        </button>

        ${isAdmin() ? `
          <div class="v60-admin-actions">
            <button type="button" class="secondary-button" data-v60-edit="${esc(item.id)}">
              ✎ ${txt("Edit","تعديل")}
            </button>
            <button type="button" class="danger-button v60-remove" data-v60-remove="${esc(item.id)}">
              🗑 ${txt("Remove","حذف")}
            </button>
          </div>
        ` : ""}
      </article>
    `;
  }

  window.ClinicPages.logistics = async function () {
    C.setTitle(txt("Logistics","اللوجستيات"));

    const main = document.getElementById("mainContent");
    if (!main) return;

    main.innerHTML = `
      <section class="content-card empty-state">
        ${txt("Loading logistics...","جارٍ تحميل اللوجستيات...")}
      </section>
    `;

    let rows;
    try {
      rows = await loadItems();
    } catch (error) {
      main.innerHTML = `<section class="content-card empty-state">${esc(error.message)}</section>`;
      return;
    }

    main.innerHTML = `
      <section class="v60-logistics-page">
        <header class="v60-logistics-header">
          <div>
            <span class="eyebrow">CLINIC LOGISTICS</span>
            <h2>${txt("Clinic items","احتياجات العيادة")}</h2>
            <p class="muted">
              ${txt(
                "Tap an item to request it. Administrators can edit its name, photo and stock, or add/remove items.",
                "اضغط على أي عنصر لطلبه. يمكن للإدارة تعديل الاسم والصورة والمخزون أو إضافة وحذف العناصر."
              )}
            </p>
          </div>

          ${isAdmin() ? `
            <button type="button" class="primary-button" id="v60AddItem">
              ＋ ${txt("Add item","إضافة عنصر")}
            </button>
          ` : ""}
        </header>

        ${rows.length ? `
          <div class="v60-gallery">
            ${rows.map(card).join("")}
          </div>
        ` : `
          <section class="content-card empty-state">
            ${txt("No logistics items yet.","لا توجد عناصر لوجستية حتى الآن.")}
          </section>
        `}
      </section>
    `;

    if (isAdmin()) {
      main.querySelector("#v60AddItem")?.addEventListener("click", () => editItem(null));
    }

    main.querySelectorAll("[data-v60-request]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = rows.find((row) => row.id === button.dataset.v60Request);
        if (item) requestItem(item);
      });
    });

    main.querySelectorAll("[data-v60-edit]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const item = rows.find((row) => row.id === button.dataset.v60Edit);
        if (item) editItem(item);
      });
    });

    main.querySelectorAll("[data-v60-remove]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const item = rows.find((row) => row.id === button.dataset.v60Remove);
        if (item) removeItem(item);
      });
    });
  };

  const style = document.createElement("style");
  style.textContent = `
    .v60-logistics-page{display:grid;gap:18px}
    .v60-logistics-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
    .v60-logistics-header h2{margin:4px 0 6px}
    .v60-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}
    .v60-item-card{background:var(--surface,#fff);border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 22px rgba(17,34,56,.06);min-width:0}
    .v60-photo-button{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:inherit;cursor:pointer}
    .v60-photo-wrap{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#f4f6f8}
    .v60-item-photo{width:100%;height:100%;object-fit:cover;display:block}
    .v60-photo-placeholder,.v60-no-photo{width:100%;height:100%;display:grid;place-items:center;font-size:42px;background:#f4f6f8}
    .v60-stock-badge{position:absolute;top:9px;right:9px;min-width:30px;height:30px;padding:0 8px;display:grid;place-items:center;border-radius:999px;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.14);font-weight:800}
    .v60-stock-badge.low{background:#fff4df;color:#a85e00}
    .v60-item-name{text-align:center;font-weight:800;font-size:15px;line-height:1.35;padding:11px 4px 5px;min-height:49px;display:grid;place-items:center}
    .v60-admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}
    .v60-admin-actions button{min-width:0;padding:8px 5px;border-radius:10px;font-size:12px}
    .v60-remove{background:#fff2f2!important;color:#a32626!important;border:1px solid #ffd3d3!important}
    .v60-modal{max-width:560px}
    .v60-form{display:grid;gap:14px}
    .v60-form label{display:grid;gap:7px}
    .v60-edit-preview{display:block;width:150px;height:150px;object-fit:cover;border-radius:14px;border:1px solid rgba(17,34,56,.12)}
    .v60-photo-field small{color:var(--muted,#6b7280)}
    .v60-request-head{display:flex;gap:12px;align-items:center;margin-bottom:16px;padding:12px;border-radius:14px;background:#f6f8fa}
    .v60-request-head img,.v60-request-head .v60-no-photo{width:78px;height:78px;border-radius:12px;object-fit:cover;flex:none}
    .v60-request-head div:last-child{display:grid;gap:4px}
    @media(max-width:640px){
      .v60-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
      .v60-item-card{padding:8px;border-radius:15px}
      .v60-photo-wrap{border-radius:11px}
      .v60-item-name{font-size:13px;min-height:46px}
      .v60-admin-actions{grid-template-columns:1fr}
      .v60-logistics-header .primary-button{width:100%}
    }
  `;
  document.head.appendChild(style);
})();
