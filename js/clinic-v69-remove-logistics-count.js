(() => {
  function removeNumericLogisticsBadge() {
    const logistics = document.querySelector('#navigation [data-page="logistics"]');
    if (!logistics) return;

    [...logistics.querySelectorAll("span,div,b,strong,small")].forEach(el => {
      const text = (el.textContent || "").trim();

      // Remove only standalone numeric inventory-count badges such as "19".
      // Keep the 📦 icon, Logistics label and ⚠ critical alert untouched.
      if (/^\d+$/.test(text) && !el.classList.contains("notification-badge")) {
        el.remove();
      }
    });
  }

  let observer = null;

  function install() {
    removeNumericLogisticsBadge();

    const logistics = document.querySelector('#navigation [data-page="logistics"]');
    if (!logistics || observer) return;

    observer = new MutationObserver(() => {
      removeNumericLogisticsBadge();
    });

    observer.observe(logistics, {
      childList: true,
      subtree: true
    });
  }

  const timer = setInterval(() => {
    install();
    if (document.querySelector('#navigation [data-page="logistics"]')) {
      clearInterval(timer);
    }
  }, 250);

  // Re-run after normal page/navigation refreshes without touching other badges.
  document.addEventListener("click", event => {
    if (event.target.closest?.("#navigation")) {
      setTimeout(removeNumericLogisticsBadge, 100);
    }
  });

  const style = document.createElement("style");
  style.textContent = `
    /* V69 safety: hide legacy numeric Logistics count badges only */
    #navigation [data-page="logistics"] .v44-logistics-badge,
    #navigation [data-page="logistics"] .logistics-count,
    #navigation [data-page="logistics"] .inventory-count {
      display:none!important;
    }
  `;
  document.head.appendChild(style);
})();