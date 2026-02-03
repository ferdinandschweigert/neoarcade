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

export function createQuickDrawGame(ctx) {
  let bestMs = Infinity;
  let state = createState();

  function randomWait() {
    return 70 + Math.floor(Math.random() * 120);
  }

  function createState() {
    return {
      status: "running",
      phase: "wait",
      timer: randomWait(),
      goTicks: 0,
      score: 0,
      streak: 0,
      fouls: 0,
      message: "Wait for DRAW",
      info: "",
    };
  }

  function actionDraw() {
    if (state.status !== "running") {
      return false;
    }

    if (state.phase === "wait") {
      state.fouls += 1;
      state.streak = 0;
      state.phase = "result";
      state.timer = 46;
      state.message = "Too soon";
      state.info = "Foul";
    } else if (state.phase === "go") {
      const ms = state.goTicks * 16;
      state.score += Math.max(10, 420 - ms);
      state.streak += 1;
      bestMs = Math.min(bestMs, ms);
      state.phase = "result";
      state.timer = 60;
      state.message = "Hit";
      state.info = `${ms}ms`;
    } else {
      return false;
    }

    if (state.fouls >= 3) {
      state.status = "game_over";
      state.message = "Disqualified";
    }

    return true;
  }

  function nextRound() {
    state.phase = "wait";
    state.timer = randomWait();
    state.goTicks = 0;
    state.message = "Wait for DRAW";
    state.info = "";
  }

  return {
    title: "Quick Draw",
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

      if (state.phase === "wait") {
        state.timer -= 1;
        if (state.timer <= 0) {
          state.phase = "go";
          state.goTicks = 0;
          state.message = "DRAW";
          state.info = "";
        }
      } else if (state.phase === "go") {
        state.goTicks += 1;
        if (state.goTicks > 95) {
          state.fouls += 1;
          state.streak = 0;
          state.phase = "result";
          state.timer = 42;
          state.message = "Too slow";
          state.info = "";
          if (state.fouls >= 3) {
            state.status = "game_over";
            state.message = "Disqualified";
          }
        }
      } else if (state.phase === "result") {
        state.timer -= 1;
        if (state.timer <= 0 && state.status === "running") {
          nextRound();
        }
      }
    },
    render() {
      clearCanvas(ctx, "#efece4");

      ctx.fillStyle = "#151515";
      ctx.fillRect(58, 120, 364, 236);

      ctx.fillStyle = state.phase === "go" ? "#f4d20b" : "#f7f7f7";
      ctx.font = "900 54px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.message, CANVAS_SIZE / 2, 210);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "700 30px Arial";
      ctx.fillText(state.info, CANVAS_SIZE / 2, 270);

      if (state.status !== "game_over") {
        ctx.fillStyle = "#1e61ff";
        ctx.fillRect(150, 382, 180, 42);
        ctx.fillStyle = "#fff";
        ctx.font = "700 24px Arial";
        ctx.fillText("Select / F", CANVAS_SIZE / 2, 404);
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
        return actionDraw();
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "SELECT") {
        return actionDraw();
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
      const best = Number.isFinite(bestMs) ? `${bestMs}ms` : "-";
      if (state.status === "game_over") {
        return {
          score: `Score: ${state.score} | Streak: ${state.streak} | Fouls: ${state.fouls}/3 | Best: ${best}`,
          status: "Game over. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Streak: ${state.streak} | Fouls: ${state.fouls}/3 | Best: ${best}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Score: ${state.score} | Streak: ${state.streak} | Fouls: ${state.fouls}/3 | Best: ${best}`,
        status: "Wait for DRAW then press Select/F fast.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
