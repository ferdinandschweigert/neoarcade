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

export function createOrbitGame(ctx) {
  const playerRadius = 12;
  const arenaPadding = 14;

  let bestScore = 0;
  let state = createState();

  function createOrb(count = 4) {
    const orbs = [];
    for (let i = 0; i < count; i += 1) {
      const radius = 10 + Math.random() * 10;
      orbs.push({
        x: 34 + Math.random() * (CANVAS_SIZE - 68),
        y: 34 + Math.random() * (CANVAS_SIZE - 68),
        vx: (Math.random() * 2 - 1) * 2.6,
        vy: (Math.random() * 2 - 1) * 2.6,
        radius,
        color: Math.random() > 0.5 ? "#f4d20b" : "#e24739",
      });
    }
    return orbs;
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      ticks: 0,
      player: {
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        vx: 0,
        vy: 0,
      },
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      spawnCooldown: 190,
      orbs: createOrb(4),
    };
  }

  return {
    title: "Orbit Dodge",
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

      if (state.input.up) {
        state.player.vy -= 0.42;
      }
      if (state.input.down) {
        state.player.vy += 0.42;
      }
      if (state.input.left) {
        state.player.vx -= 0.42;
      }
      if (state.input.right) {
        state.player.vx += 0.42;
      }

      state.player.vx *= 0.9;
      state.player.vy *= 0.9;
      state.player.vx = clamp(state.player.vx, -6.2, 6.2);
      state.player.vy = clamp(state.player.vy, -6.2, 6.2);

      state.player.x += state.player.vx;
      state.player.y += state.player.vy;

      if (state.player.x < arenaPadding + playerRadius) {
        state.player.x = arenaPadding + playerRadius;
        state.player.vx *= -0.3;
      }
      if (state.player.x > CANVAS_SIZE - arenaPadding - playerRadius) {
        state.player.x = CANVAS_SIZE - arenaPadding - playerRadius;
        state.player.vx *= -0.3;
      }
      if (state.player.y < arenaPadding + playerRadius) {
        state.player.y = arenaPadding + playerRadius;
        state.player.vy *= -0.3;
      }
      if (state.player.y > CANVAS_SIZE - arenaPadding - playerRadius) {
        state.player.y = CANVAS_SIZE - arenaPadding - playerRadius;
        state.player.vy *= -0.3;
      }

      for (const orb of state.orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x - orb.radius < arenaPadding || orb.x + orb.radius > CANVAS_SIZE - arenaPadding) {
          orb.vx *= -1;
        }
        if (orb.y - orb.radius < arenaPadding || orb.y + orb.radius > CANVAS_SIZE - arenaPadding) {
          orb.vy *= -1;
        }
      }

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0 && state.orbs.length < 12) {
        const bonusOrb = createOrb(1)[0];
        bonusOrb.vx *= 1.2;
        bonusOrb.vy *= 1.2;
        state.orbs.push(bonusOrb);
        state.spawnCooldown = Math.max(80, 190 - state.orbs.length * 10);
      }

      if (state.ticks % 8 === 0) {
        state.score += 1;
        if (state.score > bestScore) {
          bestScore = state.score;
        }
      }

      const hit = state.orbs.some((orb) => {
        const dx = state.player.x - orb.x;
        const dy = state.player.y - orb.y;
        return Math.hypot(dx, dy) < playerRadius + orb.radius;
      });

      if (hit) {
        state.status = "game_over";
      }
    },
    render() {
      clearCanvas(ctx, "#0b1118");

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let line = 1; line < 12; line += 1) {
        const offset = (CANVAS_SIZE / 12) * line;
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(CANVAS_SIZE, offset);
        ctx.stroke();
      }

      ctx.strokeStyle = "#f4d20b";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        arenaPadding,
        arenaPadding,
        CANVAS_SIZE - arenaPadding * 2,
        CANVAS_SIZE - arenaPadding * 2,
      );

      for (const orb of state.orbs) {
        ctx.fillStyle = orb.color;
        drawDot(ctx, orb.x, orb.y, orb.radius);
      }

      ctx.fillStyle = "#1e61ff";
      drawDiamond(ctx, state.player.x, state.player.y, playerRadius + 2);
      ctx.fillStyle = "#f8f8f8";
      drawDot(ctx, state.player.x, state.player.y, 4);
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
        state.input.up = true;
        return true;
      }
      if (normalized === "arrowdown" || normalized === "s") {
        state.input.down = true;
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
    onKeyUp(keyText) {
      const normalized = String(keyText).toLowerCase();

      if (normalized === "arrowup" || normalized === "w") {
        state.input.up = false;
        return true;
      }
      if (normalized === "arrowdown" || normalized === "s") {
        state.input.down = false;
        return true;
      }
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
      if (action === "UP") {
        state.player.vy -= 1.4;
        return true;
      }
      if (action === "DOWN") {
        state.player.vy += 1.4;
        return true;
      }
      if (action === "LEFT") {
        state.player.vx -= 1.4;
        return true;
      }
      if (action === "RIGHT") {
        state.player.vx += 1.4;
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
          status: "Impact. Press Restart or Enter.",
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
        status: "Use Arrow keys/WASD to dodge moving orbs.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
