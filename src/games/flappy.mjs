import { CANVAS_SIZE, clearCanvas, drawDot } from "./shared.mjs";

const BIRD_X = 120;
const BIRD_RADIUS = 14;
const GAP = 138;
const COLUMN_WIDTH = 54;

export function createFlappyGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      birdY: CANVAS_SIZE / 2,
      birdVy: 0,
      columns: [],
      ticks: 0,
    };
  }

  function flap() {
    if (state.status !== "running") {
      return false;
    }
    state.birdVy = -5.8;
    return true;
  }

  function spawnColumn() {
    const padding = 72;
    const gapY = padding + Math.random() * (CANVAS_SIZE - padding * 2);
    state.columns.push({
      x: CANVAS_SIZE + COLUMN_WIDTH,
      gapY,
      passed: false,
    });
  }

  return {
    title: "Flappy Neon",
    controlScheme: "select_only",
    start() {
      state = createState();
      spawnColumn();
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

      state.ticks += 1;
      state.birdVy += 0.32;
      state.birdY += state.birdVy;

      if (state.ticks % 74 === 0) {
        spawnColumn();
      }

      for (const column of state.columns) {
        column.x -= 2.7;

        if (!column.passed && column.x + COLUMN_WIDTH < BIRD_X) {
          column.passed = true;
          state.score += 1;
        }

        const inX = BIRD_X + BIRD_RADIUS > column.x && BIRD_X - BIRD_RADIUS < column.x + COLUMN_WIDTH;
        const inUpper = state.birdY - BIRD_RADIUS < column.gapY - GAP / 2;
        const inLower = state.birdY + BIRD_RADIUS > column.gapY + GAP / 2;
        if (inX && (inUpper || inLower)) {
          state.status = "game_over";
        }
      }

      state.columns = state.columns.filter((column) => column.x > -COLUMN_WIDTH - 8);

      if (state.birdY < -20 || state.birdY > CANVAS_SIZE + 20) {
        state.status = "game_over";
      }

      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#061124");

      ctx.fillStyle = "#132642";
      for (let i = 0; i < 24; i += 1) {
        const x = (i * 58 + state.ticks * 0.4) % (CANVAS_SIZE + 30) - 20;
        const y = (i * 33) % CANVAS_SIZE;
        ctx.fillRect(x, y, 18, 10);
      }

      for (const column of state.columns) {
        ctx.fillStyle = "#26d4a6";
        ctx.fillRect(column.x, 0, COLUMN_WIDTH, column.gapY - GAP / 2);
        ctx.fillRect(column.x, column.gapY + GAP / 2, COLUMN_WIDTH, CANVAS_SIZE);
      }

      ctx.fillStyle = "#f4d20b";
      drawDot(ctx, BIRD_X, state.birdY, BIRD_RADIUS);
      ctx.fillStyle = "#0b1020";
      drawDot(ctx, BIRD_X + 5, state.birdY - 3, 2.4);
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
      if (key === "arrowup" || key === "w" || key === "f" || key === "k") {
        return flap();
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "SELECT") {
        return flap();
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
      spawnColumn();
    },
    getTickMs() {
      return 16;
    },
    getHud() {
      const scoreLine = `Score: ${state.score} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Crash! Press Restart or Enter.",
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
        status: "Tap Select/F/Up to flap through gates.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
