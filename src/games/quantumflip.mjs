import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";
import { directionFromKey } from "../gameLogic.mjs";

const SIZE = 7;
const CELL = CANVAS_SIZE / SIZE;

export function createQuantumFlipGame(ctx) {
  const difficultyMoves = {
    easy: 30,
    normal: 24,
    hard: 20,
  };

  let difficulty = "normal";
  let best = Infinity;
  let state = createState();

  function maxMoves() {
    return difficultyMoves[difficulty] || difficultyMoves.normal;
  }

  function createBoard() {
    const board = [];
    for (let y = 0; y < SIZE; y += 1) {
      const row = [];
      for (let x = 0; x < SIZE; x += 1) {
        row.push(Math.random() > 0.5 ? 1 : 0);
      }
      board.push(row);
    }
    return board;
  }

  function createState() {
    return {
      status: "running",
      board: createBoard(),
      cursor: { x: 0, y: 0 },
      moves: 0,
      message: "",
    };
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  function flip(x, y) {
    const cells = [
      [x, y],
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [cx, cy] of cells) {
      if (!inBounds(cx, cy)) {
        continue;
      }
      state.board[cy][cx] = state.board[cy][cx] ? 0 : 1;
    }
  }

  function solved() {
    const target = state.board[0][0];
    for (const row of state.board) {
      for (const value of row) {
        if (value !== target) {
          return false;
        }
      }
    }
    return true;
  }

  function doFlip() {
    if (state.status !== "running") {
      return false;
    }

    flip(state.cursor.x, state.cursor.y);
    state.moves += 1;

    if (solved()) {
      state.status = "game_over";
      best = Math.min(best, state.moves);
      state.message = "Field synchronized";
      return true;
    }

    if (state.moves >= maxMoves()) {
      state.status = "game_over";
      state.message = "Energy depleted";
    }

    return true;
  }

  return {
    title: "Quantum Flip",
    controlScheme: "grid_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyMoves[nextDifficulty]) {
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
      clearCanvas(ctx, "#0f172a");

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const px = x * CELL;
          const py = y * CELL;
          ctx.fillStyle = state.board[y][x] ? "#1e61ff" : "#0b1220";
          ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);

          if (x === state.cursor.x && y === state.cursor.y) {
            ctx.strokeStyle = "#f4d20b";
            ctx.lineWidth = 4;
            ctx.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6);
          }
        }
      }
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
        return doFlip();
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
        return doFlip();
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
      const bestText = Number.isFinite(best) ? best : "-";
      const scoreLine = `Moves: ${state.moves}/${maxMoves()} | Best: ${bestText}`;
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
        status: "Flip a tile to invert its cross neighbors.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
