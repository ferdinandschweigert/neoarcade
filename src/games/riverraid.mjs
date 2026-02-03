import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDot, clamp, rectsOverlap } from "./shared.mjs";

export function createRiverRaidGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      lives: 3,
      ticks: 0,
      invuln: 0,
      fireCooldown: 0,
      playerX: CANVAS_SIZE / 2,
      input: {
        left: false,
        right: false,
        fire: false,
      },
      bullets: [],
      enemies: [],
      islands: [],
    };
  }

  function shoot() {
    if (state.status !== "running" || state.fireCooldown > 0) {
      return false;
    }
    state.fireCooldown = 8;
    state.bullets.push({ x: state.playerX, y: CANVAS_SIZE - 72, vy: -8.6 });
    return true;
  }

  function hurtPlayer() {
    if (state.invuln > 0 || state.status !== "running") {
      return;
    }

    state.lives -= 1;
    state.invuln = 70;
    state.playerX = CANVAS_SIZE / 2;
    if (state.lives <= 0) {
      state.lives = 0;
      state.status = "game_over";
    }
  }

  return {
    title: "River Raid",
    controlScheme: "horizontal_select",
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

      if (state.input.left) {
        state.playerX -= 4.5;
      }
      if (state.input.right) {
        state.playerX += 4.5;
      }

      state.playerX = clamp(state.playerX, 70, CANVAS_SIZE - 70);

      if (state.input.fire) {
        shoot();
      }

      if (state.fireCooldown > 0) {
        state.fireCooldown -= 1;
      }

      if (state.invuln > 0) {
        state.invuln -= 1;
      }

      const speed = 3 + Math.min(3.2, state.score / 500);

      if (state.ticks % 22 === 0) {
        const width = 52 + Math.random() * 64;
        const x = 50 + Math.random() * (CANVAS_SIZE - 100 - width);
        state.islands.push({ x, y: -60, width, height: 40 + Math.random() * 34 });
      }

      if (state.ticks % 34 === 0) {
        state.enemies.push({
          x: 80 + Math.random() * (CANVAS_SIZE - 160),
          y: -40,
          vy: speed + 1.1,
          size: 17,
        });
      }

      for (const bullet of state.bullets) {
        bullet.y += bullet.vy;
      }
      state.bullets = state.bullets.filter((bullet) => bullet.y > -20);

      for (const island of state.islands) {
        island.y += speed;
      }
      state.islands = state.islands.filter((island) => island.y < CANVAS_SIZE + 50);

      for (const enemy of state.enemies) {
        enemy.y += enemy.vy;
      }
      state.enemies = state.enemies.filter((enemy) => enemy.y < CANVAS_SIZE + 30);

      for (const bullet of state.bullets) {
        for (const enemy of state.enemies) {
          if (rectsOverlap(bullet.x - 2, bullet.y - 6, 4, 12, enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2)) {
            enemy.y = CANVAS_SIZE + 100;
            bullet.y = -100;
            state.score += 20;
            break;
          }
        }
      }

      const playerRect = {
        x: state.playerX - 16,
        y: CANVAS_SIZE - 70,
        w: 32,
        h: 30,
      };

      for (const island of state.islands) {
        if (rectsOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, island.x, island.y, island.width, island.height)) {
          hurtPlayer();
          break;
        }
      }

      for (const enemy of state.enemies) {
        if (rectsOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2)) {
          hurtPlayer();
          enemy.y = CANVAS_SIZE + 100;
        }
      }

      if (state.ticks % 7 === 0) {
        state.score += 1;
      }

      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#06243e");

      ctx.fillStyle = "#0d5b7f";
      ctx.fillRect(48, 0, CANVAS_SIZE - 96, CANVAS_SIZE);

      ctx.fillStyle = "#9ca67b";
      ctx.fillRect(0, 0, 48, CANVAS_SIZE);
      ctx.fillRect(CANVAS_SIZE - 48, 0, 48, CANVAS_SIZE);

      ctx.fillStyle = "#6f5e39";
      for (const island of state.islands) {
        ctx.fillRect(island.x, island.y, island.width, island.height);
      }

      ctx.fillStyle = "#ef4444";
      for (const enemy of state.enemies) {
        drawDot(ctx, enemy.x, enemy.y, enemy.size);
      }

      ctx.fillStyle = "#f8fafc";
      for (const bullet of state.bullets) {
        ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
      }

      const blink = state.invuln > 0 && state.invuln % 8 < 4;
      if (!blink) {
        ctx.fillStyle = "#f4d20b";
        ctx.beginPath();
        ctx.moveTo(state.playerX, CANVAS_SIZE - 84);
        ctx.lineTo(state.playerX + 16, CANVAS_SIZE - 40);
        ctx.lineTo(state.playerX - 16, CANVAS_SIZE - 40);
        ctx.closePath();
        ctx.fill();
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

      const direction = directionFromKey(keyText);
      if (direction === "LEFT") {
        state.input.left = true;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = true;
        return true;
      }

      if (key === "f" || key === "q" || key === "e") {
        state.input.fire = true;
        shoot();
        return true;
      }

      return false;
    },
    onKeyUp(keyText) {
      const direction = directionFromKey(keyText);
      if (direction === "LEFT") {
        state.input.left = false;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = false;
        return true;
      }

      const key = String(keyText).toLowerCase();
      if (key === "f" || key === "q" || key === "e") {
        state.input.fire = false;
        return true;
      }
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.playerX = clamp(state.playerX - 22, 70, CANVAS_SIZE - 70);
        return true;
      }
      if (action === "RIGHT") {
        state.playerX = clamp(state.playerX + 22, 70, CANVAS_SIZE - 70);
        return true;
      }
      if (action === "SELECT") {
        return shoot();
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
      const scoreLine = `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Mission failed. Press Restart or Enter.",
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
        status: "Steer with Left/Right, fire with Select/F.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
