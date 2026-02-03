import { CANVAS_SIZE, clearCanvas, clamp, drawDot } from "./shared.mjs";

const POINT_COUNT = 24;
const CHECKERS_PER_SIDE = 15;
const PLAYER = "player";
const CPU = "cpu";

const BOARD_MARGIN = 20;
const BOARD_TOP = 34;
const BOARD_BOTTOM = CANVAS_SIZE - 34;
const BOARD_HEIGHT = BOARD_BOTTOM - BOARD_TOP;
const MID_Y = CANVAS_SIZE / 2;
const SLOT_COUNT = 13;
const SLOT_W = (CANVAS_SIZE - BOARD_MARGIN * 2) / SLOT_COUNT;
const CHECKER_RADIUS = 13;
const CPU_STEP_DELAY = 8;

function pointColumn(point) {
  const offset = point >= 12 ? point - 12 : 11 - point;
  return offset >= 6 ? offset + 1 : offset;
}

function sideSign(side) {
  return side === PLAYER ? 1 : -1;
}

export function createBackgammonGame(ctx) {
  let bestWins = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      board: createInitialBoard(),
      barPlayer: 0,
      barCpu: 0,
      offPlayer: 0,
      offCpu: 0,
      turn: PLAYER,
      dice: [],
      playerWins: 0,
      cpuWins: 0,
      playerChoice: 0,
      message: "",
      cpuDelay: 0,
    };
  }

  function createInitialBoard() {
    const board = Array(POINT_COUNT).fill(0);

    // Standard backgammon opening positions, mirrored for each side.
    board[23] = 2;
    board[12] = 5;
    board[7] = 3;
    board[5] = 5;

    board[0] = -2;
    board[11] = -5;
    board[16] = -3;
    board[18] = -5;

    return board;
  }

  function startRound(prefix = "") {
    state.board = createInitialBoard();
    state.barPlayer = 0;
    state.barCpu = 0;
    state.offPlayer = 0;
    state.offCpu = 0;
    state.status = "running";
    state.playerChoice = 0;
    state.cpuDelay = 0;
    beginTurn(PLAYER, prefix);
  }

  function beginTurn(side, prefix = "") {
    if (state.status !== "running") {
      return;
    }

    state.turn = side;
    state.dice = rollDice();
    state.playerChoice = 0;
    state.cpuDelay = side === CPU ? CPU_STEP_DELAY : 0;

    const actor = side === PLAYER ? "You" : "CPU";
    const lead = prefix ? `${prefix} ` : "";
    state.message = `${lead}${actor} rolled ${formatDice(state.dice)}.`;
  }

  function rollDice() {
    const first = 1 + Math.floor(Math.random() * 6);
    const second = 1 + Math.floor(Math.random() * 6);
    return first === second ? [first, first, first, first] : [first, second];
  }

  function formatDice(dice) {
    if (!dice.length) {
      return "-";
    }
    return dice.join(", ");
  }

  function pointLabel(point) {
    return String(point + 1);
  }

  function ownCount(side, point) {
    const signed = state.board[point] * sideSign(side);
    return signed > 0 ? signed : 0;
  }

  function opponentCount(side, point) {
    const signed = state.board[point] * sideSign(side);
    return signed < 0 ? -signed : 0;
  }

  function allCheckersInHome(side) {
    if (side === PLAYER) {
      if (state.barPlayer > 0) {
        return false;
      }
      for (let point = 6; point < POINT_COUNT; point += 1) {
        if (state.board[point] > 0) {
          return false;
        }
      }
      return true;
    }

    if (state.barCpu > 0) {
      return false;
    }

    for (let point = 0; point < 18; point += 1) {
      if (state.board[point] < 0) {
        return false;
      }
    }
    return true;
  }

  function hasFartherPlayerChecker(fromPoint) {
    for (let point = fromPoint + 1; point <= 5; point += 1) {
      if (state.board[point] > 0) {
        return true;
      }
    }
    return false;
  }

  function hasFartherCpuChecker(fromPoint) {
    for (let point = fromPoint - 1; point >= 18; point -= 1) {
      if (state.board[point] < 0) {
        return true;
      }
    }
    return false;
  }

  function createMove(side, from, die, dieIndex) {
    if (from === -1) {
      const destination = side === PLAYER ? POINT_COUNT - die : die - 1;
      if (opponentCount(side, destination) >= 2) {
        return null;
      }
      return {
        from,
        to: destination,
        die,
        dieIndex,
        hit: opponentCount(side, destination) === 1,
        bearOff: false,
      };
    }

    const destination = side === PLAYER ? from - die : from + die;

    if (destination >= 0 && destination < POINT_COUNT) {
      if (opponentCount(side, destination) >= 2) {
        return null;
      }
      return {
        from,
        to: destination,
        die,
        dieIndex,
        hit: opponentCount(side, destination) === 1,
        bearOff: false,
      };
    }

    if (!allCheckersInHome(side)) {
      return null;
    }

    if (side === PLAYER) {
      if (destination === -1 || !hasFartherPlayerChecker(from)) {
        return {
          from,
          to: -1,
          die,
          dieIndex,
          hit: false,
          bearOff: true,
        };
      }
      return null;
    }

    if (destination === POINT_COUNT || !hasFartherCpuChecker(from)) {
      return {
        from,
        to: -1,
        die,
        dieIndex,
        hit: false,
        bearOff: true,
      };
    }

    return null;
  }

  function generateMoves(side) {
    if (state.status !== "running" || state.dice.length === 0) {
      return [];
    }

    const sources = [];
    const barCount = side === PLAYER ? state.barPlayer : state.barCpu;

    if (barCount > 0) {
      sources.push(-1);
    } else {
      for (let point = 0; point < POINT_COUNT; point += 1) {
        if (ownCount(side, point) > 0) {
          sources.push(point);
        }
      }
    }

    const result = [];
    const seen = new Set();

    for (let dieIndex = 0; dieIndex < state.dice.length; dieIndex += 1) {
      const die = state.dice[dieIndex];
      for (const source of sources) {
        const move = createMove(side, source, die, dieIndex);
        if (!move) {
          continue;
        }

        const key = `${move.from}:${move.to}:${move.die}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        result.push(move);
      }
    }

    result.sort((a, b) => {
      if (a.from !== b.from) {
        return b.from - a.from;
      }
      if (a.to !== b.to) {
        return b.to - a.to;
      }
      return a.die - b.die;
    });

    return result;
  }

  function removeDie(index) {
    state.dice.splice(index, 1);
  }

  function applyMove(side, move) {
    const sign = sideSign(side);

    if (move.from === -1) {
      if (side === PLAYER) {
        state.barPlayer -= 1;
      } else {
        state.barCpu -= 1;
      }
    } else {
      state.board[move.from] -= sign;
    }

    if (move.to === -1) {
      if (side === PLAYER) {
        state.offPlayer += 1;
      } else {
        state.offCpu += 1;
      }
    } else {
      if (move.hit) {
        state.board[move.to] = 0;
        if (side === PLAYER) {
          state.barCpu += 1;
        } else {
          state.barPlayer += 1;
        }
      }

      state.board[move.to] += sign;
    }

    removeDie(move.dieIndex);

    if (state.offPlayer >= CHECKERS_PER_SIDE) {
      finalizeRound(PLAYER);
    } else if (state.offCpu >= CHECKERS_PER_SIDE) {
      finalizeRound(CPU);
    }
  }

  function finalizeRound(winner) {
    state.status = "game_over";
    state.dice = [];

    if (winner === PLAYER) {
      state.playerWins += 1;
      bestWins = Math.max(bestWins, state.playerWins);
      state.message = "You won this round.";
      return;
    }

    state.cpuWins += 1;
    state.message = "CPU won this round.";
  }

  function formatMove(move, side) {
    const fromLabel = move.from === -1 ? "bar" : pointLabel(move.from);
    const toLabel = move.to === -1 ? "off" : pointLabel(move.to);
    const note = move.hit ? " hit" : "";
    return `${fromLabel} -> ${toLabel} (d${move.die}${note})`;
  }

  function evaluateCpuMove(move) {
    let score = move.die * 3;

    if (move.bearOff) {
      score += 80;
    }

    if (move.hit) {
      score += 34;
    }

    if (move.to >= 0) {
      const stackAfter = ownCount(CPU, move.to) + 1;
      if (stackAfter >= 2) {
        score += 10;
      } else {
        score -= 5;
      }

      if (move.to >= 18) {
        score += 6;
      }
    }

    return score;
  }

  function chooseCpuMove(moves) {
    const sorted = moves.slice().sort((a, b) => {
      const delta = evaluateCpuMove(b) - evaluateCpuMove(a);
      if (delta !== 0) {
        return delta;
      }
      if (a.to !== b.to) {
        return b.to - a.to;
      }
      return b.from - a.from;
    });
    return sorted[0];
  }

  function shiftPlayerChoice(delta) {
    if (state.status !== "running" || state.turn !== PLAYER) {
      return false;
    }

    const moves = generateMoves(PLAYER);
    if (moves.length === 0) {
      return false;
    }

    state.playerChoice =
      (state.playerChoice + delta + moves.length) % moves.length;
    return true;
  }

  function playPlayerMove() {
    if (state.status !== "running" || state.turn !== PLAYER) {
      return false;
    }

    const moves = generateMoves(PLAYER);
    if (moves.length === 0) {
      return false;
    }

    state.playerChoice = clamp(state.playerChoice, 0, moves.length - 1);
    const move = moves[state.playerChoice];
    applyMove(PLAYER, move);

    if (state.status === "game_over") {
      return true;
    }

    state.message = `You played ${formatMove(move, PLAYER)}.`;

    const followUps = generateMoves(PLAYER);
    state.playerChoice = 0;

    if (state.dice.length === 0 || followUps.length === 0) {
      const reason =
        followUps.length === 0 && state.dice.length > 0
          ? "No legal follow-up."
          : "Turn complete.";
      beginTurn(CPU, reason);
    }

    return true;
  }

  function pointX(point) {
    return BOARD_MARGIN + (pointColumn(point) + 0.5) * SLOT_W;
  }

  function drawBoardBase() {
    clearCanvas(ctx, "#ebe5d9");

    const boardX = BOARD_MARGIN;
    const boardY = BOARD_TOP;
    const boardW = SLOT_W * SLOT_COUNT;

    ctx.fillStyle = "#6d4e35";
    ctx.fillRect(boardX - 5, boardY - 5, boardW + 10, BOARD_HEIGHT + 10);

    ctx.fillStyle = "#c89f6d";
    ctx.fillRect(boardX, boardY, boardW, BOARD_HEIGHT);

    ctx.fillStyle = "#8d6845";
    ctx.fillRect(boardX + 6 * SLOT_W, boardY, SLOT_W, BOARD_HEIGHT);

    for (let point = 0; point < POINT_COUNT; point += 1) {
      const column = pointColumn(point);
      const x0 = boardX + column * SLOT_W;
      const x1 = x0 + SLOT_W;
      const topPoint = point >= 12;

      ctx.fillStyle = (column + (topPoint ? 0 : 1)) % 2 === 0 ? "#1e61ff" : "#ead3b0";
      ctx.beginPath();

      if (topPoint) {
        ctx.moveTo(x0 + 2, boardY + 2);
        ctx.lineTo(x1 - 2, boardY + 2);
        ctx.lineTo((x0 + x1) / 2, MID_Y - 20);
      } else {
        ctx.moveTo(x0 + 2, BOARD_BOTTOM - 2);
        ctx.lineTo(x1 - 2, BOARD_BOTTOM - 2);
        ctx.lineTo((x0 + x1) / 2, MID_Y + 20);
      }

      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCheckerStack(point, count, side) {
    if (count <= 0) {
      return;
    }

    const topPoint = point >= 12;
    const visible = Math.min(count, 5);
    const x = pointX(point);
    const step = CHECKER_RADIUS * 2 - 2;

    for (let index = 0; index < visible; index += 1) {
      const y = topPoint
        ? BOARD_TOP + 22 + CHECKER_RADIUS + index * step
        : BOARD_BOTTOM - 22 - CHECKER_RADIUS - index * step;

      ctx.fillStyle = side === PLAYER ? "#f8fafc" : "#0f172a";
      drawDot(ctx, x, y, CHECKER_RADIUS);

      ctx.strokeStyle = side === PLAYER ? "#5b6678" : "#d2d9e6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, CHECKER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (count > visible) {
      const y = topPoint ? BOARD_TOP + 126 : BOARD_BOTTOM - 126;
      ctx.fillStyle = side === PLAYER ? "#111827" : "#f8fafc";
      ctx.font = "700 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`x${count}`, x, y);
    }
  }

  function drawBar(side, count) {
    if (count <= 0) {
      return;
    }

    const x = BOARD_MARGIN + 6.5 * SLOT_W;
    const visible = Math.min(count, 5);
    const step = CHECKER_RADIUS * 2 - 2;

    for (let index = 0; index < visible; index += 1) {
      const y =
        side === PLAYER
          ? MID_Y + 22 + CHECKER_RADIUS + index * step
          : MID_Y - 22 - CHECKER_RADIUS - index * step;

      ctx.fillStyle = side === PLAYER ? "#f8fafc" : "#0f172a";
      drawDot(ctx, x, y, CHECKER_RADIUS);

      ctx.strokeStyle = side === PLAYER ? "#5b6678" : "#d2d9e6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, CHECKER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (count > visible) {
      ctx.fillStyle = side === PLAYER ? "#111827" : "#f8fafc";
      ctx.font = "700 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const y = side === PLAYER ? MID_Y + 130 : MID_Y - 130;
      ctx.fillText(`x${count}`, x, y);
    }
  }

  function drawDice() {
    const diceSize = 28;
    const gap = 8;
    const totalWidth = state.dice.length * diceSize + Math.max(0, state.dice.length - 1) * gap;
    const startX = CANVAS_SIZE / 2 - totalWidth / 2;

    for (let index = 0; index < state.dice.length; index += 1) {
      const value = state.dice[index];
      const x = startX + index * (diceSize + gap);
      const y = MID_Y - diceSize / 2;

      ctx.fillStyle = "#fff9ed";
      ctx.fillRect(x, y, diceSize, diceSize);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, diceSize, diceSize);

      ctx.fillStyle = "#111827";
      ctx.font = "700 16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), x + diceSize / 2, y + diceSize / 2 + 1);
    }
  }

  function drawPointHighlight(point, color) {
    const x = BOARD_MARGIN + pointColumn(point) * SLOT_W + 3;
    const y = point >= 12 ? BOARD_TOP + 3 : MID_Y + 3;
    const h = BOARD_HEIGHT / 2 - 6;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, SLOT_W - 6, h);
  }

  function drawMoveHighlight(move) {
    if (!move) {
      return;
    }

    if (move.from === -1) {
      ctx.strokeStyle = "#f4d20b";
      ctx.lineWidth = 4;
      ctx.strokeRect(BOARD_MARGIN + 6 * SLOT_W + 4, MID_Y + 6, SLOT_W - 8, BOARD_HEIGHT / 2 - 12);
    } else {
      drawPointHighlight(move.from, "#f4d20b");
    }

    if (move.to >= 0) {
      drawPointHighlight(move.to, "#26d07c");
    }
  }

  function renderBoard() {
    drawBoardBase();

    for (let point = 0; point < POINT_COUNT; point += 1) {
      const value = state.board[point];
      if (value > 0) {
        drawCheckerStack(point, value, PLAYER);
      } else if (value < 0) {
        drawCheckerStack(point, -value, CPU);
      }
    }

    drawBar(PLAYER, state.barPlayer);
    drawBar(CPU, state.barCpu);
    drawDice();

    if (state.turn === PLAYER && state.status === "running") {
      const moves = generateMoves(PLAYER);
      if (moves.length > 0) {
        state.playerChoice = clamp(state.playerChoice, 0, moves.length - 1);
        drawMoveHighlight(moves[state.playerChoice]);
      }
    }

    ctx.fillStyle = "#111827";
    ctx.font = "700 13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`BAR ${state.barPlayer} / ${state.barCpu}`, 12, 8);

    ctx.textAlign = "right";
    ctx.fillText(`OFF ${state.offPlayer} / ${state.offCpu}`, CANVAS_SIZE - 12, 8);

    if (state.turn === PLAYER && state.status === "running") {
      const moves = generateMoves(PLAYER);
      if (moves.length > 0) {
        const current = moves[state.playerChoice];
        ctx.fillStyle = "#111827";
        ctx.font = "700 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          `Move ${state.playerChoice + 1}/${moves.length}: ${formatMove(current, PLAYER)}`,
          CANVAS_SIZE / 2,
          CANVAS_SIZE - 8,
        );
      }
    }
  }

  return {
    title: "Backgammon",
    controlScheme: "horizontal_select",
    start() {
      state = createState();
      beginTurn(PLAYER, "Round start.");
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

      if (state.turn === PLAYER) {
        const playerMoves = generateMoves(PLAYER);
        if (state.dice.length === 0 || playerMoves.length === 0) {
          const reason =
            playerMoves.length === 0 && state.dice.length > 0
              ? "No legal moves."
              : "Turn complete.";
          beginTurn(CPU, reason);
          return;
        }

        if (state.playerChoice >= playerMoves.length) {
          state.playerChoice = 0;
        }
        return;
      }

      if (state.cpuDelay > 0) {
        state.cpuDelay -= 1;
        return;
      }

      const cpuMoves = generateMoves(CPU);
      if (state.dice.length === 0 || cpuMoves.length === 0) {
        const reason =
          cpuMoves.length === 0 && state.dice.length > 0
            ? "CPU passes."
            : "CPU turn complete.";
        beginTurn(PLAYER, reason);
        return;
      }

      const move = chooseCpuMove(cpuMoves);
      applyMove(CPU, move);

      if (state.status === "game_over") {
        return;
      }

      state.message = `CPU played ${formatMove(move, CPU)}.`;

      if (state.dice.length === 0) {
        beginTurn(PLAYER, "CPU finished.");
      } else {
        state.cpuDelay = CPU_STEP_DELAY;
      }
    },
    render() {
      renderBoard();
    },
    onKeyDown(keyText) {
      const key = String(keyText).toLowerCase();

      if (key === " ") {
        this.togglePause();
        return true;
      }

      if (key === "enter" && state.status === "game_over") {
        startRound("Next round.");
        return true;
      }

      if (key === "arrowleft" || key === "a" || key === "arrowup" || key === "w") {
        return shiftPlayerChoice(-1);
      }

      if (key === "arrowright" || key === "d" || key === "arrowdown" || key === "s") {
        return shiftPlayerChoice(1);
      }

      if (key === "f" || key === "enter") {
        return playPlayerMove();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "LEFT" || action === "UP") {
        return shiftPlayerChoice(-1);
      }
      if (action === "RIGHT" || action === "DOWN") {
        return shiftPlayerChoice(1);
      }
      if (action === "SELECT") {
        return playPlayerMove();
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
      beginTurn(PLAYER, "Round start.");
    },
    getTickMs() {
      return 140;
    },
    getHud() {
      const scoreLine = `Wins: ${state.playerWins} | CPU: ${state.cpuWins} | Off: ${state.offPlayer}-${state.offCpu} | Best: ${bestWins}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `${state.message} Press Restart or Enter for next round.`,
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

      if (state.turn === PLAYER) {
        const moves = generateMoves(PLAYER);
        if (moves.length === 0) {
          return {
            score: scoreLine,
            status: `${state.message} Waiting for CPU...`,
            pauseLabel: "Pause",
            pauseDisabled: false,
          };
        }

        const current = moves[clamp(state.playerChoice, 0, moves.length - 1)];
        return {
          score: scoreLine,
          status: `${state.message} Choose move ${state.playerChoice + 1}/${moves.length}: ${formatMove(current, PLAYER)}.`,
          pauseLabel: "Pause",
          pauseDisabled: false,
        };
      }

      return {
        score: scoreLine,
        status: `${state.message} CPU is playing...`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
