import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const LEVELS = [
  [
    "##########",
    "#........#",
    "#..$..T..#",
    "#..##....#",
    "#..@..$..#",
    "#....##..#",
    "#..T.....#",
    "#........#",
    "#........#",
    "##########",
  ],
  [
    "##########",
    "#...T....#",
    "#..$$....#",
    "#..##....#",
    "#..@..T..#",
    "#..##....#",
    "#........#",
    "#........#",
    "#........#",
    "##########",
  ],
  [
    "##########",
    "#..T..T..#",
    "#..$$$...#",
    "#..#.#...#",
    "#..@.....#",
    "#..#.#...#",
    "#........#",
    "#........#",
    "#........#",
    "##########",
  ],
  [
    "##########",
    "#..T.....#",
    "#..$$....#",
    "#..##.##.#",
    "#..@..$T.#",
    "#..##.##.#",
    "#.....T..#",
    "#........#",
    "#........#",
    "##########",
  ],
  [
    "##########",
    "#T....T..#",
    "#.$$.$$..#",
    "#.##.##..#",
    "#..@.....#",
    "#.##.##..#",
    "#..T....T#",
    "#........#",
    "#........#",
    "##########",
  ],
];

export function createSokobanGame(ctx) {
  const difficultyLevelCount = {
    easy: 3,
    normal: 4,
    hard: 5,
  };

  let difficulty = "normal";
  let bestSolved = 0;
  let state = createState();

  function levelCount() {
    return difficultyLevelCount[difficulty] || difficultyLevelCount.normal;
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function parseLevel(index) {
    const lines = LEVELS[index] || LEVELS[0];
    const walls = new Set();
    const targets = new Set();
    const boxes = new Set();
    let player = { x: 1, y: 1 };

    for (let y = 0; y < lines.length; y += 1) {
      const line = lines[y];
      for (let x = 0; x < line.length; x += 1) {
        const cell = line[x];
        if (cell === "#") walls.add(keyOf(x, y));
        if (cell === "T") targets.add(keyOf(x, y));
        if (cell === "$") boxes.add(keyOf(x, y));
        if (cell === "@") player = { x, y };
      }
    }

    return {
      width: lines[0].length,
      height: lines.length,
      walls,
      targets,
      boxes,
      player,
    };
  }

  function createState() {
    const levelIndex = 0;
    const level = parseLevel(levelIndex);
    return {
      status: "running",
      solved: 0,
      levelIndex,
      moves: 0,
      message: "",
      ...level,
    };
  }

  function loadLevel(index) {
    const level = parseLevel(index);
    state.levelIndex = index;
    state.moves = 0;
    state.message = "";
    state.walls = level.walls;
    state.targets = level.targets;
    state.boxes = level.boxes;
    state.player = level.player;
    state.width = level.width;
    state.height = level.height;
  }

  function isSolved() {
    for (const box of state.boxes) {
      if (!state.targets.has(box)) {
        return false;
      }
    }
    return state.boxes.size > 0;
  }

  function step(direction) {
    if (state.status !== "running") {
      return false;
    }

    const vectors = {
      UP: { x: 0, y: -1 },
      DOWN: { x: 0, y: 1 },
      LEFT: { x: -1, y: 0 },
      RIGHT: { x: 1, y: 0 },
    };

    const vector = vectors[direction];
    if (!vector) {
      return false;
    }

    const next = {
      x: state.player.x + vector.x,
      y: state.player.y + vector.y,
    };
    const nextKey = keyOf(next.x, next.y);

    if (state.walls.has(nextKey)) {
      return false;
    }

    if (state.boxes.has(nextKey)) {
      const beyond = {
        x: next.x + vector.x,
        y: next.y + vector.y,
      };
      const beyondKey = keyOf(beyond.x, beyond.y);

      if (state.walls.has(beyondKey) || state.boxes.has(beyondKey)) {
        return false;
      }

      state.boxes.delete(nextKey);
      state.boxes.add(beyondKey);
    }

    state.player = next;
    state.moves += 1;

    if (isSolved()) {
      state.solved += 1;
      bestSolved = Math.max(bestSolved, state.solved);

      const lastLevel = levelCount() - 1;
      if (state.levelIndex >= lastLevel) {
        state.status = "game_over";
        state.message = "Warehouse cleared";
      } else {
        loadLevel(state.levelIndex + 1);
        state.message = `Level ${state.levelIndex + 1}`;
      }
    }

    return true;
  }

  return {
    title: "Sokoban Crates",
    controlScheme: "dpad",
    setDifficulty(nextDifficulty) {
      if (!difficultyLevelCount[nextDifficulty]) {
        difficulty = "normal";
        return;
      }
      difficulty = nextDifficulty;
    },
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {},
    render() {
      clearCanvas(ctx, "#151b24");
      const cell = CANVAS_SIZE / state.width;

      for (let y = 0; y < state.height; y += 1) {
        for (let x = 0; x < state.width; x += 1) {
          const key = keyOf(x, y);
          const px = x * cell;
          const py = y * cell;

          ctx.fillStyle = "#1b2733";
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

          if (state.walls.has(key)) {
            ctx.fillStyle = "#3a4b5e";
            ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
          }

          if (state.targets.has(key)) {
            ctx.fillStyle = "#f4d20b";
            ctx.fillRect(px + cell * 0.35, py + cell * 0.35, cell * 0.3, cell * 0.3);
          }

          if (state.boxes.has(key)) {
            const onTarget = state.targets.has(key);
            ctx.fillStyle = onTarget ? "#22c55e" : "#1e61ff";
            ctx.fillRect(px + 4, py + 4, cell - 8, cell - 8);
          }
        }
      }

      ctx.fillStyle = "#e24739";
      ctx.fillRect(
        state.player.x * cell + cell * 0.2,
        state.player.y * cell + cell * 0.2,
        cell * 0.6,
        cell * 0.6,
      );
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
        return step(direction);
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return step(action);
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
      return 120;
    },
    getHud() {
      const total = levelCount();
      const scoreLine = `Level: ${state.levelIndex + 1}/${total} | Moves: ${state.moves} | Solved: ${state.solved} | Best: ${bestSolved}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `${state.message} (${difficulty}). Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: `Paused (${difficulty}). Press Pause or Space to continue.`,
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: scoreLine,
        status: `Push crates onto targets (${difficulty}).`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
