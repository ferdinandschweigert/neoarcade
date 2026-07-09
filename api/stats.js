const { redisCommand, withRedis } = require("./_redis");
const { resolveUser } = require("./auth");
const {
  CLASSIC_GAME_IDS,
  GAME_LABELS,
  keys,
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
    const user = await resolveUser(req);
    if (!user) {
      jsonResponse(res, 401, { error: "Not signed in." });
      return;
    }

    await withRedis(async (redisUrl, redisToken) => {
      const bests = {};
      let gamesWithScores = 0;

      for (const gameId of CLASSIC_GAME_IDS) {
        const raw = await redisCommand(redisUrl, redisToken, [
          "GET",
          keys().best(user.id, gameId),
        ]);
        if (!raw) {
          continue;
        }

        const metric = Number(raw);
        gamesWithScores += 1;
        bests[gameId] = {
          gameId,
          label: GAME_LABELS[gameId] || gameId,
          metric,
          metricLabel: displayMetric(gameId, metric),
        };
      }

      const historyRaw = await redisCommand(redisUrl, redisToken, [
        "LRANGE",
        keys().history(user.id),
        0,
        19,
      ]);

      const recent = [];
      for (const item of historyRaw || []) {
        try {
          recent.push(JSON.parse(item));
        } catch {
          // skip invalid entries
        }
      }

      const playCount = recent.length;
      const uniqueDays = new Set(
        recent.map((entry) => String(entry.at || "").slice(0, 10)).filter(Boolean),
      );

      jsonResponse(res, 200, {
        user,
        summary: {
          gamesWithScores,
          totalGames: CLASSIC_GAME_IDS.length,
          playCount,
          activeDays: uniqueDays.size,
        },
        bests: Object.values(bests),
        recent,
      });
    });
  } catch (error) {
    jsonResponse(res, error.statusCode || 500, {
      error: error?.message || "Unexpected error.",
    });
  }
};
