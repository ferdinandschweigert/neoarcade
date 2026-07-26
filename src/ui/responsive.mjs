const VIEWPORT_WIDTH = {
  narrow: 480,
  medium: 820,
  wide: 1120,
};

const CONTAINER_WIDTH = {
  narrow: 480,
  medium: 720,
};

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

export function createResponsiveLayout({
  root = document.body,
  container = document.querySelector(".app"),
  onChange,
} = {}) {
  const isTouchDevice = detectTouchDevice();
  root.classList.toggle("is-touch", isTouchDevice);

  let frame = null;

  function readState() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const containerWidth = container?.clientWidth ?? width;

    return {
      isTouchDevice,
      viewport: resolveViewportWidth(width),
      orientation: width >= height ? "landscape" : "portrait",
      container: resolveContainerWidth(containerWidth),
      width,
      height,
      containerWidth,
    };
  }

  function applyState(state) {
    root.dataset.viewport = state.viewport;
    root.dataset.orientation = state.orientation;
    root.dataset.container = state.container;
    root.dataset.touch = state.isTouchDevice ? "true" : "false";

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
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    },
  };
}
