const { redisCommand, withRedis } = require("./_redis");
const {
  SESSION_TTL_SECONDS,
  keys,
  sanitizeUsername,
  sanitizeDisplayName,
  parseBody,
  jsonResponse,
  getBearerToken,
  createToken,
  hashPassword,
  verifyPassword,
  setCors,
} = require("./_lib");

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === "GET") {
      await handleMe(req, res);
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const action = String(body?.action || req.query?.action || "").toLowerCase();

      if (action === "register") {
        await handleRegister(req, res, body);
        return;
      }

      if (action === "login") {
        await handleLogin(req, res, body);
        return;
      }

      if (action === "logout") {
        await handleLogout(req, res);
        return;
      }

      jsonResponse(res, 400, { error: "Unknown action." });
      return;
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    jsonResponse(res, 405, { error: "Method not allowed." });
  } catch (error) {
    jsonResponse(res, error.statusCode || 500, {
      error: error?.message || "Unexpected error.",
    });
  }
};

async function handleMe(req, res) {
  const user = await resolveUser(req);
  if (!user) {
    jsonResponse(res, 401, { error: "Not signed in." });
    return;
  }

  jsonResponse(res, 200, { user });
}

async function handleRegister(req, res, body) {
  const inviteRequired = process.env.NEO_ARCADE_INVITE_CODE;
  if (inviteRequired && String(body?.inviteCode || "") !== inviteRequired) {
    jsonResponse(res, 403, { error: "Invalid invite code." });
    return;
  }

  const username = sanitizeUsername(body?.username);
  const password = String(body?.password || "");
  const displayName = sanitizeDisplayName(body?.displayName, username);

  if (!username || username.length < 3) {
    jsonResponse(res, 400, { error: "Username must be at least 3 characters." });
    return;
  }

  if (password.length < 6) {
    jsonResponse(res, 400, { error: "Password must be at least 6 characters." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const userKey = keys().user(username);
    const exists = await redisCommand(redisUrl, redisToken, ["EXISTS", userKey]);
    if (Number(exists) === 1) {
      const error = new Error("Username already taken.");
      error.statusCode = 409;
      throw error;
    }

    const userId = await redisCommand(redisUrl, redisToken, ["INCR", keys().nextUserId]);
    const createdAt = new Date().toISOString();
    const userRecord = {
      id: String(userId),
      username,
      passwordHash: hashPassword(password),
      displayName,
      createdAt,
    };

    await redisCommand(redisUrl, redisToken, [
      "SET",
      userKey,
      JSON.stringify(userRecord),
    ]);
    await redisCommand(redisUrl, redisToken, [
      "SET",
      keys().userId(userId),
      username,
    ]);
    await redisCommand(redisUrl, redisToken, ["SADD", keys().usersIndex, String(userId)]);
    await redisCommand(redisUrl, redisToken, [
      "SET",
      keys().userMeta(userId),
      JSON.stringify({ displayName, createdAt }),
    ]);

    const token = createToken();
    await redisCommand(redisUrl, redisToken, [
      "SET",
      keys().session(token),
      String(userId),
      "EX",
      SESSION_TTL_SECONDS,
    ]);

    jsonResponse(res, 201, {
      token,
      user: publicUser(userRecord),
    });
  });
}

async function handleLogin(req, res, body) {
  const username = sanitizeUsername(body?.username);
  const password = String(body?.password || "");

  if (!username || !password) {
    jsonResponse(res, 400, { error: "Username and password required." });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    const raw = await redisCommand(redisUrl, redisToken, ["GET", keys().user(username)]);
    if (!raw) {
      const error = new Error("Invalid username or password.");
      error.statusCode = 401;
      throw error;
    }

    let userRecord;
    try {
      userRecord = JSON.parse(raw);
    } catch {
      const error = new Error("Stored user is invalid.");
      error.statusCode = 500;
      throw error;
    }

    if (!verifyPassword(password, userRecord.passwordHash)) {
      const error = new Error("Invalid username or password.");
      error.statusCode = 401;
      throw error;
    }

    const token = createToken();
    await redisCommand(redisUrl, redisToken, [
      "SET",
      keys().session(token),
      userRecord.id,
      "EX",
      SESSION_TTL_SECONDS,
    ]);

    jsonResponse(res, 200, {
      token,
      user: publicUser(userRecord),
    });
  });
}

async function handleLogout(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  await withRedis(async (redisUrl, redisToken) => {
    await redisCommand(redisUrl, redisToken, ["DEL", keys().session(token)]);
    jsonResponse(res, 200, { ok: true });
  });
}

async function resolveUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  return withRedis(async (redisUrl, redisToken) => {
    const userId = await redisCommand(redisUrl, redisToken, ["GET", keys().session(token)]);
    if (!userId) {
      return null;
    }

    const username = await redisCommand(redisUrl, redisToken, ["GET", keys().userId(userId)]);
    if (!username) {
      return null;
    }

    const raw = await redisCommand(redisUrl, redisToken, ["GET", keys().user(username)]);
    if (!raw) {
      return null;
    }

    try {
      return publicUser(JSON.parse(raw));
    } catch {
      return null;
    }
  });
}

function publicUser(userRecord) {
  return {
    id: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    createdAt: userRecord.createdAt,
  };
}

module.exports.resolveUser = resolveUser;
