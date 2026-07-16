import { CANVAS_SIZE, clearCanvas, clamp, drawDot } from "./shared.mjs";
import { createLcdSpriteAtlas, drawLcdSprite } from "./lcdSprites.mjs";

const PLAYER_SCREEN_X = 108;
const PLAYER_W = 28;
const PLAYER_H = 40;
const GROUND_BASE = CANVAS_SIZE - 72;
const FULL_TURN = Math.PI * 2;
const grannyItemSprites = createLcdSpriteAtlas(
  new URL("../../assets/granny-rooftop-sprites-v2.png", import.meta.url).href,
);
const grannyAnimationSprites = createLcdSpriteAtlas(
  new URL("../../assets/granny-rooftop-animation-v2.png", import.meta.url).href,
);

function drawGrannyFrame(ctx, column, row, x, y, width, height) {
  const atlas = grannyAnimationSprites;
  if (!atlas?.complete || !atlas.naturalWidth || !atlas.naturalHeight) {
    return false;
  }

  const cellWidth = atlas.naturalWidth / 4;
  const cellHeight = atlas.naturalHeight / 2;
  const topTrim = row === 0 ? 0.24 : 0.04;
  const bottomTrim = row === 0 ? 0.15 : 0.24;
  const sourceY = row * cellHeight + cellHeight * topTrim;
  const sourceHeight = cellHeight * (1 - topTrim - bottomTrim);
  const smoothing = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas,
    column * cellWidth,
    sourceY,
    cellWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

function uprightAngleError(angle) {
  const normalized = ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return Math.min(normalized, FULL_TURN - normalized);
}

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
      perfectLandings: 0,
      crashes: 0,
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
      animationClock: 0,
      spinAngle: 0,
      spinInputTimer: 0,
      jumpHeld: false,
      airControlTicks: 0,
      currentJumpFlips: 0,
      landingTimer: 0,
      crashTimer: 0,
      crashAngle: 0,
      feedbackTimer: 0,
      landingFeedback: "",
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
    const previous = state.platforms[state.platforms.length - 1];
    const width = 70 + Math.floor(Math.random() * 90);
    const height = 34 + Math.floor(Math.random() * 28);
    const previousTop = previous ? platformTop(previous) : GROUND_BASE - 54;
    const nextTop = clamp(
      previousTop + Math.floor(Math.random() * 49) - 24,
      GROUND_BASE - 92,
      GROUND_BASE - 30,
    );
    const y = nextTop + height;

    state.platforms.push({
      x: start,
      y,
      width,
      height,
      tone: Math.random() < 0.5 ? "#5c6b78" : "#4a5864",
      chimney: Math.random() < 0.35,
    });

    const gap = Math.random() < cfg.gapChance ? 42 + Math.random() * 38 : 0;
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
    state.spinAngle = 0;
    state.currentJumpFlips = 0;
    state.spinInputTimer = 0;
    state.score += 8;
    state.playerY = anchor.y + Math.sin(state.swingAngle) * state.swingRadius - PLAYER_H;
  }

  function queueJump() {
    if (state.status !== "running") {
      return false;
    }

    if (state.crashTimer > 0) {
      return true;
    }

    if (state.mode === "swing") {
      releaseSwing();
      return true;
    }

    if (state.onGround) {
      state.jumpQueued = true;
      return true;
    }

    if (tryLatchHook()) {
      return true;
    }

    state.spinInputTimer = 10;
    return true;
  }

  function gradeLanding() {
    const angleError = uprightAngleError(state.spinAngle);
    const completedFlips = state.currentJumpFlips;

    state.landingTimer = 8;

    if (completedFlips > 0 && angleError <= 0.52) {
      const bonus = 12 + completedFlips * 6;
      state.perfectLandings += 1;
      state.score += bonus;
      state.speed = Math.min(9.5, state.speed + 0.9);
      state.landingFeedback = `Perfect landing! +${bonus}`;
      state.feedbackTimer = 72;
    } else if (angleError >= 1.15) {
      state.crashes += 1;
      state.crashTimer = 30;
      state.crashAngle = state.spinAngle;
      state.speed = Math.max(preset().runSpeed * 0.58, state.speed * 0.64);
      state.score = Math.max(0, state.score - 5);
      state.landingFeedback = "Rough landing — Granny is back on her skates!";
      state.feedbackTimer = 72;
    } else if (completedFlips > 0) {
      state.score += completedFlips * 3;
      state.landingFeedback = "Clean landing";
      state.feedbackTimer = 42;
    }

    state.spinAngle = 0;
    state.spinInputTimer = 0;
    state.airControlTicks = 0;
    state.currentJumpFlips = 0;
  }

  function collidePlatforms() {
    const worldX = getPlayerWorldX();
    const feet = state.playerY + PLAYER_H;
    const ground = getGroundYAt(worldX);
    const wasAirborne = !state.onGround && state.mode !== "crash";

    if (ground !== null && state.playerVy >= 0 && feet >= ground - 2 && feet <= ground + 18) {
      state.playerY = ground - PLAYER_H;
      state.playerVy = 0;
      state.onGround = true;
      if (wasAirborne) {
        gradeLanding();
      }
      state.mode = state.crashTimer > 0 ? "crash" : "run";
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
      bestScore = Math.max(bestScore, Math.floor(state.distance));
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
    stageAspect: "square",
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
      state.animationClock += 0.16 * Math.max(0.65, state.speed / cfg.runSpeed);
      state.landingTimer = Math.max(0, state.landingTimer - 1);
      state.feedbackTimer = Math.max(0, state.feedbackTimer - 1);
      state.spinInputTimer = Math.max(0, state.spinInputTimer - 1);

      if (state.crashTimer > 0) {
        state.crashTimer -= 1;
        if (state.crashTimer === 0 && state.onGround) {
          state.mode = "run";
        }
      }

      const cruiseSpeed = Math.min(8.8, cfg.runSpeed + state.distance / 900);
      const targetSpeed = state.crashTimer > 0 ? cfg.runSpeed * 0.58 : cruiseSpeed;
      state.speed += (targetSpeed - state.speed) * 0.055;
      state.scrollX += state.speed;
      state.distance += state.speed;

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
          state.spinAngle = 0;
          state.spinInputTimer = 0;
          state.airControlTicks = 0;
          state.currentJumpFlips = 0;
          state.jumpQueued = false;
        } else if (state.jumpQueued) {
          tryLatchHook();
          state.jumpQueued = false;
        }

        state.playerVy += cfg.gravity;
        state.playerY += state.playerVy;
        collidePlatforms();

        if (!state.onGround && state.mode === "air") {
          state.airControlTicks = state.jumpHeld ? state.airControlTicks + 1 : 0;
        }

        const wantsToSpin = state.spinInputTimer > 0 || state.airControlTicks >= 7;
        if (!state.onGround && state.mode === "air" && wantsToSpin) {
          const turnsBefore = Math.floor(state.spinAngle / FULL_TURN);
          const speedFactor = clamp(state.speed / cfg.runSpeed, 0.85, 1.45);
          state.spinAngle += 0.22 * speedFactor;
          const turnsAfter = Math.floor(state.spinAngle / FULL_TURN);
          if (turnsAfter > turnsBefore) {
            const newFlips = turnsAfter - turnsBefore;
            state.flips += newFlips;
            state.currentJumpFlips += newFlips;
            state.score += newFlips * 5;
          }
        }
      }

      collectPickups();
      checkFall();
      pruneWorld();
    },
    render() {
      clearCanvas(ctx, "#f8fbfd");

      const parallax = (state.scrollX * 0.2) % CANVAS_SIZE;

      ctx.fillStyle = "#eaf8fc";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE * 0.55);

      ctx.fillStyle = "#c9c2f4";
      for (let i = -1; i < 4; i += 1) {
        const baseX = i * 160 - parallax * 0.35;
        ctx.fillRect(baseX, 120, 90, 180);
        ctx.fillRect(baseX + 40, 90, 70, 210);
        ctx.fillStyle = "#ffd34f";
        ctx.fillRect(baseX + 14, 140, 12, 18);
        ctx.fillRect(baseX + 52, 112, 12, 18);
        ctx.fillStyle = "#c9c2f4";
      }

      for (const platform of state.platforms) {
        const x = platform.x - state.scrollX;
        if (x + platform.width < -20 || x > CANVAS_SIZE + 20) {
          continue;
        }

        ctx.fillStyle = platform.tone === "#5c6b78" ? "#ff5d73" : "#283043";
        ctx.fillRect(x, platform.y - platform.height, platform.width, platform.height);
        ctx.fillStyle = "#20c7e5";
        ctx.fillRect(x, platform.y - platform.height, platform.width, 6);

        if (platform.chimney) {
          ctx.fillStyle = "#283043";
          ctx.fillRect(x + platform.width * 0.25, platform.y - platform.height - 22, 14, 22);
        }
      }

      for (const hook of state.hooks) {
        const x = hook.x - state.scrollX;
        if (x < -30 || x > CANVAS_SIZE + 30) {
          continue;
        }

        const drawn = drawLcdSprite(
          ctx,
          grannyItemSprites,
          1,
          1,
          x - 28,
          hook.y - 58,
          56,
          76,
        );
        if (!drawn) {
          ctx.strokeStyle = "#283043";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, hook.y - 36);
          ctx.lineTo(x, hook.y);
          ctx.stroke();
          ctx.fillStyle = "#9b78f6";
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

        const drawn = drawLcdSprite(
          ctx,
          grannyItemSprites,
          0,
          1,
          x - 18,
          pickup.y - 18,
          36,
          36,
        );
        if (!drawn) {
          ctx.fillStyle = "#ff5d73";
          drawDot(ctx, x, pickup.y, pickup.radius);
        }
      }

      const px = PLAYER_SCREEN_X;
      const py = state.playerY;

      if (state.mode === "swing" && state.swingAnchor) {
        ctx.strokeStyle = "#283043";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px + PLAYER_W / 2, py + 5);
        ctx.lineTo(state.swingAnchor.x - state.scrollX, state.swingAnchor.y);
        ctx.stroke();
      }

      if (state.mode === "run" && state.onGround && state.crashTimer === 0) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = "#20c7e5";
        ctx.lineWidth = 2;
        for (let trail = 0; trail < 3; trail += 1) {
          const trailY = py + 24 + trail * 7;
          ctx.beginPath();
          ctx.moveTo(px - 9 - trail * 7, trailY);
          ctx.lineTo(px - 28 - trail * 11, trailY);
          ctx.stroke();
        }
        ctx.restore();
      }

      let frameColumn = Math.floor(state.animationClock) % 4;
      let frameRow = 0;

      if (state.crashTimer > 0) {
        frameColumn = 1;
        frameRow = 1;
      } else if (state.mode === "swing") {
        frameColumn = 2;
        frameRow = 1;
      } else if (state.landingTimer > 0) {
        frameColumn = 3;
        frameRow = 1;
      } else if (!state.onGround) {
        frameColumn = state.spinAngle > 0.55 ? 1 : state.playerVy < 1 ? 0 : 3;
        frameRow = 1;
      }

      let visualRotation = 0;
      if (state.crashTimer > 0) {
        visualRotation = state.crashAngle + (30 - state.crashTimer) * 0.075;
      } else if (state.mode === "swing") {
        visualRotation = clamp(state.swingAngle - Math.PI / 2, -0.48, 0.48);
      } else if (!state.onGround) {
        visualRotation = state.spinAngle + clamp(state.playerVy * 0.012, -0.12, 0.15);
      }

      const skateBob = frameRow === 0
        ? Math.sin(state.animationClock * Math.PI * 0.5) * 1.1
        : 0;

      ctx.save();
      ctx.translate(px + PLAYER_W / 2, py + 15);
      ctx.rotate(visualRotation);
      ctx.translate(-(px + PLAYER_W / 2), -(py + 15));

      const playerDrawn = drawGrannyFrame(
        ctx,
        frameColumn,
        frameRow,
        px - 23,
        py - 33 + skateBob,
        74,
        76,
      );
      if (!playerDrawn) {
        ctx.fillStyle = "#20c7e5";
        ctx.fillRect(px, py + 12, PLAYER_W, PLAYER_H - 12);
        ctx.fillStyle = "#ffffff";
        drawDot(ctx, px + PLAYER_W / 2, py + 10, 11);
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
        state.jumpHeld = true;
        return queueJump();
      }

      return false;
    },
    onKeyUp(keyText) {
      const normalized = String(keyText).toLowerCase();
      if (normalized === "arrowup" || normalized === "w") {
        state.jumpHeld = false;
        state.spinInputTimer = 0;
        return true;
      }
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
    getControlHint() {
      return "Up/W: jump · hold to flip · press again near a vine to swing.";
    },
    getHud() {
      const scoreLine = `Score: ${Math.floor(state.score)} | Apples: ${state.apples} | Best: ${Math.floor(bestScore)}m`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Granny fell! Flips ${state.flips} · Perfect landings ${state.perfectLandings} · Crashes ${state.crashes}. Restart to retry.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: `Paused (${difficulty}). Up/W jump · hold to flip · press again near vines to swing.`,
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      if (state.feedbackTimer > 0 && state.landingFeedback) {
        return {
          score: scoreLine,
          status: `Run rooftops · ${state.landingFeedback}`,
          pauseLabel: "Pause",
          pauseDisabled: false,
        };
      }

      return {
        score: scoreLine,
        status: `Run rooftops (${difficulty}). Tap Up/W to jump · hold to flip · grab vines · collect apples.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
