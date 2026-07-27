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
      if (view) {
        setView(view);
      }
    });
  }

  for (const [name, overlay] of Object.entries(modals)) {
    overlay?.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.closeModal || name;
        if (target === name || target === "play") {
          setView("play");
        }
      });
    });

    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) {
        setView("play");
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && MODAL_VIEWS.has(activeView)) {
      setView("play");
    }
  });

  function syncModalOpenState(viewName) {
    const modalOpen = MODAL_VIEWS.has(viewName);
    document.body.classList.toggle("menu-modal-open", modalOpen);
  }

  function setView(viewName) {
    if (viewName !== "play" && !modals[viewName]) {
      return;
    }

    activeView = viewName;
    document.body.dataset.view = viewName;
    playView?.classList.remove("hidden");

    for (const [name, overlay] of Object.entries(modals)) {
      overlay?.classList.toggle("hidden", name !== viewName);
    }

    for (const button of tabButtons) {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    }

    syncModalOpenState(viewName);

    if (config.onViewChange) {
      config.onViewChange(viewName);
    }
  }

  function closeModals() {
    setView("play");
  }

  setView(activeView);

  return {
    setView,
    closeModals,
    getActiveView: () => activeView,
  };
}
