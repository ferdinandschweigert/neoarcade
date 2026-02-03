import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const SIZE = 8;
const CELL = CANVAS_SIZE / SIZE;
const PLAYER = 1;
const CPU = -1;

const DIRECTIONS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function createReversiGame(ctx) {
  let bestWins = 0;
  let state = createState();

  function createState() {
    const board = Array(SIZE * SIZE).fill(0);
    setCell(board, 3, 3, CPU);
    setCell(board, 4, 4, CPU);
    setCell(board, 3, 4, PLAYER);
    setCell(board, 4, 3, PLAYER);

    return {
      status: "running",
      board,
      cursor: { x: 2, y: 3 },
      turn: "player",
      playerWins: 0,
      cpuWins: 0,
      draws: 0,
      message: "Your move",
      pendingCpu: false,
      lastPassPlayer: false,
      lastPassCpu: false,
    };
  }

  function indexOf(x, y) {
    return y * SIZE + x;
  }

  function inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function getCell(board, x, y) {
    return board[indexOf(x, y)];
  }

  function setCell(board, x, y, value) {
    board[indexOf(x, y)] = value;
  }

  function collectFlips(board, x, y, side) {
    if (!inBounds(x, y) || getCell(board, x, y) !== 0) {
      return [];
    }

    const flips = [];

    for (const direction of DIRECTIONS) {
      const line = [];
      let cx = x + direction.x;
      let cy = y + direction.y;

      while (inBounds(cx, cy)) {
        const value = getCell(board, cx, cy);
        if (value === -side) {
          line.push({ x: cx, y: cy });
          cx += direction.x;
          cy += direction.y;
          continue;
        }

        if (value === side && line.length > 0) {
          flips.push(...line);
        }
        break;
      }
    }

    return flips;
  }

  function legalMoves(board, side) {
    const moves = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const flips = collectFlips(board, x, y, side);
        if (flips.length > 0) {
          moves.push({ x, y, flips });
        }
      }
    }
    return moves;
  }

  function applyMove(x, y, side, flips) {
    setCell(state.board, x, y, side);
    for (const cell of flips) {
      setCell(state.board, cell.x, cell.y, side);
    }
  }

  function countPieces() {
    let player = 0;
    let cpu = 0;
    for (const value of state.board) {
      if (value === PLAYER) player += 1;
      if (value === CPU) cpu += 1;
    }
    return { player, cpu };
  }

  function maybeFinishGame() {
    const playerMoves = legalMoves(state.board, PLAYER).length;
    const cpuMoves = legalMoves(state.board, CPU).length;
    const openCells = state.board.filter((value) => value === 0).length;

    if (openCells > 0 && (playerMoves > 0 || cpuMoves > 0)) {
      return false;
    }

    const counts = countPieces();
    if (counts.player > counts.cpu) {
      state.playerWins += 1;
      bestWins = Math.max(bestWins, state.playerWins);
      state.message = "You win";
    } else if (counts.cpu > counts.player) {
      state.cpuWins += 1;
      state.message = "CPU wins";
    } else {
      state.draws += 1;
      state.message = "Draw";
    }

    state.status = "game_over";
    return true;
  }

  function performCpuTurn() {
    if (state.status !== "running" || state.turn !== "cpu") {
      return;
    }

    const moves = legalMoves(state.board, CPU);
    if (moves.length === 0) {
      state.lastPassCpu = true;
      state.message = "CPU passes";
      state.turn = "player";
      if (state.lastPassPlayer) {
        maybeFinishGame();
      }
      return;
    }

    state.lastPassCpu = false;

    moves.sort((a, b) => evaluateMove(b) - evaluateMove(a));
    const bestMove = moves[0];

    applyMove(bestMove.x, bestMove.y, CPU, bestMove.flips);
    state.turn = "player";
    state.message = "Your move";
  }

  function evaluateMove(move) {
    const corner = (move.x === 0 || move.x === SIZE - 1) && (move.y === 0 || move.y === SIZE - 1);
    const edge = move.x === 0 || move.x === SIZE - 1 || move.y === 0 || move.y === SIZE - 1;
    return move.flips.length * 4 + (corner ? 30 : 0) + (edge ? 6 : 0);
  }

  function tryPlayerMove() {
    if (state.status !== "running" || state.turn !== "player") {
      return false;
    }

    const moves = legalMoves(state.board, PLAYER);
    if (moves.length === 0) {
      state.lastPassPlayer = true;
      state.turn = "cpu";
      state.message = "No move. CPU turn.";
      return true;
    }

    state.lastPassPlayer = false;

    const choice = moves.find((move) => move.x === state.cursor.x && move.y === state.cursor.y);
    if (!choice) {
      return false;
    }

    applyMove(choice.x, choice.y, PLAYER, choice.flips);
    state.turn = "cpu";
    state.message = "CPU thinking";

    maybeFinishGame();
    return true;
  }

  function moveCursor(direction) {
    if (direction === "UP") state.cursor.y = Math.max(0, state.cursor.y - 1);
    if (direction === "DOWN") state.cursor.y = Math.min(SIZE - 1, state.cursor.y + 1);
    if (direction === "LEFT") state.cursor.x = Math.max(0, state.cursor.x - 1);
    if (direction === "RIGHT") state.cursor.x = Math.min(SIZE - 1, state.cursor.x + 1);
  }

  return {
    title: "Reversi Royale",
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
      if (state.status !== "running") {
        return;
      }

      if (state.turn === "cpu") {
        performCpuTurn();
        maybeFinishGame();
      }
    },
    render() {
      clearCanvas(ctx, "#0c151f");

      ctx.fillStyle = "#1f8f5b";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      for (let line = 0; line <= SIZE; line += 1) {
        const pos = line * CELL;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(CANVAS_SIZE, pos);
        ctx.stroke();
      }

      const hints = state.turn === "player" && state.status === "running" ? legalMoves(state.board, PLAYER) : [];
      for (const hint of hints) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(hint.x * CELL + CELL / 2, hint.y * CELL + CELL / 2, CELL * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const value = getCell(state.board, x, y);
          if (value === 0) {
            continue;
          }

          ctx.fillStyle = value === PLAYER ? "#f8fafc" : "#111827";
          ctx.beginPath();
          ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = "#f4d20b";
      ctx.lineWidth = 4;
      ctx.strokeRect(state.cursor.x * CELL + 4, state.cursor.y * CELL + 4, CELL - 8, CELL - 8);
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
        return tryPlayerMove();
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
        return tryPlayerMove();
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
      const wins = state.playerWins;
      const cpu = state.cpuWins;
      const draws = state.draws;
      state = createState();
      state.playerWins = wins;
      state.cpuWins = cpu;
      state.draws = draws;
    },
    getTickMs() {
      return 130;
    },
    getHud() {
      const counts = countPieces();
      const scoreLine = `You ${counts.player} | CPU ${counts.cpu} | Wins ${state.playerWins} | CPU ${state.cpuWins} | Draws ${state.draws} | Best ${bestWins}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `${state.message}. Press Restart or Enter.`,
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
        status: state.turn === "player" ? "Pick a legal square and press Select." : "CPU is moving...",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
