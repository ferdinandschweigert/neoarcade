import { renderSVG } from "../vendor/uqr.mjs";

const DEFAULT_TITLE = "Brain Break Arcade";
const DEFAULT_TEXT = "Klassische Brain-Break-Spiele zum gemeinsamen Spielen.";

function getShareUrl() {
  if (typeof location !== "undefined" && location.href) {
    return location.href.split("#")[0];
  }
  return "https://neoarcade.vercel.app";
}

function canNativeShare(url) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare !== "function") {
    return true;
  }
  try {
    return navigator.canShare({ url, title: DEFAULT_TITLE, text: DEFAULT_TEXT });
  } catch {
    return false;
  }
}

function renderQrSvg(url) {
  return renderSVG(url, {
    ecc: "M",
    boostEcc: true,
    border: 2,
    pixelSize: 8,
    whiteColor: "#ffffff",
    blackColor: "#111827",
  });
}

export function createShareManager(config = {}) {
  const rootEl = config.rootEl;
  const openButtonEl = config.openButtonEl;
  const closeButtonEl = config.closeButtonEl;
  const qrEl = config.qrEl;
  const urlEl = config.urlEl;
  const messageEl = config.messageEl;
  const nativeShareButtonEl = config.nativeShareButtonEl;
  const copyButtonEl = config.copyButtonEl;
  const getUrl = typeof config.getUrl === "function" ? config.getUrl : getShareUrl;

  let messageTimer = 0;

  function init() {
    if (!rootEl || !openButtonEl) {
      return;
    }

    openButtonEl.addEventListener("click", () => {
      open();
    });

    if (closeButtonEl) {
      closeButtonEl.addEventListener("click", () => {
        close();
      });
    }

    rootEl.addEventListener("click", (event) => {
      if (event.target === rootEl) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && rootEl && !rootEl.classList.contains("hidden")) {
        close();
      }
    });

    if (nativeShareButtonEl) {
      nativeShareButtonEl.addEventListener("click", () => {
        void shareNative();
      });
    }

    if (copyButtonEl) {
      copyButtonEl.addEventListener("click", () => {
        void copyLink();
      });
    }
  }

  function open() {
    refresh();
    rootEl.classList.remove("hidden");
    document.body.classList.add("share-open");
    if (closeButtonEl) {
      closeButtonEl.focus();
    }
  }

  function close() {
    rootEl.classList.add("hidden");
    document.body.classList.remove("share-open");
    clearMessage();
    openButtonEl?.focus();
  }

  function refresh() {
    const url = getUrl();
    if (urlEl) {
      urlEl.textContent = url;
    }
    if (qrEl) {
      qrEl.innerHTML = renderQrSvg(url);
      const svg = qrEl.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `QR-Code für ${url}`);
      }
    }
    if (nativeShareButtonEl) {
      const supported = canNativeShare(url);
      nativeShareButtonEl.hidden = !supported;
      nativeShareButtonEl.disabled = !supported;
    }
    clearMessage();
  }

  async function shareNative() {
    const url = getUrl();
    if (!canNativeShare(url)) {
      setMessage("Teilen nicht verfügbar — Link kopieren oder QR-Code scannen.");
      return;
    }
    try {
      await navigator.share({
        title: DEFAULT_TITLE,
        text: DEFAULT_TEXT,
        url,
      });
      setMessage("Geteilt.");
    } catch (error) {
      if (error && error.name === "AbortError") {
        clearMessage();
        return;
      }
      setMessage("Teilen fehlgeschlagen — Link kopieren oder QR-Code scannen.");
    }
  }

  async function copyLink() {
    const url = getUrl();
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopy(url);
      }
      setMessage("Link kopiert.");
    } catch {
      try {
        fallbackCopy(url);
        setMessage("Link kopiert.");
      } catch {
        setMessage("Kopieren fehlgeschlagen — Link unten markieren.");
      }
    }
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) {
      throw new Error("copy failed");
    }
  }

  function setMessage(text) {
    if (!messageEl) {
      return;
    }
    messageEl.textContent = text;
    if (typeof window !== "undefined") {
      window.clearTimeout(messageTimer);
      if (text) {
        messageTimer = window.setTimeout(() => {
          clearMessage();
        }, 2800);
      }
    }
  }

  function clearMessage() {
    if (!messageEl) {
      return;
    }
    messageEl.textContent = "";
    if (typeof window !== "undefined") {
      window.clearTimeout(messageTimer);
    }
  }

  function isOpen() {
    return Boolean(rootEl && !rootEl.classList.contains("hidden"));
  }

  return {
    init,
    open,
    close,
    refresh,
    isOpen,
    getShareUrl: getUrl,
    canNativeShare: () => canNativeShare(getUrl()),
    renderQrSvg,
  };
}

export { getShareUrl, canNativeShare, renderQrSvg };
