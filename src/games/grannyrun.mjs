import { CANVAS_SIZE, clearCanvas, clamp, drawDot } from "./shared.mjs";
import { createLcdSpriteAtlas, drawLcdSprite } from "./lcdSprites.mjs";

const PLAYER_SCREEN_X = 108;
const PLAYER_W = 28;
const PLAYER_H = 40;
const GROUND_BASE = CANVAS_SIZE - 72;
const grannySprites = createLcdSpriteAtlas(
  new URL("../../assets/lcd-granny-sprites.png", import.meta.url).href,
);

export function createGrannyRunGame(ctx) {
  const difficultyPresets = {
    easy: {
      gravity: 0.55,
      jumpVelocity: -10.8,
      runSpeed: 4.2,
      speedGain: 0.75,
      gapChance: 0.18,
      hookChance: 0.32,
      appleChance: 0.45,
    },
    normal: {
      gravity: 0.62,
      jumpVelocity: -11.4,
      runSpeed: 4.8,
      speedGain: 0.9,
      gapChance: 0.24,
      hookChance: 0.38,
      appleChance: 0.4,
    },
    hard: {
      gravity: 0.68,
      jumpVelocity: -12,
      runSpeed: 5.4,
      speedGain: 1.05,
      gapChance: 0.3,
      hookChance: 0.42,
      appleChance: 0.35,
    },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    const cfg = preset();
    const initial = {
      status: "running",
      score: 0,
      apples: 0,
      swings: 0,
      flips: 0,
      distance: 0,
      speed: cfg.runSpeed,
      scrollX: 0,
      worldEnd: 0,
      playerY: GROUND_BASE - PLAYER_H,
      playerVy: 0,
      onGround: true,
      jumpQueued: false,
      mode: "run",
      swingAnchor: null,
      swingRadius: 0,
      swingAngle: 0,
      swingVelocity: 0,
      facing: 1,
      flipTimer: 0,
      platforms: [],
      hooks: [],
      pickups: [],
      spawnCooldown: 0,
    };

    initial.platforms.push({
      x: 0,
      y: GROUND_BASE,
      width: CANVAS_SIZE * 1.5,
      height: 72,
      tone: "#5c6b78",
      chimney: false,
    });
    initial.playerY = platformTop(initial.platforms[0]) - PLAYER_H;
    initial.worldEnd = initial.platforms[0].width;

    return initial;
  }

  function platformTop(platform) {
    return platform.y - platform.height;
  }

  function ensureWorld(minWorldX) {
    while (state.worldEnd < minWorldX + CANVAS_SIZE * 2) {
      extendWorld();
    }
  }

  function extendWorld() {
    const cfg = preset();
    const start = state.worldEnd;
    const width = 70 + Math.floor(Math.random() * 90);
    const height = 34 + Math.floor(Math.random() * 28);
    const y = GROUND_BASE - Math.floor(Math.random() * 36);

    state.platforms.push({
      x: start,
      y,
      width,
      height,
      tone: Math.random() < 0.5 ? "#5c6b78" : "#4a5864",
      chimney: Math.random() < 0.35,
    });

    const gap = Math.random() < cfg.gapChance ? 52 + Math.random() * 48 : 0;
    state.worldEnd = start + width + gap;

    const platformTopY = y - height;

    if (Math.random() < cfg.hookChance) {
      const hookX = start + width * 0.35 + Math.random() * width * 0.35;
      state.hooks.push({
        x: hookX,
        y: platformTopY - 58 - Math.random() * 42,
        radius: 14,
        used: false,
      });
    }

    if (Math.random() < cfg.appleChance) {
      state.pickups.push({
        x: start + 18 + Math.random() * Math.max(20, width - 36),
        y: platformTopY - 18,
        radius: 9,
        taken: false,
      });
    }
  }

  function getPlayerWorldX() {
    return state.scrollX + PLAYER_SCREEN_X;
  }

  function getGroundYAt(worldX) {
    let best = null;

    for (const platform of state.platforms) {
      if (worldX >= platform.x && worldX <= platform.x + platform.width) {
        const top = platformTop(platform);
        if (best === null || top < best) {
          best = top;
        }
      }
    }

    return best;
  }

  function tryLatchHook() {
    if (state.mode === "swing") {
      releaseSwing();
      return true;
    }

    const worldX = getPlayerWorldX();
    const latchY = state.playerY + PLAYER_H * 0.35;

    for (const hook of state.hooks) {
      if (hook.used) {
        continue;
      }

      const dx = hook.x - worldX;
      const dy = hook.y - latchY;
      const dist = Math.hypot(dx, dy);

      if (dist < 46) {
        hook.used = true;
        state.mode = "swing";
        state.swingAnchor = hook;
        state.swingRadius = Math.max(48, dist);
        state.swingAngle = Math.atan2(latchY - hook.y, worldX - hook.x);
        state.swingVelocity = state.speed / Math.max(42, state.swingRadius);
        state.onGround = false;
        state.playerVy = 0;
        state.swings += 1;
        return true;
      }
    }

    return false;
  }

  function releaseSwing() {
    if (state.mode !== "swing" || !state.swingAnchor) {
      return;
    }

    const anchor = state.swingAnchor;
    const tangent = state.swingVelocity * state.swingRadius;
    state.playerVy = -Math.cos(state.swingAngle) * tangent;
    const launchVx = Math.sin(state.swingAngle) * tangent * 0.35;
    state.speed = clamp(state.speed + launchVx * 0.08, preset().runSpeed, 9.5);
    state.mode = "air";
    state.swingAnchor = null;
    state.flipTimer = 18;
    state.flips += 1;
    state.score += 8;
    state.playerY = anchor.y + Math.sin(state.swingAngle) * state.swingRadius - PLAYER_H;
  }

  function queueJump() {
    if (state.status !== "running") {
      return false;
    }

    if (state.mode === "swing") {
      releaseSwing();
      return true;
    }

    if (state.onGround) {
      state.jumpQueued = true;
      return true;
    }

    return tryLatchHook();
  }

  function collidePlatforms() {
    const worldX = getPlayerWorldX();
    const feet = state.playerY + PLAYER_H;
    const ground = getGroundYAt(worldX);

    if (ground !== null && state.playerVy >= 0 && feet >= ground - 2 && feet <= ground + 18) {
      state.playerY = ground - PLAYER_H;
      state.playerVy = 0;
      state.onGround = true;
      state.mode = "run";
      return;
    }

    state.onGround = false;
    if (state.mode === "run" && !state.onGround) {
      state.mode = "air";
    }
  }

  function collectPickups() {
    const worldX = getPlayerWorldX();

    for (const pickup of state.pickups) {
      if (pickup.taken) {
        continue;
      }

      const dx = pickup.x - worldX;
      const dy = pickup.y - (state.playerY + PLAYER_H * 0.45);
      if (Math.hypot(dx, dy) < pickup.radius + 18) {
        pickup.taken = true;
        state.apples += 1;
        state.score += 15;
      }
    }
  }

  function checkFall() {
    if (state.playerY > CANVAS_SIZE + 40) {
      state.status = "game_over";
    }
  }

  function pruneWorld() {
    const minX = state.scrollX - 120;
    state.platforms = state.platforms.filter((platform) => platform.x + platform.width > minX);
    state.hooks = state.hooks.filter((hook) => hook.x > minX - 40);
    state.pickups = state.pickups.filter((pickup) => pickup.x > minX - 40 || !pickup.taken);
  }

  return {
    title: "Granny Rooftop",
    controlScheme: "dpad",
    stageAspect: "landscape",
    setDifficulty(nextDifficulty) {
      if (!difficultyPresets[nextDifficulty]) {
        difficulty = "normal";
        return;
      }
      difficulty = nextDifficulty;
    },
    start() {
      state = createState();
      ensureWorld(CANVAS_SIZE);
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
      state.speed = Math.min(8.8, cfg.runSpeed + state.distance / 900);
      state.scrollX += state.speed;
      state.distance += state.speed;

      if (state.distance > bestScore) {
        bestScore = Math.floor(state.distance);
      }

      if (Math.floor(state.distance) % 8 === 0) {
        state.score += 1;
      }

      ensureWorld(state.scrollX + CANVAS_SIZE);

      if (state.mode === "swing" && state.swingAnchor) {
        const anchor = state.swingAnchor;
        state.swingVelocity += cfg.gravity / Math.max(36, state.swingRadius);
        state.swingAngle += state.swingVelocity;

        const worldX = anchor.x + Math.cos(state.swingAngle) * state.swingRadius;
        const bodyY = anchor.y + Math.sin(state.swingAngle) * state.swingRadius - PLAYER_H;
        state.playerY = bodyY;

        if (state.swingAngle > 0.25 && state.swingVelocity > 0) {
          releaseSwing();
        }
      } else {
        if (state.jumpQueued && state.onGround) {
          state.playerVy = cfg.jumpVelocity;
          state.onGround = false;
          state.mode = "air";
          state.jumpQueued = false;
        } else if (state.jumpQueued) {
          tryLatchHook();
          state.jumpQueued = false;
        }

        state.playerVy += cfg.gravity;
        state.playerY += state.playerVy;
        collidePlatforms();

        if (state.flipTimer > 0) {
          state.flipTimer -= 1;
        }
      }

      collectPickups();
      checkFall();
      pruneWorld();
    },
    render() {
      clearCanvas(ctx, "#a5b46a");

      const parallax = (state.scrollX * 0.2) % CANVAS_SIZE;

      ctx.fillStyle = "#a5b46a";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE * 0.55);

      ctx.fillStyle = "#65783a";
      for (let i = -1; i < 4; i += 1) {
        const baseX = i * 160 - parallax * 0.35;
        ctx.fillRect(baseX, 120, 90, 180);
        ctx.fillRect(baseX + 40, 90, 70, 210);
        ctx.fillStyle = "#899751";
        ctx.fillRect(baseX + 14, 140, 12, 18);
        ctx.fillRect(baseX + 52, 112, 12, 18);
        ctx.fillStyle = "#65783a";
      }

      for (const platform of state.platforms) {
        const x = platform.x - state.scrollX;
        if (x + platform.width < -20 || x > CANVAS_SIZE + 20) {
          continue;
        }

        ctx.fillStyle = platform.tone === "#5c6b78" ? "#354622" : "#263417";
        ctx.fillRect(x, platform.y - platform.height, platform.width, platform.height);
        ctx.fillStyle = "#18210f";
        ctx.fillRect(x, platform.y - platform.height, platform.width, 6);

        if (platform.chimney) {
          ctx.fillStyle = "#18210f";
          ctx.fillRect(x + platform.width * 0.25, platform.y - platform.height - 22, 14, 22);
        }
      }

      for (const hook of state.hooks) {
        const x = hook.x - state.scrollX;
        if (x < -30 || x > CANVAS_SIZE + 30) {
          continue;
        }

        const drawn = drawLcdSprite(ctx, grannySprites, 1, 1, x - 28, hook.y - 58, 56, 76);
        if (!drawn) {
          ctx.strokeStyle = "#18210f";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, hook.y - 36);
          ctx.lineTo(x, hook.y);
          ctx.stroke();
          ctx.fillStyle = "#354622";
          drawDot(ctx, x, hook.y, hook.radius);
        }
      }

      for (const pickup of state.pickups) {
        if (pickup.taken) {
          continue;
        }

        const x = pickup.x - state.scrollX;
        if (x < -20 || x > CANVAS_SIZE + 20) {
          continue;
        }

        const drawn = drawLcdSprite(ctx, grannySprites, 0, 1, x - 18, pickup.y - 18, 36, 36);
        if (!drawn) {
          ctx.fillStyle = "#65783a";
          drawDot(ctx, x, pickup.y, pickup.radius);
        }
      }

      const px = PLAYER_SCREEN_X;
      const py = state.playerY;

      ctx.save();
      ctx.translate(px + PLAYER_W / 2, py + PLAYER_H / 2);
      if (state.flipTimer > 0 && state.flipTimer % 6 < 3) {
        ctx.scale(1, -1);
      }
      ctx.translate(-(px + PLAYER_W / 2), -(py + PLAYER_H / 2));

      const playerDrawn = drawLcdSprite(
        ctx,
        grannySprites,
        state.mode === "run" ? 0 : 1,
        0,
        px - 15,
        py - 10,
        PLAYER_W + 30,
        PLAYER_H + 20,
      );
      if (!playerDrawn) {
        ctx.fillStyle = "#354622";
        ctx.fillRect(px, py + 12, PLAYER_W, PLAYER_H - 12);
        ctx.fillStyle = "#a5b46a";
        drawDot(ctx, px + PLAYER_W / 2, py + 10, 11);
      }

      if (state.mode === "swing") {
        ctx.strokeStyle = "#18210f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + PLAYER_W / 2, py + 8);
        if (state.swingAnchor) {
          ctx.lineTo(state.swingAnchor.x - state.scrollX, state.swingAnchor.y);
        }
        ctx.stroke();
      }

      ctx.restore();
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
      ensureWorld(CANVAS_SIZE);
    },
    getTickMs() {
      return 16;
    },
    getHud() {
      const scoreLine = `Score: ${Math.floor(state.score)} | Apples: ${state.apples} | Best: ${Math.floor(bestScore)}m`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Granny fell! Swings ${state.swings} · Flips ${state.flips}. Restart to retry.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: `Paused (${difficulty}). Up/W jump · latch apple vines mid-air.`,
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: scoreLine,
        status: `Run rooftops (${difficulty}). Up/W jump gaps · grab vines · collect apples.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
