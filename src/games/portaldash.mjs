import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDot } from "./shared.mjs";

const GRID = 12;
const CELL = CANVAS_SIZE / GRID;

const DIRS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export function createPortalDashGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    const gems = [];
    for (let i = 0; i < 5; i += 1) {
      gems.push(randomCell());
    }

    return {
      status: "running",
      level: 1,
      score: 0,
      player: { x: 1, y: 1 },
      exit: { x: GRID - 2, y: GRID - 2 },
      gems,
      hazards: createHazards(1),
      portals: [
        { x: 2, y: GRID - 3 },
        { x: GRID - 3, y: 2 },
      ],
      message: "Collect all gems",
    };
  }

  function randomCell() {
    return {
      x: 1 + Math.floor(Math.random() * (GRID - 2)),
      y: 1 + Math.floor(Math.random() * (GRID - 2)),
    };
  }

  function createHazards(level) {
    const hazards = [];
    for (let i = 0; i < 2 + level; i += 1) {
      hazards.push({
        x: 2 + Math.floor(Math.random() * (GRID - 4)),
        y: 2 + Math.floor(Math.random() * (GRID - 4)),
        vx: Math.random() > 0.5 ? 1 : -1,
        vy: Math.random() > 0.5 ? 1 : -1,
      });
    }
    return hazards;
  }

  function same(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function movePlayer(direction) {
    if (state.status !== "running") {
      return false;
    }

    const step = DIRS[direction];
    if (!step) {
      return false;
    }

    const nx = Math.max(1, Math.min(GRID - 2, state.player.x + step.x));
    const ny = Math.max(1, Math.min(GRID - 2, state.player.y + step.y));
    state.player = { x: nx, y: ny };

    for (let i = state.gems.length - 1; i >= 0; i -= 1) {
      if (same(state.player, state.gems[i])) {
        state.gems.splice(i, 1);
        state.score += 20;
        state.message = "Gem collected";
      }
    }

    if (same(state.player, state.portals[0])) {
      state.player = { ...state.portals[1] };
      state.message = "Warped";
    } else if (same(state.player, state.portals[1])) {
      state.player = { ...state.portals[0] };
      state.message = "Warped";
    }

    if (state.gems.length === 0 && same(state.player, state.exit)) {
      state.level += 1;
      state.score += 90;
      state.gems = [];
      for (let i = 0; i < 5 + Math.min(3, state.level); i += 1) {
        state.gems.push(randomCell());
      }
      state.hazards = createHazards(state.level);
      state.player = { x: 1, y: 1 };
      state.message = `Level ${state.level}`;
    }

    if (state.score > bestScore) {
      bestScore = state.score;
    }

    return true;
  }

  function checkHit() {
    for (const hazard of state.hazards) {
      if (same(hazard, state.player)) {
        state.status = "game_over";
        state.message = "Caught by anomaly";
      }
    }
  }

  return {
    title: "Portal Dash",
    controlScheme: "dpad",
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      if (state.status !== "running") {
        return;
      }

      for (const hazard of state.hazards) {
        hazard.x += hazard.vx;
        hazard.y += hazard.vy;
        if (hazard.x <= 1 || hazard.x >= GRID - 2) {
          hazard.vx *= -1;
          hazard.x += hazard.vx;
        }
        if (hazard.y <= 1 || hazard.y >= GRID - 2) {
          hazard.vy *= -1;
          hazard.y += hazard.vy;
        }
      }

      checkHit();
    },
    render() {
      clearCanvas(ctx, "#0b1020");

      for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
          ctx.fillStyle = x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1 ? "#273449" : "#111827";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(state.exit.x * CELL + 8, state.exit.y * CELL + 8, CELL - 16, CELL - 16);

      ctx.fillStyle = "#a855f7";
      drawDot(ctx, state.portals[0].x * CELL + CELL / 2, state.portals[0].y * CELL + CELL / 2, CELL * 0.28);
      drawDot(ctx, state.portals[1].x * CELL + CELL / 2, state.portals[1].y * CELL + CELL / 2, CELL * 0.28);

      ctx.fillStyle = "#22d3ee";
      for (const gem of state.gems) {
        drawDot(ctx, gem.x * CELL + CELL / 2, gem.y * CELL + CELL / 2, CELL * 0.16);
      }

      ctx.fillStyle = "#ef4444";
      for (const hazard of state.hazards) {
        drawDot(ctx, hazard.x * CELL + CELL / 2, hazard.y * CELL + CELL / 2, CELL * 0.22);
      }

      ctx.fillStyle = "#f4d20b";
      drawDot(ctx, state.player.x * CELL + CELL / 2, state.player.y * CELL + CELL / 2, CELL * 0.24);
    },
    onKeyDown(keyText) {
      const key = String(keyText).toLowerCase();
      if (key === " ") {
        this.togglePause();
        return true;
      }
      if (key === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }
      const direction = directionFromKey(keyText);
      if (direction) {
        return movePlayer(direction);
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return movePlayer(action);
      }
      return false;
    },
    togglePause() {
      if (state.status === "game_over") {
        return;
      }
      state.status = state.status === "paused" ? "running" : "paused";
    },
    restart() {
      state = createState();
    },
    getTickMs() {
      return 140;
    },
    getHud() {
      const scoreLine = `Score: ${state.score} | Level: ${state.level} | Gems left: ${state.gems.length} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Anomaly got you. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: scoreLine,
        status: `${state.message}. Grab all gems, then reach exit.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
