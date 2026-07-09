async function redisCommand(redisUrl, redisToken, command) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || `redis_http_${response.status}`);
      }

      if (payload?.error) {
        throw new Error(payload.error);
      }

      return payload?.result ?? null;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => {
          setTimeout(resolve, 400 * attempt);
        });
      }
    }
  }

  throw lastError;
}

function getRedisConfig() {
  const pairs = [
    [
      process.env.UPSTASH_REDIS_REST_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN,
    ],
    [
      process.env.KV_REST_API_URL,
      process.env.KV_REST_API_TOKEN,
    ],
    [
      process.env.KV_URL,
      process.env.KV_REST_API_TOKEN,
    ],
    [
      process.env.REDIS_URL,
      process.env.REDIS_TOKEN,
    ],
  ];

  for (const [redisUrl, redisToken] of pairs) {
    if (redisUrl && redisToken) {
      return { redisUrl, redisToken };
    }
  }

  return null;
}

function storageSetupMessage() {
  return (
    "Storage is not configured. In Vercel: Project neoarcade → Storage → "
    + "Create Database → Upstash Redis → connect to this project, then redeploy. "
    + "https://vercel.com/integrations/upstash"
  );
}

async function withRedis(handler) {
  const config = getRedisConfig();
  if (!config) {
    const error = new Error(storageSetupMessage());
    error.statusCode = 500;
    error.code = "STORAGE_NOT_CONFIGURED";
    throw error;
  }

  return handler(config.redisUrl, config.redisToken);
}

module.exports = {
  redisCommand,
  getRedisConfig,
  storageSetupMessage,
  withRedis,
};
