const KEY_PREFIX = "neoarcade:cloud:";
const MAX_CODE_LENGTH = 32;
const MAX_SNAPSHOT_BYTES = 200_000;

module.exports = async function handler(req, res) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    res.status(500).json({
      error: "Cloud storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const code = sanitizeCode(req.query?.code);
      if (!code) {
        res.status(400).json({ error: "Missing code." });
        return;
      }

      const raw = await redisCommand(redisUrl, redisToken, [
        "GET",
        `${KEY_PREFIX}${code}`,
      ]);

      if (!raw) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      let snapshot = null;
      try {
        snapshot = JSON.parse(raw);
      } catch {
        res.status(500).json({ error: "Stored snapshot is invalid JSON." });
        return;
      }

      res.status(200).json({ snapshot });
      return;
    }

    if (req.method === "PUT") {
      const body = parseBody(req.body);
      const code = sanitizeCode(body?.code);
      const snapshot = body?.snapshot;

      if (!code) {
        res.status(400).json({ error: "Missing code." });
        return;
      }

      if (!snapshot || typeof snapshot !== "object") {
        res.status(400).json({ error: "Missing snapshot object." });
        return;
      }

      const serialized = JSON.stringify(snapshot);
      if (Buffer.byteLength(serialized, "utf8") > MAX_SNAPSHOT_BYTES) {
        res.status(413).json({ error: "Snapshot too large." });
        return;
      }

      await redisCommand(redisUrl, redisToken, [
        "SET",
        `${KEY_PREFIX}${code}`,
        serialized,
      ]);

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Unexpected error." });
  }
};

function sanitizeCode(rawCode) {
  return String(rawCode || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, MAX_CODE_LENGTH);
}

function parseBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (typeof body === "object") {
    return body;
  }

  return null;
}

async function redisCommand(redisUrl, redisToken, command) {
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
}
