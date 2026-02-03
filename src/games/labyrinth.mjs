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

export function createLabyrinthGame(ctx) {
  const map = [
    "##############",
    "#....#......E#",
    "#.##.#.####..#",
    "#.#..#....#..#",
    "#.#.####.#.###",
    "#.#......#...#",
    "#.######.###.#",
    "#....#....#..#",
    "###.#.##.##..#",
    "#...#..#.....#",
    "#.####.#.###.#",
    "#..K...#...#.#",
    "#S###.###K.#G#",
    "##############",
  ];

  const gridSize = map.length;
  const cell = CANVAS_SIZE / gridSize;
  const vectors = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  const walls = new Set();
  const keys = [];
  let start = { x: 1, y: 1 };
  let guardStart = { x: gridSize - 2, y: gridSize - 2 };
  let exit = { x: gridSize - 2, y: 1 };

  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      const symbol = map[y][x];
      if (symbol === "#") {
        walls.add(`${x},${y}`);
      } else if (symbol === "S") {
        start = { x, y };
      } else if (symbol === "G") {
        guardStart = { x, y };
      } else if (symbol === "E") {
        exit = { x, y };
      } else if (symbol === "K") {
        keys.push({ x, y });
      }
    }
  }

  let bestScore = 0;
  let state = createState();

  function keyOf(position) {
    return `${position.x},${position.y}`;
  }

  function createState() {
    return {
      status: "running",
      won: false,
      player: { ...start },
      guard: { ...guardStart },
      remainingKeys: new Set(keys.map((keyPosition) => keyOf(keyPosition))),
      turns: 0,
      score: 0,
    };
  }

  function isWall(x, y) {
    return x < 0 || x >= gridSize || y < 0 || y >= gridSize || walls.has(`${x},${y}`);
  }

  function movePlayer(direction) {
    if (state.status !== "running") {
      return false;
    }
    const vector = vectors[direction];
    const nextX = state.player.x + vector.x;
    const nextY = state.player.y + vector.y;
    if (isWall(nextX, nextY)) {
      return false;
    }
    state.player = { x: nextX, y: nextY };

    const id = keyOf(state.player);
    if (state.remainingKeys.has(id)) {
      state.remainingKeys.delete(id);
      state.score += 30;
      bestScore = Math.max(bestScore, state.score);
    }

    if (
      state.player.x === exit.x &&
      state.player.y === exit.y &&
      state.remainingKeys.size === 0
    ) {
      state.status = "game_over";
      state.won = true;
      state.score += 120;
      bestScore = Math.max(bestScore, state.score);
    }

    return true;
  }

  function findGuardStep() {
    const startKey = keyOf(state.guard);
    const goalKey = keyOf(state.player);
    const queue = [state.guard];
    const parent = new Map();
    parent.set(startKey, null);

    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = keyOf(current);

      if (currentKey === goalKey) {
        break;
      }

      for (const vector of Object.values(vectors)) {
        const next = { x: current.x + vector.x, y: current.y + vector.y };
        const nextKey = keyOf(next);
        if (isWall(next.x, next.y) || parent.has(nextKey)) {
          continue;
        }
        parent.set(nextKey, currentKey);
        queue.push(next);
      }
    }

    if (!parent.has(goalKey)) {
      return null;
    }

    let cursor = goalKey;
    let previous = parent.get(cursor);
    while (previous && previous !== startKey) {
      cursor = previous;
      previous = parent.get(cursor);
    }

    const [xText, yText] = cursor.split(",");
    return {
      x: Number(xText),
      y: Number(yText),
    };
  }

  return {
    title: "Labyrinth Heist",
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

      const nextGuard = findGuardStep();
      if (nextGuard) {
        state.guard = nextGuard;
      }

      state.turns += 1;
      if (state.turns % 4 === 0) {
        state.score += 1;
        bestScore = Math.max(bestScore, state.score);
      }

      if (
        state.guard.x === state.player.x &&
        state.guard.y === state.player.y
      ) {
        state.status = "game_over";
        state.won = false;
      }
    },
    render() {
      clearCanvas(ctx, "#0f141a");

      for (let y = 0; y < gridSize; y += 1) {
        for (let x = 0; x < gridSize; x += 1) {
          const px = x * cell;
          const py = y * cell;

          if (walls.has(`${x},${y}`)) {
            ctx.fillStyle = "#264d8c";
            ctx.fillRect(px, py, cell, cell);
            continue;
          }

          ctx.fillStyle = "#1d242e";
          ctx.fillRect(px, py, cell, cell);
        }
      }

      ctx.fillStyle = "#f4d20b";
      for (const id of state.remainingKeys) {
        const [xText, yText] = id.split(",");
        const x = Number(xText);
        const y = Number(yText);
        drawDiamond(
          ctx,
          x * cell + cell / 2,
          y * cell + cell / 2,
          cell * 0.27,
        );
      }

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(exit.x * cell + 6, exit.y * cell + 6, cell - 12, cell - 12);

      ctx.fillStyle = "#f4d20b";
      drawDot(
        ctx,
        state.player.x * cell + cell / 2,
        state.player.y * cell + cell / 2,
        cell * 0.31,
      );

      ctx.fillStyle = "#e24739";
      drawDot(
        ctx,
        state.guard.x * cell + cell / 2,
        state.guard.y * cell + cell / 2,
        cell * 0.31,
      );
    },
    onKeyDown(keyText) {
      const keyLower = String(keyText).toLowerCase();
      if (keyLower === " ") {
        this.togglePause();
        return true;
      }
      if (keyLower === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }
      const direction = directionFromKey(keyText);
      if (!direction) {
        return false;
      }
      return movePlayer(direction);
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return false;
      }
      return movePlayer(action);
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
      return 170;
    },
    getHud() {
      const remaining = state.remainingKeys.size;
      if (state.status === "game_over") {
        return {
          score: `Score: ${state.score} | Keys left: ${remaining} | Best: ${bestScore}`,
          status: state.won
            ? "Heist complete. Press Restart or Enter."
            : "Guard caught you. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Keys left: ${remaining} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Score: ${state.score} | Keys left: ${remaining} | Best: ${bestScore}`,
        status: "Collect all keys, then reach exit before guard catches you.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
