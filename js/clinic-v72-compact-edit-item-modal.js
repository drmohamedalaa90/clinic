(() => {
  const style = document.createElement("style");
  style.textContent = `
    /* V72 — compact Add/Edit Logistics item modal */

    #modalRoot .v62-modal,
    #modalRoot .v61-modal,
    #modalRoot .v60-modal{
      width:min(520px,calc(100vw - 28px))!important;
      max-width:520px!important;
      max-height:calc(100vh - 32px)!important;
      padding:14px!important;
      border-radius:18px!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      box-sizing:border-box!important;
    }

    #modalRoot .v62-modal .modal-header,
    #modalRoot .v61-modal .modal-header,
    #modalRoot .v60-modal .modal-header{
      margin:0 0 8px!important;
      padding:0 0 8px!important;
      min-height:auto!important;
      gap:8px!important;
    }

    #modalRoot .v62-modal .modal-header h3,
    #modalRoot .v61-modal .modal-header h3,
    #modalRoot .v60-modal .modal-header h3{
      font-size:20px!important;
      line-height:1.2!important;
      margin:2px 0 0!important;
    }

    #modalRoot .v62-modal .eyebrow,
    #modalRoot .v61-modal .eyebrow,
    #modalRoot .v60-modal .eyebrow{
      font-size:11px!important;
      line-height:1!important;
      margin:0!important;
    }

    #modalRoot .v62-modal .icon-button,
    #modalRoot .v61-modal .icon-button,
    #modalRoot .v60-modal .icon-button{
      width:40px!important;
      height:40px!important;
      min-width:40px!important;
      padding:0!important;
      border-radius:11px!important;
      font-size:18px!important;
    }

    #modalRoot .v62-form,
    #modalRoot .v61-form,
    #modalRoot .v60-form{
      gap:9px!important;
    }

    #modalRoot .v62-form label,
    #modalRoot .v61-form label,
    #modalRoot .v60-form label{
      gap:4px!important;
      margin:0!important;
      font-size:13px!important;
      line-height:1.15!important;
    }

    #modalRoot .v62-form label > span,
    #modalRoot .v61-form label > span,
    #modalRoot .v60-form label > span{
      margin:0!important;
      padding:0 2px!important;
      font-size:13px!important;
      font-weight:700!important;
      line-height:1.15!important;
    }

    #modalRoot .v62-form .control,
    #modalRoot .v61-form .control,
    #modalRoot .v60-form .control{
      min-height:42px!important;
      height:42px!important;
      padding:8px 12px!important;
      border-radius:11px!important;
      font-size:14px!important;
      line-height:1.2!important;
      margin:0!important;
      box-sizing:border-box!important;
    }

    #modalRoot .v62-form textarea.control,
    #modalRoot .v61-form textarea.control,
    #modalRoot .v60-form textarea.control{
      height:auto!important;
      min-height:72px!important;
    }

    #modalRoot .v62-edit-preview,
    #modalRoot .v61-edit-preview,
    #modalRoot .v60-edit-preview{
      width:112px!important;
      height:112px!important;
      border-radius:11px!important;
      margin:2px 0 4px!important;
      object-fit:cover!important;
    }

    #modalRoot .v62-photo-field,
    #modalRoot .v61-photo-field,
    #modalRoot .v60-photo-field{
      gap:5px!important;
    }

    #modalRoot .v62-photo-field input[type="file"],
    #modalRoot .v61-photo-field input[type="file"],
    #modalRoot .v60-photo-field input[type="file"]{
      height:auto!important;
      min-height:40px!important;
      padding:5px 8px!important;
      font-size:12px!important;
    }

    #modalRoot .v62-form .primary-button,
    #modalRoot .v61-form .primary-button,
    #modalRoot .v60-form .primary-button{
      min-height:42px!important;
      padding:9px 14px!important;
      border-radius:11px!important;
      font-size:13px!important;
      margin-top:2px!important;
    }

    #modalRoot .v62-form-grid,
    #modalRoot .v61-form-grid{
      gap:8px!important;
    }

    /* Tighter modal margins from browser edges */
    #modalRoot:not(.hidden),
    #modalRoot .modal-backdrop{
      padding:16px!important;
    }

    @media(max-width:600px){
      #modalRoot .v62-modal,
      #modalRoot .v61-modal,
      #modalRoot .v60-modal{
        width:calc(100vw - 18px)!important;
        max-width:calc(100vw - 18px)!important;
        max-height:calc(100vh - 18px)!important;
        padding:11px!important;
        border-radius:15px!important;
      }

      #modalRoot:not(.hidden),
      #modalRoot .modal-backdrop{
        padding:9px!important;
      }

      #modalRoot .v62-form .control,
      #modalRoot .v61-form .control,
      #modalRoot .v60-form .control{
        min-height:39px!important;
        height:39px!important;
        padding:7px 10px!important;
        font-size:13px!important;
      }

      #modalRoot .v62-edit-preview,
      #modalRoot .v61-edit-preview,
      #modalRoot .v60-edit-preview{
        width:96px!important;
        height:96px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();