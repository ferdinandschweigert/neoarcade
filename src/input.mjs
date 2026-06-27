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
  dpad: [["UP"], ["LEFT", "DOWN", "RIGHT"]],
  horizontal: [["LEFT", "RIGHT"]],
  vertical: [["UP", "DOWN"]],
  hfire: [["UP"], ["LEFT", "RIGHT"]],
  grid_select: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT"]],
  grid_select_flag: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT", "FLAG"]],
  horizontal_select: [["LEFT", "RIGHT"], ["SELECT"]],
  select_only: [["SELECT"]],
};

export const ACTION_ARIA_LABELS = {
  UP: "Move up",
  DOWN: "Move down",
  LEFT: "Move left",
  RIGHT: "Move right",
  SELECT: "Select",
  FLAG: "Flag",
};

export const DEFAULT_CONTROL_HINTS = {
  dpad: "Swipe or use the D-pad to move.",
  horizontal: "Swipe left/right or use on-screen buttons.",
  vertical: "Swipe up/down or use on-screen buttons.",
  hfire: "Move with left/right. Fire or jump with up.",
  grid_select: "Tap a cell or use D-pad + Select.",
  grid_select_flag: "Tap to reveal. Long-press or Flag to mark.",
  horizontal_select: "Move left/right, then Select to confirm.",
  select_only: "Tap or press Action to play.",
  none: "Use swipe gestures on the game board.",
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
  if (scheme.length === 0) {
    return false;
  }

  if (controlMode === "buttons" || controlMode === "both") {
    return true;
  }

  if (controlMode === "gestures") {
    return false;
  }

  return isTouchDevice;
}

export function shouldUseGestures(controlMode, isTouchDevice) {
  if (controlMode === "gestures" || controlMode === "both") {
    return true;
  }

  if (controlMode === "buttons") {
    return false;
  }

  return isTouchDevice;
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

  function renderTouchControls(schemeName) {
    if (!touchControlsEl) {
      return;
    }

    const controlMode = getControlMode();
    const showButtons = shouldShowTouchButtons(controlMode, isTouchDevice, schemeName);
    const scheme = showButtons
      ? CONTROL_SCHEMES[schemeName] ?? CONTROL_SCHEMES.none
      : CONTROL_SCHEMES.none;

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
        buttonEl.setAttribute("aria-label", ACTION_ARIA_LABELS[action] || action.toLowerCase());
        buttonEl.textContent = ACTION_LABELS[action] || action;
        rowEl.appendChild(buttonEl);
      }

      touchControlsEl.appendChild(rowEl);
    }
  }

  function stopTouchHold() {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    touchHoldAction = null;
  }

  function startTouchHold(action) {
    stopTouchHold();
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

    touchControlsEl.addEventListener("pointerdown", (event) => {
      if (!getActiveGame() || event.pointerType === "mouse") {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.dataset.action;
      if (!action) {
        return;
      }

      event.preventDefault();
      startTouchHold(action);
    }, { passive: false });

    touchControlsEl.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "mouse") {
        event.preventDefault();
      }
      stopTouchHold();
    }, { passive: false });

    touchControlsEl.addEventListener("pointercancel", () => {
      stopTouchHold();
    });

    touchControlsEl.addEventListener("pointerleave", () => {
      stopTouchHold();
    });

    touchControlsEl.addEventListener("click", (event) => {
      if (!getActiveGame()) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.dataset.action;
      if (!action) {
        return;
      }

      triggerControl(action);
    });
  }

  function bindCanvasGestures() {
    if (!canvas) {
      return;
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

      if (absDx < swipeMin && absDy < swipeMin) {
        handleCanvasTap(touch.clientX, touch.clientY, elapsedMs >= longPressMs);
        swipeTouchStartTime = 0;
        return;
      }

      let action;
      if (absDx >= absDy) {
        action = dx > 0 ? "RIGHT" : "LEFT";
      } else {
        action = dy > 0 ? "DOWN" : "UP";
      }

      triggerControl(action);
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
      } else {
        holdState.pressed = false;
        holdState.nextRepeat = 0;
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
