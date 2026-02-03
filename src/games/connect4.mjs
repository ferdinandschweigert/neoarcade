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

export function createConnect4Game(ctx) {
  const cols = 7;
  const rows = 6;
  const cell = 56;
  const boardX = 44;
  const boardY = 86;

  let bestWins = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      board: Array.from({ length: rows }, () => Array(cols).fill(0)),
      cursor: 3,
      playerWins: 0,
      cpuWins: 0,
      draws: 0,
      lastResult: "",
    };
  }

  function startRound() {
    state.board = Array.from({ length: rows }, () => Array(cols).fill(0));
    state.cursor = 3;
    state.status = "running";
    state.lastResult = "";
  }

  function moveCursor(delta) {
    const next = clamp(state.cursor + delta, 0, cols - 1);
    if (next === state.cursor) {
      return false;
    }
    state.cursor = next;
    return true;
  }

  function dropDisc(board, col, player) {
    for (let row = rows - 1; row >= 0; row -= 1) {
      if (board[row][col] === 0) {
        board[row][col] = player;
        return row;
      }
    }
    return -1;
  }

  function boardIsFull(board) {
    for (let col = 0; col < cols; col += 1) {
      if (board[0][col] === 0) {
        return false;
      }
    }
    return true;
  }

  function hasConnect(board, player) {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (board[row][col] !== player) {
          continue;
        }

        const lines = [
          [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
          [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
          [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
          [{ x: -1, y: 1 }, { x: -2, y: 2 }, { x: -3, y: 3 }],
        ];

        for (const line of lines) {
          const ok = line.every((step) => {
            const x = col + step.x;
            const y = row + step.y;
            return x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === player;
          });
          if (ok) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function chooseCpuColumn() {
    const valid = [];
    for (let col = 0; col < cols; col += 1) {
      if (state.board[0][col] === 0) {
        valid.push(col);
      }
    }
    if (valid.length === 0) {
      return null;
    }

    for (const col of valid) {
      const test = state.board.map((row) => row.slice());
      dropDisc(test, col, 2);
      if (hasConnect(test, 2)) {
        return col;
      }
    }

    for (const col of valid) {
      const test = state.board.map((row) => row.slice());
      dropDisc(test, col, 1);
      if (hasConnect(test, 1)) {
        return col;
      }
    }

    const priority = [3, 2, 4, 1, 5, 0, 6];
    for (const col of priority) {
      if (valid.includes(col)) {
        return col;
      }
    }

    return valid[Math.floor(Math.random() * valid.length)];
  }

  function finalizeRound(winner) {
    state.status = "game_over";
    if (winner === 1) {
      state.playerWins += 1;
      bestWins = Math.max(bestWins, state.playerWins);
      state.lastResult = "You win";
    } else if (winner === 2) {
      state.cpuWins += 1;
      state.lastResult = "CPU wins";
    } else {
      state.draws += 1;
      state.lastResult = "Draw";
    }
  }

  function playerDrop() {
    if (state.status !== "running") {
      return false;
    }

    const row = dropDisc(state.board, state.cursor, 1);
    if (row < 0) {
      return false;
    }

    if (hasConnect(state.board, 1)) {
      finalizeRound(1);
      return true;
    }

    if (boardIsFull(state.board)) {
      finalizeRound(0);
      return true;
    }

    const cpuCol = chooseCpuColumn();
    if (cpuCol !== null) {
      dropDisc(state.board, cpuCol, 2);
    }

    if (hasConnect(state.board, 2)) {
      finalizeRound(2);
      return true;
    }

    if (boardIsFull(state.board)) {
      finalizeRound(0);
    }

    return true;
  }

  return {
    title: "Connect Four",
    controlScheme: "horizontal_select",
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      // Turn-based game.
    },
    render() {
      clearCanvas(ctx, "#efece4");

      const pointerX = boardX + state.cursor * cell + cell / 2;
      ctx.fillStyle = "#1e61ff";
      drawDot(ctx, pointerX, boardY - 26, 10);

      ctx.fillStyle = "#1f3f9f";
      ctx.fillRect(boardX, boardY, cols * cell, rows * cell);

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = boardX + col * cell + cell / 2;
          const y = boardY + row * cell + cell / 2;
          const value = state.board[row][col];
          ctx.fillStyle = value === 1 ? "#1e61ff" : value === 2 ? "#e24739" : "#f6f6f6";
          drawDot(ctx, x, y, cell * 0.37);
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
        startRound();
        return true;
      }

      if (key === "enter" || key === "f" || key === "arrowup" || key === "w") {
        return playerDrop();
      }

      if (key === "arrowleft" || key === "a") {
        return moveCursor(-1);
      }

      if (key === "arrowright" || key === "d") {
        return moveCursor(1);
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        return moveCursor(-1);
      }
      if (action === "RIGHT") {
        return moveCursor(1);
      }
      if (action === "SELECT") {
        return playerDrop();
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
      return 180;
    },
    getHud() {
      if (state.status === "game_over") {
        return {
          score: `Wins ${state.playerWins} | CPU ${state.cpuWins} | Draws ${state.draws} | Best ${bestWins}`,
          status: `${state.lastResult}. Press Restart or Enter for next round.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Wins ${state.playerWins} | CPU ${state.cpuWins} | Draws ${state.draws} | Best ${bestWins}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Wins ${state.playerWins} | CPU ${state.cpuWins} | Draws ${state.draws} | Best ${bestWins}`,
        status: "Move column with Left/Right. Drop with Enter/F.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
