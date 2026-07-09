const { redisCommand, withRedis } = require("./_redis");
const { resolveUser } = require("./auth");
const {
  CLASSIC_GAME_IDS,
  GAME_LABELS,
  keys,
  sanitizeGameId,
  jsonResponse,
  displayMetric,
  setCors,
} = require("./_lib");

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    jsonResponse(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const overall = String(req.query?.overall || "") === "1";
    const gameId = overall ? null : sanitizeGameId(req.query?.gameId);
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 20));
    const currentUser = await resolveUser(req);

    if (!overall && !gameId) {
      jsonResponse(res, 400, { error: "Missing gameId." });
      return;
    }

    await withRedis(async (redisUrl, redisToken) => {
      if (overall) {
        const rows = await buildOverallLeaderboard(redisUrl, redisToken, limit);
        jsonResponse(res, 200, {
          mode: "overall",
          rows: markCurrentUser(rows, currentUser?.id),
        });
        return;
      }

      const rows = await buildGameLeaderboard(redisUrl, redisToken, gameId, limit);
      jsonResponse(res, 200, {
        mode: "game",
        gameId,
        gameLabel: GAME_LABELS[gameId] || gameId,
        rows: markCurrentUser(rows, currentUser?.id),
      });
    });
  } catch (error) {
    jsonResponse(res, error.statusCode || 500, {
      error: error?.message || "Unexpected error.",
    });
  }
};

async function buildGameLeaderboard(redisUrl, redisToken, gameId, limit) {
  const entries = await redisCommand(redisUrl, redisToken, [
    "ZREVRANGE",
    keys().board(gameId),
    0,
    limit - 1,
    "WITHSCORES",
  ]);

  const rows = [];
  for (let index = 0; index < entries.length; index += 2) {
    const userId = entries[index];
    const bestRaw = await redisCommand(redisUrl, redisToken, [
      "GET",
      keys().best(userId, gameId),
    ]);
    const displayName = await loadDisplayName(redisUrl, redisToken, userId);
    rows.push({
      rank: rows.length + 1,
      userId,
      displayName,
      metric: Number(bestRaw),
      metricLabel: displayMetric(gameId, Number(bestRaw)),
      gameId,
    });
  }

  return rows;
}

async function buildOverallLeaderboard(redisUrl, redisToken, limit) {
  const userIds = await redisCommand(redisUrl, redisToken, ["SMEMBERS", keys().usersIndex]);
  const totals = [];

  for (const userId of userIds || []) {
    let points = 0;
    let gamesPlayed = 0;

    for (const gameId of CLASSIC_GAME_IDS) {
      const bestRaw = await redisCommand(redisUrl, redisToken, [
        "GET",
        keys().best(userId, gameId),
      ]);
      if (!bestRaw) {
        continue;
      }

      gamesPlayed += 1;
      points += Number(bestRaw);
    }

    if (gamesPlayed === 0) {
      continue;
    }

    totals.push({
      userId,
      points,
      gamesPlayed,
      displayName: await loadDisplayName(redisUrl, redisToken, userId),
    });
  }

  totals.sort((a, b) => b.points - a.points || b.gamesPlayed - a.gamesPlayed);

  return totals.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    displayName: row.displayName,
    points: row.points,
    gamesPlayed: row.gamesPlayed,
  }));
}

async function loadDisplayName(redisUrl, redisToken, userId) {
  const username = await redisCommand(redisUrl, redisToken, ["GET", keys().userId(userId)]);
  if (!username) {
    return `Player ${userId}`;
  }

  const raw = await redisCommand(redisUrl, redisToken, ["GET", keys().user(username)]);
  if (!raw) {
    return username;
  }

  try {
    return JSON.parse(raw).displayName || username;
  } catch {
    return username;
  }
}

function markCurrentUser(rows, userId) {
  if (!userId) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    isCurrentUser: row.userId === userId,
  }));
}
