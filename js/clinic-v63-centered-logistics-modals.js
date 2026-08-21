(() => {
  const style = document.createElement("style");
  style.textContent = `
    /* V63 — force Logistics popups to be true centered modal windows */
    #modalRoot:not(.hidden){
      position:fixed!important;
      inset:0!important;
      z-index:99999!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:24px!important;
      overflow:auto!important;
      background:transparent!important;
    }

    #modalRoot .modal-backdrop{
      position:fixed!important;
      inset:0!important;
      width:100vw!important;
      height:100vh!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:24px!important;
      overflow:auto!important;
      background:rgba(10,24,40,.46)!important;
      backdrop-filter:blur(4px)!important;
    }

    #modalRoot .modal-card.v62-modal,
    #modalRoot .modal-card.v62-critical-modal,
    #modalRoot .modal-card.v61-modal,
    #modalRoot .modal-card.v60-modal{
      position:relative!important;
      inset:auto!important;
      top:auto!important;
      left:auto!important;
      right:auto!important;
      bottom:auto!important;
      transform:none!important;
      margin:auto!important;
      width:min(560px,calc(100vw - 48px))!important;
      max-width:560px!important;
      max-height:calc(100vh - 48px)!important;
      overflow:auto!important;
      border-radius:22px!important;
      box-shadow:0 24px 70px rgba(8,24,40,.28)!important;
    }

    #modalRoot .modal-card.v62-critical-modal{
      width:min(650px,calc(100vw - 48px))!important;
      max-width:650px!important;
    }

    #modalRoot .v62-purchase-item{
      border-radius:14px!important;
    }

    #modalRoot .modal-header{
      position:sticky!important;
      top:0!important;
      z-index:2!important;
      background:inherit!important;
      padding-top:2px!important;
    }

    @media (max-width:700px){
      #modalRoot:not(.hidden),
      #modalRoot .modal-backdrop{
        padding:14px!important;
      }

      #modalRoot .modal-card.v62-modal,
      #modalRoot .modal-card.v62-critical-modal,
      #modalRoot .modal-card.v61-modal,
      #modalRoot .modal-card.v60-modal{
        width:min(520px,calc(100vw - 28px))!important;
        max-width:calc(100vw - 28px)!important;
        max-height:calc(100vh - 28px)!important;
        border-radius:18px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();