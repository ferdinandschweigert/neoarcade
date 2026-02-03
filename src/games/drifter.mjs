import { CANVAS_SIZE, clearCanvas, clamp, rectsOverlap } from "./shared.mjs";

export function createDrifterGame(ctx) {
  const difficultyPresets = {
    easy: { lives: 3, speed: 3.4, steer: 0.26 },
    normal: { lives: 2, speed: 4, steer: 0.3 },
    hard: { lives: 1, speed: 4.8, steer: 0.34 },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      level: 1,
      lives: preset().lives,
      playerX: CANVAS_SIZE / 2,
      playerY: CANVAS_SIZE - 90,
      vx: 0,
      input: { left: false, right: false },
      obstacles: [],
      spawnCooldown: 26,
      roadPhase: 0,
      roadCenter: CANVAS_SIZE / 2,
      roadHalfWidth: 118,
      message: "",
    };
  }

  function spawnObstacle() {
    const laneOffset = (Math.random() * 2 - 1) * (state.roadHalfWidth - 24);
    state.obstacles.push({
      x: state.roadCenter + laneOffset,
      y: -30,
      w: 26,
      h: 40,
      color: Math.random() > 0.5 ? "#ef4444" : "#f59e0b",
    });
  }

  function loseLife() {
    state.lives -= 1;
    state.obstacles = [];
    state.playerX = state.roadCenter;
    state.vx = 0;
    if (state.lives <= 0) {
      state.status = "game_over";
    }
  }

  return {
    title: "Neon Drifter",
    controlScheme: "horizontal",
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
      state.level = Math.max(1, Math.floor(state.score / 18) + 1);

      state.roadPhase += 0.02 + state.level * 0.0007;
      state.roadCenter = CANVAS_SIZE / 2 + Math.sin(state.roadPhase) * 72;

      if (state.input.left) {
        state.vx -= cfg.steer;
      }
      if (state.input.right) {
        state.vx += cfg.steer;
      }
      state.vx *= 0.9;
      state.playerX += state.vx * 12;

      const minX = state.roadCenter - state.roadHalfWidth + 16;
      const maxX = state.roadCenter + state.roadHalfWidth - 16;
      state.playerX = clamp(state.playerX, minX, maxX);

      const speed = cfg.speed + state.level * 0.25;

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnObstacle();
        state.spawnCooldown = Math.max(9, 26 - state.level) + Math.floor(Math.random() * 10);
      }

      for (const obstacle of state.obstacles) {
        obstacle.y += speed;
      }
      state.obstacles = state.obstacles.filter((obstacle) => obstacle.y < CANVAS_SIZE + 40);

      const roadMiss =
        state.playerX <= minX + 1 ||
        state.playerX >= maxX - 1;

      const crash = state.obstacles.some((obstacle) =>
        rectsOverlap(
          state.playerX - 14,
          state.playerY - 18,
          28,
          36,
          obstacle.x - obstacle.w / 2,
          obstacle.y - obstacle.h / 2,
          obstacle.w,
          obstacle.h,
        ),
      );

      if (roadMiss || crash) {
        loseLife();
        return;
      }

      state.score += 0.5;
      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#101317");

      const roadLeft = state.roadCenter - state.roadHalfWidth;
      const roadRight = state.roadCenter + state.roadHalfWidth;

      ctx.fillStyle = "#1f2937";
      ctx.fillRect(roadLeft, 0, state.roadHalfWidth * 2, CANVAS_SIZE);

      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(state.roadCenter, 0);
      ctx.lineTo(state.roadCenter, CANVAS_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const obstacle of state.obstacles) {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x - obstacle.w / 2, obstacle.y - obstacle.h / 2, obstacle.w, obstacle.h);
      }

      ctx.fillStyle = "#1e61ff";
      ctx.fillRect(state.playerX - 14, state.playerY - 18, 28, 36);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(state.playerX - 4, state.playerY - 12, 8, 10);
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
        state.input.left = true;
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.input.right = true;
        return true;
      }
      return false;
    },
    onKeyUp(keyText) {
      const key = String(keyText).toLowerCase();
      if (key === "arrowleft" || key === "a") {
        state.input.left = false;
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.input.right = false;
        return true;
      }
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.playerX -= 22;
        return true;
      }
      if (action === "RIGHT") {
        state.playerX += 22;
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
      const scoreLine = `Score: ${Math.floor(state.score)} | Level: ${state.level} | Lives: ${state.lives} | Best: ${Math.floor(bestScore)}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Crash out (${difficulty}). Press Restart or Enter.`,
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
        status: `Stay on track and dodge traffic cones (${difficulty}).`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
