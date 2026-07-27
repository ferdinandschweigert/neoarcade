import { pointerToGridCell } from "./games/shared.mjs";

export const ACTION_LABELS = {
  UP: "▲",
  DOWN: "▼",
  LEFT: "◀",
  RIGHT: "▶",
  SELECT: "✓",
  FLAG: "⚑",
};

export const CONTROL_SCHEMES = {
  none: [],
  action: [["SELECT"]],
  dpad: [["UP"], ["LEFT", "DOWN", "RIGHT"]],
  horizontal: [["LEFT", "RIGHT"]],
  vertical: [["UP", "DOWN"]],
  hfire: [["UP"], ["LEFT", "RIGHT"]],
  grid_select: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT"]],
  grid_select_flag: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT", "FLAG"]],
  horizontal_select: [["LEFT", "RIGHT"], ["SELECT"]],
  select_only: [["SELECT"]],
  jump_cane: [["UP"], ["LEFT", "RIGHT"], ["SELECT"]],
  shop_nav: [["LEFT", "RIGHT"], ["SELECT"]],
};

export const ACTION_ARIA_LABELS = {
  UP: "Move up",
  DOWN: "Move down",
  LEFT: "Move left",
  RIGHT: "Move right",
  SELECT: "Select",
  FLAG: "Flag",
};

export const SCHEME_ACTION_LABELS = {
  jump_cane: {
    UP: "Jump",
    LEFT: "◀",
    RIGHT: "▶",
    SELECT: "Cane",
  },
  shop_nav: {
    LEFT: "◀",
    RIGHT: "▶",
    SELECT: "Buy",
  },
};

export const SCHEME_ACTION_ARIA_LABELS = {
  jump_cane: {
    UP: "Jump and hold to flip",
    LEFT: "Previous shop item",
    RIGHT: "Next shop item",
    SELECT: "Hook cane or confirm shop",
  },
  shop_nav: {
    LEFT: "Previous shop item",
    RIGHT: "Next shop item",
    SELECT: "Buy or continue",
  },
};

export const DEFAULT_CONTROL_HINTS = {
  action: "Tap the board to start or interact.",
  dpad: "Swipe on the board to move.",
  horizontal: "Swipe left/right on the board.",
  vertical: "Swipe up/down on the board.",
  hfire: "Swipe left/right to move. Swipe up or tap to fire/jump.",
  grid_select: "Tap a cell to play.",
  grid_select_flag: "Tap to reveal. Long-press to flag.",
  horizontal_select: "Swipe left/right, tap to confirm.",
  select_only: "Tap the board to play.",
  jump_cane: "Up/W jump (hold to flip). Down/S or Cane to swing on wires.",
  shop_nav: "Left/Right to browse. Select to buy or continue.",
  none: "Swipe on the board to play.",
};

export const GAMEPAD_AXIS_THRESHOLD = 0.54;
export const GAMEPAD_REPEAT_INITIAL_MS = 180;
export const GAMEPAD_REPEAT_MS = 90;
export const GAMEPAD_CONTROL_ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "SELECT", "FLAG"];
export const GAMEPAD_BUTTON_CONTROL_MAP = [
  { button: 12, action: "UP" },
  { button: 13, action: "DOWN" },
  { button: 14, action: "LEFT" },
  { button: 15, action: "RIGHT" },
  { button: 0, action: "SELECT" },
  { button: 1, action: "FLAG" },
];
export const GAMEPAD_BUTTON_EDGE_MAP = [
  { button: 8, action: "BACK" },
  { button: 9, action: "PAUSE" },
  { button: 3, action: "RESTART" },
];

const TOUCH_HOLD_INITIAL_MS = 160;
const TOUCH_HOLD_REPEAT_MS = 80;
const GESTURE_HOLD_MS = 200;
const DEFAULT_SWIPE_MIN = 24;
const DEFAULT_LONG_PRESS_MS = 320;

export function getControlHintForGame(game) {
  if (game && typeof game.getControlHint === "function") {
    const hint = game.getControlHint();
    if (hint) {
      return hint;
    }
  }

  const scheme = game?.controlScheme || "none";
  return DEFAULT_CONTROL_HINTS[scheme] || DEFAULT_CONTROL_HINTS.none;
}

export function shouldShowTouchButtons(controlMode, isTouchDevice, schemeName) {
  const scheme = CONTROL_SCHEMES[schemeName] ?? CONTROL_SCHEMES.none;
  if (!isTouchDevice || scheme.length === 0) {
    return false;
  }

  // Phone default (auto) and gestures: play by swiping/tapping the board.
  // On-screen pads only when explicitly requested.
  return controlMode === "buttons" || controlMode === "both";
}

export function shouldUseGestures(controlMode, isTouchDevice) {
  if (!isTouchDevice) {
    return false;
  }

  if (controlMode === "buttons") {
    return false;
  }

  // auto / gestures / both → touch the game board
  return true;
}

export function createInputManager(options) {
  const {
    canvas,
    touchControlsEl,
    isTouchDevice,
    getActiveGame,
    getControlMode,
    getSwipeMinDistance = () => DEFAULT_SWIPE_MIN,
    getLongPressMs = () => DEFAULT_LONG_PRESS_MS,
    onControlApplied,
    onBack,
    onPause,
    onRestart,
    onGamepadConnected,
  } = options;

  let touchHoldTimer = null;
  let touchHoldAction = null;
  let suppressButtonClick = false;
  let suppressButtonClickTimer = null;
  let swipeTouchStartX = 0;
  let swipeTouchStartY = 0;
  let swipeTouchId = null;
  let swipeTouchStartTime = 0;
  let gamepadAnimationFrame = null;
  let gamepadWasConnected = false;
  const gamepadControlState = new Map();
  const gamepadEdgeState = new Map();

  function triggerControl(action) {
    const game = getActiveGame();
    if (!game) {
      return false;
    }

    const changed = game.onControl(action);
    if (changed) {
      pulseTouchFeedback(canvas);
      onControlApplied?.();
    }
    return changed;
  }

  function releaseControl(action) {
    const game = getActiveGame();
    if (!game) {
      return false;
    }

    let changed = false;
    if (typeof game.onControlRelease === "function") {
      changed = game.onControlRelease(action) || changed;
    }
    if (typeof game.onControlUp === "function") {
      changed = game.onControlUp(action) || changed;
    }
    if (changed) {
      onControlApplied?.();
    }
    return changed;
  }

  function resolveActionButton(eventTarget) {
    if (!(eventTarget instanceof Element)) {
      return null;
    }

    return eventTarget.closest("button[data-action]");
  }

  function renderTouchControls(schemeName) {
    if (!touchControlsEl) {
      return;
    }

    const controlMode = getControlMode();
    const showButtons = shouldShowTouchButtons(controlMode, isTouchDevice, schemeName);
    const scheme = showButtons
      ? CONTROL_SCHEMES[schemeName] ?? CONTROL_SCHEMES.none
      : CONTROL_SCHEMES.none;
    const schemeLabels = SCHEME_ACTION_LABELS[schemeName] || {};
    const schemeAria = SCHEME_ACTION_ARIA_LABELS[schemeName] || {};

    touchControlsEl.innerHTML = "";

    if (scheme.length === 0) {
      touchControlsEl.classList.add("is-empty");
      return;
    }

    touchControlsEl.classList.remove("is-empty");

    for (const rowActions of scheme) {
      const rowEl = document.createElement("div");
      rowEl.className = `touch-row cols-${rowActions.length}`;

      for (const action of rowActions) {
        const buttonEl = document.createElement("button");
        buttonEl.type = "button";
        buttonEl.dataset.action = action;
        buttonEl.className = "touch-action-button";
        buttonEl.setAttribute(
          "aria-label",
          schemeAria[action] || ACTION_ARIA_LABELS[action] || action.toLowerCase(),
        );
        buttonEl.textContent = schemeLabels[action] || ACTION_LABELS[action] || action;
        rowEl.appendChild(buttonEl);
      }

      touchControlsEl.appendChild(rowEl);
    }
  }

  function stopTouchHold() {
    const action = touchHoldAction;

    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    touchHoldAction = null;

    if (action) {
      releaseControl(action);
    }
  }

  function startTouchHold(action) {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    if (touchHoldAction && touchHoldAction !== action) {
      releaseControl(touchHoldAction);
    }

    touchHoldAction = action;
    triggerControl(action);

    touchHoldTimer = setTimeout(function repeatHold() {
      if (!touchHoldAction || !getActiveGame()) {
        return;
      }

      triggerControl(touchHoldAction);
      touchHoldTimer = setTimeout(repeatHold, TOUCH_HOLD_REPEAT_MS);
    }, TOUCH_HOLD_INITIAL_MS);
  }

  function pulseTouchFeedback(targetCanvas) {
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      navigator.vibrate?.(10);
    }

    if (targetCanvas) {
      targetCanvas.classList.remove("touch-pulse");
      void targetCanvas.offsetWidth;
      targetCanvas.classList.add("touch-pulse");
    }
  }

  function handleCanvasTap(clientX, clientY, isLongPress) {
    const game = getActiveGame();
    if (!game) {
      return false;
    }

    if (typeof game.onTapCell === "function" && typeof game.getGridLayout === "function") {
      const layout = game.getGridLayout();
      const cell = pointerToGridCell(clientX, clientY, canvas, layout);
      if (cell) {
        const changed = game.onTapCell(cell.col, cell.row, { longPress: isLongPress });
        if (changed) {
          pulseTouchFeedback(canvas);
          onControlApplied?.();
        }
        return changed;
      }
    }

    const action = isLongPress ? "FLAG" : "SELECT";
    return triggerControl(action);
  }

  function bindTouchControls() {
    if (!touchControlsEl) {
      return;
    }

    function armClickSuppression() {
      suppressButtonClick = true;
      if (suppressButtonClickTimer) {
        clearTimeout(suppressButtonClickTimer);
      }
      suppressButtonClickTimer = setTimeout(() => {
        suppressButtonClick = false;
        suppressButtonClickTimer = null;
      }, 120);
    }

    touchControlsEl.addEventListener("pointerdown", (event) => {
      if (!getActiveGame()) {
        return;
      }

      const button = resolveActionButton(event.target);
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers reject capture on non-primary pointers.
      }

      armClickSuppression();
      startTouchHold(action);
    }, { passive: false });

    touchControlsEl.addEventListener("pointerup", (event) => {
      event.preventDefault();
      stopTouchHold();
    }, { passive: false });

    touchControlsEl.addEventListener("pointercancel", () => {
      stopTouchHold();
      suppressButtonClick = false;
    });

    touchControlsEl.addEventListener("lostpointercapture", () => {
      stopTouchHold();
    });

    // Fallback for keyboard / accessibility activation without pointer events.
    touchControlsEl.addEventListener("click", (event) => {
      if (!getActiveGame()) {
        return;
      }

      if (suppressButtonClick) {
        suppressButtonClick = false;
        event.preventDefault();
        return;
      }

      const button = resolveActionButton(event.target);
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      if (!action) {
        return;
      }

      event.preventDefault();
      triggerControl(action);
    });
  }

  function bindCanvasGestures() {
    if (!canvas) {
      return;
    }

    function directionFromDelta(dx, dy) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx >= absDy) {
        return dx > 0 ? "RIGHT" : "LEFT";
      }
      return dy > 0 ? "DOWN" : "UP";
    }

    canvas.addEventListener("touchstart", (event) => {
      if (!getActiveGame() || !shouldUseGestures(getControlMode(), isTouchDevice)) {
        return;
      }

      event.preventDefault();
      const touch = event.changedTouches[0];
      swipeTouchStartX = touch.clientX;
      swipeTouchStartY = touch.clientY;
      swipeTouchId = touch.identifier;
      swipeTouchStartTime = Date.now();
    }, { passive: false });

    canvas.addEventListener("touchmove", (event) => {
      if (
        !getActiveGame()
        || !shouldUseGestures(getControlMode(), isTouchDevice)
        || swipeTouchId == null
      ) {
        return;
      }

      const touch = Array.from(event.touches).find((t) => t.identifier === swipeTouchId);
      if (!touch) {
        return;
      }

      event.preventDefault();

      const dx = touch.clientX - swipeTouchStartX;
      const dy = touch.clientY - swipeTouchStartY;
      const swipeMin = getSwipeMinDistance();
      if (Math.abs(dx) < swipeMin && Math.abs(dy) < swipeMin) {
        return;
      }

      const action = directionFromDelta(dx, dy);
      if (touchHoldAction !== action) {
        startTouchHold(action);
      }
    }, { passive: false });

    canvas.addEventListener("touchend", (event) => {
      if (!getActiveGame() || !shouldUseGestures(getControlMode(), isTouchDevice)) {
        return;
      }

      event.preventDefault();

      const touch = Array.from(event.changedTouches).find(
        (t) => t.identifier === swipeTouchId,
      );
      if (!touch) {
        return;
      }

      swipeTouchId = null;

      const dx = touch.clientX - swipeTouchStartX;
      const dy = touch.clientY - swipeTouchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const elapsedMs = Date.now() - swipeTouchStartTime;
      const swipeMin = getSwipeMinDistance();
      const longPressMs = getLongPressMs();
      const wasHolding = Boolean(touchHoldAction);

      if (wasHolding) {
        stopTouchHold();
        swipeTouchStartTime = 0;
        return;
      }

      if (absDx < swipeMin && absDy < swipeMin) {
        handleCanvasTap(touch.clientX, touch.clientY, elapsedMs >= longPressMs);
        swipeTouchStartTime = 0;
        return;
      }

      const action = directionFromDelta(dx, dy);
      triggerControl(action);
      // One-shot swipe: briefly hold then release so run/paddle games still move.
      const releaseAction = action;
      setTimeout(() => {
        releaseControl(releaseAction);
      }, GESTURE_HOLD_MS);
      swipeTouchStartTime = 0;
    }, { passive: false });

    canvas.addEventListener("touchcancel", () => {
      swipeTouchId = null;
      swipeTouchStartTime = 0;
      stopTouchHold();
    });
  }

  function bindGlobalTouchScrollLock() {
    document.addEventListener("touchmove", (event) => {
      if (!getActiveGame()) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest("#touch-controls, .controls-overlay, .auth-gate, .tabletop-overlay")) {
        return;
      }

      event.preventDefault();
    }, { passive: false });
  }

  function handleKeyDown(event) {
    const game = getActiveGame();
    if (!game) {
      return false;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onBack?.();
      return true;
    }

    if (event.key === " " || event.code === "Space") {
      if (typeof game.togglePause === "function") {
        event.preventDefault();
        game.togglePause();
        onControlApplied?.();
        return true;
      }
    }

    if (event.key === "r" || event.key === "R") {
      if (typeof game.restart === "function") {
        event.preventDefault();
        game.restart();
        onControlApplied?.();
        return true;
      }
    }

    if (game.onKeyDown(event.key)) {
      event.preventDefault();
      onControlApplied?.();
      return true;
    }

    return false;
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (event) => {
      handleKeyDown(event);
    });

    document.addEventListener("keyup", (event) => {
      const game = getActiveGame();
      if (!game) {
        return;
      }

      if (game.onKeyUp(event.key)) {
        event.preventDefault();
      }
    });
  }

  function resetGamepadStates() {
    for (const action of GAMEPAD_CONTROL_ACTIONS) {
      gamepadControlState.set(action, { pressed: false, nextRepeat: 0 });
    }

    for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
      gamepadEdgeState.set(mapping.action, false);
    }
  }

  function getPrimaryGamepad() {
    if (typeof navigator.getGamepads !== "function") {
      return null;
    }

    const pads = navigator.getGamepads();
    if (!pads) {
      return null;
    }

    for (const pad of pads) {
      if (pad && pad.connected) {
        return pad;
      }
    }

    return null;
  }

  function resolveGamepadAxes(gamepad) {
    const x = gamepad.axes[0] ?? 0;
    const y = gamepad.axes[1] ?? 0;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX < GAMEPAD_AXIS_THRESHOLD && absY < GAMEPAD_AXIS_THRESHOLD) {
      return [];
    }

    if (absX >= absY) {
      return [x < 0 ? "LEFT" : "RIGHT"];
    }

    return [y < 0 ? "UP" : "DOWN"];
  }

  function collectGamepadActions(gamepad) {
    const controlActions = new Set();
    const edgeActions = new Set();

    for (const mapping of GAMEPAD_BUTTON_CONTROL_MAP) {
      if (gamepad.buttons[mapping.button]?.pressed) {
        controlActions.add(mapping.action);
      }
    }

    for (const direction of resolveGamepadAxes(gamepad)) {
      controlActions.add(direction);
    }

    for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
      if (gamepad.buttons[mapping.button]?.pressed) {
        edgeActions.add(mapping.action);
      }
    }

    return { controlActions, edgeActions };
  }

  function handleGamepadEdgeActions(edgeActions) {
    let changed = false;

    for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
      const isPressed = edgeActions.has(mapping.action);
      const wasPressed = gamepadEdgeState.get(mapping.action) || false;

      if (isPressed && !wasPressed) {
        if (mapping.action === "BACK") {
          onBack?.();
          changed = true;
        } else if (mapping.action === "PAUSE") {
          getActiveGame()?.togglePause?.();
          changed = true;
        } else if (mapping.action === "RESTART") {
          getActiveGame()?.restart?.();
          changed = true;
        }
      }

      gamepadEdgeState.set(mapping.action, isPressed);
    }

    return changed;
  }

  function handleGamepadControlActions(controlActions, timestamp) {
    let changed = false;

    for (const action of GAMEPAD_CONTROL_ACTIONS) {
      const isPressed = controlActions.has(action);
      const holdState = gamepadControlState.get(action) || {
        pressed: false,
        nextRepeat: 0,
      };

      if (isPressed) {
        if (!holdState.pressed) {
          holdState.pressed = true;
          holdState.nextRepeat = timestamp + GAMEPAD_REPEAT_INITIAL_MS;
          changed = triggerControl(action) || changed;
        } else if (timestamp >= holdState.nextRepeat) {
          holdState.nextRepeat = timestamp + GAMEPAD_REPEAT_MS;
          changed = triggerControl(action) || changed;
        }
      } else if (holdState.pressed) {
        holdState.pressed = false;
        holdState.nextRepeat = 0;
        changed = releaseControl(action) || changed;
      }

      gamepadControlState.set(action, holdState);
    }

    return changed;
  }

  function pollGamepadFrame(timestamp) {
    const game = getActiveGame();
    if (!game || typeof navigator.getGamepads !== "function") {
      resetGamepadStates();
      return;
    }

    const gamepad = getPrimaryGamepad();
    if (!gamepad) {
      gamepadWasConnected = false;
      resetGamepadStates();
      return;
    }

    if (!gamepadWasConnected) {
      gamepadWasConnected = true;
      onGamepadConnected?.();
    }

    const actions = collectGamepadActions(gamepad);
    let changed = false;

    changed = handleGamepadEdgeActions(actions.edgeActions) || changed;
    changed = handleGamepadControlActions(actions.controlActions, timestamp) || changed;

    if (changed) {
      onControlApplied?.();
    }
  }

  function startGamepadPolling() {
    if (typeof requestAnimationFrame !== "function") {
      return;
    }

    resetGamepadStates();

    const loop = (timestamp) => {
      pollGamepadFrame(timestamp);
      gamepadAnimationFrame = requestAnimationFrame(loop);
    };

    gamepadAnimationFrame = requestAnimationFrame(loop);
  }

  function stopGamepadPolling() {
    if (gamepadAnimationFrame) {
      cancelAnimationFrame(gamepadAnimationFrame);
      gamepadAnimationFrame = null;
    }

    gamepadWasConnected = false;
    resetGamepadStates();
  }

  function initialize() {
    bindTouchControls();
    bindCanvasGestures();
    bindGlobalTouchScrollLock();
    bindKeyboard();
  }

  return {
    initialize,
    renderTouchControls,
    stopTouchHold,
    resetGamepadStates,
    startGamepadPolling,
    stopGamepadPolling,
    handleKeyDown,
    getControlHintForGame: (game) => getControlHintForGame(game),
  };
}
