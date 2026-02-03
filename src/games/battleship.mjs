import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";
import { directionFromKey } from "../gameLogic.mjs";

const SIZE = 8;
const CELL = CANVAS_SIZE / SIZE;

export function createBattleshipGame(ctx) {
  const difficultyPresets = {
    easy: { shots: 46 },
    normal: { shots: 40 },
    hard: { shots: 34 },
  };

  const shipSizes = [4, 3, 3, 2, 2];

  let difficulty = "normal";
  let bestWins = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function randomShips() {
    const ships = new Set();
    for (const size of shipSizes) {
      let placed = false;
      for (let attempts = 0; attempts < 200 && !placed; attempts += 1) {
        const vertical = Math.random() > 0.5;
        const startX = Math.floor(Math.random() * (vertical ? SIZE : SIZE - size + 1));
        const startY = Math.floor(Math.random() * (vertical ? SIZE - size + 1 : SIZE));

        const points = [];
        let overlap = false;
        for (let step = 0; step < size; step += 1) {
          const x = startX + (vertical ? 0 : step);
          const y = startY + (vertical ? step : 0);
          const key = keyOf(x, y);
          if (ships.has(key)) {
            overlap = true;
            break;
          }
          points.push(key);
        }

        if (!overlap) {
          for (const key of points) {
            ships.add(key);
          }
          placed = true;
        }
      }
    }
    return ships;
  }

  function createState() {
    return {
      status: "running",
      shotsLeft: preset().shots,
      hits: 0,
      neededHits: shipSizes.reduce((sum, value) => sum + value, 0),
      board: Array.from({ length: SIZE }, () => Array(SIZE).fill("unknown")),
      ships: randomShips(),
      cursor: { x: 0, y: 0 },
      message: "",
      won: false,
    };
  }

  function moveCursor(direction) {
    if (direction === "UP") state.cursor.y = Math.max(0, state.cursor.y - 1);
    if (direction === "DOWN") state.cursor.y = Math.min(SIZE - 1, state.cursor.y + 1);
    if (direction === "LEFT") state.cursor.x = Math.max(0, state.cursor.x - 1);
    if (direction === "RIGHT") state.cursor.x = Math.min(SIZE - 1, state.cursor.x + 1);
  }

  function fireAtCursor() {
    if (state.status !== "running") {
      return false;
    }

    const { x, y } = state.cursor;
    if (state.board[y][x] !== "unknown") {
      return false;
    }

    const key = keyOf(x, y);
    const hit = state.ships.has(key);
    state.board[y][x] = hit ? "hit" : "miss";
    state.shotsLeft -= 1;

    if (hit) {
      state.hits += 1;
      state.message = "Direct hit";
      if (state.hits >= state.neededHits) {
        state.status = "game_over";
        state.won = true;
        bestWins += 1;
      }
    } else {
      state.message = "Miss";
      if (state.shotsLeft <= 0) {
        state.status = "game_over";
        state.won = false;
      }
    }

    return true;
  }

  return {
    title: "Battleship Grid",
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
    tick() {},
    render() {
      clearCanvas(ctx, "#0c1726");

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const cell = state.board[y][x];
          const px = x * CELL;
          const py = y * CELL;

          ctx.fillStyle = "#10243a";
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

          if (cell === "miss") {
            ctx.fillStyle = "#cbd5e1";
            ctx.fillRect(px + CELL * 0.4, py + CELL * 0.4, CELL * 0.2, CELL * 0.2);
          }

          if (cell === "hit") {
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(px + 6, py + 6, CELL - 12, CELL - 12);
          }

          if (state.status === "game_over" && state.ships.has(keyOf(x, y)) && cell === "unknown") {
            ctx.fillStyle = "rgba(34,197,94,0.45)";
            ctx.fillRect(px + 8, py + 8, CELL - 16, CELL - 16);
          }
        }
      }

      ctx.strokeStyle = "#f4d20b";
      ctx.lineWidth = 4;
      ctx.strokeRect(state.cursor.x * CELL + 3, state.cursor.y * CELL + 3, CELL - 6, CELL - 6);
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
        return fireAtCursor();
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
        return fireAtCursor();
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
      const scoreLine = `Hits: ${state.hits}/${state.neededHits} | Shots: ${state.shotsLeft} | Best: ${bestWins}`;

      if (state.status === "game_over") {
        const resultText = state.won ? "Fleet sunk" : "Out of shots";
        return {
          score: scoreLine,
          status: `${resultText} (${difficulty}). Press Restart or Enter.`,
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
        status: `${state.message || "Pick a tile and fire."}`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
