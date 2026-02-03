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

export function createRunnerGame(ctx) {
  const playerX = 92;
  const playerWidth = 34;
  const playerHeight = 44;
  const groundY = CANVAS_SIZE - 84;

  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      ticks: 0,
      speed: 5,
      playerY: groundY,
      playerVy: 0,
      jumpQueued: false,
      obstacles: [],
      spawnCooldown: 52,
    };
  }

  function queueJump() {
    if (state.status !== "running") {
      return false;
    }
    state.jumpQueued = true;
    return true;
  }

  function spawnObstacle() {
    const fly = Math.random() < 0.24;
    const width = 24 + Math.random() * 36;
    const height = fly ? 22 + Math.random() * 18 : 30 + Math.random() * 42;
    const y = fly ? groundY - 56 - Math.random() * 38 : groundY + playerHeight - height;

    state.obstacles.push({
      x: CANVAS_SIZE + 22,
      y,
      width,
      height,
      color: fly ? "#1e61ff" : "#e24739",
    });
  }

  return {
    title: "Sky Runner",
    controlScheme: "dpad",
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

      state.ticks += 1;
      state.speed = Math.min(12.5, 5 + state.ticks / 900);

      const onGround = state.playerY >= groundY - 0.5;
      if (state.jumpQueued && onGround) {
        state.playerVy = -12.2;
        state.jumpQueued = false;
      }

      state.playerVy += 0.68;
      state.playerY += state.playerVy;
      if (state.playerY >= groundY) {
        state.playerY = groundY;
        state.playerVy = 0;
      }

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnObstacle();
        state.spawnCooldown =
          Math.max(22, 54 - Math.floor(state.speed * 2.6)) + Math.floor(Math.random() * 24);
      }

      for (const obstacle of state.obstacles) {
        obstacle.x -= state.speed;
      }

      state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -24);

      if (state.ticks % 6 === 0) {
        state.score += 1;
        if (state.score > bestScore) {
          bestScore = state.score;
        }
      }

      const hit = state.obstacles.some((obstacle) =>
        rectsOverlap(
          playerX,
          state.playerY,
          playerWidth,
          playerHeight,
          obstacle.x,
          obstacle.y,
          obstacle.width,
          obstacle.height,
        ),
      );

      if (hit) {
        state.status = "game_over";
      }
    },
    render() {
      clearCanvas(ctx, "#eef2f3");

      ctx.fillStyle = "#f5d61d";
      drawDot(ctx, CANVAS_SIZE - 62, 58, 30);

      ctx.fillStyle = "#dce7ef";
      ctx.fillRect(0, CANVAS_SIZE - 160, CANVAS_SIZE, 78);
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, groundY + playerHeight + 8, CANVAS_SIZE, 4);
      ctx.fillStyle = "#26343c";
      ctx.fillRect(0, groundY + playerHeight + 12, CANVAS_SIZE, CANVAS_SIZE);

      for (const obstacle of state.obstacles) {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      }

      ctx.fillStyle = "#1e61ff";
      ctx.fillRect(playerX, state.playerY + 8, playerWidth, playerHeight - 8);
      ctx.fillStyle = "#f4d20b";
      drawDot(ctx, playerX + playerWidth / 2, state.playerY + 8, 11);
      ctx.fillStyle = "#111";
      drawDot(ctx, playerX + playerWidth / 2 + 3, state.playerY + 7, 2.5);
    },
    onKeyDown(keyText) {
      const normalized = String(keyText).toLowerCase();

      if (normalized === " ") {
        this.togglePause();
        return true;
      }

      if (normalized === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }

      if (normalized === "arrowup" || normalized === "w") {
        return queueJump();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "UP") {
        return queueJump();
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
          score: `Score: ${state.score} | Best: ${bestScore}`,
          status: "Wipeout. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Score: ${state.score} | Best: ${bestScore}`,
        status: "Jump with Up/W to avoid obstacles.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
