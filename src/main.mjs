import { CANVAS_SIZE, clearCanvas } from "./games/shared.mjs";
import { createSnakeGame } from "./games/snake.mjs";
import { createPongGame } from "./games/pong.mjs";
import { createBreakoutGame } from "./games/breakout.mjs";
import { createPacmanGame } from "./games/pacman.mjs";
import { createBlasterGame } from "./games/blaster.mjs";
import { createDodgerGame } from "./games/dodger.mjs";
import { createBlockfallGame } from "./games/blockfall.mjs";
import { createTronGame } from "./games/tron.mjs";
import { createRunnerGame } from "./games/runner.mjs";
import { createOrbitGame } from "./games/orbit.mjs";
import { create2048Game } from "./games/g2048.mjs";
import { createTicTacToeGame } from "./games/tictactoe.mjs";
import { createConnect4Game } from "./games/connect4.mjs";
import { createLightsOutGame } from "./games/lights.mjs";
import { createMemoryMatchGame } from "./games/memory.mjs";
import { createMinefieldGame } from "./games/mines.mjs";
import { createFroggerGame } from "./games/frogger.mjs";
import { createCatcherGame } from "./games/catcher.mjs";
import { createQuickDrawGame } from "./games/quickdraw.mjs";
import { createLabyrinthGame } from "./games/labyrinth.mjs";
import { createRogueliteGame } from "./games/roguelite.mjs";
import { createAsteroidsGame } from "./games/asteroids.mjs";
import { createFlappyGame } from "./games/flappy.mjs";
import { createRiverRaidGame } from "./games/riverraid.mjs";
import { createAirHockeyGame } from "./games/airhockey.mjs";
import { createSlidingGame } from "./games/sliding.mjs";
import { createReversiGame } from "./games/reversi.mjs";
import { createBomberVaultGame } from "./games/bomber.mjs";
import { createPortalDashGame } from "./games/portaldash.mjs";
import { createStackerGame } from "./games/stacker.mjs";
import { createColorFloodGame } from "./games/colorflood.mjs";
import { createBackgammonGame } from "./games/backgammon.mjs";
import { createInvadersGame } from "./games/invaders.mjs";
import { createHeliGame } from "./games/heli.mjs";
import { createSokobanGame } from "./games/sokoban.mjs";
import { createBattleshipGame } from "./games/battleship.mjs";
import { createMastermindGame } from "./games/mastermind.mjs";
import { createHanoiGame } from "./games/hanoi.mjs";
import { createDrifterGame } from "./games/drifter.mjs";
import { createTurretDefenseGame } from "./games/turret.mjs";
import { createWordHuntGame } from "./games/wordhunt.mjs";
import { createQuantumFlipGame } from "./games/quantumflip.mjs";

const ACTION_LABELS = {
  UP: "Up",
  DOWN: "Down",
  LEFT: "Left",
  RIGHT: "Right",
  SELECT: "Select",
  FLAG: "Flag",
};

const CONTROL_SCHEMES = {
  none: [],
  dpad: [["UP"], ["LEFT", "DOWN", "RIGHT"]],
  horizontal: [["LEFT", "RIGHT"]],
  vertical: [["UP", "DOWN"]],
  hfire: [["UP"], ["LEFT", "RIGHT"]],
  grid_select: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT"]],
  grid_select_flag: [["UP"], ["LEFT", "DOWN", "RIGHT"], ["SELECT", "FLAG"]],
  horizontal_select: [["LEFT", "RIGHT"], ["SELECT"]],
  select_only: [["SELECT"]],
};

const LEGACY_SCORE_STORAGE_KEY = "neoArcade.savedBest.v1";
const PROFILE_STORAGE_KEY = "neoArcade.profiles.v1";
const PROFILE_SCORE_STORAGE_KEY = "neoArcade.savedBestByProfile.v1";
const ACTIVE_PROFILE_STORAGE_KEY = "neoArcade.activeProfileId.v1";
const MAX_PROFILES = 8;
const PROFILE_COLORS = [
  "#1e61ff",
  "#e24739",
  "#47c3a2",
  "#f4d20b",
  "#8f5cf7",
  "#ff8a3d",
  "#111827",
  "#14b8a6",
];
const DIFFICULTY_STORAGE_KEY = "neoArcade.difficulty.v1";
const DIFFICULTY_OPTIONS = new Set(["easy", "normal", "hard"]);
const LOWER_IS_BETTER_GAMES = new Set([
  "lights",
  "memory",
  "quickdraw",
  "sliding",
  "colorflood",
  "hanoi",
  "quantumflip",
]);
const BEST_TOKEN_PATTERN = /(Best(?:\s+safe)?\s*:?\s*)(-|\d+(?:\.\d+)?(?:ms)?)/i;
const GAMEPAD_AXIS_THRESHOLD = 0.54;
const GAMEPAD_REPEAT_INITIAL_MS = 180;
const GAMEPAD_REPEAT_MS = 90;
const GAMEPAD_CONTROL_ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "SELECT", "FLAG"];
const GAMEPAD_BUTTON_CONTROL_MAP = [
  { button: 12, action: "UP" },
  { button: 13, action: "DOWN" },
  { button: 14, action: "LEFT" },
  { button: 15, action: "RIGHT" },
  { button: 0, action: "SELECT" },
  { button: 1, action: "FLAG" },
];
const GAMEPAD_BUTTON_EDGE_MAP = [
  { button: 8, action: "BACK" },
  { button: 9, action: "PAUSE" },
  { button: 3, action: "RESTART" },
];

const profileGateEl = document.querySelector("#profile-gate");
const profileListEl = document.querySelector("#profile-list");
const profileFormEl = document.querySelector("#profile-form");
const profileNameInputEl = document.querySelector("#profile-name-input");
const profileMessageEl = document.querySelector("#profile-message");
const activeProfileNameEl = document.querySelector("#active-profile-name");
const switchProfileButton = document.querySelector("#switch-profile-button");
const difficultySelectEl = document.querySelector("#difficulty-select");

const menuEl = document.querySelector("#arcade-menu");
const gameScreenEl = document.querySelector("#game-screen");
const gameTitleEl = document.querySelector("#game-title");
const gameButtons = document.querySelectorAll("[data-game]");
const gameCards = document.querySelectorAll(".game-card[data-game]");
const filterButtons = document.querySelectorAll(".filter-button[data-filter]");
const randomGameButton = document.querySelector("#random-game-button");
const backButton = document.querySelector("#back-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const touchControlsEl = document.querySelector("#touch-controls");
const stageCanvas = document.querySelector("#stage-canvas");

stageCanvas.width = CANVAS_SIZE;
stageCanvas.height = CANVAS_SIZE;

const context = stageCanvas.getContext("2d");

const games = {
  snake: createSnakeGame(context),
  pong: createPongGame(context),
  breakout: createBreakoutGame(context),
  pacman: createPacmanGame(context),
  blaster: createBlasterGame(context),
  dodger: createDodgerGame(context),
  blockfall: createBlockfallGame(context),
  tron: createTronGame(context),
  runner: createRunnerGame(context),
  orbit: createOrbitGame(context),
  g2048: create2048Game(context),
  tictactoe: createTicTacToeGame(context),
  connect4: createConnect4Game(context),
  lights: createLightsOutGame(context),
  memory: createMemoryMatchGame(context),
  mines: createMinefieldGame(context),
  frogger: createFroggerGame(context),
  catcher: createCatcherGame(context),
  quickdraw: createQuickDrawGame(context),
  labyrinth: createLabyrinthGame(context),
  roguelite: createRogueliteGame(context),
  asteroids: createAsteroidsGame(context),
  flappy: createFlappyGame(context),
  riverraid: createRiverRaidGame(context),
  airhockey: createAirHockeyGame(context),
  sliding: createSlidingGame(context),
  reversi: createReversiGame(context),
  bomber: createBomberVaultGame(context),
  portaldash: createPortalDashGame(context),
  stacker: createStackerGame(context),
  colorflood: createColorFloodGame(context),
  backgammon: createBackgammonGame(context),
  invaders: createInvadersGame(context),
  heli: createHeliGame(context),
  sokoban: createSokobanGame(context),
  battleship: createBattleshipGame(context),
  mastermind: createMastermindGame(context),
  hanoi: createHanoiGame(context),
  drifter: createDrifterGame(context),
  turret: createTurretDefenseGame(context),
  wordhunt: createWordHuntGame(context),
  quantumflip: createQuantumFlipGame(context),
};
const gameCardBestEls = new Map();

let activeGame = null;
let activeGameId = null;
let tickTimer = null;
let activeFilter = "all";
let gamepadAnimationFrame = null;
let profiles = [];
let scoreStoreByProfile = {};
let activeProfile = null;
let activeProfileId = null;
let activeDifficulty = loadDifficultySetting();
let savedBestByGame = {};
const gamepadControlState = new Map();
const gamepadEdgeState = new Map();

for (const gameButton of gameButtons) {
  gameButton.addEventListener("click", () => {
    const gameId = gameButton.dataset.game;
    if (games[gameId]) {
      startGame(gameId);
    }
  });
}

for (const filterButton of filterButtons) {
  filterButton.addEventListener("click", () => {
    activeFilter = filterButton.dataset.filter || "all";
    applyGameFilter();
  });
}

if (randomGameButton) {
  randomGameButton.addEventListener("click", () => {
    const randomGameId = pickRandomVisibleGameId();
    if (randomGameId) {
      startGame(randomGameId);
    }
  });
}

if (switchProfileButton) {
  switchProfileButton.addEventListener("click", () => {
    showProfileGate("Choose a profile.");
  });
}

if (difficultySelectEl instanceof HTMLSelectElement) {
  difficultySelectEl.value = activeDifficulty;
  difficultySelectEl.addEventListener("change", () => {
    setActiveDifficulty(difficultySelectEl.value, true);
    if (activeGame) {
      drawFrame();
    }
  });
}

if (profileListEl) {
  profileListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const cardEl = target.closest("[data-profile-id]");
    if (!(cardEl instanceof HTMLButtonElement)) {
      return;
    }

    const profileId = cardEl.dataset.profileId;
    if (!profileId) {
      return;
    }

    if (setActiveProfile(profileId, true)) {
      showMenu();
      setProfileMessage("");
    }
  });
}

if (profileFormEl) {
  profileFormEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const profileName = sanitizeProfileName(profileNameInputEl?.value || "");
    if (!profileName) {
      setProfileMessage("Enter a profile name first.", true);
      return;
    }

    if (profiles.length >= MAX_PROFILES) {
      setProfileMessage(`Profile limit reached (${MAX_PROFILES}).`, true);
      return;
    }

    const lower = profileName.toLowerCase();
    if (profiles.some((profile) => profile.name.toLowerCase() === lower)) {
      setProfileMessage("That profile already exists.", true);
      return;
    }

    const nextProfile = createProfile(profileName, profiles.length);
    profiles.push(nextProfile);
    persistProfiles();
    renderProfileCards();
    setActiveProfile(nextProfile.id, true);

    if (profileNameInputEl) {
      profileNameInputEl.value = "";
    }

    showMenu();
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

touchControlsEl.addEventListener("click", (event) => {
  if (!activeGame) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  if (activeGame.onControl(action)) {
    drawFrame();
  }
});

document.addEventListener("keydown", (event) => {
  if (!activeGame) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    showMenu();
    return;
  }

  if (activeGame.onKeyDown(event.key)) {
    event.preventDefault();
    drawFrame();
  }
});

document.addEventListener("keyup", (event) => {
  if (!activeGame) {
    return;
  }

  if (activeGame.onKeyUp(event.key)) {
    event.preventDefault();
  }
});

applyGameFilter();
initializeGameCardBestLabels();
initializeProfiles();
startGamepadPolling();

function startGame(gameId) {
  if (!activeProfileId) {
    showProfileGate("Choose a profile first.");
    return;
  }

  stopLoop();
  resetGamepadStates();

  activeGameId = gameId;
  activeGame = games[gameId];
  applyDifficultyToGame(activeGame);

  if (profileGateEl) {
    profileGateEl.classList.add("hidden");
  }
  menuEl.classList.add("hidden");
  gameScreenEl.classList.remove("hidden");

  gameTitleEl.textContent = activeGame.title;
  renderTouchControls(activeGame.controlScheme);

  activeGame.start();
  drawFrame();
  scheduleTick();
}

function showMenu() {
  stopLoop();
  resetGamepadStates();

  if (activeGame) {
    activeGame.stop();
  }

  activeGame = null;
  activeGameId = null;

  if (profileGateEl) {
    profileGateEl.classList.add("hidden");
  }
  menuEl.classList.remove("hidden");
  gameScreenEl.classList.add("hidden");

  clearCanvas(context);
}

function applyGameFilter() {
  for (const filterButton of filterButtons) {
    const filter = filterButton.dataset.filter || "all";
    filterButton.classList.toggle("is-active", filter === activeFilter);
  }

  for (const card of gameCards) {
    const categories = String(card.dataset.category || "")
      .split(" ")
      .filter(Boolean);

    const visible =
      activeFilter === "all" || categories.includes(activeFilter);

    card.classList.toggle("is-hidden", !visible);
  }
}

function pickRandomVisibleGameId() {
  const visibleGameIds = [];

  for (const card of gameCards) {
    if (card.classList.contains("is-hidden")) {
      continue;
    }

    const gameId = card.dataset.game;
    if (gameId && games[gameId]) {
      visibleGameIds.push(gameId);
    }
  }

  const candidateIds =
    visibleGameIds.length > 0 ? visibleGameIds : Object.keys(games);

  if (candidateIds.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidateIds.length);
  return candidateIds[randomIndex];
}

function initializeProfiles() {
  profiles = loadProfiles();

  if (profiles.length === 0) {
    profiles = [createProfile("Player 1", 0)];
    persistProfiles();
  }

  scoreStoreByProfile = loadScoreStoreByProfile();
  migrateLegacyScores(profiles[0].id);

  const preferredProfileId = loadActiveProfileId();
  const hasPreferredProfile = profiles.some(
    (profile) => profile.id === preferredProfileId,
  );

  const initialProfile = hasPreferredProfile
    ? profiles.find((profile) => profile.id === preferredProfileId)
    : profiles[0];

  if (!initialProfile) {
    showProfileGate("Create or choose a profile.");
    return;
  }

  setActiveProfile(initialProfile.id, true);
  renderProfileCards();

  if (hasPreferredProfile) {
    showMenu();
    setProfileMessage("");
    return;
  }

  showProfileGate("Choose your profile to start.");
}

function createProfile(name, index) {
  return {
    id: `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color: PROFILE_COLORS[index % PROFILE_COLORS.length],
  };
}

function sanitizeProfileName(rawName) {
  return String(rawName).trim().replace(/\s+/g, " ").slice(0, 18);
}

function renderProfileCards() {
  if (!profileListEl) {
    return;
  }

  profileListEl.innerHTML = "";

  for (const profile of profiles) {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "profile-card";
    buttonEl.dataset.profileId = profile.id;
    buttonEl.setAttribute("role", "listitem");

    if (profile.id === activeProfileId) {
      buttonEl.classList.add("is-active");
    }

    const avatarEl = document.createElement("span");
    avatarEl.className = "profile-avatar";
    avatarEl.style.setProperty("--profile-color", profile.color);
    avatarEl.textContent = profile.name.charAt(0).toUpperCase();

    const nameEl = document.createElement("span");
    nameEl.className = "profile-name";
    nameEl.textContent = profile.name;

    buttonEl.appendChild(avatarEl);
    buttonEl.appendChild(nameEl);
    profileListEl.appendChild(buttonEl);
  }
}

function setActiveProfile(profileId, persist) {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    return false;
  }

  activeProfile = profile;
  activeProfileId = profile.id;
  savedBestByGame = loadScoresForProfile(activeProfileId);

  if (activeProfileNameEl) {
    activeProfileNameEl.textContent = activeProfile.name;
  }

  if (persist) {
    persistActiveProfileId();
  }

  refreshGameCardBestLabels();
  renderProfileCards();
  return true;
}

function showProfileGate(message = "Choose a profile.") {
  stopLoop();
  resetGamepadStates();

  if (activeGame) {
    activeGame.stop();
  }

  activeGame = null;
  activeGameId = null;

  if (profileGateEl) {
    profileGateEl.classList.remove("hidden");
  }
  menuEl.classList.add("hidden");
  gameScreenEl.classList.add("hidden");

  clearCanvas(context);
  renderProfileCards();
  setProfileMessage(message);
}

function setProfileMessage(message, isError = false) {
  if (!profileMessageEl) {
    return;
  }

  profileMessageEl.textContent = message;
  profileMessageEl.classList.toggle("is-error", isError);
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

function scheduleTick() {
  if (!activeGame) {
    return;
  }

  const delay = activeGame.getTickMs();
  tickTimer = setTimeout(() => {
    if (!activeGame || !games[activeGameId]) {
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
}

function stopLoop() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

function renderTouchControls(schemeName) {
  const scheme = CONTROL_SCHEMES[schemeName] || CONTROL_SCHEMES.none;
  touchControlsEl.innerHTML = "";

  if (scheme.length === 0) {
    touchControlsEl.classList.add("is-empty");
    return;
  }

  touchControlsEl.classList.remove("is-empty");

  for (const rowActions of scheme) {
    const rowEl = document.createElement("div");
    rowEl.className = `touch-row cols-${rowActions.length}`;

    for (const action of rowActions) {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.dataset.action = action;
      buttonEl.textContent = ACTION_LABELS[action] || action;
      rowEl.appendChild(buttonEl);
    }

    touchControlsEl.appendChild(rowEl);
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

function parseMetricValue(rawValue, gameId) {
  if (!rawValue) {
    return null;
  }

  const numericText =
    gameId === "quickdraw"
      ? String(rawValue).toLowerCase().replace("ms", "")
      : String(rawValue);

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetric(gameId, value) {
  const rounded = Math.round(value);
  if (gameId === "quickdraw") {
    return `${rounded}ms`;
  }
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
  return true;
}

function loadDifficultySetting() {
  try {
    const raw = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    const normalized = String(raw || "").toLowerCase();
    return DIFFICULTY_OPTIONS.has(normalized) ? normalized : "normal";
  } catch {
    return "normal";
  }
}

function persistDifficultySetting() {
  try {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, activeDifficulty);
  } catch {
    // Ignore storage failures.
  }
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const sanitized = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];
      if (!item || typeof item !== "object") {
        continue;
      }

      const id = String(item.id || "").trim();
      const name = sanitizeProfileName(item.name || "");
      const color = String(item.color || PROFILE_COLORS[index % PROFILE_COLORS.length]).trim();

      if (!id || !name) {
        continue;
      }

      sanitized.push({ id, name, color });
    }

    return sanitized.slice(0, MAX_PROFILES);
  } catch {
    return [];
  }
}

function persistProfiles() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage failures (private mode, quota, blocked storage).
  }
}

function loadActiveProfileId() {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const profileId = String(raw).trim();
    return profileId || null;
  } catch {
    return null;
  }
}

function persistActiveProfileId() {
  if (!activeProfileId) {
    return;
  }

  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
  } catch {
    // Ignore storage failures.
  }
}

function loadScoreStoreByProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_SCORE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const sanitized = {};
    for (const [profileId, maybeMap] of Object.entries(parsed)) {
      sanitized[profileId] = sanitizeScoreMap(maybeMap);
    }

    return sanitized;
  } catch {
    return {};
  }
}

function loadLegacySavedBestScores() {
  try {
    const raw = localStorage.getItem(LEGACY_SCORE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return sanitizeScoreMap(parsed);
  } catch {
    return {};
  }
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

function migrateLegacyScores(defaultProfileId) {
  if (!defaultProfileId) {
    return;
  }

  const existing = scoreStoreByProfile[defaultProfileId];
  if (existing && Object.keys(existing).length > 0) {
    return;
  }

  const legacyScores = loadLegacySavedBestScores();
  if (Object.keys(legacyScores).length === 0) {
    return;
  }

  scoreStoreByProfile[defaultProfileId] = legacyScores;
  persistScoreStoreByProfile();

  try {
    localStorage.removeItem(LEGACY_SCORE_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures.
  }
}

function loadScoresForProfile(profileId) {
  if (!profileId) {
    return {};
  }

  return { ...sanitizeScoreMap(scoreStoreByProfile[profileId]) };
}

function persistScoreStoreByProfile() {
  try {
    localStorage.setItem(
      PROFILE_SCORE_STORAGE_KEY,
      JSON.stringify(scoreStoreByProfile),
    );
  } catch {
    // Ignore storage failures (private mode, quota, blocked storage).
  }
}

function persistSavedBestScores() {
  if (!activeProfileId) {
    return;
  }

  scoreStoreByProfile[activeProfileId] = { ...savedBestByGame };
  persistScoreStoreByProfile();
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
      bestEl.textContent = `Saved best: ${formatMetric(gameId, metric)}`;
      bestEl.classList.remove("is-empty");
      continue;
    }

    bestEl.textContent = "Saved best: -";
    bestEl.classList.add("is-empty");
  }
}

function startGamepadPolling() {
  if (typeof requestAnimationFrame !== "function") {
    return;
  }

  resetGamepadStates();

  const loop = (timestamp) => {
    pollGamepadFrame(timestamp);
    gamepadAnimationFrame = requestAnimationFrame(loop);
  };

  gamepadAnimationFrame = requestAnimationFrame(loop);
}

function pollGamepadFrame(timestamp) {
  if (!activeGame || typeof navigator.getGamepads !== "function") {
    resetGamepadStates();
    return;
  }

  const gamepad = getPrimaryGamepad();
  if (!gamepad) {
    resetGamepadStates();
    return;
  }

  const actions = collectGamepadActions(gamepad);
  let changed = false;

  changed = handleGamepadEdgeActions(actions.edgeActions) || changed;
  changed = handleGamepadControlActions(actions.controlActions, timestamp) || changed;

  if (changed && activeGame) {
    drawFrame();
  }
}

function getPrimaryGamepad() {
  const pads = navigator.getGamepads();
  if (!pads) {
    return null;
  }

  for (const pad of pads) {
    if (pad && pad.connected) {
      return pad;
    }
  }

  return null;
}

function collectGamepadActions(gamepad) {
  const controlActions = new Set();
  const edgeActions = new Set();

  for (const mapping of GAMEPAD_BUTTON_CONTROL_MAP) {
    if (gamepad.buttons[mapping.button]?.pressed) {
      controlActions.add(mapping.action);
    }
  }

  const axisDirections = resolveGamepadAxes(gamepad);
  for (const direction of axisDirections) {
    controlActions.add(direction);
  }

  for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
    if (gamepad.buttons[mapping.button]?.pressed) {
      edgeActions.add(mapping.action);
    }
  }

  return { controlActions, edgeActions };
}

function resolveGamepadAxes(gamepad) {
  const x = gamepad.axes[0] ?? 0;
  const y = gamepad.axes[1] ?? 0;

  const absX = Math.abs(x);
  const absY = Math.abs(y);

  if (absX < GAMEPAD_AXIS_THRESHOLD && absY < GAMEPAD_AXIS_THRESHOLD) {
    return [];
  }

  if (absX >= absY) {
    return [x < 0 ? "LEFT" : "RIGHT"];
  }

  return [y < 0 ? "UP" : "DOWN"];
}

function handleGamepadEdgeActions(edgeActions) {
  let changed = false;

  for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
    const isPressed = edgeActions.has(mapping.action);
    const wasPressed = gamepadEdgeState.get(mapping.action) || false;

    if (isPressed && !wasPressed) {
      if (mapping.action === "BACK" && activeGame) {
        showMenu();
        changed = true;
      } else if (mapping.action === "PAUSE" && activeGame) {
        activeGame.togglePause();
        changed = true;
      } else if (mapping.action === "RESTART" && activeGame) {
        activeGame.restart();
        changed = true;
      }
    }

    gamepadEdgeState.set(mapping.action, isPressed);
  }

  return changed;
}

function handleGamepadControlActions(controlActions, timestamp) {
  let changed = false;

  for (const action of GAMEPAD_CONTROL_ACTIONS) {
    const isPressed = controlActions.has(action);
    const holdState = gamepadControlState.get(action) || {
      pressed: false,
      nextRepeat: 0,
    };

    if (isPressed) {
      if (!holdState.pressed) {
        holdState.pressed = true;
        holdState.nextRepeat = timestamp + GAMEPAD_REPEAT_INITIAL_MS;
        changed = triggerGameControl(action) || changed;
      } else if (timestamp >= holdState.nextRepeat) {
        holdState.nextRepeat = timestamp + GAMEPAD_REPEAT_MS;
        changed = triggerGameControl(action) || changed;
      }
    } else {
      holdState.pressed = false;
      holdState.nextRepeat = 0;
    }

    gamepadControlState.set(action, holdState);
  }

  return changed;
}

function triggerGameControl(action) {
  if (!activeGame) {
    return false;
  }

  return activeGame.onControl(action);
}

function resetGamepadStates() {
  for (const action of GAMEPAD_CONTROL_ACTIONS) {
    gamepadControlState.set(action, { pressed: false, nextRepeat: 0 });
  }

  for (const mapping of GAMEPAD_BUTTON_EDGE_MAP) {
    gamepadEdgeState.set(mapping.action, false);
  }
}
