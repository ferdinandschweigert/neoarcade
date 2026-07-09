const STORAGE_KEYS = {
  LEGACY_SCORE: "neoArcade.savedBest.v1",
  PROFILES: "neoArcade.profiles.v1",
  PROFILE_SCORES: "neoArcade.savedBestByProfile.v1",
  ACTIVE_PROFILE: "neoArcade.activeProfileId.v1",
  DIFFICULTY: "neoArcade.difficulty.v1",
  CLOUD_CODE: "neoArcade.cloudCode.v1",
  CLOUD_PENDING: "neoArcade.cloudPending.v1",
  RECENT_GAMES: "neoArcade.recentGames.v1",
  CONTROL_MODE: "neoArcade.controlMode.v1",
  CONTROLS_HINT: "neoArcade.controlsHintSeen.v1",
  SWIPE_SENSITIVITY: "neoArcade.swipeSensitivity.v1",
  LONG_PRESS: "neoArcade.longPress.v1",
  AUTH_TOKEN: "neoArcade.authToken.v1",
  GUEST_MODE: "neoArcade.guestMode.v1",
};

let onStorageError = null;

export function setStorageErrorHandler(handler) {
  onStorageError = typeof handler === "function" ? handler : null;
}

function reportStorageError(message) {
  if (onStorageError) {
    onStorageError(message);
  }
}

export function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    reportStorageError("Could not read saved data. Storage may be blocked or full.");
    return null;
  }
}

export function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    reportStorageError("Could not save data. Storage may be blocked or full.");
    return false;
  }
}

export function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    reportStorageError("Could not update saved data.");
    return false;
  }
}

export function safeStorageGetJson(key, fallback) {
  const raw = safeStorageGet(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeStorageSetJson(key, value) {
  return safeStorageSet(key, JSON.stringify(value));
}

export { STORAGE_KEYS };
