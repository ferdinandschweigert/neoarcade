const { redisCommand, withRedis } = require("./_redis");
const { resolveUser } = require("./auth");
const {
  keys,
  sanitizeGameId,
  parseBody,
  jsonResponse,
  boardScore,
  isBetterScore,
  setCors,
} = require("./_lib");

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
    const user = await resolveUser(req);
    if (!user) {
      jsonResponse(res, 401, { error: "Not signed in." });
      return;
    }

    const body = parseBody(req.body);
    const gameId = sanitizeGameId(body?.gameId);
    const metric = Number(body?.metric);

    if (!gameId) {
      jsonResponse(res, 400, { error: "Invalid game." });
      return;
    }

    if (!Number.isFinite(metric)) {
      jsonResponse(res, 400, { error: "Invalid score." });
      return;
    }

    await withRedis(async (redisUrl, redisToken) => {
      const bestKey = keys().best(user.id, gameId);
      const previousRaw = await redisCommand(redisUrl, redisToken, ["GET", bestKey]);
      const previous = previousRaw ? Number(previousRaw) : null;
      const improved = isBetterScore(gameId, previous, metric);
      const now = new Date().toISOString();

      if (improved) {
        await redisCommand(redisUrl, redisToken, ["SET", bestKey, String(metric)]);
        const ranked = boardScore(gameId, metric);
        if (ranked !== null) {
          await redisCommand(redisUrl, redisToken, [
            "ZADD",
            keys().board(gameId),
            ranked,
            user.id,
          ]);
        }
      }

      const historyEntry = JSON.stringify({ gameId, metric, at: now, improved });
      await redisCommand(redisUrl, redisToken, [
        "LPUSH",
        keys().history(user.id),
        historyEntry,
      ]);
      await redisCommand(redisUrl, redisToken, [
        "LTRIM",
        keys().history(user.id),
        0,
        99,
      ]);

      jsonResponse(res, 200, {
        ok: true,
        improved,
        best: improved ? metric : previous,
      });
    });
  } catch (error) {
    jsonResponse(res, error.statusCode || 500, {
      error: error?.message || "Unexpected error.",
    });
  }
};
