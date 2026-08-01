import { apiFetch, getAuthToken } from "../apiClient.mjs";
import {
  safeStorageGetJson,
  safeStorageSetJson,
  STORAGE_KEYS,
} from "../storage.mjs";
import { TABLETOP_GAMES, getTabletopGame } from "./games.mjs";

const MAX_PLAYERS = 48;

export function normalizePlayerName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

export function nameKey(name) {
  return normalizePlayerName(name).toLowerCase();
}

export function createPlayerId() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyFriendsStore() {
  return {
    players: [],
    lastGroupIds: [],
    joinCode: null,
    ownerId: null,
    localStats: {},
  };
}

export function loadFriendsStore() {
  const stored = safeStorageGetJson(STORAGE_KEYS.TABLETOP_FRIENDS, null);
  if (!stored || typeof stored !== "object") {
    return emptyFriendsStore();
  }
  return {
    players: Array.isArray(stored.players) ? stored.players : [],
    lastGroupIds: Array.isArray(stored.lastGroupIds) ? stored.lastGroupIds : [],
    joinCode: stored.joinCode || null,
    ownerId: stored.ownerId || null,
    localStats:
      stored.localStats && typeof stored.localStats === "object"
        ? stored.localStats
        : {},
  };
}

export function saveFriendsStore(store) {
  return safeStorageSetJson(STORAGE_KEYS.TABLETOP_FRIENDS, store);
}

/**
 * Upsert names into the roster (case-insensitive merge).
 * @param {Array<{id:string,name:string}>} players
 * @param {string[]} names
 * @returns {{ players: Array, ids: string[] }}
 */
export function promotePlayers(players, names) {
  const next = [...(players || [])];
  const byKey = new Map(next.map((p) => [nameKey(p.name), p]));
  const ids = [];

  for (const raw of names || []) {
    const name = normalizePlayerName(raw);
    if (!name) {
      ids.push(null);
      continue;
    }
    const key = nameKey(name);
    let player = byKey.get(key);
    if (!player) {
      if (next.length >= MAX_PLAYERS) {
        ids.push(null);
        continue;
      }
      player = {
        id: createPlayerId(),
        name,
        joinedAt: new Date().toISOString(),
      };
      next.push(player);
      byKey.set(key, player);
    } else if (player.name !== name) {
      player.name = name;
    }
    ids.push(player.id);
  }

  return { players: next, ids };
}

/**
 * Link session players to permanent profiles by id or name.
 * @returns {Array<{ profileId: string|null, name: string, total: number, won: boolean }>}
 */
export function linkSessionPlayers(session, game, rosterPlayers) {
  if (!session?.players?.length) {
    return [];
  }
  const lowerIsBetter = Boolean(game?.lowerIsBetter);
  const sorted = [...session.players].sort((a, b) =>
    lowerIsBetter ? a.total - b.total : b.total - a.total,
  );
  const bestTotal = sorted[0]?.total;
  const byId = new Map((rosterPlayers || []).map((p) => [p.id, p]));
  const byName = new Map((rosterPlayers || []).map((p) => [nameKey(p.name), p]));

  return session.players.map((player) => {
    const linked =
      (player.profileId && byId.get(player.profileId)) ||
      byName.get(nameKey(player.name)) ||
      null;
    const won =
      Number.isFinite(bestTotal) &&
      player.total === bestTotal &&
      session.players.filter((p) => p.total === bestTotal).length >= 1;
    return {
      profileId: linked?.id || player.profileId || null,
      name: linked?.name || player.name,
      total: Number(player.total) || 0,
      won,
    };
  });
}

/**
 * Apply one finished session into a localStats map.
 * @returns {Record<string, Record<string, {wins:number,games:number,pointsSum:number,lastPlayedAt:string}>>}
 */
export function applySessionToStats(localStats, session, game) {
  const next = structuredClone(localStats || {});
  const gameId = session.gameId;
  const now = new Date().toISOString();
  const totals = session.players.map((p) => Number(p.total) || 0);
  if (!totals.length) {
    return next;
  }
  const lowerIsBetter = Boolean(game?.lowerIsBetter);
  const best = lowerIsBetter ? Math.min(...totals) : Math.max(...totals);

  for (const player of session.players) {
    const profileId = player.profileId;
    if (!profileId) {
      continue;
    }
    if (!next[profileId]) {
      next[profileId] = {};
    }
    if (!next[profileId][gameId]) {
      next[profileId][gameId] = {
        wins: 0,
        games: 0,
        pointsSum: 0,
        lastPlayedAt: now,
      };
    }
    const entry = next[profileId][gameId];
    entry.games += 1;
    entry.pointsSum += Number(player.total) || 0;
    entry.lastPlayedAt = now;
    if ((Number(player.total) || 0) === best) {
      entry.wins += 1;
    }
  }

  return next;
}

/**
 * Build ranking rows for overall or one game.
 * @returns {Array<{playerId:string,name:string,wins:number,games:number,pointsSum:number,avgPoints:number}>}
 */
export function buildRankings(players, localStats, gameId = null, options = {}) {
  const lowerIsBetterIds = new Set(
    options.lowerIsBetterIds ||
      TABLETOP_GAMES.filter((g) => g.lowerIsBetter).map((g) => g.id),
  );
  const rows = [];

  for (const player of players || []) {
    const perGame = localStats?.[player.id] || {};
    let wins = 0;
    let games = 0;
    let pointsSum = 0;
    const gameIds = gameId ? [gameId] : Object.keys(perGame);
    for (const id of gameIds) {
      const entry = perGame[id];
      if (!entry) {
        continue;
      }
      wins += entry.wins || 0;
      games += entry.games || 0;
      pointsSum += entry.pointsSum || 0;
    }
    if (games === 0 && gameId) {
      continue;
    }
    rows.push({
      playerId: player.id,
      name: player.name,
      wins,
      games,
      pointsSum,
      avgPoints: games > 0 ? pointsSum / games : 0,
    });
  }

  const lowerIsBetter = gameId ? lowerIsBetterIds.has(gameId) : false;
  rows.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (lowerIsBetter) {
      if (a.avgPoints !== b.avgPoints) {
        return a.avgPoints - b.avgPoints;
      }
    } else if (a.avgPoints !== b.avgPoints) {
      return b.avgPoints - a.avgPoints;
    }
    return b.games - a.games;
  });

  return rows;
}

export function findPlayerById(players, id) {
  return (players || []).find((p) => p.id === id) || null;
}

export async function fetchCircle() {
  if (!getAuthToken()) {
    return null;
  }
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({ action: "getCircle" }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load friends.");
  }
  return payload;
}

export async function apiPromotePlayers(names) {
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({ action: "promotePlayers", names }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not save players.");
  }
  return payload;
}

export async function apiJoinByCode({ joinCode, name }) {
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({ action: "joinByCode", joinCode, name }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not join.");
  }
  return payload;
}

export async function apiRemovePlayer(playerId) {
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({ action: "removePlayer", playerId }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not remove player.");
  }
  return payload;
}

export async function apiSubmitSession(session) {
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({
      action: "submitSession",
      gameId: session.gameId,
      players: session.players.map((p) => ({
        profileId: p.profileId || null,
        name: p.name,
        total: p.total,
      })),
      finishedAt: session.finishedAt || new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not submit session.");
  }
  return payload;
}

export async function apiGetRankings({ gameId = null, joinCode = null } = {}) {
  const { response, payload } = await apiFetch("/api/tabletop", {
    method: "POST",
    body: JSON.stringify({ action: "getRankings", gameId, joinCode }),
  });
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load rankings.");
  }
  return payload;
}

export function mergeRemoteCircle(local, remote) {
  if (!remote) {
    return local;
  }
  const promoted = promotePlayers(
    remote.players || [],
    (local.players || []).map((p) => p.name),
  );
  // Prefer remote ids when names match; keep any local-only after merge via promote on remote base
  const remoteByKey = new Map(
    (remote.players || []).map((p) => [nameKey(p.name), p]),
  );
  const mergedPlayers = [...(remote.players || [])];
  for (const localPlayer of local.players || []) {
    if (!remoteByKey.has(nameKey(localPlayer.name))) {
      mergedPlayers.push(localPlayer);
    }
  }
  return {
    ...local,
    players: mergedPlayers.length ? mergedPlayers : promoted.players,
    joinCode: remote.joinCode || local.joinCode,
    ownerId: remote.ownerId || local.ownerId,
    localStats: remote.stats || local.localStats || {},
  };
}

export function tabletopGameIds() {
  return TABLETOP_GAMES.map((g) => g.id);
}

export function isTabletopGameId(gameId) {
  return Boolean(getTabletopGame(gameId));
}
