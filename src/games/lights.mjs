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

export function createLightsOutGame(ctx) {
  const size = 5;
  const cell = 82;
  const boardX = 35;
  const boardY = 35;

  let bestMoves = Infinity;
  let state = createState();

  function createBoard() {
    const board = Array.from({ length: size }, () => Array(size).fill(false));
    const randomPresses = 16 + Math.floor(Math.random() * 8);

    for (let i = 0; i < randomPresses; i += 1) {
      toggleAt(board, Math.floor(Math.random() * size), Math.floor(Math.random() * size));
    }

    if (isSolved(board)) {
      toggleAt(board, 2, 2);
    }

    return board;
  }

  function createState() {
    return {
      status: "running",
      board: createBoard(),
      cursor: {
        x: 2,
        y: 2,
      },
      moves: 0,
      won: false,
    };
  }

  function toggleAt(board, x, y) {
    const offsets = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (const offset of offsets) {
      const nextX = x + offset.x;
      const nextY = y + offset.y;
      if (nextX >= 0 && nextX < size && nextY >= 0 && nextY < size) {
        board[nextY][nextX] = !board[nextY][nextX];
      }
    }
  }

  function isSolved(board) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (board[y][x]) {
          return false;
        }
      }
    }
    return true;
  }

  function moveCursor(direction) {
    const next = { ...state.cursor };
    if (direction === "UP") {
      next.y = Math.max(0, next.y - 1);
    } else if (direction === "DOWN") {
      next.y = Math.min(size - 1, next.y + 1);
    } else if (direction === "LEFT") {
      next.x = Math.max(0, next.x - 1);
    } else if (direction === "RIGHT") {
      next.x = Math.min(size - 1, next.x + 1);
    }

    const changed = next.x !== state.cursor.x || next.y !== state.cursor.y;
    state.cursor = next;
    return changed;
  }

  function pressCell() {
    if (state.status !== "running") {
      return false;
    }

    toggleAt(state.board, state.cursor.x, state.cursor.y);
    state.moves += 1;

    if (isSolved(state.board)) {
      state.won = true;
      state.status = "game_over";
      bestMoves = Math.min(bestMoves, state.moves);
    }

    return true;
  }

  return {
    title: "Lights Out",
    controlScheme: "grid_select",
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      // Turn-based puzzle.
    },
    render() {
      clearCanvas(ctx, "#ece9e1");

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const px = boardX + x * cell;
          const py = boardY + y * cell;
          const on = state.board[y][x];

          ctx.fillStyle = on ? "#f4d20b" : "#2b2b2b";
          ctx.fillRect(px + 4, py + 4, cell - 8, cell - 8);

          if (x === state.cursor.x && y === state.cursor.y && state.status !== "game_over") {
            ctx.strokeStyle = "#1e61ff";
            ctx.lineWidth = 4;
            ctx.strokeRect(px + 8, py + 8, cell - 16, cell - 16);
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
      if (key === "f" || key === "enter") {
        return pressCell();
      }

      const direction = directionFromKey(keyText);
      if (!direction) {
        return false;
      }
      return moveCursor(direction);
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "SELECT") {
        return pressCell();
      }
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return moveCursor(action);
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
      return 200;
    },
    getHud() {
      const best = Number.isFinite(bestMoves) ? bestMoves : "-";
      if (state.status === "game_over") {
        return {
          score: `Moves: ${state.moves} | Best: ${best}`,
          status: "Board solved. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Moves: ${state.moves} | Best: ${best}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Moves: ${state.moves} | Best: ${best}`,
        status: "Move cursor and Select tiles to switch lights.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
