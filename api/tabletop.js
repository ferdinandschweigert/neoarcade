const crypto = require("crypto");
const { redisCommand, withRedis } = require("./_redis");
const { resolveUser } = require("./auth");
const {
  keys,
  sanitizeDisplayName,
  sanitizeTabletopGameId,
  sanitizeJoinCode,
  createJoinCode,
  parseBody,
  jsonResponse,
  setCors,
  TABLETOP_GAME_IDS,
  TABLETOP_LOWER_IS_BETTER,
} = require("./_lib");

const MAX_PLAYERS = 48;

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    jsonResponse(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = parseBody(req.body) || {};
    const action = String(body.action || "").toLowerCase();

    if (action === "getcircle") {
      await handleGetCircle(req, res);
      return;
    }
    if (action === "promoteplayers") {
      await handlePromotePlayers(req, res, body);
      return;
    }
    if (action === "joinbycode") {
      await handleJoinByCode(req, res, body);
      return;
    }
    if (action === "removeplayer") {
      await handleRemovePlayer(req, res, body);
      return;
    }
    if (action === "renameplayer") {
      await handleRenamePlayer(req, res, body);
      return;
    }
    if (action === "submitsession") {
      await handleSubmitSession(req, res, body);
      return;
    }
    if (action === "getrankings") {
      await handleGetRankings(req, res, body);
      return;
    }

    jsonResponse(res, 400, { error: "Unknown action." });
  } catch (error) {
    jsonResponse(res, error.statusCode || 500, {
      error: error?.message || "Unexpected error.",
    });
  }
};

async function handleGetCircle(req, res) {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await ensureCircle(redisUrl, redisToken, user);
    const stats = await loadAllStats(redisUrl, redisToken, user.id, circle.players);
    jsonResponse(res, 200, {
      ownerId: user.id,
      joinCode: circle.joinCode,
      players: circle.players,
      stats,
    });
  });
}

async function handlePromotePlayers(req, res, body) {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const names = Array.isArray(body.names) ? body.names : [];
  if (!names.length) {
    jsonResponse(res, 400, { error: "No names to save." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await ensureCircle(redisUrl, redisToken, user);
    const { players, ids } = promoteIntoCircle(circle.players, names);
    circle.players = players;
    await saveCircle(redisUrl, redisToken, user.id, circle);
    jsonResponse(res, 200, {
      ownerId: user.id,
      joinCode: circle.joinCode,
      players: circle.players,
      ids,
    });
  });
}

async function handleJoinByCode(req, res, body) {
  const code = sanitizeJoinCode(body.joinCode);
  const name = sanitizeDisplayName(body.name, "");
  if (!code || code.length < 6) {
    jsonResponse(res, 400, { error: "Invalid join code." });
    return;
  }
  if (!name) {
    jsonResponse(res, 400, { error: "Name required." });
    return;
  }

  const user = await resolveUser(req);

  await withRedis(async (redisUrl, redisToken) => {
    const ownerId = await redisCommand(redisUrl, redisToken, [
      "GET",
      keys().circleCode(code),
    ]);
    if (!ownerId) {
      jsonResponse(res, 404, { error: "Join code not found." });
      return;
    }

    const circle = await loadCircle(redisUrl, redisToken, ownerId);
    if (!circle) {
      jsonResponse(res, 404, { error: "Circle not found." });
      return;
    }

    const { players, ids } = promoteIntoCircle(circle.players, [name]);
    const playerId = ids[0];
    if (!playerId) {
      jsonResponse(res, 400, { error: "Circle is full." });
      return;
    }

    const player = players.find((p) => p.id === playerId);
    if (user?.id && player) {
      player.linkedUserId = user.id;
    }
    circle.players = players;
    await saveCircle(redisUrl, redisToken, ownerId, circle);

    jsonResponse(res, 200, {
      ownerId,
      joinCode: circle.joinCode,
      players: circle.players,
      playerId,
    });
  });
}

async function handleRemovePlayer(req, res, body) {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }
  const playerId = String(body.playerId || "").trim();
  if (!playerId) {
    jsonResponse(res, 400, { error: "Missing player." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await ensureCircle(redisUrl, redisToken, user);
    circle.players = (circle.players || []).filter((p) => p.id !== playerId);
    await saveCircle(redisUrl, redisToken, user.id, circle);
    jsonResponse(res, 200, {
      ownerId: user.id,
      joinCode: circle.joinCode,
      players: circle.players,
    });
  });
}

async function handleRenamePlayer(req, res, body) {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }
  const playerId = String(body.playerId || "").trim();
  const name = sanitizeDisplayName(body.name, "");
  if (!playerId || !name) {
    jsonResponse(res, 400, { error: "Player and name required." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await ensureCircle(redisUrl, redisToken, user);
    const player = (circle.players || []).find((p) => p.id === playerId);
    if (!player) {
      jsonResponse(res, 404, { error: "Player not found." });
      return;
    }
    player.name = name;
    await saveCircle(redisUrl, redisToken, user.id, circle);
    jsonResponse(res, 200, {
      ownerId: user.id,
      joinCode: circle.joinCode,
      players: circle.players,
    });
  });
}

async function handleSubmitSession(req, res, body) {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const gameId = sanitizeTabletopGameId(body.gameId);
  if (!gameId) {
    jsonResponse(res, 400, { error: "Invalid tabletop game." });
    return;
  }

  const players = Array.isArray(body.players) ? body.players : [];
  if (!players.length) {
    jsonResponse(res, 400, { error: "No players." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await ensureCircle(redisUrl, redisToken, user);
    const byId = new Map(circle.players.map((p) => [p.id, p]));
    const byName = new Map(
      circle.players.map((p) => [String(p.name).toLowerCase(), p]),
    );

    const resolved = [];
    for (const entry of players) {
      const name = sanitizeDisplayName(entry.name, "");
      let profile =
        (entry.profileId && byId.get(entry.profileId)) ||
        (name && byName.get(name.toLowerCase())) ||
        null;
      if (!profile && name) {
        const promoted = promoteIntoCircle(circle.players, [name]);
        circle.players = promoted.players;
        profile = circle.players.find((p) => p.id === promoted.ids[0]) || null;
        if (profile) {
          byId.set(profile.id, profile);
          byName.set(profile.name.toLowerCase(), profile);
        }
      }
      if (!profile) {
        continue;
      }
      resolved.push({
        profileId: profile.id,
        total: Number(entry.total) || 0,
      });
    }

    if (!resolved.length) {
      jsonResponse(res, 400, { error: "No linked players." });
      return;
    }

    await saveCircle(redisUrl, redisToken, user.id, circle);

    const lowerIsBetter = TABLETOP_LOWER_IS_BETTER.has(gameId);
    const totals = resolved.map((p) => p.total);
    const best = lowerIsBetter ? Math.min(...totals) : Math.max(...totals);
    const now = new Date().toISOString();

    for (const entry of resolved) {
      const statsKey = keys().ttStats(user.id, entry.profileId, gameId);
      const raw = await redisCommand(redisUrl, redisToken, ["GET", statsKey]);
      let stats = { wins: 0, games: 0, pointsSum: 0, lastPlayedAt: now };
      if (raw) {
        try {
          stats = { ...stats, ...JSON.parse(raw) };
        } catch {
          // keep defaults
        }
      }
      stats.games += 1;
      stats.pointsSum += entry.total;
      stats.lastPlayedAt = now;
      if (entry.total === best) {
        stats.wins += 1;
      }
      await redisCommand(redisUrl, redisToken, [
        "SET",
        statsKey,
        JSON.stringify(stats),
      ]);

      const boardScore = rankingScore(gameId, stats);
      await redisCommand(redisUrl, redisToken, [
        "ZADD",
        keys().ttBoard(user.id, gameId),
        boardScore,
        entry.profileId,
      ]);
    }

    const allStats = await loadAllStats(
      redisUrl,
      redisToken,
      user.id,
      circle.players,
    );
    jsonResponse(res, 200, {
      ok: true,
      players: circle.players,
      stats: allStats,
    });
  });
}

async function handleGetRankings(req, res, body) {
  const gameId = body.gameId ? sanitizeTabletopGameId(body.gameId) : null;
  if (body.gameId && !gameId) {
    jsonResponse(res, 400, { error: "Invalid tabletop game." });
    return;
  }

  let ownerId = null;
  const user = await resolveUser(req);
  if (user) {
    ownerId = user.id;
  } else {
    const code = sanitizeJoinCode(body.joinCode);
    if (!code) {
      jsonResponse(res, 401, { error: "Sign in or provide a join code." });
      return;
    }
    ownerId = await withRedis(async (redisUrl, redisToken) =>
      redisCommand(redisUrl, redisToken, ["GET", keys().circleCode(code)]),
    );
    if (!ownerId) {
      jsonResponse(res, 404, { error: "Join code not found." });
      return;
    }
  }

  await withRedis(async (redisUrl, redisToken) => {
    const circle = await loadCircle(redisUrl, redisToken, ownerId);
    if (!circle) {
      jsonResponse(res, 404, { error: "Circle not found." });
      return;
    }
    const stats = await loadAllStats(redisUrl, redisToken, ownerId, circle.players);
    const rankings = buildRankings(circle.players, stats, gameId);
    jsonResponse(res, 200, {
      ownerId,
      joinCode: circle.joinCode,
      gameId: gameId || null,
      players: circle.players,
      rankings,
      stats,
    });
  });
}

async function requireUser(req, res) {
  const user = await resolveUser(req);
  if (!user) {
    jsonResponse(res, 401, { error: "Not signed in." });
    return null;
  }
  return user;
}

async function ensureCircle(redisUrl, redisToken, user) {
  let circle = await loadCircle(redisUrl, redisToken, user.id);
  if (circle) {
    return circle;
  }

  let joinCode = createJoinCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await redisCommand(redisUrl, redisToken, [
      "GET",
      keys().circleCode(joinCode),
    ]);
    if (!existing) {
      break;
    }
    joinCode = createJoinCode();
  }

  circle = {
    ownerId: user.id,
    joinCode,
    players: [],
    createdAt: new Date().toISOString(),
  };
  await saveCircle(redisUrl, redisToken, user.id, circle);
  return circle;
}

async function loadCircle(redisUrl, redisToken, ownerId) {
  const raw = await redisCommand(redisUrl, redisToken, [
    "GET",
    keys().circle(ownerId),
  ]);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCircle(redisUrl, redisToken, ownerId, circle) {
  await redisCommand(redisUrl, redisToken, [
    "SET",
    keys().circle(ownerId),
    JSON.stringify(circle),
  ]);
  if (circle.joinCode) {
    await redisCommand(redisUrl, redisToken, [
      "SET",
      keys().circleCode(sanitizeJoinCode(circle.joinCode)),
      ownerId,
    ]);
  }
}

function promoteIntoCircle(players, names) {
  const next = [...(players || [])];
  const byKey = new Map(
    next.map((p) => [String(p.name || "").trim().toLowerCase(), p]),
  );
  const ids = [];

  for (const raw of names || []) {
    const name = sanitizeDisplayName(raw, "");
    if (!name) {
      ids.push(null);
      continue;
    }
    const key = name.toLowerCase();
    let player = byKey.get(key);
    if (!player) {
      if (next.length >= MAX_PLAYERS) {
        ids.push(null);
        continue;
      }
      player = {
        id: `fp-${crypto.randomBytes(6).toString("hex")}`,
        name,
        joinedAt: new Date().toISOString(),
      };
      next.push(player);
      byKey.set(key, player);
    } else {
      player.name = name;
    }
    ids.push(player.id);
  }

  return { players: next, ids };
}

async function loadAllStats(redisUrl, redisToken, ownerId, players) {
  /** @type {Record<string, Record<string, object>>} */
  const stats = {};
  for (const player of players || []) {
    stats[player.id] = {};
    for (const gameId of TABLETOP_GAME_IDS) {
      const raw = await redisCommand(redisUrl, redisToken, [
        "GET",
        keys().ttStats(ownerId, player.id, gameId),
      ]);
      if (!raw) {
        continue;
      }
      try {
        stats[player.id][gameId] = JSON.parse(raw);
      } catch {
        // skip bad entries
      }
    }
  }
  return stats;
}

function rankingScore(gameId, stats) {
  const wins = Number(stats.wins) || 0;
  const games = Number(stats.games) || 0;
  const avg = games > 0 ? (Number(stats.pointsSum) || 0) / games : 0;
  // Primary: wins. Secondary: prefer higher avg (or lower for skyjo/phase10).
  const pointComponent = TABLETOP_LOWER_IS_BETTER.has(gameId)
    ? Math.max(0, 100000 - Math.round(avg * 100))
    : Math.round(avg * 100);
  return wins * 1_000_000 + pointComponent;
}

function buildRankings(players, stats, gameId) {
  const rows = [];
  for (const player of players || []) {
    const perGame = stats?.[player.id] || {};
    let wins = 0;
    let games = 0;
    let pointsSum = 0;
    const ids = gameId ? [gameId] : Object.keys(perGame);
    for (const id of ids) {
      const entry = perGame[id];
      if (!entry) {
        continue;
      }
      wins += entry.wins || 0;
      games += entry.games || 0;
      pointsSum += entry.pointsSum || 0;
    }
    if (gameId && games === 0) {
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

  const lowerIsBetter = gameId ? TABLETOP_LOWER_IS_BETTER.has(gameId) : false;
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

module.exports._test = {
  promoteIntoCircle,
  buildRankings,
  rankingScore,
  sanitizeJoinCode: sanitizeJoinCode,
};
