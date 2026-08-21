(() => {
  const C = window.Clinic;
  if (!C) return;

  // V67 keeps only the existing V62 critical popup on opening Logistics.
  // It does not add a first-login/day popup.
  let lastLogisticsOpenStamp = 0;

  const originalRoute = typeof C.route === "function" ? C.route.bind(C) : null;
  if (originalRoute && !C.route.__v67Wrapped) {
    function wrappedRoute(page, ...rest) {
      if (page === "logistics") {
        const now = Date.now();
        if (now - lastLogisticsOpenStamp < 600) return;
        lastLogisticsOpenStamp = now;
      }
      return originalRoute(page, ...rest);
    }
    wrappedRoute.__v67Wrapped = true;
    C.route = wrappedRoute;
  }

  const root = document.getElementById("modalRoot");
  if (root && !window.__v67ModalObserver) {
    window.__v67ModalObserver = new MutationObserver(() => {
      const criticals = root.querySelectorAll(".v62-critical-modal");
      if (criticals.length <= 1) return;
      for (let i = 1; i < criticals.length; i++) criticals[i].remove();
    });
    window.__v67ModalObserver.observe(root, { childList: true, subtree: true });
  }
})();