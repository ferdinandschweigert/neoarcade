import { CANVAS_SIZE, clearCanvas, drawDot } from "./shared.mjs";

export function createTurretDefenseGame(ctx) {
  const difficultyPresets = {
    easy: { coreHp: 5, enemySpeed: 1.8, spawnRate: 38 },
    normal: { coreHp: 4, enemySpeed: 2.1, spawnRate: 33 },
    hard: { coreHp: 3, enemySpeed: 2.5, spawnRate: 28 },
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
      coreHp: preset().coreHp,
      angle: -Math.PI / 2,
      bullets: [],
      enemies: [],
      spawnCooldown: preset().spawnRate,
      fireCooldown: 0,
      fireQueued: false,
    };
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * CANVAS_SIZE;
      y = -14;
    } else if (edge === 1) {
      x = CANVAS_SIZE + 14;
      y = Math.random() * CANVAS_SIZE;
    } else if (edge === 2) {
      x = Math.random() * CANVAS_SIZE;
      y = CANVAS_SIZE + 14;
    } else {
      x = -14;
      y = Math.random() * CANVAS_SIZE;
    }

    state.enemies.push({ x, y, r: 10, hp: 1 + (state.level >= 4 ? 1 : 0) });
  }

  function fire() {
    const speed = 7.5;
    state.bullets.push({
      x: CANVAS_SIZE / 2 + Math.cos(state.angle) * 26,
      y: CANVAS_SIZE / 2 + Math.sin(state.angle) * 26,
      vx: Math.cos(state.angle) * speed,
      vy: Math.sin(state.angle) * speed,
    });
  }

  return {
    title: "Turret Defense",
    controlScheme: "horizontal_select",
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
      state.level = Math.max(1, Math.floor(state.score / 12) + 1);

      if (state.fireCooldown > 0) {
        state.fireCooldown -= 1;
      }
      if (state.fireQueued && state.fireCooldown <= 0) {
        fire();
        state.fireCooldown = Math.max(4, 10 - Math.floor(state.level / 2));
      }
      state.fireQueued = false;

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnEnemy();
        state.spawnCooldown = Math.max(8, cfg.spawnRate - state.level);
      }

      for (const bullet of state.bullets) {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
      }
      state.bullets = state.bullets.filter(
        (bullet) => bullet.x >= -20 && bullet.x <= CANVAS_SIZE + 20 && bullet.y >= -20 && bullet.y <= CANVAS_SIZE + 20,
      );

      for (const enemy of state.enemies) {
        const dx = CANVAS_SIZE / 2 - enemy.x;
        const dy = CANVAS_SIZE / 2 - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = cfg.enemySpeed + state.level * 0.08;
        enemy.x += (dx / len) * speed;
        enemy.y += (dy / len) * speed;
      }

      for (const bullet of state.bullets) {
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) {
            continue;
          }
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          if (dx * dx + dy * dy <= (enemy.r + 2) * (enemy.r + 2)) {
            enemy.hp -= 1;
            bullet.x = -100;
            if (enemy.hp <= 0) {
              state.score += 1;
              if (state.score > bestScore) {
                bestScore = state.score;
              }
            }
          }
        }
      }

      state.bullets = state.bullets.filter((bullet) => bullet.x > -30);
      state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

      for (const enemy of state.enemies) {
        const dx = enemy.x - CANVAS_SIZE / 2;
        const dy = enemy.y - CANVAS_SIZE / 2;
        if (dx * dx + dy * dy < 22 * 22) {
          enemy.hp = 0;
          state.coreHp -= 1;
          if (state.coreHp <= 0) {
            state.status = "game_over";
            break;
          }
        }
      }

      state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
    },
    render() {
      clearCanvas(ctx, "#0b1220");

      ctx.fillStyle = "#1f2937";
      drawDot(ctx, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 24);
      ctx.fillStyle = "#22c55e";
      drawDot(ctx, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 10);

      const tx = CANVAS_SIZE / 2 + Math.cos(state.angle) * 26;
      const ty = CANVAS_SIZE / 2 + Math.sin(state.angle) * 26;
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.fillStyle = "#1e61ff";
      for (const bullet of state.bullets) {
        drawDot(ctx, bullet.x, bullet.y, 3);
      }

      ctx.fillStyle = "#ef4444";
      for (const enemy of state.enemies) {
        drawDot(ctx, enemy.x, enemy.y, enemy.r);
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
        state.angle -= 0.18;
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.angle += 0.18;
        return true;
      }
      if (key === "f" || key === "enter" || key === "arrowup" || key === "w") {
        state.fireQueued = true;
        return true;
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.angle -= 0.22;
        return true;
      }
      if (action === "RIGHT") {
        state.angle += 0.22;
        return true;
      }
      if (action === "SELECT") {
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
      const scoreLine = `Score: ${state.score} | Level: ${state.level} | Core HP: ${state.coreHp} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Core destroyed (${difficulty}). Press Restart or Enter.`,
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
        status: "Rotate turret and fire to defend the core.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
