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

export function createDodgerGame(ctx) {
  const playerSize = 28;
  const lanePadding = 18;

  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      difficulty: 1,
      ticks: 0,
      spawnCooldown: 26,
      playerX: CANVAS_SIZE / 2 - playerSize / 2,
      input: {
        left: false,
        right: false,
      },
      blocks: [],
    };
  }

  function spawnBlock() {
    const width = 24 + Math.floor(Math.random() * 30);
    const x = lanePadding + Math.random() * (CANVAS_SIZE - lanePadding * 2 - width);
    const speed = 2.9 + state.difficulty * 0.45 + Math.random() * 1.15;
    state.blocks.push({
      x,
      y: -24,
      width,
      height: 18 + Math.random() * 16,
      speed,
      color: Math.random() > 0.5 ? "#e24739" : "#1e61ff",
    });
  }

  function playerTop() {
    return CANVAS_SIZE - 44;
  }

  return {
    title: "Dodger",
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
        state.playerX -= 7;
      }
      if (state.input.right) {
        state.playerX += 7;
      }

      state.playerX = clamp(
        state.playerX,
        lanePadding,
        CANVAS_SIZE - lanePadding - playerSize,
      );

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnBlock();
        state.spawnCooldown = Math.max(8, 26 - state.difficulty * 2);
      }

      state.ticks += 1;
      if (state.ticks % 45 === 0) {
        state.score += 1;
        if (state.score > bestScore) {
          bestScore = state.score;
        }
      }

      if (state.ticks % 240 === 0) {
        state.difficulty += 1;
      }

      for (const block of state.blocks) {
        block.y += block.speed;
      }

      state.blocks = state.blocks.filter((block) => block.y < CANVAS_SIZE + 28);

      const hit = state.blocks.some((block) =>
        rectsOverlap(
          state.playerX,
          playerTop(),
          playerSize,
          playerSize,
          block.x,
          block.y,
          block.width,
          block.height,
        ),
      );

      if (hit) {
        state.status = "game_over";
      }
    },
    render() {
      clearCanvas(ctx, "#f1eee6");

      ctx.strokeStyle = "#2f2f2f";
      ctx.lineWidth = 2;
      for (let lane = 1; lane <= 5; lane += 1) {
        const x = (CANVAS_SIZE / 6) * lane;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
        ctx.stroke();
      }

      for (const block of state.blocks) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);
      }

      ctx.fillStyle = "#f4d20b";
      ctx.fillRect(state.playerX, playerTop(), playerSize, playerSize);
      ctx.fillStyle = "#101010";
      ctx.fillRect(state.playerX + 8, playerTop() + 8, 12, 12);
    },
    onKeyDown(key) {
      const normalized = String(key).toLowerCase();

      if (normalized === " ") {
        this.togglePause();
        return true;
      }

      if (normalized === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }

      if (normalized === "arrowleft" || normalized === "a") {
        state.input.left = true;
        return true;
      }

      if (normalized === "arrowright" || normalized === "d") {
        state.input.right = true;
        return true;
      }

      return false;
    },
    onKeyUp(key) {
      const normalized = String(key).toLowerCase();

      if (normalized === "arrowleft" || normalized === "a") {
        state.input.left = false;
        return true;
      }

      if (normalized === "arrowright" || normalized === "d") {
        state.input.right = false;
        return true;
      }

      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.playerX -= 30;
        state.playerX = clamp(
          state.playerX,
          lanePadding,
          CANVAS_SIZE - lanePadding - playerSize,
        );
        return true;
      }

      if (action === "RIGHT") {
        state.playerX += 30;
        state.playerX = clamp(
          state.playerX,
          lanePadding,
          CANVAS_SIZE - lanePadding - playerSize,
        );
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
          score: `Score: ${state.score} | Best: ${bestScore}`,
          status: "Crash. Press Restart or Enter.",
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
        status: "Stay alive. Move with Left/Right or A/D.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
