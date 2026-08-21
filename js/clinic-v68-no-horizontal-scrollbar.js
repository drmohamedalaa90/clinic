(() => {
  const style = document.createElement("style");
  style.textContent = `
    /* V68 — remove the grey horizontal scrollbar from critical Logistics modal */

    #modalRoot,
    #modalRoot .modal-backdrop,
    #modalRoot .modal-card,
    #modalRoot .v62-critical-modal,
    #modalRoot .v62-critical-list,
    #modalRoot .v62-critical-row {
      overflow-x: hidden !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    #modalRoot .v62-critical-modal {
      width: min(470px, calc(100vw - 28px)) !important;
      max-width: 470px !important;
      min-width: 0 !important;
    }

    #modalRoot .v62-critical-row {
      grid-template-columns: 40px minmax(0, 1fr) auto !important;
      width: 100% !important;
      min-width: 0 !important;
    }

    #modalRoot .v62-critical-row > * {
      min-width: 0 !important;
    }

    #modalRoot .v62-critical-row strong,
    #modalRoot .v62-critical-row small {
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    #modalRoot .v62-critical-row .primary-button {
      width: auto !important;
      max-width: 100% !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }

    /* hide horizontal scrollbar explicitly on all browsers */
    #modalRoot .v62-critical-modal::-webkit-scrollbar:horizontal,
    #modalRoot .modal-backdrop::-webkit-scrollbar:horizontal,
    #modalRoot::-webkit-scrollbar:horizontal {
      height: 0 !important;
      display: none !important;
    }

    #modalRoot .v62-critical-modal,
    #modalRoot .modal-backdrop,
    #modalRoot {
      scrollbar-width: auto;
    }

    @media (max-width: 520px) {
      #modalRoot .v62-critical-modal {
        width: calc(100vw - 20px) !important;
      }

      #modalRoot .v62-critical-row {
        grid-template-columns: 36px minmax(0, 1fr) auto !important;
      }
    }
  `;
  document.head.appendChild(style);
})();