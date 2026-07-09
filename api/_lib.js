const crypto = require("crypto");

const KEY_PREFIX = "neoarcade:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

const CLASSIC_GAME_IDS = [
  "snake",
  "blockfall",
  "g2048",
  "pong",
  "breakout",
  "pacman",
  "asteroids",
  "frogger",
  "invaders",
  "memory",
  "mines",
];

const LOWER_IS_BETTER_GAMES = new Set(["memory", "mines"]);

const GAME_LABELS = {
  snake: "Snake",
  blockfall: "Tetris",
  g2048: "2048",
  pong: "Pong",
  breakout: "Breakout",
  pacman: "Pac-Maze",
  asteroids: "Asteroids",
  frogger: "Frogger",
  invaders: "Space Invaders",
  memory: "Memory Match",
  mines: "Minefield",
};

function keys() {
  return {
    user: (username) => `${KEY_PREFIX}user:${username}`,
    userId: (id) => `${KEY_PREFIX}user:id:${id}`,
    session: (token) => `${KEY_PREFIX}session:${token}`,
    best: (userId, gameId) => `${KEY_PREFIX}best:${userId}:${gameId}`,
    history: (userId) => `${KEY_PREFIX}history:${userId}`,
    board: (gameId) => `${KEY_PREFIX}board:${gameId}`,
    usersIndex: `${KEY_PREFIX}users:index`,
    userMeta: (userId) => `${KEY_PREFIX}user:meta:${userId}`,
    nextUserId: `${KEY_PREFIX}seq:userId`,
  };
}

function sanitizeUsername(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
}

function sanitizeDisplayName(raw, fallback = "Player") {
  const trimmed = String(raw || "").trim().slice(0, 24);
  return trimmed || fallback;
}

function sanitizeGameId(raw) {
  const gameId = String(raw || "").trim();
  return CLASSIC_GAME_IDS.includes(gameId) ? gameId : null;
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

function jsonResponse(res, status, payload) {
  res.status(status).json(payload);
}

function getBearerToken(req) {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) {
    return false;
  }

  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

function boardScore(gameId, metric) {
  if (!Number.isFinite(metric)) {
    return null;
  }

  if (LOWER_IS_BETTER_GAMES.has(gameId)) {
    return 1_000_000_000 - metric;
  }

  return metric;
}

function displayMetric(gameId, metric) {
  if (!Number.isFinite(metric)) {
    return "-";
  }

  if (gameId === "memory" || gameId === "mines") {
    return String(metric);
  }

  return String(metric);
}

function isBetterScore(gameId, previous, candidate) {
  if (!Number.isFinite(candidate)) {
    return false;
  }

  if (!Number.isFinite(previous)) {
    return true;
  }

  if (LOWER_IS_BETTER_GAMES.has(gameId)) {
    return candidate < previous;
  }

  return candidate > previous;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = {
  CLASSIC_GAME_IDS,
  LOWER_IS_BETTER_GAMES,
  GAME_LABELS,
  KEY_PREFIX,
  SESSION_TTL_SECONDS,
  keys,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeGameId,
  parseBody,
  jsonResponse,
  getBearerToken,
  createToken,
  hashPassword,
  verifyPassword,
  boardScore,
  displayMetric,
  isBetterScore,
  setCors,
};
