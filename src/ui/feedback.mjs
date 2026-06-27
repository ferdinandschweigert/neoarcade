export function createFeedbackUI({
  appStatusEl,
  cloudStatusEl,
  cloudToastEl,
} = {}) {
  let appStatusTimer = null;
  let cloudToastTimer = null;

  function setAppStatus(message, isError = false, autoClearMs = 0) {
    if (!appStatusEl) {
      return;
    }

    appStatusEl.textContent = message;
    appStatusEl.classList.toggle("is-error", isError);

    if (appStatusTimer) {
      clearTimeout(appStatusTimer);
      appStatusTimer = null;
    }

    if (autoClearMs > 0) {
      appStatusTimer = setTimeout(() => {
        appStatusEl.textContent = "";
        appStatusEl.classList.remove("is-error");
      }, autoClearMs);
    }
  }

  function updateCloudStatus(message, state = "off") {
    if (!cloudStatusEl) {
      return;
    }

    cloudStatusEl.textContent = message;
    cloudStatusEl.dataset.state = state;
    cloudStatusEl.classList.toggle("is-error", state === "error");
  }

  function showCloudToast(message, durationMs = 3000) {
    if (!cloudToastEl) {
      return;
    }

    cloudToastEl.textContent = message;
    cloudToastEl.classList.remove("hidden");

    if (cloudToastTimer) {
      clearTimeout(cloudToastTimer);
    }

    cloudToastTimer = setTimeout(() => {
      cloudToastEl.classList.add("hidden");
      cloudToastTimer = null;
    }, durationMs);
  }

  return {
    setAppStatus,
    updateCloudStatus,
    showCloudToast,
  };
}
