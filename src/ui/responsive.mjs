const VIEWPORT_WIDTH = {
  narrow: 480,
  medium: 820,
  wide: 1120,
};

const CONTAINER_WIDTH = {
  narrow: 480,
  medium: 720,
};

const SHELL_FIT_PADDING = 16;
const SHELL_SCALE_MIN = 0.55;

export function detectTouchDevice(globalObject = globalThis) {
  const matchMedia = globalObject.matchMedia?.bind(globalObject);
  const coarse = matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const noHover = matchMedia?.("(hover: none)")?.matches ?? false;
  // Phones/tablets: coarse primary pointer or no hover.
  // Do NOT use maxTouchPoints / ontouchstart alone — many laptops report those
  // and would incorrectly show on-screen controllers next to keyboard play.
  return coarse || noHover;
}

function resolveViewportWidth(width) {
  if (width <= VIEWPORT_WIDTH.narrow) {
    return "narrow";
  }
  if (width <= VIEWPORT_WIDTH.medium) {
    return "medium";
  }
  if (width <= VIEWPORT_WIDTH.wide) {
    return "compact";
  }
  return "wide";
}

function resolveContainerWidth(width) {
  if (width <= CONTAINER_WIDTH.narrow) {
    return "narrow";
  }
  if (width <= CONTAINER_WIDTH.medium) {
    return "medium";
  }
  return "wide";
}

function roundScale(value) {
  return Math.round(value * 1000) / 1000;
}

export function computeShellScale({
  shellWidth,
  shellHeight,
  viewportWidth,
  viewportHeight,
  padding = SHELL_FIT_PADDING,
  minScale = SHELL_SCALE_MIN,
  enabled = true,
} = {}) {
  if (!enabled || !shellWidth || !shellHeight || !viewportWidth || !viewportHeight) {
    return 1;
  }

  const availableWidth = Math.max(1, viewportWidth - padding);
  const availableHeight = Math.max(1, viewportHeight - padding);
  const nextScale = Math.min(
    1,
    availableWidth / shellWidth,
    availableHeight / shellHeight,
  );

  return roundScale(Math.max(minScale, nextScale));
}

export function createResponsiveLayout({
  root = document.body,
  container = document.querySelector(".app"),
  shell = document.querySelector(".app-shell"),
  onChange,
} = {}) {
  const isTouchDevice = detectTouchDevice();
  root.classList.toggle("is-touch", isTouchDevice);

  let frame = null;

  function applyShellScale() {
    const playingGame = root.dataset.panel === "game";
    // On phones/tablets, keep UI at native size and scroll the menu
    // instead of shrinking the whole shell to fit every game card.
    const narrowViewport = window.innerWidth <= 860;
    if (!shell || playingGame || narrowViewport) {
      root.style.setProperty("--shell-scale", "1");
      return 1;
    }

    root.style.setProperty("--shell-scale", "1");
    // Force layout so measurements use the unscaled shell size.
    void shell.offsetWidth;

    const scale = computeShellScale({
      shellWidth: shell.offsetWidth,
      shellHeight: shell.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      enabled: true,
    });

    root.style.setProperty("--shell-scale", String(scale));
    return scale;
  }

  function readState() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const containerWidth = container?.clientWidth ?? width;
    const shellScale = applyShellScale();

    return {
      isTouchDevice,
      viewport: resolveViewportWidth(width),
      orientation: width >= height ? "landscape" : "portrait",
      container: resolveContainerWidth(containerWidth),
      width,
      height,
      containerWidth,
      shellScale,
    };
  }

  function applyState(state) {
    root.dataset.viewport = state.viewport;
    root.dataset.orientation = state.orientation;
    root.dataset.container = state.container;
    root.dataset.touch = state.isTouchDevice ? "true" : "false";
    root.dataset.shellScale = String(state.shellScale);

    if (container) {
      container.dataset.viewport = state.container;
    }

    onChange?.(state);
  }

  function update() {
    applyState(readState());
  }

  function scheduleUpdate() {
    if (frame !== null) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = null;
      update();
    });
  }

  const panelObserver = typeof MutationObserver !== "undefined"
    ? new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-panel") {
          scheduleUpdate();
          break;
        }
      }
    })
    : null;

  panelObserver?.observe(root, { attributes: true, attributeFilter: ["data-panel"] });

  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleUpdate, { passive: true });

  if (container && typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    update();

    return {
      isTouchDevice,
      update,
      disconnect() {
        observer.disconnect();
        panelObserver?.disconnect();
        window.removeEventListener("resize", scheduleUpdate);
        window.removeEventListener("orientationchange", scheduleUpdate);
        if (frame !== null) {
          window.cancelAnimationFrame(frame);
        }
      },
    };
  }

  update();

  return {
    isTouchDevice,
    update,
    disconnect() {
      panelObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    },
  };
}
