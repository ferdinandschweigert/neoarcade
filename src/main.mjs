import { CANVAS_SIZE, clearCanvas } from "./games/shared.mjs";
import { createSnakeGame } from "./games/snake.mjs";
import { createPongGame } from "./games/pong.mjs";
import { createBreakoutGame } from "./games/breakout.mjs";
import { createPacmanGame } from "./games/pacman.mjs";
import { createBlockfallGame } from "./games/blockfall.mjs";
import { create2048Game } from "./games/g2048.mjs";
import { createMemoryMatchGame } from "./games/memory.mjs";
import { createMinefieldGame } from "./games/mines.mjs";
import { createFroggerGame } from "./games/frogger.mjs";
import { createAsteroidsGame } from "./games/asteroids.mjs";
import { createInvadersGame } from "./games/invaders.mjs";
import { createLabyrinthGame } from "./games/labyrinth.mjs";
import { createGrannyRunGame } from "./games/grannyrun.mjs";
import { submitScore } from "./apiClient.mjs";
import { createAuthManager } from "./auth.mjs";
import { createLeaderboardView } from "./leaderboard.mjs";
import { createStatsView } from "./stats.mjs";
import { createLayoutManager } from "./ui/layout.mjs";
import { createInputManager } from "./input.mjs";
import { createFeedbackUI } from "./ui/feedback.mjs";
import { createResponsiveLayout } from "./ui/responsive.mjs";
import {
  safeStorageGet,
  safeStorageGetJson,
  safeStorageSet,
  safeStorageSetJson,
  setStorageErrorHandler,
  STORAGE_KEYS,
} from "./storage.mjs";

const GUEST_PROFILE_ID = "guest";
const DIFFICULTY_STORAGE_KEY = STORAGE_KEYS.DIFFICULTY;
const PROFILE_SCORE_STORAGE_KEY = STORAGE_KEYS.PROFILE_SCORES;
const ACTIVE_PROFILE_STORAGE_KEY = STORAGE_KEYS.ACTIVE_PROFILE;
const DIFFICULTY_OPTIONS = new Set(["easy", "normal", "hard"]);
const CONTROL_MODE_OPTIONS = new Set(["auto", "both", "buttons", "gestures"]);
const LOWER_IS_BETTER_GAMES = new Set(["memory", "mines"]);
const BEST_TOKEN_PATTERN = /(Best(?:\s+safe)?\s*:?\s*)(-|\d+(?:\.\d+)?(?:ms)?)/i;

const DISPLAY_TITLES = {
  blockfall: "Tetris",
  g2048: "2048",
  invaders: "Space Invaders",
  frogger: "Frogger",
  pacman: "Pac-Maze",
  memory: "Memory Match",
  mines: "Minefield",
  labyrinth: "Labyrinth Heist",
  grannyrun: "Granny Rooftop",
};

const playViewEl = document.querySelector("#play-view");
const rankingsViewEl = document.querySelector("#rankings-view");
const statsViewEl = document.querySelector("#stats-view");
const settingsViewEl = document.querySelector("#settings-view");
const gameScreenEl = document.querySelector("#game-screen");
const gameTitleEl = document.querySelector("#game-title");
const gameButtons = document.querySelectorAll("[data-game]");
const gameCards = document.querySelectorAll(".game-card[data-game]");
const randomGameButton = document.querySelector("#random-game-button");
const backButton = document.querySelector("#back-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const bestHudEl = document.querySelector("#best-hud");
const touchControlsEl = document.querySelector("#touch-controls");
const stageCanvas = document.querySelector("#stage-canvas");
const difficultySelectEl = document.querySelector("#difficulty-select");
const controlModeSelectEl = document.querySelector("#control-mode-select");
const appStatusEl = document.querySelector("#app-status");
const recentGamesEl = document.querySelector("#recent-games");
const recentGamesListEl = document.querySelector("#recent-games-list");
const controlsHelpButton = document.querySelector("#controls-help-button");
const controlsOverlayEl = document.querySelector("#controls-overlay");
const controlsOverlayHintEl = document.querySelector("#controls-overlay-hint");
const controlsOverlayDismissEl = document.querySelector("#controls-overlay-dismiss");
const controlsGameHintEl = document.querySelector("#controls-game-hint");

const responsiveLayout = createResponsiveLayout({
  container: document.querySelector(".app"),
  onChange: () => {
    syncGameStageLayout();
  },
});
const isTouchDevice = responsiveLayout.isTouchDevice;

stageCanvas.width = CANVAS_SIZE;
stageCanvas.height = CANVAS_SIZE;

const context = stageCanvas.getContext("2d");

const games = {
  snake: createSnakeGame(context),
  pong: createPongGame(context),
  breakout: createBreakoutGame(context),
  pacman: createPacmanGame(context),
  blockfall: createBlockfallGame(context),
  g2048: create2048Game(context),
  asteroids: createAsteroidsGame(context),
  frogger: createFroggerGame(context),
  invaders: createInvadersGame(context),
  memory: createMemoryMatchGame(context),
  mines: createMinefieldGame(context),
  labyrinth: createLabyrinthGame(context),
  grannyrun: createGrannyRunGame(context),
};

const gameCardBestEls = new Map();
const { setAppStatus } = createFeedbackUI({ appStatusEl });

const authManager = createAuthManager({
  authGateEl: document.querySelector("#auth-gate"),
  authMessageEl: document.querySelector("#auth-message"),
  userLabelEl: document.querySelector("#user-label"),
  signInButtonEl: document.querySelector("#signin-button"),
  signOutButtonEl: document.querySelector("#signout-button"),
  signInFormEl: document.querySelector("#signin-form"),
  signUpFormEl: document.querySelector("#signup-form"),
  authCloseButtonEl: document.querySelector("#auth-close-button"),
  authTabButtons: document.querySelectorAll("[data-auth-tab]"),
  onAuthChange: () => {
    switchScoreProfile();
    if (authManager.isAuthenticated()) {
      void statsView.refresh();
    }
  },
});

const layoutManager = createLayoutManager({
  tabButtons: document.querySelectorAll(".app-tab"),
  views: {
    play: playViewEl,
    rankings: rankingsViewEl,
    stats: statsViewEl,
    settings: settingsViewEl,
  },
  onViewChange: (viewName) => {
    if (viewName === "rankings") {
      void leaderboardView.refresh();
    }
    if (viewName === "stats") {
      if (authManager.isAuthenticated()) {
        void statsView.refresh();
      } else {
        statsView.showGuestMessage();
      }
    }
  },
});

const leaderboardView = createLeaderboardView({
  rootEl: rankingsViewEl,
  gameSelectEl: document.querySelector("#rankings-game-select"),
  overallTabEl: document.querySelector("#rankings-overall-tab"),
  gameTabEl: document.querySelector("#rankings-game-tab"),
  tableBodyEl: document.querySelector("#rankings-table-body"),
  messageEl: document.querySelector("#rankings-message"),
  titleEl: document.querySelector("#rankings-title"),
});

const statsView = createStatsView({
  summaryEl: document.querySelector("#stats-summary"),
  barsEl: document.querySelector("#stats-bars"),
  recentEl: document.querySelector("#stats-recent"),
  progressEl: document.querySelector("#stats-progress"),
  messageEl: document.querySelector("#stats-message"),
});

const inputManager = createInputManager({
  canvas: stageCanvas,
  touchControlsEl,
  isTouchDevice,
  getActiveGame: () => activeGame,
  getControlMode: () => controlMode,
  getSwipeMinDistance: () => 24,
  getLongPressMs: () => 320,
  onControlApplied: () => drawFrame(),
  onBack: () => showMenu(),
  onPause: () => activeGame?.togglePause?.(),
  onRestart: () => activeGame?.restart?.(),
  onGamepadConnected: () => setAppStatus("Gamepad connected.", false, 3000),
});

setStorageErrorHandler((message) => {
  setAppStatus(message, true);
});

let activeGame = null;
let activeGameId = null;
let tickTimer = null;
let scoreStoreByProfile = loadScoreStoreByProfile();
let activeProfileId = GUEST_PROFILE_ID;
let activeDifficulty = loadDifficultySetting();
let savedBestByGame = {};
let loopPausedForVisibility = false;
let lastFocusedGameCard = null;
let controlMode = loadControlModeSetting();
let isAuthenticated = false;

for (const gameButton of gameButtons) {
  gameButton.addEventListener("click", () => {
    const gameId = gameButton.dataset.game;
    if (games[gameId]) {
      lastFocusedGameCard = gameButton;
      startGame(gameId);
    }
  });
}

if (randomGameButton) {
  randomGameButton.addEventListener("click", () => {
    const ids = Object.keys(games);
    const randomGameId = ids[Math.floor(Math.random() * ids.length)];
    if (randomGameId) {
      startGame(randomGameId);
    }
  });
}

if (controlModeSelectEl instanceof HTMLSelectElement) {
  controlModeSelectEl.value = controlMode;
  controlModeSelectEl.addEventListener("change", () => {
    const nextMode = String(controlModeSelectEl.value || "auto").toLowerCase();
    controlMode = CONTROL_MODE_OPTIONS.has(nextMode) ? nextMode : "auto";
    persistControlModeSetting();
    if (activeGame) {
      inputManager.renderTouchControls(activeGame.controlScheme);
    }
  });
}

if (controlsHelpButton) {
  controlsHelpButton.addEventListener("click", () => {
    showControlsOverlay(false);
  });
}

if (controlsOverlayDismissEl) {
  controlsOverlayDismissEl.addEventListener("click", () => {
    hideControlsOverlay(true);
  });
}

backButton.addEventListener("click", () => {
  showMenu();
});

pauseButton.addEventListener("click", () => {
  if (!activeGame) {
    return;
  }

  activeGame.togglePause();
  drawFrame();
});

restartButton.addEventListener("click", () => {
  if (!activeGame) {
    return;
  }

  activeGame.restart();
  drawFrame();
});

if (difficultySelectEl instanceof HTMLSelectElement) {
  difficultySelectEl.value = activeDifficulty;
  difficultySelectEl.addEventListener("change", () => {
    setActiveDifficulty(difficultySelectEl.value, true);
    if (activeGame) {
      drawFrame();
    }
  });
}

inputManager.initialize();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    loopPausedForVisibility = Boolean(activeGame && tickTimer);
    stopLoop();
    inputManager.stopGamepadPolling();
    return;
  }

  if (activeGame && loopPausedForVisibility) {
    loopPausedForVisibility = false;
    drawFrame();
    scheduleTick();
  }

  if (!isTouchDevice || getPrimaryGamepadExists()) {
    inputManager.startGamepadPolling();
  }
});

initializeGameCardBestLabels();
switchScoreProfile();
inputManager.startGamepadPolling();
setActivePanel("menu");

void authManager.initialize().then(() => {
  switchScoreProfile();
});

function getPrimaryGamepadExists() {
  if (typeof navigator.getGamepads !== "function") {
    return false;
  }

  const pads = navigator.getGamepads();
  return Boolean(pads && Array.from(pads).some((pad) => pad && pad.connected));
}

function getProfileIdForUser(userId) {
  return userId ? `user-${userId}` : GUEST_PROFILE_ID;
}

function switchScoreProfile(userId = null) {
  const nextProfileId = authManager.isAuthenticated()
    ? getProfileIdForUser(authManager.getCurrentUser()?.id)
    : GUEST_PROFILE_ID;

  if (!scoreStoreByProfile[nextProfileId]) {
    scoreStoreByProfile[nextProfileId] = {};
  }

  activeProfileId = nextProfileId;
  isAuthenticated = authManager.isAuthenticated();
  safeStorageSet(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
  savedBestByGame = { ...sanitizeScoreMap(scoreStoreByProfile[nextProfileId]) };
  refreshGameCardBestLabels();
}

function syncGameStageLayout() {
  if (!gameScreenEl || gameScreenEl.classList.contains("hidden")) {
    return;
  }

  const topBar = gameScreenEl.querySelector(".game-top-bar");
  const hud = gameScreenEl.querySelector(".game-hud");
  const bottomBar = gameScreenEl.querySelector(".game-bottom-bar");
  const stageStack = gameScreenEl.querySelector(".game-stage-stack");
  const touchControls = gameScreenEl.querySelector("#touch-controls");
  const touchControlsHeight = touchControls?.offsetHeight ?? 0;
  const stageGap = stageStack
    ? Number.parseFloat(window.getComputedStyle(stageStack).gap) || 0
    : 0;
  const stageSpace = Math.max(
    0,
    (stageStack?.clientHeight ?? 0)
      - touchControlsHeight
      - (touchControlsHeight > 0 ? stageGap : 0),
  );
  const chromeHeight =
    (topBar?.offsetHeight ?? 0)
    + (hud?.offsetHeight ?? 0)
    + (bottomBar?.offsetHeight ?? 0)
    + touchControlsHeight
    + 48;

  document.documentElement.style.setProperty(
    "--game-chrome",
    `${Math.ceil(chromeHeight)}px`,
  );
  document.documentElement.style.setProperty(
    "--game-stage-space",
    `${Math.floor(stageSpace)}px`,
  );
}

function setActivePanel(panelName) {
  document.body.dataset.panel = panelName;

  if (panelName !== "game") {
    delete document.body.dataset.stageAspect;
    if (gameScreenEl) {
      delete gameScreenEl.dataset.stageAspect;
    }
    document.documentElement.style.removeProperty("--game-chrome");
    document.documentElement.style.removeProperty("--game-stage-space");
  }
}

function applyGameStageAspect(game) {
  const aspect = game?.stageAspect === "landscape" ? "landscape" : "square";
  document.body.dataset.stageAspect = aspect;
  if (gameScreenEl) {
    gameScreenEl.dataset.stageAspect = aspect;
  }
  requestAnimationFrame(() => {
    syncGameStageLayout();
  });
}

function startGame(gameId) {
  stopLoop();
  inputManager.resetGamepadStates();

  activeGameId = gameId;
  activeGame = games[gameId];
  applyDifficultyToGame(activeGame);
  recordRecentGame(gameId);

  for (const view of [playViewEl, rankingsViewEl, statsViewEl, settingsViewEl]) {
    view?.classList.add("hidden");
  }
  gameScreenEl.classList.remove("hidden");
  setActivePanel("game");
  applyGameStageAspect(activeGame);

  gameTitleEl.textContent = DISPLAY_TITLES[gameId] || activeGame.title;
  inputManager.renderTouchControls(activeGame.controlScheme);
  updateControlsHints();

  activeGame.start();
  drawFrame();
  scheduleTick();

  if (isTouchDevice && !hasSeenControlsHint()) {
    showControlsOverlay(true);
  }

  stageCanvas.focus();
  requestAnimationFrame(() => {
    syncGameStageLayout();
  });
}

function showMenu() {
  stopLoop();
  inputManager.resetGamepadStates();
  inputManager.stopTouchHold();
  hideControlsOverlay(false);

  if (activeGame) {
    activeGame.stop();
  }

  activeGame = null;
  activeGameId = null;

  gameScreenEl.classList.add("hidden");
  layoutManager.setView(layoutManager.getActiveView());
  setActivePanel("menu");

  clearCanvas(context);

  if (lastFocusedGameCard instanceof HTMLElement) {
    lastFocusedGameCard.focus();
  }
}

function scheduleTick() {
  if (!activeGame || document.hidden) {
    return;
  }

  const delay = activeGame.getTickMs();
  tickTimer = setTimeout(() => {
    if (!activeGame || !games[activeGameId] || document.hidden) {
      return;
    }

    activeGame.tick();
    drawFrame();
    scheduleTick();
  }, delay);
}

function drawFrame() {
  if (!activeGame) {
    return;
  }

  activeGame.render();

  const hud = activeGame.getHud();
  scoreEl.textContent = mergeSavedBestIntoHud(activeGameId, hud.score);
  statusEl.textContent = hud.status;
  pauseButton.textContent = hud.pauseLabel;
  pauseButton.disabled = hud.pauseDisabled;

  const savedBest = savedBestByGame[activeGameId];
  if (bestHudEl) {
    bestHudEl.textContent = Number.isFinite(savedBest)
      ? `Best: ${formatMetric(activeGameId, savedBest)}`
      : "Best: -";
  }
}

function stopLoop() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

function mergeSavedBestIntoHud(gameId, scoreText) {
  if (!gameId || !activeProfileId) {
    return scoreText;
  }

  const bestFromHud = parseBestMetric(scoreText, gameId);
  const fallbackMetric = parseFallbackMetric(scoreText, gameId);
  const candidate = Number.isFinite(bestFromHud) ? bestFromHud : fallbackMetric;
  const didUpdate = updateSavedBest(gameId, candidate);
  const savedBest = savedBestByGame[gameId];

  if (!Number.isFinite(savedBest)) {
    return scoreText;
  }

  if (didUpdate) {
    refreshGameCardBestLabels();
  }

  if (BEST_TOKEN_PATTERN.test(scoreText)) {
    return scoreText.replace(
      BEST_TOKEN_PATTERN,
      (_, prefix) => `${prefix}${formatMetric(gameId, savedBest)}`,
    );
  }

  return `${scoreText} | Best: ${formatMetric(gameId, savedBest)}`;
}

function parseBestMetric(scoreText, gameId) {
  const match = BEST_TOKEN_PATTERN.exec(String(scoreText));
  if (!match) {
    return null;
  }

  return parseMetricValue(match[2], gameId);
}

function parseFallbackMetric(scoreText, gameId) {
  if (gameId === "pong") {
    const match = /Player\s+(\d+)/i.exec(String(scoreText));
    if (!match) {
      return null;
    }

    return parseMetricValue(match[1], gameId);
  }

  return null;
}

function parseMetricValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseFloat(String(rawValue));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetric(gameId, value) {
  const rounded = Math.round(value);
  return String(rounded);
}

function pickBetterMetric(gameId, a, b) {
  if (!Number.isFinite(a)) {
    return b;
  }
  if (!Number.isFinite(b)) {
    return a;
  }
  if (LOWER_IS_BETTER_GAMES.has(gameId)) {
    return Math.min(a, b);
  }
  return Math.max(a, b);
}

function updateSavedBest(gameId, candidate) {
  if (!activeProfileId || !Number.isFinite(candidate)) {
    return false;
  }

  const previous = savedBestByGame[gameId];
  const next = pickBetterMetric(gameId, previous, candidate);

  if (Object.is(previous, next)) {
    return false;
  }

  savedBestByGame[gameId] = next;
  persistSavedBestScores();

  if (isAuthenticated) {
    void submitScore(gameId, next).catch(() => {
      setAppStatus("Could not sync score to rankings.", true, 4000);
    });
  }

  return true;
}

function loadDifficultySetting() {
  const raw = safeStorageGet(DIFFICULTY_STORAGE_KEY);
  const normalized = String(raw || "").toLowerCase();
  return DIFFICULTY_OPTIONS.has(normalized) ? normalized : "normal";
}

function persistDifficultySetting() {
  safeStorageSet(DIFFICULTY_STORAGE_KEY, activeDifficulty);
}

function loadControlModeSetting() {
  const raw = safeStorageGet(STORAGE_KEYS.CONTROL_MODE);
  const normalized = String(raw || "").toLowerCase();
  return CONTROL_MODE_OPTIONS.has(normalized) ? normalized : "auto";
}

function persistControlModeSetting() {
  safeStorageSet(STORAGE_KEYS.CONTROL_MODE, controlMode);
}

function loadScoreStoreByProfile() {
  const parsed = safeStorageGetJson(PROFILE_SCORE_STORAGE_KEY, {});
  if (!parsed || typeof parsed !== "object") {
    return { [GUEST_PROFILE_ID]: {} };
  }
  return parsed;
}

function sanitizeScoreMap(maybeMap) {
  if (!maybeMap || typeof maybeMap !== "object") {
    return {};
  }

  const sanitized = {};
  for (const [gameId, metric] of Object.entries(maybeMap)) {
    if (Number.isFinite(metric)) {
      sanitized[gameId] = metric;
    }
  }
  return sanitized;
}

function persistSavedBestScores() {
  if (!activeProfileId) {
    return;
  }

  scoreStoreByProfile[activeProfileId] = { ...savedBestByGame };
  safeStorageSetJson(PROFILE_SCORE_STORAGE_KEY, scoreStoreByProfile);
}

function setActiveDifficulty(nextDifficulty, persist) {
  const normalized = String(nextDifficulty || "").toLowerCase();
  activeDifficulty = DIFFICULTY_OPTIONS.has(normalized)
    ? normalized
    : "normal";

  if (difficultySelectEl instanceof HTMLSelectElement) {
    difficultySelectEl.value = activeDifficulty;
  }

  if (persist) {
    persistDifficultySetting();
  }

  if (activeGame) {
    applyDifficultyToGame(activeGame);
  }
}

function applyDifficultyToGame(game) {
  if (!game || typeof game.setDifficulty !== "function") {
    return;
  }

  game.setDifficulty(activeDifficulty);
}

function initializeGameCardBestLabels() {
  for (const card of gameCards) {
    const gameId = card.dataset.game;
    if (!gameId) {
      continue;
    }

    let bestEl = card.querySelector(".game-card-best");
    if (!bestEl) {
      bestEl = document.createElement("span");
      bestEl.className = "game-card-best";
      card.appendChild(bestEl);
    }

    gameCardBestEls.set(gameId, bestEl);
  }
}

function refreshGameCardBestLabels() {
  for (const [gameId, bestEl] of gameCardBestEls.entries()) {
    const metric = savedBestByGame[gameId];
    if (Number.isFinite(metric)) {
      bestEl.textContent = `Best: ${formatMetric(gameId, metric)}`;
      bestEl.classList.remove("is-empty");
      continue;
    }

    bestEl.textContent = "Best: -";
    bestEl.classList.add("is-empty");
  }
}

function loadRecentGames() {
  const stored = safeStorageGetJson(STORAGE_KEYS.RECENT_GAMES, []);
  return Array.isArray(stored)
    ? stored.filter((id) => typeof id === "string" && games[id]).slice(0, 5)
    : [];
}

function recordRecentGame(gameId) {
  const recent = loadRecentGames().filter((id) => id !== gameId);
  recent.unshift(gameId);
  safeStorageSetJson(STORAGE_KEYS.RECENT_GAMES, recent.slice(0, 5));
  renderRecentGames();
}

function renderRecentGames() {
  if (!recentGamesEl || !recentGamesListEl) {
    return;
  }

  const recent = loadRecentGames();
  recentGamesListEl.innerHTML = "";

  if (recent.length === 0) {
    recentGamesEl.classList.add("hidden");
    return;
  }

  recentGamesEl.classList.remove("hidden");

  for (const gameId of recent) {
    const game = games[gameId];
    if (!game) {
      continue;
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "recent-chip";
    chip.textContent = DISPLAY_TITLES[gameId] || game.title;
    chip.addEventListener("click", () => {
      startGame(gameId);
    });
    recentGamesListEl.appendChild(chip);
  }
}

function hasSeenControlsHint() {
  return safeStorageGet(STORAGE_KEYS.CONTROLS_HINT) === "1";
}

function markControlsHintSeen() {
  safeStorageSet(STORAGE_KEYS.CONTROLS_HINT, "1");
}

function showControlsOverlay(markSeen) {
  if (!controlsOverlayEl) {
    return;
  }

  controlsOverlayEl.classList.remove("hidden");
  if (markSeen) {
    markControlsHintSeen();
  }
}

function hideControlsOverlay(markSeen) {
  if (!controlsOverlayEl) {
    return;
  }

  controlsOverlayEl.classList.add("hidden");
  if (markSeen) {
    markControlsHintSeen();
  }
}

function updateControlsHints() {
  if (!activeGame) {
    return;
  }

  const hint = inputManager.getControlHintForGame(activeGame);
  if (controlsGameHintEl) {
    controlsGameHintEl.textContent = hint;
  }
  if (controlsOverlayHintEl) {
    controlsOverlayHintEl.textContent = hint;
  }
}

renderRecentGames();
