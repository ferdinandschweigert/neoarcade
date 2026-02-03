import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const SIZE = 10;
const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7"];

export function createColorFloodGame(ctx) {
  let bestMoves = Infinity;
  let state = createState();

  function createState() {
    const board = [];
    for (let y = 0; y < SIZE; y += 1) {
      const row = [];
      for (let x = 0; x < SIZE; x += 1) {
        row.push(Math.floor(Math.random() * COLORS.length));
      }
      board.push(row);
    }

    return {
      status: "running",
      board,
      selectedColor: 0,
      region: new Set(["0,0"]),
      moves: 0,
      maxMoves: 24,
      currentColor: board[0][0],
      message: "Flood from top-left",
    };
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  function expandRegion() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...state.region]) {
        const [xText, yText] = id.split(",");
        const x = Number(xText);
        const y = Number(yText);

        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (const neighbor of neighbors) {
          if (!inBounds(neighbor.x, neighbor.y)) {
            continue;
          }

          const key = keyOf(neighbor.x, neighbor.y);
          if (state.region.has(key)) {
            continue;
          }

          if (state.board[neighbor.y][neighbor.x] === state.currentColor) {
            state.region.add(key);
            changed = true;
          }
        }
      }
    }
  }

  function applyColor() {
    if (state.status !== "running") {
      return false;
    }

    const next = state.selectedColor;
    if (next === state.currentColor) {
      return false;
    }

    state.currentColor = next;
    for (const id of state.region) {
      const [xText, yText] = id.split(",");
      state.board[Number(yText)][Number(xText)] = next;
    }

    expandRegion();
    state.moves += 1;

    if (state.region.size === SIZE * SIZE) {
      state.status = "game_over";
      state.message = "Board flooded";
      bestMoves = Math.min(bestMoves, state.moves);
      return true;
    }

    if (state.moves >= state.maxMoves) {
      state.status = "game_over";
      state.message = "Out of moves";
    }

    return true;
  }

  return {
    title: "Color Flood",
    controlScheme: "horizontal_select",
    start() {
      state = createState();
      expandRegion();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {},
    render() {
      clearCanvas(ctx, "#101722");

      const boardArea = CANVAS_SIZE - 100;
      const cell = boardArea / SIZE;

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const id = keyOf(x, y);
          ctx.fillStyle = COLORS[state.board[y][x]];
          ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);

          if (state.region.has(id)) {
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x * cell + 4, y * cell + 4, cell - 8, cell - 8);
          }
        }
      }

      const paletteY = boardArea + 18;
      const swatch = (CANVAS_SIZE - 20) / COLORS.length;
      for (let i = 0; i < COLORS.length; i += 1) {
        const x = 10 + i * swatch;
        ctx.fillStyle = COLORS[i];
        ctx.fillRect(x + 3, paletteY + 3, swatch - 6, 62);

        if (i === state.selectedColor) {
          ctx.strokeStyle = "#f8fafc";
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 2, paletteY + 2, swatch - 4, 64);
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

      if (key === "arrowleft" || key === "a") {
        state.selectedColor = (state.selectedColor - 1 + COLORS.length) % COLORS.length;
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.selectedColor = (state.selectedColor + 1) % COLORS.length;
        return true;
      }
      if (key === "f" || key === "enter") {
        return applyColor();
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.selectedColor = (state.selectedColor - 1 + COLORS.length) % COLORS.length;
        return true;
      }
      if (action === "RIGHT") {
        state.selectedColor = (state.selectedColor + 1) % COLORS.length;
        return true;
      }
      if (action === "SELECT") {
        return applyColor();
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
      expandRegion();
    },
    getTickMs() {
      return 110;
    },
    getHud() {
      const best = Number.isFinite(bestMoves) ? bestMoves : "-";
      const scoreLine = `Moves: ${state.moves}/${state.maxMoves} | Region: ${state.region.size}/${SIZE * SIZE} | Best: ${best}`;
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
        status: "Choose color (Left/Right), press Select to flood.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
