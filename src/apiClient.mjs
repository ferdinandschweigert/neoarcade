import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  STORAGE_KEYS,
} from "./storage.mjs";

const TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN;

let authToken = safeStorageGet(TOKEN_KEY) || "";
let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === "function" ? handler : null;
}

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = String(token || "");
  if (authToken) {
    safeStorageSet(TOKEN_KEY, authToken);
  } else {
    safeStorageRemove(TOKEN_KEY);
  }
}

export function clearAuthToken() {
  setAuthToken("");
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    clearAuthToken();
    if (onUnauthorized) {
      onUnauthorized();
    }
  }

  return { response, payload };
}

export async function registerUser({ username, password, displayName, inviteCode }) {
  const { response, payload } = await apiFetch("/api/auth", {
    method: "POST",
    body: JSON.stringify({
      action: "register",
      username,
      password,
      displayName,
      inviteCode,
    }),
  });

  if (!response.ok) {
    throw new Error(payload?.error || "Registration failed.");
  }

  setAuthToken(payload.token);
  return payload.user;
}

export async function loginUser({ username, password }) {
  const { response, payload } = await apiFetch("/api/auth", {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(payload?.error || "Sign in failed.");
  }

  setAuthToken(payload.token);
  return payload.user;
}

export async function logoutUser() {
  try {
    await apiFetch("/api/auth", {
      method: "POST",
      body: JSON.stringify({ action: "logout" }),
    });
  } catch {
    // ignore network errors on logout
  }

  clearAuthToken();
}

export async function fetchCurrentUser() {
  if (!authToken) {
    return null;
  }

  const { response, payload } = await apiFetch("/api/auth");
  if (!response.ok) {
    return null;
  }

  return payload?.user || null;
}

export async function submitScore(gameId, metric) {
  const { response, payload } = await apiFetch("/api/scores", {
    method: "POST",
    body: JSON.stringify({ gameId, metric }),
  });

  if (!response.ok) {
    throw new Error(payload?.error || "Could not save score.");
  }

  return payload;
}

export async function fetchLeaderboard({ gameId, overall = false, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (overall) {
    params.set("overall", "1");
  } else if (gameId) {
    params.set("gameId", gameId);
  }
  params.set("limit", String(limit));

  const { response, payload } = await apiFetch(`/api/leaderboard?${params}`);
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load leaderboard.");
  }

  return payload;
}

export async function fetchMyStats() {
  const { response, payload } = await apiFetch("/api/stats");
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load stats.");
  }

  return payload;
}
