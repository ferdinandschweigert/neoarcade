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

function isRestRedisUrl(value) {
  return typeof value === "string"
    && value.startsWith("https://")
    && (value.includes("upstash.io") || value.includes("redis.vercel"));
}

function tokenCandidatesForUrlKey(urlKey) {
  const candidates = [];

  if (urlKey.endsWith("REST_API_URL")) {
    candidates.push(urlKey.replace(/REST_API_URL$/, "REST_API_TOKEN"));
  }

  if (urlKey.endsWith("REST_URL")) {
    candidates.push(urlKey.replace(/REST_URL$/, "REST_TOKEN"));
  }

  if (urlKey.endsWith("_URL")) {
    candidates.push(urlKey.replace(/_URL$/, "_TOKEN"));
  }

  candidates.push("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");

  return [...new Set(candidates.filter(Boolean))];
}

function isLikelyRedisToken(value) {
  return typeof value === "string"
    && value.length > 0
    && !value.startsWith("https://")
    && !value.startsWith("redis://");
}

function discoverRedisConfig() {
  for (const [urlKey, redisUrl] of Object.entries(process.env)) {
    if (!isRestRedisUrl(redisUrl)) {
      continue;
    }

    if (/READ_ONLY/i.test(urlKey)) {
      continue;
    }

    for (const tokenKey of tokenCandidatesForUrlKey(urlKey)) {
      const redisToken = process.env[tokenKey];
      if (redisToken && isLikelyRedisToken(redisToken) && !/READ_ONLY/i.test(tokenKey)) {
        return { redisUrl, redisToken, urlKey, tokenKey };
      }
    }
  }

  return null;
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
  ];

  for (const [redisUrl, redisToken] of pairs) {
    if (redisUrl && redisToken) {
      return { redisUrl, redisToken };
    }
  }

  const discovered = discoverRedisConfig();
  if (discovered) {
    return {
      redisUrl: discovered.redisUrl,
      redisToken: discovered.redisToken,
    };
  }

  return null;
}

function listStorageEnvKeys() {
  return Object.keys(process.env).filter((key) => /UPSTASH|KV_|REDIS/i.test(key)).sort();
}

function storageSetupMessage() {
  return (
    "Storage is not configured. Connect Upstash Redis to this Vercel project, "
    + "then redeploy. https://vercel.com/integrations/upstash"
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
  listStorageEnvKeys,
  storageSetupMessage,
  withRedis,
};
