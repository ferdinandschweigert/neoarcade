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

export function createLayoutManager(config = {}) {
  const tabButtons = config.tabButtons || [];
  const views = config.views || {};
  let activeView = "play";

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view) {
        setView(view);
      }
    });
  }

  function setView(viewName) {
    if (!views[viewName]) {
      return;
    }

    activeView = viewName;
    document.body.dataset.view = viewName;

    for (const [name, element] of Object.entries(views)) {
      element.classList.toggle("hidden", name !== viewName);
    }

    for (const button of tabButtons) {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    }

    if (config.onViewChange) {
      config.onViewChange(viewName);
    }
  }

  setView(activeView);

  return {
    setView,
    getActiveView: () => activeView,
  };
}
