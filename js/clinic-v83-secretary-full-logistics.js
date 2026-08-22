(() => {
  const C = window.Clinic;
  if (!C || !window.ClinicPages || !C.hasRole?.("secretary")) return;

  const txt=(en,ar)=>C.lang==="ar"?ar:en;
  const esc=v=>C.escape(v??"");
  const name=i=>C.lang==="ar"?(i.arabic_name||i.english_name||"عنصر"):(i.english_name||i.arabic_name||"Item");
  let filter="all", search="";

  function catName(c){
    const m={drinks:["Drinks","مشروبات"],cleaning:["Cleaning","نظافة"],stationery:["Stationery","أدوات مكتبية"],disposable:["Disposable","مستهلكات"],equipment:["Equipment","معدات"],other:["Other","أخرى"]};
    const p=m[c]||m.other; return txt(p[0],p[1]);
  }

  async function load(){
    const {data,error}=await C.sb.from("clinic_inventory_items").select("*").eq("is_active",true).order("english_name",{ascending:true,nullsFirst:false});
    if(error) throw error; return data||[];
  }

  function state(i){
    if(i.item_type==="equipment"){
      const s=i.equipment_status||"working";
      return {key:s,label:s==="broken"?txt("Broken","معطل"):s==="maintenance"?txt("Needs maintenance","يحتاج صيانة"):txt("Working","يعمل")};
    }
    if(i.is_critical) return {key:"critical",label:txt("Critical","حرج")};
    const stock=Number(i.available_stock||0), min=Number(i.min_stock??1);
    if(stock<=0) return {key:"out",label:txt("Out of stock","نفد")};
    if(stock<=min) return {key:"low",label:txt("Low stock","مخزون منخفض")};
    return {key:"enough",label:txt("Enough","كافٍ")};
  }

  function openRequest(i){
    const root=document.getElementById("modalRoot"); if(!root) return;
    root.innerHTML=`
      <div class="modal-backdrop">
        <div class="modal-card v83-modal">
          <div class="modal-header">
            <div><span class="eyebrow">LOGISTICS</span><h3>${txt("Request to buy","طلب شراء")}</h3></div>
            <button type="button" class="icon-button" data-close>✕</button>
          </div>
          <div class="v83-request-head">
            ${i.image_url?`<img src="${esc(i.image_url)}" alt="">`:`<div>📦</div>`}
            <div><strong>${esc(name(i))}</strong><small>${txt("Current stock","المخزون الحالي")}: ${Number(i.available_stock||0)}</small></div>
          </div>
          <form id="v83ReqForm" class="v83-form">
            <label><span>${txt("Quantity needed","الكمية المطلوبة")}</span><input class="control" name="quantity" type="number" min="1" step="1" value="1" required></label>
            <label><span>${txt("Reason / note","السبب / ملاحظة")}</span><textarea class="control" rows="3" name="reason"></textarea></label>
            <button class="primary-button" type="submit">${txt("Send purchase request","إرسال طلب الشراء")}</button>
          </form>
        </div>
      </div>`;
    root.classList.remove("hidden");
    root.querySelector("[data-close]").onclick=()=>{root.classList.add("hidden");root.innerHTML="";};
    root.querySelector("#v83ReqForm").onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(e.currentTarget), btn=e.currentTarget.querySelector("button[type=submit]");
      btn.disabled=true;
      const {error}=await C.sb.rpc("v44_request_inventory_item",{p_item:i.id,p_quantity:Number(fd.get("quantity")||1),p_reason:String(fd.get("reason")||"").trim()});
      if(error){btn.disabled=false;return C.toast(error.message,"error");}
      root.classList.add("hidden");root.innerHTML="";
      C.toast(txt("Purchase request sent.","تم إرسال طلب الشراء."));
    };
  }

  function matches(i){
    const q=search.toLowerCase(), n=`${i.arabic_name||""} ${i.english_name||""}`.toLowerCase();
    if(q&&!n.includes(q)) return false;
    if(filter==="all") return true;
    if(filter==="critical") return !!i.is_critical;
    if(filter==="equipment") return i.item_type==="equipment";
    return i.category===filter;
  }

  function card(i){
    const s=state(i), equipment=i.item_type==="equipment";
    return `<article class="v83-card ${i.is_critical?"critical":""}">
      <div class="v83-photo">
        ${i.image_url?`<img src="${esc(i.image_url)}" alt="${esc(name(i))}">`:`<div class="v83-placeholder">📦</div>`}
        <span class="v83-status ${esc(s.key)}">${s.key==="critical"?"🚨 ":s.key==="enough"||s.key==="working"?"✓ ":s.key==="low"?"⚠ ":""}${esc(s.label)}</span>
      </div>
      <div class="v83-name">${esc(name(i))}</div>
      <div class="v83-category">${esc(catName(i.category))}</div>
      ${equipment?`<div class="v83-equip ${esc(s.key)}">${esc(s.label)}</div>`:`<div class="v83-stock"><span>${txt("Stock","المخزون")}</span><strong>${Number(i.available_stock||0)}</strong></div>`}
      <button class="primary-button v83-buy" data-buy="${esc(i.id)}">🛒 ${txt("Request to buy","طلب شراء")}</button>
    </article>`;
  }

  function bind(main,items){
    main.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>{const i=items.find(x=>x.id===b.dataset.buy);if(i)openRequest(i);});
    main.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;C.route("logistics");});
    const box=main.querySelector("#v83Search");
    if(box){box.value=search;box.oninput=()=>{search=box.value.trim();const f=items.filter(matches);main.querySelector("#v83Grid").innerHTML=f.length?f.map(card).join(""):`<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`;bind(main,items);};}
  }

  window.ClinicPages.logistics=async function(){
    C.setTitle(txt("Logistics & Inventory","اللوجستيات والمخزون"));
    const main=document.getElementById("mainContent"); if(!main) return;
    main.innerHTML=`<section class="content-card empty-state">${txt("Loading logistics...","جارٍ تحميل اللوجستيات...")}</section>`;
    let items; try{items=await load();}catch(e){main.innerHTML=`<section class="content-card empty-state">${esc(e.message)}</section>`;return;}
    const f=items.filter(matches), critical=items.filter(x=>x.is_critical).length, equip=items.filter(x=>x.item_type==="equipment").length;
    main.innerHTML=`<section class="v83-page">
      <header><span class="eyebrow">CLINIC LOGISTICS</span><h2>${txt("Logistics & Inventory","اللوجستيات والمخزون")}</h2><p class="muted">${txt("View clinic stock and send purchase requests when needed.","شاهد مخزون العيادة وأرسل طلب شراء عند الحاجة.")}</p></header>
      <div class="v83-summary">
        <button data-filter="all" class="${filter==="all"?"active":""}"><strong>${items.length}</strong><span>${txt("All","الكل")}</span></button>
        <button data-filter="critical" class="${filter==="critical"?"active":""}"><strong>${critical}</strong><span>🚨 ${txt("Critical","حرج")}</span></button>
        <button data-filter="equipment" class="${filter==="equipment"?"active":""}"><strong>${equip}</strong><span>${txt("Equipment","معدات")}</span></button>
      </div>
      <div class="v83-tools"><input id="v83Search" class="control" placeholder="${txt("Search items...","ابحث عن عنصر...")}"><div class="v83-chips">
        ${[["drinks",txt("Drinks","مشروبات")],["cleaning",txt("Cleaning","نظافة")],["stationery",txt("Stationery","أدوات مكتبية")],["disposable",txt("Disposable","مستهلكات")],["equipment",txt("Equipment","معدات")],["other",txt("Other","أخرى")]].map(([k,l])=>`<button data-filter="${k}" class="${filter===k?"active":""}">${esc(l)}</button>`).join("")}
      </div></div>
      <div id="v83Grid" class="v83-grid">${f.length?f.map(card).join(""):`<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`}</div>
    </section>`;
    bind(main,items);
  };

  const style=document.createElement("style");
  style.textContent=`
    .v83-page{display:grid;gap:15px}.v83-page h2{margin:3px 0 5px}
    .v83-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .v83-summary button{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:14px;padding:11px 13px;display:flex;justify-content:space-between;cursor:pointer}
    .v83-summary button.active{border-color:#112238;box-shadow:0 0 0 2px rgba(17,34,56,.08)}
    .v83-summary strong{font-size:20px}.v83-summary span{font-size:12px;color:#667085}
    .v83-tools{display:grid;gap:9px}.v83-tools>.control{max-width:420px}
    .v83-chips{display:flex;gap:7px;flex-wrap:wrap}.v83-chips button{border:1px solid rgba(17,34,56,.12);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}.v83-chips button.active{background:#112238;color:#fff}
    .v83-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:13px}
    .v83-card{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 20px rgba(17,34,56,.05)}.v83-card.critical{border:2px solid #e5484d}
    .v83-photo{position:relative;aspect-ratio:1/1;border-radius:13px;overflow:hidden;background:#f4f6f8}.v83-photo img{width:100%;height:100%;object-fit:cover}.v83-placeholder{width:100%;height:100%;display:grid;place-items:center;font-size:42px}
    .v83-status{position:absolute;top:8px;right:8px;border-radius:999px;padding:6px 8px;font-size:10px;font-weight:900}.v83-status.enough,.v83-status.working{background:#eaf8ef;color:#157a3d}.v83-status.low,.v83-status.maintenance{background:#fff4df;color:#9d5a00}.v83-status.out,.v83-status.broken,.v83-status.critical{background:#d92d20;color:#fff}
    .v83-name{text-align:center;font-weight:850;padding:9px 3px 2px}.v83-category{text-align:center;color:#7a8699;font-size:11px;margin-bottom:7px}.v83-stock,.v83-equip{display:flex;justify-content:space-between;border-top:1px solid #eef0f3;padding:8px 2px;font-size:12px}.v83-buy{width:100%!important;margin-top:5px;padding:9px!important;font-size:12px!important}
    #modalRoot .v83-modal{width:min(460px,calc(100vw - 24px))!important;max-width:460px!important;padding:15px!important;border-radius:18px!important}
    .v83-request-head{display:flex;align-items:center;gap:10px;background:#f6f8fa;border-radius:12px;padding:9px;margin-bottom:11px}.v83-request-head img,.v83-request-head>div:first-child{width:58px;height:58px;border-radius:9px;object-fit:cover}.v83-form{display:grid;gap:10px}.v83-form label{display:grid;gap:5px;font-size:12px;font-weight:800}
    @media(max-width:700px){.v83-summary{grid-template-columns:1fr}.v83-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}}
  `;
  document.head.appendChild(style);
})();