import { CANVAS_SIZE, clearCanvas, clamp, drawDot } from "./shared.mjs";

export function createInvadersGame(ctx) {
  const enemyWidth = 28;
  const enemyHeight = 18;
  const enemyGapX = 16;
  const enemyGapY = 12;
  const playerY = CANVAS_SIZE - 34;

  const difficultyPresets = {
    easy: {
      lives: 4,
      enemySpeed: 0.9,
      enemyFireRate: 1.2,
      playerSpeed: 7,
    },
    normal: {
      lives: 3,
      enemySpeed: 1,
      enemyFireRate: 1,
      playerSpeed: 6.4,
    },
    hard: {
      lives: 2,
      enemySpeed: 1.18,
      enemyFireRate: 0.86,
      playerSpeed: 5.8,
    },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createWave(level) {
    const rows = Math.min(6, 3 + Math.floor((level - 1) / 2));
    const cols = 9;
    const width = cols * enemyWidth + (cols - 1) * enemyGapX;
    const startX = (CANVAS_SIZE - width) / 2;

    const enemies = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        enemies.push({
          x: startX + col * (enemyWidth + enemyGapX),
          y: 52 + row * (enemyHeight + enemyGapY),
          alive: true,
          row,
        });
      }
    }
    return enemies;
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      level: 1,
      lives: preset().lives,
      playerX: CANVAS_SIZE / 2 - 18,
      input: {
        left: false,
        right: false,
      },
      fireQueued: false,
      fireCooldown: 0,
      enemyStepCooldown: 0,
      enemyDirection: 1,
      enemyFireCooldown: 36,
      shots: [],
      enemyShots: [],
      enemies: createWave(1),
      message: "",
    };
  }

  function livingEnemies() {
    return state.enemies.filter((enemy) => enemy.alive);
  }

  function spawnEnemyShot() {
    const alive = livingEnemies();
    if (alive.length === 0) {
      return;
    }

    const source = alive[Math.floor(Math.random() * alive.length)];
    state.enemyShots.push({
      x: source.x + enemyWidth / 2,
      y: source.y + enemyHeight,
    });
  }

  function resetWave() {
    state.level += 1;
    state.enemies = createWave(state.level);
    state.enemyDirection = state.level % 2 === 0 ? -1 : 1;
    state.enemyStepCooldown = 0;
    state.enemyShots = [];
    state.message = `Wave ${state.level}`;
  }

  function loseLife() {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.status = "game_over";
      return;
    }

    state.playerX = CANVAS_SIZE / 2 - 18;
    state.enemyShots = [];
    state.shots = [];
  }

  return {
    title: "Invaders Command",
    controlScheme: "hfire",
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

      if (state.input.left) {
        state.playerX -= cfg.playerSpeed;
      }
      if (state.input.right) {
        state.playerX += cfg.playerSpeed;
      }
      state.playerX = clamp(state.playerX, 10, CANVAS_SIZE - 46);

      if (state.fireCooldown > 0) {
        state.fireCooldown -= 1;
      }
      if (state.fireQueued && state.fireCooldown <= 0) {
        state.shots.push({ x: state.playerX + 18, y: playerY - 4 });
        state.fireCooldown = 7;
      }
      state.fireQueued = false;

      for (const shot of state.shots) {
        shot.y -= 9;
      }
      state.shots = state.shots.filter((shot) => shot.y > -12);

      for (const shot of state.enemyShots) {
        shot.y += 4.8 + state.level * 0.16;
      }
      state.enemyShots = state.enemyShots.filter((shot) => shot.y < CANVAS_SIZE + 20);

      const moveEvery = Math.max(8, Math.round((24 - state.level * 1.3) * cfg.enemySpeed));
      state.enemyStepCooldown += 1;
      if (state.enemyStepCooldown >= moveEvery) {
        state.enemyStepCooldown = 0;

        const alive = livingEnemies();
        if (alive.length > 0) {
          const stepX = (8 + state.level * 0.32) * state.enemyDirection;
          let hitWall = false;
          for (const enemy of alive) {
            const nextX = enemy.x + stepX;
            if (nextX < 8 || nextX + enemyWidth > CANVAS_SIZE - 8) {
              hitWall = true;
              break;
            }
          }

          if (hitWall) {
            state.enemyDirection *= -1;
            for (const enemy of alive) {
              enemy.y += 16;
            }
          } else {
            for (const enemy of alive) {
              enemy.x += stepX;
            }
          }
        }
      }

      state.enemyFireCooldown -= 1;
      if (state.enemyFireCooldown <= 0) {
        spawnEnemyShot();
        state.enemyFireCooldown = Math.max(
          10,
          Math.round((38 - state.level * 1.6) * cfg.enemyFireRate),
        );
      }

      for (const shot of state.shots) {
        let spent = false;
        for (const enemy of state.enemies) {
          if (!enemy.alive || spent) {
            continue;
          }

          if (
            shot.x >= enemy.x &&
            shot.x <= enemy.x + enemyWidth &&
            shot.y >= enemy.y &&
            shot.y <= enemy.y + enemyHeight
          ) {
            enemy.alive = false;
            shot.y = -100;
            spent = true;
            state.score += 10 + state.level * 2;
            if (state.score > bestScore) {
              bestScore = state.score;
            }
          }
        }
      }
      state.shots = state.shots.filter((shot) => shot.y > -20);

      for (const shot of state.enemyShots) {
        const hit =
          shot.x >= state.playerX &&
          shot.x <= state.playerX + 36 &&
          shot.y >= playerY &&
          shot.y <= playerY + 16;
        if (hit) {
          shot.y = CANVAS_SIZE + 100;
          loseLife();
          if (state.status === "game_over") {
            break;
          }
        }
      }
      state.enemyShots = state.enemyShots.filter((shot) => shot.y < CANVAS_SIZE + 20);

      const alive = livingEnemies();
      if (alive.length > 0 && alive.some((enemy) => enemy.y + enemyHeight >= playerY - 6)) {
        state.status = "game_over";
      }

      if (state.status !== "game_over" && alive.length === 0) {
        state.score += 30 * state.level;
        if (state.score > bestScore) {
          bestScore = state.score;
        }
        resetWave();
      }
    },
    render() {
      clearCanvas(ctx, "#0f1722");

      ctx.fillStyle = "#131f2d";
      ctx.fillRect(0, CANVAS_SIZE - 56, CANVAS_SIZE, 56);

      for (const enemy of state.enemies) {
        if (!enemy.alive) {
          continue;
        }

        ctx.fillStyle = enemy.row % 2 === 0 ? "#47c3a2" : "#f4d20b";
        ctx.fillRect(enemy.x, enemy.y, enemyWidth, enemyHeight);
        ctx.fillStyle = "#0f1722";
        ctx.fillRect(enemy.x + 4, enemy.y + 4, enemyWidth - 8, 4);
      }

      ctx.fillStyle = "#1e61ff";
      ctx.fillRect(state.playerX, playerY, 36, 16);
      ctx.fillStyle = "#dbe7ff";
      drawDot(ctx, state.playerX + 18, playerY + 5, 4);

      ctx.fillStyle = "#f8fafc";
      for (const shot of state.shots) {
        ctx.fillRect(shot.x - 1.5, shot.y - 8, 3, 10);
      }

      ctx.fillStyle = "#e24739";
      for (const shot of state.enemyShots) {
        ctx.fillRect(shot.x - 1.5, shot.y, 3, 9);
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
        state.input.left = true;
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.input.right = true;
        return true;
      }
      if (key === "arrowup" || key === "w" || key === "f" || key === "enter") {
        state.fireQueued = true;
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
        state.playerX -= 20;
        state.playerX = clamp(state.playerX, 10, CANVAS_SIZE - 46);
        return true;
      }
      if (action === "RIGHT") {
        state.playerX += 20;
        state.playerX = clamp(state.playerX, 10, CANVAS_SIZE - 46);
        return true;
      }
      if (action === "UP" || action === "SELECT") {
        state.fireQueued = true;
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
      const scoreLine = `Score: ${state.score} | Level: ${state.level} | Lives: ${state.lives} | Best: ${bestScore}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Invasion complete (${difficulty}). Press Restart or Enter.`,
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

      const message = state.message ? `${state.message}. ` : "";
      return {
        score: scoreLine,
        status: `${message}Move Left/Right and fire with Up/F.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
