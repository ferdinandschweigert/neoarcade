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

export function createPacmanGame(ctx) {
  const map = [
    "###############",
    "#.............#",
    "#.###.###.###.#",
    "#.............#",
    "#.###.#.#.###.#",
    "#.....#.#.....#",
    "###.#.#.#.#.###",
    "#...#.....#...#",
    "###.#.###.#.###",
    "#.....#.#.....#",
    "#.###.#.#.###.#",
    "#.............#",
    "#.###.###.###.#",
    "#.............#",
    "###############",
  ];

  const gridSize = map.length;
  const directions = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  let bestScore = 0;
  let state = createState();

  function keyOf(position) {
    return `${position.x},${position.y}`;
  }

  function clonePosition(position) {
    return {
      x: position.x,
      y: position.y,
    };
  }

  function createState() {
    const walls = new Set();
    const dots = new Set();

    for (let y = 0; y < map.length; y += 1) {
      for (let x = 0; x < map[y].length; x += 1) {
        const symbol = map[y][x];
        if (symbol === "#") {
          walls.add(`${x},${y}`);
        }

        if (symbol === ".") {
          dots.add(`${x},${y}`);
        }
      }
    }

    const player = { x: 1, y: 1 };
    const ghost = { x: map[0].length - 2, y: map.length - 2 };

    dots.delete(keyOf(player));
    dots.delete(keyOf(ghost));

    return {
      status: "running",
      won: false,
      score: 0,
      walls,
      dots,
      player,
      ghost,
      direction: "RIGHT",
      nextDirection: "RIGHT",
    };
  }

  function canMove(position, direction) {
    const vector = directions[direction];
    const target = {
      x: position.x + vector.x,
      y: position.y + vector.y,
    };

    if (target.x < 0 || target.x >= gridSize || target.y < 0 || target.y >= gridSize) {
      return false;
    }

    return !state.walls.has(keyOf(target));
  }

  function step(position, direction) {
    const vector = directions[direction];
    return {
      x: position.x + vector.x,
      y: position.y + vector.y,
    };
  }

  function moveGhost() {
    const options = [];

    for (const [direction, vector] of Object.entries(directions)) {
      const candidate = {
        x: state.ghost.x + vector.x,
        y: state.ghost.y + vector.y,
      };

      if (
        candidate.x < 0 ||
        candidate.x >= gridSize ||
        candidate.y < 0 ||
        candidate.y >= gridSize ||
        state.walls.has(keyOf(candidate))
      ) {
        continue;
      }

      const distance =
        Math.abs(candidate.x - state.player.x) + Math.abs(candidate.y - state.player.y);
      options.push({
        direction,
        candidate,
        distance,
      });
    }

    if (options.length === 0) {
      return;
    }

    options.sort((a, b) => a.distance - b.distance);

    const nearestDistance = options[0].distance;
    const nearest = options.filter((option) => option.distance === nearestDistance);

    let pick;
    if (Math.random() < 0.75) {
      pick = nearest[Math.floor(Math.random() * nearest.length)];
    } else {
      pick = options[Math.floor(Math.random() * options.length)];
    }

    state.ghost = clonePosition(pick.candidate);
  }

  return {
    title: "Pac-Maze",
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

      if (canMove(state.player, state.nextDirection)) {
        state.direction = state.nextDirection;
      }

      if (canMove(state.player, state.direction)) {
        state.player = step(state.player, state.direction);
      }

      const playerKey = keyOf(state.player);
      if (state.dots.has(playerKey)) {
        state.dots.delete(playerKey);
        state.score += 1;

        if (state.score > bestScore) {
          bestScore = state.score;
        }
      }

      if (state.player.x === state.ghost.x && state.player.y === state.ghost.y) {
        state.status = "game_over";
        state.won = false;
        return;
      }

      moveGhost();

      if (state.player.x === state.ghost.x && state.player.y === state.ghost.y) {
        state.status = "game_over";
        state.won = false;
        return;
      }

      if (state.dots.size === 0) {
        state.status = "game_over";
        state.won = true;
      }
    },
    render() {
      clearCanvas(ctx, "#070f1b");

      const cellSize = CANVAS_SIZE / gridSize;

      ctx.fillStyle = "#1d4ed8";
      for (const wallKey of state.walls) {
        const [xText, yText] = wallKey.split(",");
        const x = Number(xText);
        const y = Number(yText);
        ctx.fillRect(
          x * cellSize + 1,
          y * cellSize + 1,
          cellSize - 2,
          cellSize - 2,
        );
      }

      ctx.fillStyle = "#e5e7eb";
      for (const dotKey of state.dots) {
        const [xText, yText] = dotKey.split(",");
        const x = Number(xText);
        const y = Number(yText);
        drawDot(
          ctx,
          x * cellSize + cellSize / 2,
          y * cellSize + cellSize / 2,
          Math.max(2, cellSize * 0.1),
        );
      }

      ctx.fillStyle = "#facc15";
      drawDot(
        ctx,
        state.player.x * cellSize + cellSize / 2,
        state.player.y * cellSize + cellSize / 2,
        cellSize * 0.34,
      );

      const ghostX = state.ghost.x * cellSize + cellSize / 2;
      const ghostY = state.ghost.y * cellSize + cellSize / 2;
      const ghostRadius = cellSize * 0.34;

      ctx.fillStyle = "#ef4444";
      drawDot(ctx, ghostX, ghostY, ghostRadius);

      ctx.fillStyle = "#ffffff";
      drawDot(ctx, ghostX - ghostRadius * 0.35, ghostY - ghostRadius * 0.15, ghostRadius * 0.22);
      drawDot(ctx, ghostX + ghostRadius * 0.35, ghostY - ghostRadius * 0.15, ghostRadius * 0.22);

      ctx.fillStyle = "#111827";
      drawDot(ctx, ghostX - ghostRadius * 0.35, ghostY - ghostRadius * 0.15, ghostRadius * 0.1);
      drawDot(ctx, ghostX + ghostRadius * 0.35, ghostY - ghostRadius * 0.15, ghostRadius * 0.1);
    },
    onKeyDown(key) {
      const normalized = String(key).toLowerCase();

      if (normalized === " ") {
        this.togglePause();
        return true;
      }

      if (normalized === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }

      const direction = directionFromKey(key);
      if (!direction) {
        return false;
      }

      state.nextDirection = direction;
      return true;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return false;
      }

      state.nextDirection = action;
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
      return 150;
    },
    getHud() {
      if (state.status === "game_over") {
        const result = state.won ? "Maze cleared" : "Caught by the ghost";
        return {
          score: `Dots: ${state.score} | Remaining: ${state.dots.size} | Best: ${bestScore}`,
          status: `${result}. Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Dots: ${state.score} | Remaining: ${state.dots.size} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Dots: ${state.score} | Remaining: ${state.dots.size} | Best: ${bestScore}`,
        status: "Use Arrow keys/WASD to collect dots and avoid the ghost.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
