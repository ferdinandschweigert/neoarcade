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

export function createBlasterGame(ctx) {
  const playerWidth = 44;
  const playerHeight = 20;
  const playerY = CANVAS_SIZE - 40;
  const enemyWidth = 30;
  const enemyHeight = 18;
  const enemyGapX = 14;
  const enemyGapY = 12;
  const baseRows = 4;
  const cols = 8;
  const maxRows = 6;
  const startX = 38;
  const startY = 54;

  let bestScore = 0;
  let state = createState();

  function createEnemies(rows) {
    const enemies = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        enemies.push({
          x: startX + col * (enemyWidth + enemyGapX),
          y: startY + row * (enemyHeight + enemyGapY),
          alive: true,
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
      playerX: CANVAS_SIZE / 2 - playerWidth / 2,
      input: {
        left: false,
        right: false,
      },
      bullets: [],
      enemyBullets: [],
      enemies: createEnemies(baseRows),
      enemyDirection: 1,
      enemySpeed: 1.05,
      enemyShotCooldown: 50,
      shotCooldown: 0,
    };
  }

  function aliveEnemies() {
    return state.enemies.filter((enemy) => enemy.alive);
  }

  function shootPlayerBullet() {
    if (state.status !== "running" || state.shotCooldown > 0) {
      return false;
    }

    state.bullets.push({
      x: state.playerX + playerWidth / 2,
      y: playerY - playerHeight / 2,
      vy: -8.2,
    });
    state.shotCooldown = 8;
    return true;
  }

  function spawnWave() {
    const rows = Math.min(maxRows, baseRows + Math.floor((state.level - 1) / 2));
    state.enemies = createEnemies(rows);
    state.enemyDirection = state.level % 2 === 0 ? -1 : 1;
    state.enemySpeed = Math.min(2.8, 1 + state.level * 0.17);
    state.enemyBullets = [];
    state.bullets = [];
    state.enemyShotCooldown = Math.max(20, 50 - state.level * 3);
    state.playerX = CANVAS_SIZE / 2 - playerWidth / 2;
    state.shotCooldown = 0;
  }

  function moveEnemies() {
    const alive = aliveEnemies();
    if (alive.length === 0) {
      return;
    }

    for (const enemy of alive) {
      enemy.x += state.enemyDirection * state.enemySpeed;
    }

    const rightEdge = Math.max(...alive.map((enemy) => enemy.x + enemyWidth));
    const leftEdge = Math.min(...alive.map((enemy) => enemy.x));

    if (rightEdge >= CANVAS_SIZE - 14 || leftEdge <= 14) {
      state.enemyDirection *= -1;
      for (const enemy of alive) {
        enemy.y += 16;
      }
    }

    const invaded = alive.some((enemy) => enemy.y + enemyHeight >= playerY - 6);
    if (invaded) {
      state.status = "game_over";
    }
  }

  function maybeEnemyShoot() {
    const alive = aliveEnemies();
    if (alive.length === 0) {
      return;
    }

    state.enemyShotCooldown -= 1;
    if (state.enemyShotCooldown > 0) {
      return;
    }

    const shooter = alive[Math.floor(Math.random() * alive.length)];
    state.enemyBullets.push({
      x: shooter.x + enemyWidth / 2,
      y: shooter.y + enemyHeight + 2,
      vy: 3.8 + state.level * 0.25,
    });
    state.enemyShotCooldown = Math.max(16, 48 - state.level * 2);
  }

  return {
    title: "Blaster",
    controlScheme: "hfire",
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

      if (state.shotCooldown > 0) {
        state.shotCooldown -= 1;
      }

      if (state.input.left) {
        state.playerX -= 6;
      }

      if (state.input.right) {
        state.playerX += 6;
      }

      state.playerX = clamp(state.playerX, 8, CANVAS_SIZE - playerWidth - 8);

      moveEnemies();
      maybeEnemyShoot();

      for (const bullet of state.bullets) {
        bullet.y += bullet.vy;
      }

      for (const bullet of state.enemyBullets) {
        bullet.y += bullet.vy;
      }

      state.bullets = state.bullets.filter((bullet) => bullet.y > -12);
      state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.y < CANVAS_SIZE + 16);

      for (const bullet of state.bullets) {
        for (const enemy of state.enemies) {
          if (!enemy.alive) {
            continue;
          }

          const hit = rectsOverlap(
            bullet.x - 2,
            bullet.y - 8,
            4,
            10,
            enemy.x,
            enemy.y,
            enemyWidth,
            enemyHeight,
          );

          if (!hit) {
            continue;
          }

          enemy.alive = false;
          bullet.y = -100;
          state.score += 12;
          if (state.score > bestScore) {
            bestScore = state.score;
          }
          break;
        }
      }

      for (const bullet of state.enemyBullets) {
        const hitPlayer = rectsOverlap(
          bullet.x - 2,
          bullet.y - 6,
          4,
          10,
          state.playerX,
          playerY - playerHeight / 2,
          playerWidth,
          playerHeight,
        );

        if (hitPlayer) {
          state.status = "game_over";
          break;
        }
      }

      if (state.status === "running" && aliveEnemies().length === 0) {
        state.level += 1;
        spawnWave();
      }
    },
    render() {
      clearCanvas(ctx, "#0f1318");

      ctx.fillStyle = "#283141";
      for (let line = 1; line < 10; line += 1) {
        const y = (CANVAS_SIZE / 10) * line;
        ctx.fillRect(0, y, CANVAS_SIZE, 1);
      }

      for (const enemy of state.enemies) {
        if (!enemy.alive) {
          continue;
        }

        ctx.fillStyle = "#3d7cff";
        ctx.fillRect(enemy.x, enemy.y, enemyWidth, enemyHeight);
        ctx.fillStyle = "#101010";
        ctx.fillRect(enemy.x + 6, enemy.y + 6, 5, 5);
        ctx.fillRect(enemy.x + enemyWidth - 11, enemy.y + 6, 5, 5);
      }

      ctx.fillStyle = "#f3d312";
      ctx.beginPath();
      ctx.moveTo(state.playerX + playerWidth / 2, playerY - playerHeight / 2);
      ctx.lineTo(state.playerX + playerWidth, playerY + playerHeight / 2);
      ctx.lineTo(state.playerX, playerY + playerHeight / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f8fafc";
      for (const bullet of state.bullets) {
        ctx.fillRect(bullet.x - 1.5, bullet.y - 8, 3, 10);
      }

      ctx.fillStyle = "#ff5a4f";
      for (const bullet of state.enemyBullets) {
        ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 10);
      }
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

      if (normalized === "arrowup" || normalized === "w" || normalized === "f") {
        return shootPlayerBullet();
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
        state.playerX -= 28;
        state.playerX = clamp(state.playerX, 8, CANVAS_SIZE - playerWidth - 8);
        return true;
      }

      if (action === "RIGHT") {
        state.playerX += 28;
        state.playerX = clamp(state.playerX, 8, CANVAS_SIZE - playerWidth - 8);
        return true;
      }

      if (action === "UP") {
        return shootPlayerBullet();
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
          score: `Score: ${state.score} | Level: ${state.level} | Best: ${bestScore}`,
          status: "Ship destroyed. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Level: ${state.level} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Score: ${state.score} | Level: ${state.level} | Best: ${bestScore}`,
        status: "Move Left/Right. Shoot with Up/W/F.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
