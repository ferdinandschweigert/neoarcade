import { safeStorageGetJson, safeStorageRemove, safeStorageSetJson, STORAGE_KEYS } from "./storage.mjs";

export const CLOUD_SYNC_DEBOUNCE_MS = 1200;
export const CLOUD_CONNECT_DEBOUNCE_MS = 650;
export const CLOUD_PULL_INTERVAL_MS = 30000;

export function sanitizeCloudCode(rawCode) {
  return String(rawCode || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchWithRetry(url, options = {}, config = {}) {
  const maxAttempts = config.maxAttempts ?? 3;
  const baseDelayMs = config.baseDelayMs ?? 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 404) {
        return response;
      }

      if (response.status >= 500 && attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("fetch_retry_exhausted");
}

export function describeCloudError(error) {
  const code = String(error?.message || "");
  if (code.includes("404")) {
    return "Cloud API not found (deploy latest build).";
  }
  if (code.includes("401") || code.includes("403")) {
    return "Cloud auth failed (check Vercel env vars).";
  }
  if (code.includes("500") || code.includes("503")) {
    return "Cloud unavailable right now.";
  }
  return "Cloud sync failed. Working locally.";
}

export function sanitizeProfilesArray(maybeProfiles, profileColors, maxProfiles) {
  if (!Array.isArray(maybeProfiles)) {
    return [];
  }

  const sanitized = [];
  const seen = new Set();

  for (let index = 0; index < maybeProfiles.length; index += 1) {
    const item = maybeProfiles[index];
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = String(item.id || "").trim();
    const name = sanitizeProfileName(item.name || "");
    const color = String(item.color || profileColors[index % profileColors.length]).trim();

    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    sanitized.push({ id, name, color });

    if (sanitized.length >= maxProfiles) {
      break;
    }
  }

  return sanitized;
}

export function sanitizeProfileName(rawName) {
  return String(rawName).trim().replace(/\s+/g, " ").slice(0, 18);
}

export function sanitizeScoreMap(maybeMap) {
  if (!maybeMap || typeof maybeMap !== "object") {
    return {};
  }

  const sanitized = {};
  for (const [gameId, metric] of Object.entries(maybeMap)) {
    if (Number.isFinite(metric)) {
      sanitized[gameId] = metric;
    }
  }
  return sanitized;
}

export function sanitizeScoreStoreByProfile(maybeStore) {
  if (!maybeStore || typeof maybeStore !== "object") {
    return {};
  }

  const sanitized = {};
  for (const [profileId, maybeMap] of Object.entries(maybeStore)) {
    const cleanProfileId = String(profileId || "").trim();
    if (!cleanProfileId) {
      continue;
    }

    sanitized[cleanProfileId] = sanitizeScoreMap(maybeMap);
  }

  return sanitized;
}

export function pickBetterMetric(gameId, a, b, lowerIsBetterGames) {
  if (!Number.isFinite(a)) {
    return b;
  }
  if (!Number.isFinite(b)) {
    return a;
  }
  if (lowerIsBetterGames.has(gameId)) {
    return Math.min(a, b);
  }
  return Math.max(a, b);
}

export function mergeProfiles(primaryProfiles, secondaryProfiles, maxProfiles) {
  const merged = [];
  const seenIds = new Set();
  const seenNames = new Set();

  for (const source of [primaryProfiles, secondaryProfiles]) {
    for (const profile of source) {
      const id = String(profile.id || "").trim();
      const name = sanitizeProfileName(profile.name || "");
      const nameKey = name.toLowerCase();

      if (!id || !name) {
        continue;
      }

      if (seenIds.has(id) || seenNames.has(nameKey)) {
        continue;
      }

      seenIds.add(id);
      seenNames.add(nameKey);
      merged.push({
        id,
        name,
        color: profile.color || profileColorsFallback(merged.length),
      });

      if (merged.length >= maxProfiles) {
        return merged;
      }
    }
  }

  return merged;
}

function profileColorsFallback(index) {
  const colors = [
    "#2563eb",
    "#ef6351",
    "#2cb89a",
    "#f5a623",
    "#7c5cff",
    "#ff8a3d",
    "#111827",
    "#14b8a6",
  ];
  return colors[index % colors.length];
}

export function mergeScoreStoreByProfile(primaryStore, secondaryStore, lowerIsBetterGames) {
  const result = {};
  const profileIds = new Set([
    ...Object.keys(primaryStore || {}),
    ...Object.keys(secondaryStore || {}),
  ]);

  for (const profileId of profileIds) {
    const primaryScores = sanitizeScoreMap(primaryStore?.[profileId]);
    const secondaryScores = sanitizeScoreMap(secondaryStore?.[profileId]);
    const mergedScores = {};

    const gameIds = new Set([
      ...Object.keys(primaryScores),
      ...Object.keys(secondaryScores),
    ]);

    for (const gameId of gameIds) {
      const mergedMetric = pickBetterMetric(
        gameId,
        primaryScores[gameId],
        secondaryScores[gameId],
        lowerIsBetterGames,
      );

      if (Number.isFinite(mergedMetric)) {
        mergedScores[gameId] = mergedMetric;
      }
    }

    if (Object.keys(mergedScores).length > 0) {
      result[profileId] = mergedScores;
    }
  }

  return result;
}

function parseUpdatedAt(snapshot) {
  const raw = snapshot?.updatedAt;
  if (!raw) {
    return 0;
  }

  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeCloudSnapshots(localSnapshot, remoteSnapshot, options) {
  const {
    difficultyOptions,
    profileColors,
    maxProfiles,
    lowerIsBetterGames,
  } = options;

  const localTime = parseUpdatedAt(localSnapshot);
  const remoteTime = parseUpdatedAt(remoteSnapshot);
  const remoteIsNewer = remoteTime > localTime;

  const localProfiles = sanitizeProfilesArray(
    localSnapshot?.profiles,
    profileColors,
    maxProfiles,
  );
  const remoteProfiles = sanitizeProfilesArray(
    remoteSnapshot?.profiles,
    profileColors,
    maxProfiles,
  );

  const mergedProfiles = mergeProfiles(
    remoteIsNewer ? remoteProfiles : localProfiles,
    remoteIsNewer ? localProfiles : remoteProfiles,
    maxProfiles,
  );

  const localScores = sanitizeScoreStoreByProfile(localSnapshot?.scoreStoreByProfile);
  const remoteScores = sanitizeScoreStoreByProfile(remoteSnapshot?.scoreStoreByProfile);
  const mergedScoreStore = mergeScoreStoreByProfile(
    remoteScores,
    localScores,
    lowerIsBetterGames,
  );

  const activeProfileId = remoteIsNewer
    ? String(remoteSnapshot?.activeProfileId || localSnapshot?.activeProfileId || "").trim()
    : String(localSnapshot?.activeProfileId || remoteSnapshot?.activeProfileId || "").trim();

  const remoteDifficulty = String(remoteSnapshot?.activeDifficulty || "").toLowerCase();
  const localDifficulty = String(localSnapshot?.activeDifficulty || "").toLowerCase();
  const difficultyCandidate = remoteIsNewer ? remoteDifficulty : localDifficulty;
  const activeDifficulty = difficultyOptions.has(difficultyCandidate)
    ? difficultyCandidate
    : difficultyOptions.has(localDifficulty)
      ? localDifficulty
      : difficultyOptions.has(remoteDifficulty)
        ? remoteDifficulty
        : null;

  return {
    version: 1,
    profiles: mergedProfiles,
    scoreStoreByProfile: mergedScoreStore,
    activeProfileId,
    activeDifficulty,
    updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
  };
}

export function sanitizeCloudSnapshot(snapshot, difficultyOptions, profileColors, maxProfiles) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const profilesFromCloud = sanitizeProfilesArray(snapshot.profiles, profileColors, maxProfiles);
  const scoreStoreByProfileFromCloud = sanitizeScoreStoreByProfile(snapshot.scoreStoreByProfile);

  if (profilesFromCloud.length === 0) {
    return null;
  }

  const activeProfileFromCloud =
    typeof snapshot.activeProfileId === "string"
      ? String(snapshot.activeProfileId).trim()
      : "";

  const difficultyFromCloud = String(snapshot.activeDifficulty || "").toLowerCase();

  return {
    profiles: profilesFromCloud,
    scoreStoreByProfile: scoreStoreByProfileFromCloud,
    activeProfileId: activeProfileFromCloud,
    activeDifficulty: difficultyOptions.has(difficultyFromCloud)
      ? difficultyFromCloud
      : null,
    updatedAt: snapshot.updatedAt || null,
  };
}

export async function fetchCloudSnapshot(code) {
  const response = await fetchWithRetry(`/api/cloud?code=${encodeURIComponent(code)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`cloud_read_${response.status}`);
  }

  const payload = await response.json();
  return payload && typeof payload === "object" ? payload.snapshot || null : null;
}

export async function putCloudSnapshot(code, snapshot) {
  const response = await fetchWithRetry("/api/cloud", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      snapshot,
    }),
  });

  if (!response.ok) {
    throw new Error(`cloud_write_${response.status}`);
  }
}

export function loadPendingCloudSnapshot() {
  return safeStorageGetJson(STORAGE_KEYS.CLOUD_PENDING, null);
}

export function savePendingCloudSnapshot(snapshot) {
  safeStorageSetJson(STORAGE_KEYS.CLOUD_PENDING, {
    snapshot,
    savedAt: new Date().toISOString(),
  });
}

export function clearPendingCloudSnapshot() {
  safeStorageRemove(STORAGE_KEYS.CLOUD_PENDING);
}
