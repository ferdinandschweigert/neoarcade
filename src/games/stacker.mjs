import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const COLS = 12;
const ROWS = 14;
const CELL_W = CANVAS_SIZE / COLS;
const CELL_H = CANVAS_SIZE / ROWS;

export function createStackerGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      settled: [{ y: ROWS - 1, start: 2, end: 9 }],
      moving: {
        y: ROWS - 2,
        start: 0,
        width: 7,
        dir: 1,
      },
      speed: 1,
    };
  }

  function lockRow() {
    if (state.status !== "running") {
      return false;
    }

    const previous = state.settled[state.settled.length - 1];
    const movingEnd = state.moving.start + state.moving.width;

    const overlapStart = Math.max(state.moving.start, previous.start);
    const overlapEnd = Math.min(movingEnd, previous.end);
    const overlapWidth = overlapEnd - overlapStart;

    if (overlapWidth <= 0) {
      state.status = "game_over";
      return true;
    }

    state.settled.push({
      y: state.moving.y,
      start: overlapStart,
      end: overlapEnd,
    });

    state.score += overlapWidth * 2;
    if (state.score > bestScore) {
      bestScore = state.score;
    }

    if (state.moving.y <= 0) {
      state.score += 80;
      if (state.score > bestScore) {
        bestScore = state.score;
      }
      state.settled = [{ y: ROWS - 1, start: overlapStart, end: overlapEnd }];
      state.moving = {
        y: ROWS - 2,
        start: 0,
        width: overlapWidth,
        dir: 1,
      };
      state.speed = Math.min(2.5, state.speed + 0.2);
      return true;
    }

    state.moving = {
      y: state.moving.y - 1,
      start: 0,
      width: overlapWidth,
      dir: 1,
    };

    state.speed = Math.min(3.8, state.speed + 0.04);
    return true;
  }

  return {
    title: "Stacker Rush",
    controlScheme: "select_only",
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

      state.moving.start += state.moving.dir * state.speed * 0.12;

      const maxStart = COLS - state.moving.width;
      if (state.moving.start <= 0) {
        state.moving.start = 0;
        state.moving.dir = 1;
      }
      if (state.moving.start >= maxStart) {
        state.moving.start = maxStart;
        state.moving.dir = -1;
      }
    },
    render() {
      clearCanvas(ctx, "#0f172a");

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          ctx.fillStyle = (row + col) % 2 === 0 ? "#111827" : "#0b1220";
          ctx.fillRect(col * CELL_W, row * CELL_H, CELL_W, CELL_H);
        }
      }

      for (const row of state.settled) {
        ctx.fillStyle = "#1e61ff";
        const start = row.start * CELL_W;
        const width = (row.end - row.start) * CELL_W;
        ctx.fillRect(start + 2, row.y * CELL_H + 2, width - 4, CELL_H - 4);
      }

      if (state.status === "running") {
        ctx.fillStyle = "#f4d20b";
        const start = state.moving.start * CELL_W;
        const width = state.moving.width * CELL_W;
        ctx.fillRect(start + 2, state.moving.y * CELL_H + 2, width - 4, CELL_H - 4);
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
      if (key === "f" || key === "enter" || key === "arrowup" || key === "w") {
        return lockRow();
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "SELECT") {
        return lockRow();
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
      return 16;
    },
    getHud() {
      const scoreLine = `Score: ${state.score} | Height: ${state.settled.length} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Missed stack. Press Restart or Enter.",
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
        status: "Hit Select/F at the right moment to stack blocks.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
