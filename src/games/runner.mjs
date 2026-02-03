import { CANVAS_SIZE, clearCanvas, clamp, drawDot, rectsOverlap } from "./shared.mjs";

export function createRunnerGame(ctx) {
  const playerX = 92;
  const playerWidth = 34;
  const playerHeight = 44;
  const groundY = CANVAS_SIZE - 84;

  const difficultyPresets = {
    easy: {
      gravity: 0.62,
      jumpVelocity: -11.6,
      baseSpeed: 4.5,
      speedGain: 0.9,
      spawnBase: 64,
      spawnVariance: 26,
      scoreRate: 1,
    },
    normal: {
      gravity: 0.68,
      jumpVelocity: -12.2,
      baseSpeed: 5,
      speedGain: 1.05,
      spawnBase: 54,
      spawnVariance: 24,
      scoreRate: 1,
    },
    hard: {
      gravity: 0.74,
      jumpVelocity: -12.8,
      baseSpeed: 5.8,
      speedGain: 1.25,
      spawnBase: 46,
      spawnVariance: 20,
      scoreRate: 1.15,
    },
  };

  let bestScore = 0;
  let difficulty = "normal";
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      ticks: 0,
      level: 1,
      speed: preset().baseSpeed,
      playerY: groundY,
      playerVy: 0,
      jumpQueued: false,
      obstacles: [],
      spawnCooldown: preset().spawnBase,
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
    const fly = Math.random() < 0.28;
    const width = 24 + Math.random() * 36;
    const height = fly ? 20 + Math.random() * 18 : 30 + Math.random() * 42;
    const y = fly ? groundY - 56 - Math.random() * 40 : groundY + playerHeight - height;

    state.obstacles.push({
      x: CANVAS_SIZE + 22,
      y,
      width,
      height,
      color: fly ? "#1e61ff" : "#e24739",
    });
  }

  function recomputeLevel() {
    state.level = Math.max(1, Math.floor(state.score / 40) + 1);
  }

  return {
    title: "Sky Runner",
    controlScheme: "dpad",
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
    tick() {
      if (state.status !== "running") {
        return;
      }

      const cfg = preset();
      state.ticks += 1;
      recomputeLevel();
      state.speed = Math.min(14.5, cfg.baseSpeed + state.level * cfg.speedGain + state.ticks / 1200);

      const onGround = state.playerY >= groundY - 0.5;
      if (state.jumpQueued && onGround) {
        state.playerVy = cfg.jumpVelocity;
        state.jumpQueued = false;
      }

      state.playerVy += cfg.gravity;
      state.playerY += state.playerVy;
      if (state.playerY >= groundY) {
        state.playerY = groundY;
        state.playerVy = 0;
      }

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnObstacle();
        const levelReduction = Math.floor(state.level * 1.6);
        state.spawnCooldown = Math.max(18, cfg.spawnBase - levelReduction) + Math.floor(Math.random() * cfg.spawnVariance);
      }

      for (const obstacle of state.obstacles) {
        obstacle.x -= state.speed;
      }

      state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -24);

      if (state.ticks % 6 === 0) {
        state.score += cfg.scoreRate;
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
      const scoreLine = `Score: ${Math.floor(state.score)} | Level: ${state.level} | Best: ${Math.floor(bestScore)}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Wipeout (${difficulty}). Press Restart or Enter.`,
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
        status: `Jump with Up/W (${difficulty}) and survive each speed level.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
