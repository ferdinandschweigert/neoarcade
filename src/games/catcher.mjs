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

export function createCatcherGame(ctx) {
  const basketY = CANVAS_SIZE - 46;
  const basketW = 84;
  const basketH = 18;

  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      basketX: CANVAS_SIZE / 2 - basketW / 2,
      input: { left: false, right: false },
      items: [],
      spawnCooldown: 24,
      score: 0,
      lives: 3,
    };
  }

  function spawnItem() {
    const type = Math.random() < 0.78 ? "gem" : "bomb";
    state.items.push({
      x: 20 + Math.random() * (CANVAS_SIZE - 40),
      y: -10,
      vy: 2.4 + Math.random() * 2.4,
      type,
      size: type === "gem" ? 10 : 12,
    });
  }

  return {
    title: "Gem Catch",
    controlScheme: "horizontal",
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

      if (state.input.left) {
        state.basketX -= 8;
      }
      if (state.input.right) {
        state.basketX += 8;
      }
      state.basketX = clamp(state.basketX, 8, CANVAS_SIZE - basketW - 8);

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnItem();
        state.spawnCooldown = 14 + Math.floor(Math.random() * 20);
      }

      for (const item of state.items) {
        item.y += item.vy;
      }

      const remaining = [];
      for (const item of state.items) {
        const hit = rectsOverlap(
          item.x - item.size,
          item.y - item.size,
          item.size * 2,
          item.size * 2,
          state.basketX,
          basketY,
          basketW,
          basketH,
        );

        if (hit) {
          if (item.type === "gem") {
            state.score += 1;
            bestScore = Math.max(bestScore, state.score);
          } else {
            state.lives -= 1;
            if (state.lives <= 0) {
              state.status = "game_over";
            }
          }
          continue;
        }

        if (item.y - item.size > CANVAS_SIZE + 5) {
          continue;
        }

        remaining.push(item);
      }

      state.items = remaining;
    },
    render() {
      clearCanvas(ctx, "#eef4f8");

      ctx.fillStyle = "#2b3944";
      ctx.fillRect(0, basketY + basketH + 4, CANVAS_SIZE, CANVAS_SIZE);

      for (const item of state.items) {
        if (item.type === "gem") {
          ctx.fillStyle = "#1e61ff";
          drawDiamond(ctx, item.x, item.y, item.size);
        } else {
          ctx.fillStyle = "#e24739";
          drawDot(ctx, item.x, item.y, item.size);
          ctx.fillStyle = "#111";
          drawDot(ctx, item.x, item.y, 3);
        }
      }

      ctx.fillStyle = "#f4d20b";
      ctx.fillRect(state.basketX, basketY, basketW, basketH);
      ctx.fillStyle = "#111";
      ctx.fillRect(state.basketX + 8, basketY + 5, basketW - 16, 8);
    },
    onKeyDown(keyText) {
      const keyLower = String(keyText).toLowerCase();
      if (keyLower === " ") {
        this.togglePause();
        return true;
      }
      if (keyLower === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }
      if (keyLower === "arrowleft" || keyLower === "a") {
        state.input.left = true;
        return true;
      }
      if (keyLower === "arrowright" || keyLower === "d") {
        state.input.right = true;
        return true;
      }
      return false;
    },
    onKeyUp(keyText) {
      const keyLower = String(keyText).toLowerCase();
      if (keyLower === "arrowleft" || keyLower === "a") {
        state.input.left = false;
        return true;
      }
      if (keyLower === "arrowright" || keyLower === "d") {
        state.input.right = false;
        return true;
      }
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.basketX -= 28;
        state.basketX = clamp(state.basketX, 8, CANVAS_SIZE - basketW - 8);
        return true;
      }
      if (action === "RIGHT") {
        state.basketX += 28;
        state.basketX = clamp(state.basketX, 8, CANVAS_SIZE - basketW - 8);
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
      state = createState();
    },
    getTickMs() {
      return 16;
    },
    getHud() {
      if (state.status === "game_over") {
        return {
          score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
          status: "Out of lives. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
        status: "Move basket with Left/Right to catch gems.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
