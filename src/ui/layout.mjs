export const CLASSIC_GAME_IDS = [
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
  "labyrinth",
  "grannyrun",
  "cloverquest",
  "afterhours",
];

export const GAME_LABELS = {
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
  labyrinth: "Labyrinth Heist",
  grannyrun: "Granny Rooftop",
  cloverquest: "Clover Quest",
  afterhours: "After Hours Arcade",
};

const MODAL_VIEWS = new Set(["rankings", "stats", "settings"]);

export function createLayoutManager(config = {}) {
  const tabButtons = [...(config.tabButtons || [])];
  const playView = config.playView || null;
  const modals = config.modals || {};
  let activeView = "play";

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (!view) {
        return;
      }

      // Tap the open modal tab again to close it.
      if (view === activeView && MODAL_VIEWS.has(view)) {
        closeModals();
        return;
      }

      setView(view);
    });
  }

  for (const [name, overlay] of Object.entries(modals)) {
    overlay?.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModals();
      });
    });

    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModals();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && MODAL_VIEWS.has(activeView)) {
      closeModals();
    }
  });

  function syncModalOpenState(viewName) {
    document.body.classList.toggle("menu-modal-open", MODAL_VIEWS.has(viewName));
  }

  function syncTabActiveState(viewName) {
    for (const button of tabButtons) {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    }
  }

  function hideAllModals() {
    for (const overlay of Object.values(modals)) {
      overlay?.classList.add("hidden");
    }
  }

  function setView(viewName) {
    if (!MODAL_VIEWS.has(viewName) && viewName !== "play") {
      return;
    }

    activeView = viewName;
    document.body.dataset.view = viewName;

    // Never force the play list visible while a game is open.
    if (viewName === "play" && document.body.dataset.panel !== "game") {
      playView?.classList.remove("hidden");
    }

    hideAllModals();
    if (MODAL_VIEWS.has(viewName)) {
      modals[viewName]?.classList.remove("hidden");
    }

    syncTabActiveState(MODAL_VIEWS.has(viewName) ? viewName : "");
    syncModalOpenState(viewName);

    if (config.onViewChange) {
      config.onViewChange(viewName);
    }
  }

  function closeModals() {
    const wasModal = MODAL_VIEWS.has(activeView);
    activeView = "play";
    document.body.dataset.view = "play";
    hideAllModals();
    syncTabActiveState("");
    syncModalOpenState("play");

    if (wasModal && config.onViewChange) {
      config.onViewChange("play");
    }
  }

  setView("play");

  return {
    setView,
    closeModals,
    getActiveView: () => activeView,
  };
}
