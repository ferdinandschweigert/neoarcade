const { getRedisConfig, listStorageEnvKeys, redisCommand } = require("./_redis");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const config = getRedisConfig();
  const payload = {
    storageReady: Boolean(config),
    storageEnvKeys: listStorageEnvKeys(),
  };

  if (!config) {
    res.status(200).json({
      ...payload,
      message: "Redis env vars not visible to this deployment yet. Redeploy after linking storage.",
    });
    return;
  }

  try {
    await redisCommand(config.redisUrl, config.redisToken, ["PING"]);
    res.status(200).json({
      ...payload,
      message: "Redis connected.",
    });
  } catch (error) {
    res.status(500).json({
      ...payload,
      message: error?.message || "Redis ping failed.",
    });
  }
};
