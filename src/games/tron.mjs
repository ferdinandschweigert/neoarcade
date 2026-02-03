import { directionFromKey } from "../gameLogic.mjs";
import {
  CANVAS_SIZE,
  drawDot,
  drawDiamond,
  drawGrid,
  clearCanvas,
  rectsOverlap,
  clamp,
} from "./shared.mjs";

export function createTronGame(ctx) {
  const gridSize = 32;
  const cell = CANVAS_SIZE / gridSize;
  const vectors = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };
  const opposite = {
    UP: "DOWN",
    DOWN: "UP",
    LEFT: "RIGHT",
    RIGHT: "LEFT",
  };

  let bestScore = 0;
  let state = createState();

  function key(x, y) {
    return `${x},${y}`;
  }

  function createState() {
    const trails = new Map();
    trails.set(key(5, 16), "player");
    trails.set(key(26, 16), "cpu");

    return {
      status: "running",
      player: {
        x: 5,
        y: 16,
        direction: "RIGHT",
        nextDirection: "RIGHT",
      },
      cpu: {
        x: 26,
        y: 16,
        direction: "LEFT",
        nextDirection: "LEFT",
      },
      trails,
      score: 0,
      winner: null,
    };
  }

  function isBlocked(x, y) {
    return x < 0 || y < 0 || x >= gridSize || y >= gridSize || state.trails.has(key(x, y));
  }

  function nextPosition(entity, direction) {
    const vector = vectors[direction];
    return {
      x: entity.x + vector.x,
      y: entity.y + vector.y,
    };
  }

  function chooseCpuDirection() {
    const options = [];

    for (const direction of Object.keys(vectors)) {
      if (direction === opposite[state.cpu.direction]) {
        continue;
      }

      const candidate = nextPosition(state.cpu, direction);
      if (isBlocked(candidate.x, candidate.y)) {
        continue;
      }

      const distance =
        Math.abs(candidate.x - state.player.x) + Math.abs(candidate.y - state.player.y);
      options.push({ direction, distance });
    }

    if (options.length === 0) {
      return state.cpu.direction;
    }

    options.sort((a, b) => a.distance - b.distance);

    if (Math.random() < 0.68) {
      return options[0].direction;
    }

    return options[Math.floor(Math.random() * options.length)].direction;
  }

  return {
    title: "Tron Trail",
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

      if (state.player.nextDirection !== opposite[state.player.direction]) {
        state.player.direction = state.player.nextDirection;
      }

      state.cpu.nextDirection = chooseCpuDirection();
      if (state.cpu.nextDirection !== opposite[state.cpu.direction]) {
        state.cpu.direction = state.cpu.nextDirection;
      }

      const nextPlayer = nextPosition(state.player, state.player.direction);
      const nextCpu = nextPosition(state.cpu, state.cpu.direction);

      let playerCrash = isBlocked(nextPlayer.x, nextPlayer.y);
      let cpuCrash = isBlocked(nextCpu.x, nextCpu.y);

      const sameCell = nextPlayer.x === nextCpu.x && nextPlayer.y === nextCpu.y;
      const crossPath =
        nextPlayer.x === state.cpu.x &&
        nextPlayer.y === state.cpu.y &&
        nextCpu.x === state.player.x &&
        nextCpu.y === state.player.y;

      if (sameCell || crossPath) {
        playerCrash = true;
        cpuCrash = true;
      }

      if (playerCrash || cpuCrash) {
        state.status = "game_over";
        if (playerCrash && cpuCrash) {
          state.winner = "draw";
        } else if (playerCrash) {
          state.winner = "cpu";
        } else {
          state.winner = "player";
        }
        return;
      }

      state.player.x = nextPlayer.x;
      state.player.y = nextPlayer.y;
      state.cpu.x = nextCpu.x;
      state.cpu.y = nextCpu.y;

      state.trails.set(key(state.player.x, state.player.y), "player");
      state.trails.set(key(state.cpu.x, state.cpu.y), "cpu");

      state.score += 1;
      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#0f1318");

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let line = 1; line < gridSize; line += 1) {
        const offset = line * cell;
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(CANVAS_SIZE, offset);
        ctx.stroke();
      }

      for (const [keyText, owner] of state.trails.entries()) {
        const [xText, yText] = keyText.split(",");
        const x = Number(xText);
        const y = Number(yText);
        ctx.fillStyle = owner === "player" ? "#2f7bff" : "#e95e4c";
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }

      ctx.fillStyle = "#f7f9fc";
      drawDot(
        ctx,
        state.player.x * cell + cell / 2,
        state.player.y * cell + cell / 2,
        Math.max(4, cell * 0.35),
      );

      ctx.fillStyle = "#111";
      drawDot(
        ctx,
        state.cpu.x * cell + cell / 2,
        state.cpu.y * cell + cell / 2,
        Math.max(4, cell * 0.35),
      );
    },
    onKeyDown(keyText) {
      const normalized = String(keyText).toLowerCase();

      if (normalized === " ") {
        this.togglePause();
        return true;
      }

      if (normalized === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }

      const direction = directionFromKey(keyText);
      if (!direction) {
        return false;
      }

      state.player.nextDirection = direction;
      return true;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return false;
      }

      state.player.nextDirection = action;
      return true;
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
      return 92;
    },
    getHud() {
      if (state.status === "game_over") {
        const outcomeMap = {
          player: "You win",
          cpu: "CPU wins",
          draw: "Draw",
        };

        return {
          score: `Survival: ${state.score} | Best: ${bestScore}`,
          status: `${outcomeMap[state.winner] || "Round over"}. Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Survival: ${state.score} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Survival: ${state.score} | Best: ${bestScore}`,
        status: "Steer with Arrow keys or WASD. Don't hit trails.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
