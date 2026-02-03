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

export function createTicTacToeGame(ctx) {
  const boardX = 60;
  const boardY = 60;
  const cellSize = 120;
  const winLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  let bestWins = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      board: Array(9).fill(""),
      cursor: 4,
      playerWins: 0,
      cpuWins: 0,
      draws: 0,
      lastResult: "",
    };
  }

  function startRound() {
    state.board = Array(9).fill("");
    state.cursor = 4;
    state.status = "running";
    state.lastResult = "";
  }

  function getWinner(board) {
    for (const [a, b, c] of winLines) {
      if (board[a] && board[a] === board[b] && board[b] === board[c]) {
        return board[a];
      }
    }

    return null;
  }

  function availableCells(board) {
    const cells = [];
    for (let index = 0; index < board.length; index += 1) {
      if (!board[index]) {
        cells.push(index);
      }
    }
    return cells;
  }

  function moveCursor(direction) {
    const row = Math.floor(state.cursor / 3);
    const col = state.cursor % 3;
    let nextRow = row;
    let nextCol = col;

    if (direction === "UP") {
      nextRow = Math.max(0, row - 1);
    } else if (direction === "DOWN") {
      nextRow = Math.min(2, row + 1);
    } else if (direction === "LEFT") {
      nextCol = Math.max(0, col - 1);
    } else if (direction === "RIGHT") {
      nextCol = Math.min(2, col + 1);
    }

    const nextCursor = nextRow * 3 + nextCol;
    if (nextCursor !== state.cursor) {
      state.cursor = nextCursor;
      return true;
    }

    return false;
  }

  function findWinningMove(mark) {
    for (const index of availableCells(state.board)) {
      const snapshot = state.board.slice();
      snapshot[index] = mark;
      if (getWinner(snapshot) === mark) {
        return index;
      }
    }

    return null;
  }

  function chooseCpuMove() {
    const winning = findWinningMove("O");
    if (winning !== null) {
      return winning;
    }

    const block = findWinningMove("X");
    if (block !== null) {
      return block;
    }

    if (!state.board[4]) {
      return 4;
    }

    const preferred = [0, 2, 6, 8, 1, 3, 5, 7];
    for (const index of preferred) {
      if (!state.board[index]) {
        return index;
      }
    }

    return null;
  }

  function finalizeRound(winner) {
    state.status = "game_over";
    if (winner === "X") {
      state.playerWins += 1;
      bestWins = Math.max(bestWins, state.playerWins);
      state.lastResult = "You win";
    } else if (winner === "O") {
      state.cpuWins += 1;
      state.lastResult = "CPU wins";
    } else {
      state.draws += 1;
      state.lastResult = "Draw";
    }
  }

  function placeAtCursor() {
    if (state.status !== "running" || state.board[state.cursor]) {
      return false;
    }

    state.board[state.cursor] = "X";

    const playerWinner = getWinner(state.board);
    if (playerWinner) {
      finalizeRound(playerWinner);
      return true;
    }

    if (availableCells(state.board).length === 0) {
      finalizeRound(null);
      return true;
    }

    const cpuMove = chooseCpuMove();
    if (cpuMove !== null) {
      state.board[cpuMove] = "O";
    }

    const cpuWinner = getWinner(state.board);
    if (cpuWinner) {
      finalizeRound(cpuWinner);
      return true;
    }

    if (availableCells(state.board).length === 0) {
      finalizeRound(null);
    }

    return true;
  }

  return {
    title: "Tic-Tac-Toe",
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
      // Turn-based game.
    },
    render() {
      clearCanvas(ctx, "#efece4");

      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 5;
      for (let line = 1; line < 3; line += 1) {
        const offset = line * cellSize;
        ctx.beginPath();
        ctx.moveTo(boardX + offset, boardY);
        ctx.lineTo(boardX + offset, boardY + cellSize * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(boardX, boardY + offset);
        ctx.lineTo(boardX + cellSize * 3, boardY + offset);
        ctx.stroke();
      }

      for (let index = 0; index < 9; index += 1) {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = boardX + col * cellSize;
        const y = boardY + row * cellSize;

        if (index === state.cursor && state.status !== "game_over") {
          ctx.fillStyle = "rgba(30, 97, 255, 0.15)";
          ctx.fillRect(x + 6, y + 6, cellSize - 12, cellSize - 12);
        }

        const mark = state.board[index];
        if (!mark) {
          continue;
        }

        ctx.fillStyle = mark === "X" ? "#1e61ff" : "#e24739";
        ctx.font = "900 72px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mark, x + cellSize / 2, y + cellSize / 2 + 4);
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

      if (key === "enter" || key === "f") {
        return placeAtCursor();
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
        return placeAtCursor();
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
        status: "Move cursor with arrows/WASD. Place with Enter/F.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
