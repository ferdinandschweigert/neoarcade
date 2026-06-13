import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDiamond } from "./shared.mjs";

const SIZE = 8;
const CELL = CANVAS_SIZE / SIZE;
const PLAYER = 1;
const PLAYER_KING = 2;
const CPU = -1;
const CPU_KING = -2;

const difficultyPresets = {
  easy: { depth: 2 },
  normal: { depth: 3 },
  hard: { depth: 4 },
};

function isDarkSquare(x, y) {
  return (x + y) % 2 === 1;
}

function isPlayerPiece(value) {
  return value === PLAYER || value === PLAYER_KING;
}

function isCpuPiece(value) {
  return value === CPU || value === CPU_KING;
}

function isKing(value) {
  return value === PLAYER_KING || value === CPU_KING;
}

function sideOf(value) {
  if (isPlayerPiece(value)) {
    return "player";
  }
  if (isCpuPiece(value)) {
    return "cpu";
  }
  return null;
}

function promoteIfNeeded(board, x, y) {
  const value = board[y * SIZE + x];
  if (value === PLAYER && y === 0) {
    board[y * SIZE + x] = PLAYER_KING;
  }
  if (value === CPU && y === SIZE - 1) {
    board[y * SIZE + x] = CPU_KING;
  }
}

function cloneBoard(board) {
  return board.slice();
}

function getCell(board, x, y) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) {
    return null;
  }
  return board[y * SIZE + x];
}

function setCell(board, x, y, value) {
  board[y * SIZE + x] = value;
}

function forwardDirections(piece) {
  if (piece === PLAYER) {
    return [{ x: -1, y: -1 }, { x: 1, y: -1 }];
  }
  if (piece === CPU) {
    return [{ x: -1, y: 1 }, { x: 1, y: 1 }];
  }
  return [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];
}

function collectJumps(board, x, y, piece, captures = []) {
  const jumps = [];
  for (const direction of forwardDirections(piece)) {
    const midX = x + direction.x;
    const midY = y + direction.y;
    const landX = x + direction.x * 2;
    const landY = y + direction.y * 2;
    const midValue = getCell(board, midX, midY);
    const landValue = getCell(board, landX, landY);

    if (landValue !== 0 || midValue === 0 || midValue === null) {
      continue;
    }

    const midSide = sideOf(midValue);
    const pieceSide = sideOf(piece);
    if (midSide === pieceSide || midSide === null) {
      continue;
    }

    const captureKey = `${midX},${midY}`;
    if (captures.some((cell) => cell.x === midX && cell.y === midY)) {
      continue;
    }

    const nextBoard = cloneBoard(board);
    setCell(nextBoard, x, y, 0);
    setCell(nextBoard, midX, midY, 0);
    setCell(nextBoard, landX, landY, piece);
    promoteIfNeeded(nextBoard, landX, landY);

    const nextCaptures = captures.concat([{ x: midX, y: midY }]);
    const continuations = collectJumps(nextBoard, landX, landY, nextBoard[landY * SIZE + landX], nextCaptures);

    if (continuations.length === 0) {
      jumps.push({
        from: captures.length === 0 ? { x, y } : null,
        to: { x: landX, y: landY },
        captures: nextCaptures,
        steps: [{ from: { x, y }, to: { x: landX, y: landY }, capture: { x: midX, y: midY } }],
      });
      continue;
    }

    for (const continuation of continuations) {
      jumps.push({
        from: captures.length === 0 ? { x, y } : null,
        to: continuation.to,
        captures: continuation.captures,
        steps: [{ from: { x, y }, to: { x: landX, y: landY }, capture: { x: midX, y: midY } }, ...continuation.steps],
      });
    }
  }

  return jumps;
}

function collectSlides(board, x, y, piece) {
  const slides = [];
  for (const direction of forwardDirections(piece)) {
    const nextX = x + direction.x;
    const nextY = y + direction.y;
    if (getCell(board, nextX, nextY) !== 0) {
      continue;
    }
    slides.push({
      from: { x, y },
      to: { x: nextX, y: nextY },
      captures: [],
      steps: [{ from: { x, y }, to: { x: nextX, y: nextY }, capture: null }],
    });
  }
  return slides;
}

function movesForPiece(board, x, y) {
  const piece = getCell(board, x, y);
  if (piece === 0 || piece === null) {
    return [];
  }

  const jumps = collectJumps(board, x, y, piece);
  if (jumps.length > 0) {
    return jumps.map((move) => ({ ...move, from: { x, y } }));
  }

  return collectSlides(board, x, y, piece);
}

function legalMoves(board, side) {
  const moves = [];
  let hasJump = false;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const piece = getCell(board, x, y);
      const pieceSide = sideOf(piece);
      if (pieceSide !== side) {
        continue;
      }

      const pieceJumps = collectJumps(board, x, y, piece);
      if (pieceJumps.length > 0) {
        hasJump = true;
        for (const jump of pieceJumps) {
          moves.push({ ...jump, from: { x, y } });
        }
      }
    }
  }

  if (hasJump) {
    return moves;
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const piece = getCell(board, x, y);
      if (sideOf(piece) !== side) {
        continue;
      }
      moves.push(...collectSlides(board, x, y, piece));
    }
  }

  return moves;
}

function applyMove(board, move) {
  const nextBoard = cloneBoard(board);
  for (const step of move.steps) {
    const movingPiece = getCell(nextBoard, step.from.x, step.from.y);
    setCell(nextBoard, step.from.x, step.from.y, 0);
    if (step.capture) {
      setCell(nextBoard, step.capture.x, step.capture.y, 0);
    }
    setCell(nextBoard, step.to.x, step.to.y, movingPiece);
    promoteIfNeeded(nextBoard, step.to.x, step.to.y);
  }
  return nextBoard;
}

function countPieces(board) {
  let player = 0;
  let cpu = 0;
  let playerKings = 0;
  let cpuKings = 0;

  for (const value of board) {
    if (value === PLAYER) player += 1;
    if (value === PLAYER_KING) {
      player += 1;
      playerKings += 1;
    }
    if (value === CPU) cpu += 1;
    if (value === CPU_KING) {
      cpu += 1;
      cpuKings += 1;
    }
  }

  return { player, cpu, playerKings, cpuKings };
}

function evaluateBoard(board) {
  const counts = countPieces(board);
  if (counts.player === 0) {
    return -10000;
  }
  if (counts.cpu === 0) {
    return 10000;
  }

  let score = (counts.player - counts.cpu) * 100;
  score += (counts.playerKings - counts.cpuKings) * 35;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const value = getCell(board, x, y);
      if (value === 0) {
        continue;
      }
      const edgeBonus = (x === 0 || x === SIZE - 1 || y === 0 || y === SIZE - 1) ? 4 : 0;
      const centerBonus = (x >= 2 && x <= 5 && y >= 2 && y <= 5) ? 2 : 0;
      const mobility = movesForPiece(board, x, y).length;
      const sign = isPlayerPiece(value) ? 1 : -1;
      score += sign * (edgeBonus + centerBonus + mobility * 3);
    }
  }

  return score;
}

function minimax(board, depth, maximizing, alpha, beta, searchDepth) {
  const playerMoves = legalMoves(board, "player");
  const cpuMoves = legalMoves(board, "cpu");

  if (depth === 0 || (playerMoves.length === 0 && cpuMoves.length === 0)) {
    if (playerMoves.length === 0 && cpuMoves.length === 0) {
      const counts = countPieces(board);
      if (counts.player === counts.cpu) {
        return 0;
      }
      return counts.player > counts.cpu ? 9000 : -9000;
    }
    if (maximizing && playerMoves.length === 0) {
      return -8000 + depth;
    }
    if (!maximizing && cpuMoves.length === 0) {
      return 8000 - depth;
    }
    return evaluateBoard(board);
  }

  if (maximizing) {
    if (playerMoves.length === 0) {
      return minimax(board, depth - 1, false, alpha, beta, searchDepth);
    }

    let best = -Infinity;
    for (const move of playerMoves) {
      const nextBoard = applyMove(board, move);
      const value = minimax(nextBoard, depth - 1, false, alpha, beta, searchDepth);
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha && searchDepth >= 3) {
        break;
      }
    }
    return best;
  }

  if (cpuMoves.length === 0) {
    return minimax(board, depth - 1, true, alpha, beta, searchDepth);
  }

  let best = Infinity;
  for (const move of cpuMoves) {
    const nextBoard = applyMove(board, move);
    const value = minimax(nextBoard, depth - 1, true, alpha, beta, searchDepth);
    best = Math.min(best, value);
    beta = Math.min(beta, value);
    if (beta <= alpha && searchDepth >= 3) {
      break;
    }
  }
  return best;
}

function chooseCpuMove(board, depth) {
  const moves = legalMoves(board, "cpu");
  if (moves.length === 0) {
    return null;
  }

  moves.sort((a, b) => {
    const captureDiff = b.captures.length - a.captures.length;
    if (captureDiff !== 0) {
      return captureDiff;
    }
    return (b.to.y - a.to.y) - (a.to.y - b.to.y);
  });

  let bestMove = moves[0];
  let bestScore = Infinity;

  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const score = minimax(nextBoard, depth - 1, true, -Infinity, Infinity, depth);
    if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function createInitialBoard() {
  const board = Array(SIZE * SIZE).fill(0);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!isDarkSquare(x, y)) {
        continue;
      }
      if (y < 3) {
        board[y * SIZE + x] = CPU;
      } else if (y > 4) {
        board[y * SIZE + x] = PLAYER;
      }
    }
  }
  return board;
}

export function createCheckersGame(ctx) {
  let difficulty = "normal";
  let bestWins = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    return {
      status: "running",
      board: createInitialBoard(),
      cursor: { x: 1, y: 5 },
      selected: null,
      turn: "player",
      chainFrom: null,
      playerWins: 0,
      cpuWins: 0,
      draws: 0,
      message: "Select a piece and jump or slide.",
    };
  }

  function availablePlayerMoves() {
    if (state.chainFrom) {
      return movesForPiece(state.board, state.chainFrom.x, state.chainFrom.y).filter((move) => move.captures.length > 0);
    }
    return legalMoves(state.board, "player");
  }

  function finishIfNeeded() {
    const playerMoves = legalMoves(state.board, "player");
    const cpuMoves = legalMoves(state.board, "cpu");
    const counts = countPieces(state.board);

    if (counts.player === 0 || counts.cpu === 0 || (playerMoves.length === 0 && cpuMoves.length === 0)) {
      if (counts.player > counts.cpu) {
        state.playerWins += 1;
        bestWins = Math.max(bestWins, state.playerWins);
        state.message = "You win the match.";
      } else if (counts.cpu > counts.player) {
        state.cpuWins += 1;
        state.message = "CPU wins the match.";
      } else {
        state.draws += 1;
        state.message = "Draw.";
      }
      state.status = "game_over";
      state.selected = null;
      state.chainFrom = null;
      return true;
    }

    if (state.turn === "player" && playerMoves.length === 0) {
      state.turn = "cpu";
      state.message = "No legal move. CPU turn.";
      return false;
    }

    if (state.turn === "cpu" && cpuMoves.length === 0) {
      state.turn = "player";
      state.message = "CPU has no move. Your turn.";
      return false;
    }

    return false;
  }

  function executeMove(move, side) {
    state.board = applyMove(state.board, move);

    if (side === "player") {
      const followUps = movesForPiece(state.board, move.to.x, move.to.y).filter((next) => next.captures.length > 0);
      if (move.captures.length > 0 && followUps.length > 0) {
        state.chainFrom = { x: move.to.x, y: move.to.y };
        state.selected = { x: move.to.x, y: move.to.y };
        state.cursor = { x: move.to.x, y: move.to.y };
        state.message = "Continue the capture chain.";
        return;
      }

      state.chainFrom = null;
      state.selected = null;
      state.turn = "cpu";
      state.message = "CPU thinking...";
      return;
    }

    state.turn = "player";
    state.message = "Your move.";
  }

  function performCpuTurn() {
    if (state.status !== "running" || state.turn !== "cpu") {
      return;
    }

    const move = chooseCpuMove(state.board, preset().depth);
    if (!move) {
      finishIfNeeded();
      return;
    }

    executeMove(move, "cpu");
    finishIfNeeded();
  }

  function trySelectOrMove() {
    if (state.status !== "running" || state.turn !== "player") {
      return false;
    }

    const moves = availablePlayerMoves();
    if (moves.length === 0) {
      finishIfNeeded();
      return false;
    }

    const destinationMove = moves.find((move) => move.to.x === state.cursor.x && move.to.y === state.cursor.y);
    if (destinationMove) {
      executeMove(destinationMove, "player");
      finishIfNeeded();
      return true;
    }

    if (state.chainFrom) {
      return false;
    }

    const piece = getCell(state.board, state.cursor.x, state.cursor.y);
    if (!isPlayerPiece(piece)) {
      state.selected = null;
      return false;
    }

    const pieceMoves = moves.filter((move) => move.from.x === state.cursor.x && move.from.y === state.cursor.y);
    if (pieceMoves.length === 0) {
      state.selected = null;
      return false;
    }

    state.selected = { x: state.cursor.x, y: state.cursor.y };
    state.message = pieceMoves.some((move) => move.captures.length > 0)
      ? "Capture required. Move to a highlighted square."
      : "Choose a destination square.";
    return true;
  }

  function moveCursor(direction) {
    if (direction === "UP") state.cursor.y = Math.max(0, state.cursor.y - 1);
    if (direction === "DOWN") state.cursor.y = Math.min(SIZE - 1, state.cursor.y + 1);
    if (direction === "LEFT") state.cursor.x = Math.max(0, state.cursor.x - 1);
    if (direction === "RIGHT") state.cursor.x = Math.min(SIZE - 1, state.cursor.x + 1);
  }

  return {
    title: "Neon Checkers",
    controlScheme: "grid_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyPresets[nextDifficulty]) {
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
      if (state.turn === "cpu") {
        performCpuTurn();
      }
    },
    render() {
      clearCanvas(ctx, "#0c151f");

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          ctx.fillStyle = isDarkSquare(x, y) ? "#1f2937" : "#334155";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      const hints = state.turn === "player" && state.status === "running" ? availablePlayerMoves() : [];
      for (const hint of hints) {
        ctx.fillStyle = hint.captures.length > 0 ? "rgba(239, 68, 68, 0.35)" : "rgba(34, 197, 94, 0.35)";
        ctx.beginPath();
        ctx.arc(hint.to.x * CELL + CELL / 2, hint.to.y * CELL + CELL / 2, CELL * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const value = getCell(state.board, x, y);
          if (value === 0) {
            continue;
          }

          const cx = x * CELL + CELL / 2;
          const cy = y * CELL + CELL / 2;
          ctx.fillStyle = isPlayerPiece(value) ? "#f8fafc" : "#111827";
          ctx.beginPath();
          ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isPlayerPiece(value) ? "#cbd5e1" : "#374151";
          ctx.lineWidth = 2;
          ctx.stroke();

          if (isKing(value)) {
            ctx.fillStyle = isPlayerPiece(value) ? "#f4d20b" : "#47c3a2";
            drawDiamond(ctx, cx, cy, CELL * 0.12);
          }
        }
      }

      if (state.selected) {
        ctx.strokeStyle = "#47c3a2";
        ctx.lineWidth = 4;
        ctx.strokeRect(state.selected.x * CELL + 4, state.selected.y * CELL + 4, CELL - 8, CELL - 8);
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

      if (key === "escape" || key === "q") {
        state.selected = null;
        state.message = "Selection cleared.";
        return true;
      }

      if (key === "f" || key === "enter") {
        return trySelectOrMove();
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
        return trySelectOrMove();
      }
      if (action === "FLAG") {
        state.selected = null;
        state.message = "Selection cleared.";
        return true;
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
      return 140;
    },
    getHud() {
      const counts = countPieces(state.board);
      const scoreLine = `You ${counts.player} | CPU ${counts.cpu} | Wins ${state.playerWins} | CPU ${state.cpuWins} | Draws ${state.draws} | Best ${bestWins}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `${state.message} Press Restart or Enter.`,
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
        status: state.message,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
