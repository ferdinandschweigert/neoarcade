import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";
import { directionFromKey } from "../gameLogic.mjs";

const SIZE = 6;
const CELL = CANVAS_SIZE / SIZE;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORDS = [
  "NEON",
  "ARCADE",
  "PIXEL",
  "SNAKE",
  "BOMBER",
  "ROCKET",
  "PUZZLE",
  "LASER",
  "RETRO",
  "BONUS",
];

export function createWordHuntGame(ctx) {
  const difficultyTime = {
    easy: 55,
    normal: 45,
    hard: 35,
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function startTime() {
    return difficultyTime[difficulty] || difficultyTime.normal;
  }

  function randomLetter() {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }

  function randomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  function createGrid() {
    return Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => randomLetter()),
    );
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      level: 1,
      wordsSolved: 0,
      timeLeft: startTime(),
      timerTicks: 0,
      grid: createGrid(),
      cursor: { x: 0, y: 0 },
      target: randomWord(),
      progress: 0,
      message: "Find letters in order",
    };
  }

  function pickLetter() {
    if (state.status !== "running") {
      return false;
    }

    const letter = state.grid[state.cursor.y][state.cursor.x];
    const expected = state.target[state.progress];

    if (letter === expected) {
      state.progress += 1;
      state.message = "Good";

      if (state.progress >= state.target.length) {
        state.wordsSolved += 1;
        state.level = Math.max(1, Math.floor(state.wordsSolved / 3) + 1);
        state.score += state.target.length * state.level;
        state.timeLeft += 2;
        state.target = randomWord();
        state.progress = 0;
        state.grid = createGrid();
        state.message = "Word solved";
        if (state.score > bestScore) {
          bestScore = state.score;
        }
      }
      return true;
    }

    state.progress = 0;
    state.message = "Wrong letter";
    state.timeLeft = Math.max(0, state.timeLeft - 1.5);
    return true;
  }

  return {
    title: "Word Hunt",
    controlScheme: "grid_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyTime[nextDifficulty]) {
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
    tick() {
      if (state.status !== "running") {
        return;
      }

      state.timerTicks += 1;
      const drainEvery = Math.max(4, 10 - state.level);
      if (state.timerTicks >= drainEvery) {
        state.timerTicks = 0;
        state.timeLeft -= 0.2;
      }

      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.status = "game_over";
      }
    },
    render() {
      clearCanvas(ctx, "#111827");

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const px = x * CELL;
          const py = y * CELL;

          ctx.fillStyle = "#1f2937";
          ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);

          if (x === state.cursor.x && y === state.cursor.y) {
            ctx.strokeStyle = "#f4d20b";
            ctx.lineWidth = 4;
            ctx.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6);
          }

          ctx.fillStyle = "#e5e7eb";
          ctx.font = "700 28px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(state.grid[y][x], px + CELL / 2, py + CELL / 2 + 1);
        }
      }

      const pad = 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, CANVAS_SIZE - 44, CANVAS_SIZE, 44);
      ctx.fillStyle = "#dbeafe";
      ctx.font = "700 14px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Target: ${state.target}`, pad, CANVAS_SIZE - 24);
      ctx.fillText(`Progress: ${state.target.slice(0, state.progress)}`, pad + 180, CANVAS_SIZE - 24);
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
      if (direction === "UP") {
        state.cursor.y = Math.max(0, state.cursor.y - 1);
        return true;
      }
      if (direction === "DOWN") {
        state.cursor.y = Math.min(SIZE - 1, state.cursor.y + 1);
        return true;
      }
      if (direction === "LEFT") {
        state.cursor.x = Math.max(0, state.cursor.x - 1);
        return true;
      }
      if (direction === "RIGHT") {
        state.cursor.x = Math.min(SIZE - 1, state.cursor.x + 1);
        return true;
      }

      if (key === "f" || key === "enter") {
        return pickLetter();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "UP") {
        state.cursor.y = Math.max(0, state.cursor.y - 1);
        return true;
      }
      if (action === "DOWN") {
        state.cursor.y = Math.min(SIZE - 1, state.cursor.y + 1);
        return true;
      }
      if (action === "LEFT") {
        state.cursor.x = Math.max(0, state.cursor.x - 1);
        return true;
      }
      if (action === "RIGHT") {
        state.cursor.x = Math.min(SIZE - 1, state.cursor.x + 1);
        return true;
      }
      if (action === "SELECT") {
        return pickLetter();
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
      const scoreLine = `Score: ${state.score} | Words: ${state.wordsSolved} | Level: ${state.level} | Time: ${Math.ceil(state.timeLeft)}s | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Time up (${difficulty}). Press Restart or Enter.`,
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
        status: `${state.message}. Select letters in target order.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
