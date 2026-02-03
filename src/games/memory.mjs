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

export function createMemoryMatchGame(ctx) {
  const size = 4;
  const cell = 98;
  const boardX = 44;
  const boardY = 44;

  let bestMoves = Infinity;
  let state = createState();

  function shuffledCards() {
    const values = [];
    for (let value = 1; value <= 8; value += 1) {
      values.push(value, value);
    }
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = values[i];
      values[i] = values[j];
      values[j] = temp;
    }
    return values;
  }

  function createState() {
    return {
      status: "running",
      cards: shuffledCards(),
      revealed: new Set(),
      matched: new Set(),
      pending: [],
      lockTicks: 0,
      cursor: 0,
      moves: 0,
      won: false,
    };
  }

  function moveCursor(direction) {
    const row = Math.floor(state.cursor / size);
    const col = state.cursor % size;
    let nextRow = row;
    let nextCol = col;

    if (direction === "UP") {
      nextRow = Math.max(0, row - 1);
    } else if (direction === "DOWN") {
      nextRow = Math.min(size - 1, row + 1);
    } else if (direction === "LEFT") {
      nextCol = Math.max(0, col - 1);
    } else if (direction === "RIGHT") {
      nextCol = Math.min(size - 1, col + 1);
    }

    const next = nextRow * size + nextCol;
    if (next !== state.cursor) {
      state.cursor = next;
      return true;
    }

    return false;
  }

  function revealCard(index) {
    if (state.status !== "running" || state.lockTicks > 0) {
      return false;
    }

    if (state.revealed.has(index) || state.matched.has(index)) {
      return false;
    }

    state.revealed.add(index);
    state.pending.push(index);

    if (state.pending.length < 2) {
      return true;
    }

    state.moves += 1;
    const [a, b] = state.pending;

    if (state.cards[a] === state.cards[b]) {
      state.matched.add(a);
      state.matched.add(b);
      state.pending = [];

      if (state.matched.size === size * size) {
        state.status = "game_over";
        state.won = true;
        bestMoves = Math.min(bestMoves, state.moves);
      }
    } else {
      state.lockTicks = 12;
    }

    return true;
  }

  return {
    title: "Memory Match",
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

      if (state.lockTicks > 0) {
        state.lockTicks -= 1;
        if (state.lockTicks === 0 && state.pending.length === 2) {
          for (const index of state.pending) {
            if (!state.matched.has(index)) {
              state.revealed.delete(index);
            }
          }
          state.pending = [];
        }
      }
    },
    render() {
      clearCanvas(ctx, "#ece9e1");

      for (let index = 0; index < state.cards.length; index += 1) {
        const row = Math.floor(index / size);
        const col = index % size;
        const x = boardX + col * cell;
        const y = boardY + row * cell;
        const faceUp = state.revealed.has(index) || state.matched.has(index);

        ctx.fillStyle = faceUp ? "#f4d20b" : "#1f232a";
        ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10);

        if (faceUp) {
          ctx.fillStyle = "#111";
          ctx.font = "900 36px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(state.cards[index]), x + cell / 2, y + cell / 2);
        }

        if (state.cursor === index && state.status !== "game_over") {
          ctx.strokeStyle = "#1e61ff";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 9, y + 9, cell - 18, cell - 18);
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
        return revealCard(state.cursor);
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
        return revealCard(state.cursor);
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
      return 80;
    },
    getHud() {
      const pairs = state.matched.size / 2;
      const best = Number.isFinite(bestMoves) ? bestMoves : "-";
      if (state.status === "game_over") {
        return {
          score: `Pairs: ${pairs}/8 | Moves: ${state.moves} | Best: ${best}`,
          status: "All pairs found. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Pairs: ${pairs}/8 | Moves: ${state.moves} | Best: ${best}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Pairs: ${pairs}/8 | Moves: ${state.moves} | Best: ${best}`,
        status: "Move cursor and Select cards to find pairs.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
