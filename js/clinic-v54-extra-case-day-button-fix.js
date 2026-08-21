(() => {
  const C=window.Clinic;
  if(!C || C.__v54DayButtonFixLoaded) return;
  C.__v54DayButtonFixLoaded=true;

  function style(){
    if(document.getElementById('v54-day-btn-styles')) return;
    const s=document.createElement('style');
    s.id='v54-day-btn-styles';
    s.textContent=`
      .v54-day-extra-btn{
        width:30px;height:30px;min-width:30px;
        border:1px solid #f59e0b;border-radius:9px;
        background:#fff7ed;color:#b45309;
        display:grid;place-items:center;
        font-size:16px;line-height:1;cursor:pointer;
        margin-left:auto;
      }
      .v54-day-extra-btn:hover{background:#ffedd5}
      .v54-day-extra-slot{
        display:flex;justify-content:flex-end;align-items:center;
        min-height:32px;
      }
    `;
    document.head.appendChild(s);
  }

  function validPage(){
    return ['appointments','doctor-appointments'].includes(C.currentPage);
  }

  function dayDate(el){
    const direct=el.dataset?.date||el.querySelector('[data-date]')?.dataset?.date;
    if(direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

    const m=(el.textContent||'').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  function dedupeOldButtons(){
    // remove ALL V53 day buttons first; V54 will add exactly one canonical button.
    document.querySelectorAll('.v53-day-extra-btn').forEach(x=>x.remove());

    // if V54 duplicated due rerender, keep only first per day column
    const seen=new Set();
    document.querySelectorAll('.v54-day-extra-btn').forEach(btn=>{
      const key=btn.dataset.date||'';
      if(seen.has(key)) btn.remove();
      else seen.add(key);
    });
  }

  function inject(){
    if(!validPage()) return;
    dedupeOldButtons();

    const dayNames=/\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i;
    const dateRe=/\b\d{2}\/\d{2}\/\d{4}\b/;

    const nodes=[...document.querySelectorAll('div,section,article')];

    for(const node of nodes){
      const txt=(node.textContent||'').trim();
      if(!dayNames.test(txt) || !dateRe.test(txt)) continue;

      // only operate on compact day columns, not week containers
      if(node.querySelectorAll('.hour-slot,.hour-card,[data-slot-start]').length>20) continue;

      const date=dayDate(node);
      if(!date) continue;

      // find the smallest immediate child holding weekday+date
      let header=[...node.children].find(ch=>{
        const t=(ch.textContent||'').trim();
        return dayNames.test(t) && dateRe.test(t);
      });

      if(!header) continue;

      // Prevent two icons in the same day header.
      if(header.querySelector('.v54-day-extra-btn')) continue;

      // Remove any legacy plus from this header region.
      header.querySelectorAll('.v53-day-extra-btn').forEach(x=>x.remove());

      const slot=document.createElement('div');
      slot.className='v54-day-extra-slot';

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='v54-day-extra-btn';
      btn.dataset.date=date;
      btn.textContent='＋';
      btn.title=C.lang==='ar'?'إضافة حالة إضافية لهذا اليوم':'Add extra case for this day';
      btn.setAttribute('aria-label',btn.title);

      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();

        if(typeof C.openExtraCaseModal==='function'){
          C.openExtraCaseModal({date});
        }else{
          C.toast(
            C.lang==='ar'?'تعذر فتح نافذة الحالة الإضافية.':'Could not open extra-case form.',
            'error'
          );
        }
      });

      slot.appendChild(btn);
      header.appendChild(slot);
    }

    dedupeOldButtons();
  }

  style();
  const obs=new MutationObserver(()=>setTimeout(inject,20));
  obs.observe(document.body,{childList:true,subtree:true});
  inject();
})();
