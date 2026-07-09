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
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return { redisUrl, redisToken };
}

async function withRedis(handler) {
  const config = getRedisConfig();
  if (!config) {
    const error = new Error("Storage is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return handler(config.redisUrl, config.redisToken);
}

module.exports = {
  redisCommand,
  getRedisConfig,
  withRedis,
};
