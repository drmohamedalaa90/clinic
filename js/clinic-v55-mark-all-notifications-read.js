(() => {
  /*
   * V73 EMERGENCY SAFE FIX
   * Replaces only clinic-v55-mark-all-notifications-read.js
   * No observers, no navigation patching, no startup loops.
   */
  const C = window.Clinic;
  if (!C) return;

  function label(en, ar) {
    return C.lang === "ar" ? ar : en;
  }

  async function markAll(button) {
    if (!window.ClinicNotifications || typeof ClinicNotifications.markAll !== "function") {
      C.toast(label(
        "Notification system is not ready.",
        "نظام الإشعارات غير جاهز."
      ), "error");
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = label("Marking...", "جاري التعليم...");

    try {
      // Use only the clinic's real notification backend.
      await ClinicNotifications.markAll();

      // Re-read the real server state once.
      if (typeof ClinicNotifications.refresh === "function") {
        await ClinicNotifications.refresh();
      }

      C.toast(label(
        "All notifications marked as read.",
        "تم تعليم كل الإشعارات كمقروءة."
      ));
    } catch (error) {
      console.error("Mark all as read failed:", error);
      C.toast(
        label(
          "Could not mark notifications as read.",
          "تعذر تعليم الإشعارات كمقروءة."
        ) + (error?.message ? ` ${error.message}` : ""),
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function installButton() {
    const header = document.querySelector("#notificationDrawer .drawer-header");
    if (!header) return;

    // Remove older custom Mark-all buttons only.
    header.querySelectorAll(
      "#v55MarkAllRead,#v61MarkAllRead,#v73MarkAllRead,.v55-mark-all-read,.v61-mark-all-read,.v73-mark-all-read"
    ).forEach(el => el.remove());

    const closeButton = header.querySelector("#closeNotifications");

    const button = document.createElement("button");
    button.id = "v73MarkAllRead";
    button.type = "button";
    button.className = "v73-mark-all-read";
    button.textContent = label("Mark all as read", "تعليم الكل كمقروء");
    button.addEventListener("click", () => markAll(button));

    // Insert without moving/rebuilding any existing header element.
    if (closeButton) {
      header.insertBefore(button, closeButton);
    } else {
      header.appendChild(button);
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    #notificationDrawer .v73-mark-all-read{
      border:0;
      background:#eafaf6;
      color:#0f8b78;
      font-weight:800;
      font-size:12px;
      cursor:pointer;
      padding:7px 10px;
      border-radius:9px;
      white-space:nowrap;
      margin-inline-start:auto;
      margin-inline-end:6px;
    }
    #notificationDrawer .v73-mark-all-read:disabled{
      opacity:.55;
      cursor:default;
    }
  `;
  document.head.appendChild(style);

  // The notification drawer already exists in app.html.
  // Install once only; do not observe/mutate repeatedly.
  installButton();
})();