import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const SIZE = 4;
const CELL = CANVAS_SIZE / SIZE;

export function createSlidingGame(ctx) {
  let bestMoves = Infinity;
  let state = createState();

  function createState() {
    const board = createSolvedBoard();
    let emptyIndex = board.indexOf(0);

    for (let i = 0; i < 360; i += 1) {
      const neighbors = adjacentIndexes(emptyIndex);
      const swap = neighbors[Math.floor(Math.random() * neighbors.length)];
      [board[emptyIndex], board[swap]] = [board[swap], board[emptyIndex]];
      emptyIndex = swap;
    }

    return {
      status: "running",
      moves: 0,
      cursor: 0,
      board,
    };
  }

  function createSolvedBoard() {
    return [...Array(SIZE * SIZE - 1).keys()].map((value) => value + 1).concat(0);
  }

  function adjacentIndexes(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const result = [];
    if (row > 0) result.push(index - SIZE);
    if (row < SIZE - 1) result.push(index + SIZE);
    if (col > 0) result.push(index - 1);
    if (col < SIZE - 1) result.push(index + 1);
    return result;
  }

  function attemptMove() {
    if (state.status !== "running") {
      return false;
    }

    const emptyIndex = state.board.indexOf(0);
    if (!adjacentIndexes(emptyIndex).includes(state.cursor)) {
      return false;
    }

    [state.board[emptyIndex], state.board[state.cursor]] = [
      state.board[state.cursor],
      state.board[emptyIndex],
    ];
    state.moves += 1;

    if (isSolved(state.board)) {
      state.status = "game_over";
      bestMoves = Math.min(bestMoves, state.moves);
    }
    return true;
  }

  function isSolved(board) {
    for (let i = 0; i < board.length - 1; i += 1) {
      if (board[i] !== i + 1) {
        return false;
      }
    }
    return board[board.length - 1] === 0;
  }

  function moveCursor(direction) {
    const row = Math.floor(state.cursor / SIZE);
    const col = state.cursor % SIZE;
    if (direction === "UP" && row > 0) state.cursor -= SIZE;
    if (direction === "DOWN" && row < SIZE - 1) state.cursor += SIZE;
    if (direction === "LEFT" && col > 0) state.cursor -= 1;
    if (direction === "RIGHT" && col < SIZE - 1) state.cursor += 1;
  }

  return {
    title: "Slide Quest",
    controlScheme: "grid_select",
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
      clearCanvas(ctx, "#161b23");

      for (let index = 0; index < state.board.length; index += 1) {
        const value = state.board[index];
        const x = (index % SIZE) * CELL;
        const y = Math.floor(index / SIZE) * CELL;

        if (value === 0) {
          ctx.fillStyle = "#0f1318";
          ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        } else {
          ctx.fillStyle = "#1e61ff";
          ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
          ctx.fillStyle = "#ffffff";
          ctx.font = "700 36px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), x + CELL / 2, y + CELL / 2);
        }

        if (state.cursor === index) {
          ctx.strokeStyle = "#f4d20b";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
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
      if (direction) {
        moveCursor(direction);
        return true;
      }

      if (key === "f" || key === "enter") {
        return attemptMove();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        moveCursor(action);
        return true;
      }
      if (action === "SELECT") {
        return attemptMove();
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
      return 110;
    },
    getHud() {
      const best = Number.isFinite(bestMoves) ? bestMoves : "-";
      const scoreLine = `Moves: ${state.moves} | Best: ${best}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Solved. Press Restart or Enter for a new shuffle.",
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
        status: "Move cursor, select a tile next to the empty slot.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
