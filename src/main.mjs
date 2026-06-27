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
import { createCheckersGame } from "./games/checkers.mjs";
import { createCircuitSiegeGame } from "./games/circuitsiege.mjs";
import {
  CLOUD_CONNECT_DEBOUNCE_MS,
  CLOUD_PULL_INTERVAL_MS,
  CLOUD_SYNC_DEBOUNCE_MS,
  clearPendingCloudSnapshot,
  describeCloudError,
  fetchCloudSnapshot,
  loadPendingCloudSnapshot,
  mergeCloudSnapshots,
  putCloudSnapshot,
  sanitizeCloudSnapshot,
  sanitizeCloudCode,
  sanitizeProfileName,
  sanitizeProfilesArray,
  sanitizeScoreStoreByProfile,
  savePendingCloudSnapshot,
} from "./cloudSync.mjs";
import { createInputManager } from "./input.mjs";
import { createFeedbackUI } from "./ui/feedback.mjs";
import { createResponsiveLayout } from "./ui/responsive.mjs";
import {
  safeStorageGet,
  safeStorageGetJson,
  safeStorageRemove,
  safeStorageSet,
  safeStorageSetJson,
  setStorageErrorHandler,
  STORAGE_KEYS,
} from "./storage.mjs";

const LEGACY_SCORE_STORAGE_KEY = STORAGE_KEYS.LEGACY_SCORE;
const PROFILE_STORAGE_KEY = STORAGE_KEYS.PROFILES;
const PROFILE_SCORE_STORAGE_KEY = STORAGE_KEYS.PROFILE_SCORES;
const ACTIVE_PROFILE_STORAGE_KEY = STORAGE_KEYS.ACTIVE_PROFILE;
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
const DIFFICULTY_STORAGE_KEY = STORAGE_KEYS.DIFFICULTY;
const DIFFICULTY_OPTIONS = new Set(["easy", "normal", "hard"]);
const CLOUD_CODE_STORAGE_KEY = STORAGE_KEYS.CLOUD_CODE;
const CONTROL_MODE_OPTIONS = new Set(["auto", "both", "buttons", "gestures"]);
const SWIPE_SENSITIVITY_PRESETS = {
  normal: 24,
  sensitive: 16,
  precise: 32,
};
const LONG_PRESS_PRESETS = {
  normal: 320,
  fast: 250,
  slow: 400,
};
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

const profileGateEl = document.querySelector("#profile-gate");
const profileListEl = document.querySelector("#profile-list");
const profileFormEl = document.querySelector("#profile-form");
const profileNameInputEl = document.querySelector("#profile-name-input");
const profileMessageEl = document.querySelector("#profile-message");
const activeProfileNameEl = document.querySelector("#active-profile-name");
const switchProfileButton = document.querySelector("#switch-profile-button");
const difficultySelectEl = document.querySelector("#difficulty-select");
const cloudCodeInputEl = document.querySelector("#cloud-code-input");
const cloudStatusEl = document.querySelector("#cloud-status");
const cloudPanelEl = document.querySelector("#cloud-panel");
const cloudToastEl = document.querySelector("#cloud-toast");
const appStatusEl = document.querySelector("#app-status");
const gameSearchInputEl = document.querySelector("#game-search-input");
const gameListEmptyEl = document.querySelector("#game-list-empty");
const recentGamesEl = document.querySelector("#recent-games");
const recentGamesListEl = document.querySelector("#recent-games-list");
const gameCountLabelEl = document.querySelector("#game-count-label");
const controlModeSelectEl = document.querySelector("#control-mode-select");
const activeProfileDotEl = document.querySelector("#active-profile-dot");
const bestHudEl = document.querySelector("#best-hud");
const controlsHelpButton = document.querySelector("#controls-help-button");
const controlsOverlayEl = document.querySelector("#controls-overlay");
const controlsOverlayHintEl = document.querySelector("#controls-overlay-hint");
const controlsOverlayDismissEl = document.querySelector("#controls-overlay-dismiss");
const controlsGameHintEl = document.querySelector("#controls-game-hint");

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

const responsiveLayout = createResponsiveLayout({
  container: document.querySelector(".app"),
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
  checkers: createCheckersGame(context),
  circuitsiege: createCircuitSiegeGame(context),
};
const GAME_COUNT = Object.keys(games).length;
const gameCardBestEls = new Map();

const { setAppStatus, updateCloudStatus, showCloudToast } = createFeedbackUI({
  appStatusEl,
  cloudStatusEl,
  cloudToastEl,
});

const inputManager = createInputManager({
  canvas: stageCanvas,
  touchControlsEl,
  isTouchDevice,
  getActiveGame: () => activeGame,
  getControlMode: () => controlMode,
  getSwipeMinDistance: () => SWIPE_SENSITIVITY_PRESETS[swipeSensitivity] ?? 24,
  getLongPressMs: () => LONG_PRESS_PRESETS[longPressPreset] ?? 320,
  onControlApplied: () => drawFrame(),
  onBack: () => showMenu(),
  onPause: () => activeGame?.togglePause?.(),
  onRestart: () => activeGame?.restart?.(),
  onGamepadConnected: () => setAppStatus("Gamepad connected.", false, 3000),
});

setStorageErrorHandler((message) => {
  setAppStatus(message, true);
  setProfileMessage(message, true);
});

if (gameCountLabelEl) {
  gameCountLabelEl.textContent = `${GAME_COUNT} Playable Games`;
}

let activeGame = null;
let activeGameId = null;
let tickTimer = null;
let activeFilter = "all";
let profiles = [];
let scoreStoreByProfile = {};
let activeProfile = null;
let activeProfileId = null;
let activeDifficulty = loadDifficultySetting();
let savedBestByGame = {};
let cloudCode = loadCloudCode();
let cloudSyncEnabled = false;
let cloudSyncTimer = null;
let cloudConnectTimer = null;
let cloudPullTimer = null;
let cloudSyncInFlight = false;
let cloudSyncQueued = false;
let suppressCloudSync = false;
let loopPausedForVisibility = false;
let lastFocusedGameCard = null;
let activeSearchQuery = "";
let controlMode = loadControlModeSetting();
let swipeSensitivity = loadSwipeSensitivitySetting();
let longPressPreset = loadLongPressPresetSetting();

for (const gameButton of gameButtons) {
  gameButton.addEventListener("click", () => {
    const gameId = gameButton.dataset.game;
    if (games[gameId]) {
      lastFocusedGameCard = gameButton;
      startGame(gameId);
    }
  });
}

if (gameSearchInputEl instanceof HTMLInputElement) {
  let searchTimer = null;
  gameSearchInputEl.addEventListener("input", () => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      activeSearchQuery = gameSearchInputEl.value.trim().toLowerCase();
      applyGameFilter();
    }, 150);
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

  if (cloudSyncEnabled) {
    void pullCloudSnapshot();
    void flushPendingCloudSnapshot();
  }
});

window.addEventListener("online", () => {
  if (cloudCode) {
    void connectCloudSync(true);
  }
});

applyGameFilter();
initializeGameCardBestLabels();
initializeProfiles();
initializeCloudSync();
renderRecentGames();
inputManager.startGamepadPolling();

function getPrimaryGamepadExists() {
  if (typeof navigator.getGamepads !== "function") {
    return false;
  }

  const pads = navigator.getGamepads();
  return Boolean(pads && Array.from(pads).some((pad) => pad && pad.connected));
}

function startGame(gameId) {
  if (!activeProfileId) {
    showProfileGate("Choose a profile first.");
    return;
  }

  stopLoop();
  inputManager.resetGamepadStates();

  activeGameId = gameId;
  activeGame = games[gameId];
  applyDifficultyToGame(activeGame);
  recordRecentGame(gameId);

  if (profileGateEl) {
    profileGateEl.classList.add("hidden");
  }
  menuEl.classList.add("hidden");
  gameScreenEl.classList.remove("hidden");

  gameTitleEl.textContent = activeGame.title;
  inputManager.renderTouchControls(activeGame.controlScheme);
  updateControlsHints();

  activeGame.start();
  drawFrame();
  scheduleTick();

  if (controlsGameHintEl) {
    controlsGameHintEl.textContent = inputManager.getControlHintForGame(activeGame);
  }

  if (isTouchDevice && !hasSeenControlsHint()) {
    showControlsOverlay(true);
  }

  stageCanvas.focus();
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

if (cloudCodeInputEl instanceof HTMLInputElement) {
  cloudCodeInputEl.addEventListener("input", () => {
    const sanitized = sanitizeCloudCode(cloudCodeInputEl.value);
    if (cloudCodeInputEl.value !== sanitized) {
      cloudCodeInputEl.value = sanitized;
    }

    cloudCode = sanitized;
    persistCloudCode();

    if (!cloudCode) {
      cloudSyncEnabled = false;
      stopCloudPullLoop();
      updateCloudStatus("Local only", "off");
      return;
    }

    updateCloudStatus("Syncing…", "syncing");
    scheduleCloudConnect();
  });

  cloudCodeInputEl.addEventListener("blur", () => {
    if (!cloudCode) {
      return;
    }

    void connectCloudSync(true);
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

    const selectEl = target.closest(".profile-select-button");
    if (!(selectEl instanceof HTMLButtonElement)) {
      return;
    }

    const profileId = selectEl.dataset.profileId;
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

function showMenu() {
  stopLoop();
  inputManager.resetGamepadStates();
  inputManager.stopTouchHold();
  hideControlsOverlay(false);

  if (activeGame) {
    activeGame.stop();
    void pushCloudSnapshot({ announce: false });
  }

  activeGame = null;
  activeGameId = null;

  if (profileGateEl) {
    profileGateEl.classList.add("hidden");
  }
  menuEl.classList.remove("hidden");
  gameScreenEl.classList.add("hidden");

  clearCanvas(context);

  if (lastFocusedGameCard instanceof HTMLElement) {
    lastFocusedGameCard.focus();
  }
}

function applyGameFilter() {
  let visibleCount = 0;

  for (const filterButton of filterButtons) {
    const filter = filterButton.dataset.filter || "all";
    filterButton.classList.toggle("is-active", filter === activeFilter);
  }

  for (const card of gameCards) {
    const categories = String(card.dataset.category || "")
      .split(" ")
      .filter(Boolean);

    const matchesCategory =
      activeFilter === "all" || categories.includes(activeFilter);

    const title = card.querySelector(".game-card-title")?.textContent || "";
    const subtitle = card.querySelector(".game-card-subtitle")?.textContent || "";
    const haystack = `${title} ${subtitle}`.toLowerCase();
    const matchesSearch =
      !activeSearchQuery || haystack.includes(activeSearchQuery);

    const visible = matchesCategory && matchesSearch;
    card.classList.toggle("is-hidden", !visible);

    const gameId = card.dataset.game;
    const metric = gameId ? savedBestByGame[gameId] : null;
    const bestLabel = Number.isFinite(metric)
      ? `, saved best ${formatMetric(gameId, metric)}`
      : "";
    card.setAttribute(
      "aria-label",
      `${title}${bestLabel}. ${subtitle}`.trim(),
    );

    if (visible) {
      visibleCount += 1;
    }
  }

  if (gameListEmptyEl) {
    gameListEmptyEl.classList.toggle("hidden", visibleCount > 0);
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

function initializeCloudSync() {
  if (cloudCodeInputEl instanceof HTMLInputElement) {
    cloudCodeInputEl.value = cloudCode || "";
  }

  if (!cloudCode) {
    cloudSyncEnabled = false;
    updateCloudStatus("Local only", "off");
    return;
  }

  updateCloudStatus("Syncing…", "syncing");
  void connectCloudSync(true);
}

async function connectCloudSync(silent = false) {
  const draftCode = sanitizeCloudCode(
    cloudCodeInputEl instanceof HTMLInputElement
      ? cloudCodeInputEl.value
      : cloudCode,
  );

  if (cloudCodeInputEl instanceof HTMLInputElement) {
    cloudCodeInputEl.value = draftCode;
  }

  if (!draftCode) {
    cloudCode = "";
    cloudSyncEnabled = false;
    persistCloudCode();
    stopCloudPullLoop();
    updateCloudStatus("Local only", "off");
    return;
  }

  cloudCode = draftCode;
  persistCloudCode();

  if (cloudPanelEl instanceof HTMLDetailsElement && !cloudPanelEl.open) {
    cloudPanelEl.open = true;
  }

  if (!silent) {
    updateCloudStatus("Syncing…", "syncing");
  }

  try {
    const remoteSnapshot = await fetchCloudSnapshot(cloudCode);
    cloudSyncEnabled = true;

    if (remoteSnapshot) {
      applyCloudSnapshot(remoteSnapshot);
    }

    await pushCloudSnapshot({ announce: !silent });
    await flushPendingCloudSnapshot();
    startCloudPullLoop();
    updateCloudStatus("Synced", "synced");
    if (!silent) {
      showCloudToast("Cloud sync connected.");
    }
  } catch (error) {
    cloudSyncEnabled = false;
    stopCloudPullLoop();
    updateCloudStatus(describeCloudError(error), "error");
  }
}

function scheduleCloudConnect() {
  if (cloudConnectTimer) {
    clearTimeout(cloudConnectTimer);
  }

  cloudConnectTimer = setTimeout(() => {
    cloudConnectTimer = null;
    void connectCloudSync(true);
  }, CLOUD_CONNECT_DEBOUNCE_MS);
}

function startCloudPullLoop() {
  if (cloudPullTimer) {
    return;
  }

  cloudPullTimer = setInterval(() => {
    void pullCloudSnapshot();
  }, CLOUD_PULL_INTERVAL_MS);
}

function stopCloudPullLoop() {
  if (!cloudPullTimer) {
    return;
  }

  clearInterval(cloudPullTimer);
  cloudPullTimer = null;
}

async function pullCloudSnapshot() {
  if (!cloudSyncEnabled || !cloudCode || cloudSyncInFlight) {
    return false;
  }

  cloudSyncInFlight = true;

  try {
    const snapshot = await fetchCloudSnapshot(cloudCode);
    if (snapshot) {
      applyCloudSnapshot(snapshot);
    }
    return true;
  } catch (error) {
    updateCloudStatus(describeCloudError(error), "error");
    return false;
  } finally {
    cloudSyncInFlight = false;

    if (cloudSyncQueued) {
      cloudSyncQueued = false;
      void pushCloudSnapshot({ announce: false });
    }
  }
}

function scheduleCloudSync() {
  if (!cloudSyncEnabled || !cloudCode || suppressCloudSync) {
    return;
  }

  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
  }

  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    void pushCloudSnapshot({ announce: false });
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

async function pushCloudSnapshot({ announce = false } = {}) {
  if (!cloudSyncEnabled || !cloudCode) {
    return false;
  }

  if (cloudSyncInFlight) {
    cloudSyncQueued = true;
    return false;
  }

  cloudSyncInFlight = true;
  if (announce) {
    updateCloudStatus("Syncing…", "syncing");
  }

  let succeeded = false;

  try {
    let snapshot = buildCloudSnapshot();
    const remoteSnapshot = await fetchCloudSnapshot(cloudCode);
    if (remoteSnapshot) {
      snapshot = mergeCloudSnapshots(snapshot, remoteSnapshot, {
        difficultyOptions: DIFFICULTY_OPTIONS,
        profileColors: PROFILE_COLORS,
        maxProfiles: MAX_PROFILES,
        lowerIsBetterGames: LOWER_IS_BETTER_GAMES,
      });
    }

    await putCloudSnapshot(cloudCode, snapshot);
    clearPendingCloudSnapshot();
    succeeded = true;

    if (announce) {
      updateCloudStatus("Synced", "synced");
    } else {
      updateCloudStatus("Synced", "synced");
    }
  } catch (error) {
    savePendingCloudSnapshot(buildCloudSnapshot());
    updateCloudStatus(describeCloudError(error), "pending");
    succeeded = false;
  } finally {
    cloudSyncInFlight = false;

    if (cloudSyncQueued) {
      cloudSyncQueued = false;
      void pushCloudSnapshot({ announce: false });
    }
  }

  return succeeded;
}

async function flushPendingCloudSnapshot() {
  const pending = loadPendingCloudSnapshot();
  if (!pending?.snapshot || !cloudSyncEnabled || !cloudCode) {
    return false;
  }

  try {
    await putCloudSnapshot(cloudCode, pending.snapshot);
    clearPendingCloudSnapshot();
    updateCloudStatus("Synced", "synced");
    return true;
  } catch {
    updateCloudStatus("Pending upload", "pending");
    return false;
  }
}

function buildCloudSnapshot() {
  return {
    version: 1,
    profiles,
    scoreStoreByProfile,
    activeProfileId,
    activeDifficulty,
    updatedAt: new Date().toISOString(),
  };
}

function applyCloudSnapshot(snapshot) {
  const sanitized = sanitizeCloudSnapshot(
    snapshot,
    DIFFICULTY_OPTIONS,
    PROFILE_COLORS,
    MAX_PROFILES,
  );
  if (!sanitized) {
    return;
  }

  const localSnapshot = buildCloudSnapshot();
  const merged = mergeCloudSnapshots(localSnapshot, {
    ...sanitized,
    scoreStoreByProfile: sanitized.scoreStoreByProfile,
    profiles: sanitized.profiles,
    updatedAt: sanitized.updatedAt || snapshot.updatedAt,
  }, {
    difficultyOptions: DIFFICULTY_OPTIONS,
    profileColors: PROFILE_COLORS,
    maxProfiles: MAX_PROFILES,
    lowerIsBetterGames: LOWER_IS_BETTER_GAMES,
  });

  if (merged.profiles.length === 0) {
    return;
  }

  suppressCloudSync = true;
  try {
    profiles = merged.profiles;
    scoreStoreByProfile = merged.scoreStoreByProfile;

    persistProfiles();
    persistScoreStoreByProfile();

    const preferredProfile =
      merged.profiles.find((profile) => profile.id === merged.activeProfileId) ||
      merged.profiles.find((profile) => profile.id === activeProfileId) ||
      merged.profiles[0];

    setActiveProfile(preferredProfile.id, true);

    if (merged.activeDifficulty) {
      setActiveDifficulty(merged.activeDifficulty, true);
    }
  } finally {
    suppressCloudSync = false;
  }

  renderProfileCards();
  refreshGameCardBestLabels();
  applyGameFilter();
  if (activeGame) {
    drawFrame();
  }
}

function loadCloudCode() {
  return sanitizeCloudCode(safeStorageGet(CLOUD_CODE_STORAGE_KEY));
}

function persistCloudCode() {
  if (cloudCode) {
    safeStorageSet(CLOUD_CODE_STORAGE_KEY, cloudCode);
  } else {
    safeStorageRemove(CLOUD_CODE_STORAGE_KEY);
  }
}

function loadControlModeSetting() {
  const raw = String(safeStorageGet(STORAGE_KEYS.CONTROL_MODE) || "auto").toLowerCase();
  return CONTROL_MODE_OPTIONS.has(raw) ? raw : "auto";
}

function persistControlModeSetting() {
  safeStorageSet(STORAGE_KEYS.CONTROL_MODE, controlMode);
}

function loadSwipeSensitivitySetting() {
  const raw = String(safeStorageGet(STORAGE_KEYS.SWIPE_SENSITIVITY) || "normal").toLowerCase();
  return raw in SWIPE_SENSITIVITY_PRESETS ? raw : "normal";
}

function loadLongPressPresetSetting() {
  const raw = String(safeStorageGet(STORAGE_KEYS.LONG_PRESS) || "normal").toLowerCase();
  return raw in LONG_PRESS_PRESETS ? raw : "normal";
}

function hasSeenControlsHint() {
  return safeStorageGet(STORAGE_KEYS.CONTROLS_HINT) === "seen";
}

function markControlsHintSeen() {
  safeStorageSet(STORAGE_KEYS.CONTROLS_HINT, "seen");
}

function showControlsOverlay(isFirstRun) {
  if (!controlsOverlayEl) {
    return;
  }

  if (controlsOverlayHintEl && activeGame) {
    controlsOverlayHintEl.textContent = inputManager.getControlHintForGame(activeGame);
  }

  controlsOverlayEl.classList.remove("hidden");
  if (isFirstRun) {
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
    chip.textContent = game.title;
    chip.addEventListener("click", () => {
      startGame(gameId);
    });
    recentGamesListEl.appendChild(chip);
  }
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

function renderProfileCards() {
  if (!profileListEl) {
    return;
  }

  profileListEl.innerHTML = "";

  for (const profile of profiles) {
    const cardEl = document.createElement("div");
    cardEl.className = "profile-card";
    cardEl.dataset.profileId = profile.id;
    cardEl.setAttribute("role", "listitem");

    if (profile.id === activeProfileId) {
      cardEl.classList.add("is-active");
      cardEl.setAttribute("aria-current", "true");
    }

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "profile-select-button";
    selectButton.dataset.profileId = profile.id;

    const avatarEl = document.createElement("span");
    avatarEl.className = "profile-avatar";
    avatarEl.style.setProperty("--profile-color", profile.color);
    avatarEl.textContent = profile.name.charAt(0).toUpperCase();

    const nameEl = document.createElement("span");
    nameEl.className = "profile-name";
    nameEl.textContent = profile.name;

    selectButton.appendChild(avatarEl);
    selectButton.appendChild(nameEl);

    const actionsEl = document.createElement("div");
    actionsEl.className = "profile-actions";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "profile-action-button";
    renameButton.textContent = "Rename";
    renameButton.addEventListener("click", () => {
      renameProfile(profile.id);
    });

    actionsEl.appendChild(renameButton);

    if (profile.id !== activeProfileId) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "profile-action-button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        deleteProfile(profile.id);
      });
      actionsEl.appendChild(deleteButton);
    }

    cardEl.appendChild(selectButton);
    cardEl.appendChild(actionsEl);
    profileListEl.appendChild(cardEl);
  }
}

function renameProfile(profileId) {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  const nextName = sanitizeProfileName(
    window.prompt("Rename profile", profile.name) || "",
  );
  if (!nextName || nextName === profile.name) {
    return;
  }

  const lower = nextName.toLowerCase();
  if (profiles.some((item) => item.id !== profileId && item.name.toLowerCase() === lower)) {
    setProfileMessage("That profile name already exists.", true);
    return;
  }

  profile.name = nextName;
  persistProfiles();
  renderProfileCards();
  if (profile.id === activeProfileId && activeProfileNameEl) {
    activeProfileNameEl.textContent = nextName;
  }
}

function deleteProfile(profileId) {
  if (profileId === activeProfileId) {
    setProfileMessage("Switch to another profile before deleting this one.", true);
    return;
  }

  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  const confirmed = window.confirm(`Delete profile "${profile.name}" and all scores?`);
  if (!confirmed) {
    return;
  }

  profiles = profiles.filter((item) => item.id !== profileId);
  delete scoreStoreByProfile[profileId];
  persistProfiles();
  persistScoreStoreByProfile();
  renderProfileCards();
  setProfileMessage("");
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

  if (activeProfileDotEl) {
    activeProfileDotEl.style.background = activeProfile.color;
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
  inputManager.resetGamepadStates();
  inputManager.stopTouchHold();

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
  const raw = safeStorageGet(DIFFICULTY_STORAGE_KEY);
  const normalized = String(raw || "").toLowerCase();
  return DIFFICULTY_OPTIONS.has(normalized) ? normalized : "normal";
}

function persistDifficultySetting() {
  safeStorageSet(DIFFICULTY_STORAGE_KEY, activeDifficulty);
  scheduleCloudSync();
}

function loadProfiles() {
  const parsed = safeStorageGetJson(PROFILE_STORAGE_KEY, []);
  return sanitizeProfilesArray(parsed, PROFILE_COLORS, MAX_PROFILES);
}

function persistProfiles() {
  safeStorageSetJson(PROFILE_STORAGE_KEY, profiles);
  scheduleCloudSync();
}

function loadActiveProfileId() {
  const raw = safeStorageGet(ACTIVE_PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const profileId = String(raw).trim();
  return profileId || null;
}

function persistActiveProfileId() {
  if (!activeProfileId) {
    return;
  }

  safeStorageSet(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
  scheduleCloudSync();
}

function loadScoreStoreByProfile() {
  const parsed = safeStorageGetJson(PROFILE_SCORE_STORAGE_KEY, {});
  return sanitizeScoreStoreByProfile(parsed);
}

function loadLegacySavedBestScores() {
  const parsed = safeStorageGetJson(LEGACY_SCORE_STORAGE_KEY, {});
  return sanitizeScoreMap(parsed);
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

  safeStorageRemove(LEGACY_SCORE_STORAGE_KEY);
}

function loadScoresForProfile(profileId) {
  if (!profileId) {
    return {};
  }

  return { ...sanitizeScoreMap(scoreStoreByProfile[profileId]) };
}

function persistScoreStoreByProfile() {
  safeStorageSetJson(PROFILE_SCORE_STORAGE_KEY, scoreStoreByProfile);
  scheduleCloudSync();
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
