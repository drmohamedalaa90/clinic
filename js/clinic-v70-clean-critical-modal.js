(() => {
  const style = document.createElement("style");
  style.textContent = `
    /* V70 — no scrollbars + small breathing space before text */

    #modalRoot,
    #modalRoot .modal-backdrop,
    #modalRoot .v62-critical-modal,
    #modalRoot .v62-critical-list,
    #modalRoot .v62-critical-row {
      overflow: hidden !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      box-sizing: border-box !important;
    }

    #modalRoot::-webkit-scrollbar,
    #modalRoot .modal-backdrop::-webkit-scrollbar,
    #modalRoot .v62-critical-modal::-webkit-scrollbar,
    #modalRoot .v62-critical-list::-webkit-scrollbar,
    #modalRoot .v62-critical-row::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }

    #modalRoot .v62-critical-modal {
      width: min(470px, calc(100vw - 24px)) !important;
      max-width: 470px !important;
      max-height: none !important;
      height: auto !important;
      padding: 14px !important;
    }

    #modalRoot .v62-critical-list {
      width: 100% !important;
      margin: 8px 0 10px !important;
    }

    #modalRoot .v62-critical-row {
      width: 100% !important;
      min-width: 0 !important;
      grid-template-columns: 40px minmax(0,1fr) auto !important;
      gap: 8px !important;
      padding: 7px 8px !important;
    }

    /* roughly 1–2 mm between the box/image and the text */
    #modalRoot .v62-critical-row > div:nth-child(2) {
      min-width: 0 !important;
      padding-inline-start: 6px !important;
    }

    #modalRoot .v62-critical-row strong,
    #modalRoot .v62-critical-row small {
      display: block !important;
      margin: 0 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    #modalRoot .v62-critical-row .primary-button {
      width: auto !important;
      min-width: 72px !important;
      padding: 8px 11px !important;
      white-space: nowrap !important;
    }

    @media (max-width:520px) {
      #modalRoot .v62-critical-modal {
        width: calc(100vw - 16px) !important;
        padding: 11px !important;
      }

      #modalRoot .v62-critical-row {
        grid-template-columns: 36px minmax(0,1fr) auto !important;
        gap: 6px !important;
        padding: 6px 7px !important;
      }

      #modalRoot .v62-critical-row > div:nth-child(2) {
        padding-inline-start: 5px !important;
      }

      #modalRoot .v62-critical-row .primary-button {
        min-width: 64px !important;
        padding: 7px 9px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();