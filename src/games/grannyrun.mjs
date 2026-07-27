import { CANVAS_SIZE, clearCanvas, clamp, drawDot } from "./shared.mjs";
import { createLcdSpriteAtlas, drawLcdSprite } from "./lcdSprites.mjs";
import {
  WORLDS,
  SHOP_ITEMS,
  getLevel,
  levelCount,
} from "./grannyLevels.mjs";
import { STORAGE_KEYS, safeStorageGetJson, safeStorageSetJson } from "../storage.mjs";

const PLAYER_SCREEN_X = 108;
const PLAYER_W = 28;
const PLAYER_H = 40;
const GROUND_BASE = CANVAS_SIZE - 72;
const FULL_TURN = Math.PI * 2;
const STAR_BONUS = [0, 40, 90, 160];

const grannyItemSprites = createLcdSpriteAtlas(
  new URL("../../assets/granny-rooftop-sprites-v2.png", import.meta.url).href,
);
const grannyAnimationSprites = createLcdSpriteAtlas(
  new URL("../../assets/granny-rooftop-animation-v2.png", import.meta.url).href,
);

function drawGrannyFrame(ctx, column, row, x, y, width, height, filter = "none") {
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
  const previousFilter = ctx.filter;

  ctx.imageSmoothingEnabled = false;
  ctx.filter = filter;
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
  ctx.filter = previousFilter;
  return true;
}

function uprightAngleError(angle) {
  const normalized = ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return Math.min(normalized, FULL_TURN - normalized);
}

function defaultProgress() {
  return {
    levelIndex: 0,
    coinsBank: 0,
    totalScore: 0,
    starsByLevel: Array.from({ length: levelCount() }, () => 0),
    inventory: { helmet: 0, banana: 0, baseball: 0 },
    unlockedStanley: false,
    useStanley: false,
  };
}

function loadProgress() {
  const raw = safeStorageGetJson(STORAGE_KEYS.GRANNY_PROGRESS, null);
  if (!raw || typeof raw !== "object") {
    return defaultProgress();
  }

  const base = defaultProgress();
  return {
    levelIndex: clamp(Number(raw.levelIndex) || 0, 0, levelCount() - 1),
    coinsBank: Math.max(0, Math.floor(Number(raw.coinsBank) || 0)),
    totalScore: Math.max(0, Math.floor(Number(raw.totalScore) || 0)),
    starsByLevel: Array.from({ length: levelCount() }, (_, index) => {
      const value = Array.isArray(raw.starsByLevel) ? Number(raw.starsByLevel[index]) || 0 : 0;
      return clamp(value, 0, 3);
    }),
    inventory: {
      helmet: Math.max(0, Math.floor(Number(raw.inventory?.helmet) || 0)),
      banana: Math.max(0, Math.floor(Number(raw.inventory?.banana) || 0)),
      baseball: Math.max(0, Math.floor(Number(raw.inventory?.baseball) || 0)),
    },
    unlockedStanley: Boolean(raw.unlockedStanley) || base.unlockedStanley,
    useStanley: Boolean(raw.useStanley) && (Boolean(raw.unlockedStanley) || base.unlockedStanley),
  };
}

function saveProgress(progress) {
  safeStorageSetJson(STORAGE_KEYS.GRANNY_PROGRESS, progress);
}

export function createGrannyRunGame(ctx) {
  const difficultyPresets = {
    easy: {
      gravity: 0.52,
      jumpVelocity: -10.4,
      runSpeed: 4.0,
      speedGain: 0.85,
    },
    normal: {
      gravity: 0.6,
      jumpVelocity: -11.2,
      runSpeed: 4.6,
      speedGain: 1.05,
    },
    hard: {
      gravity: 0.68,
      jumpVelocity: -11.8,
      runSpeed: 5.2,
      speedGain: 1.2,
    },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let progress = loadProgress();
  let state = createShopState("Welcome to Granny Rooftop — chase the thief!");

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createShopState(message) {
    return {
      status: "shop",
      phase: "shop",
      message,
      shopIndex: 0,
      score: progress.totalScore,
      levelIndex: progress.levelIndex,
      coinsBank: progress.coinsBank,
      inventory: { ...progress.inventory },
      starsEarned: 0,
      applesGranny: 0,
      applesThief: 0,
      flips: 0,
      perfectLandings: 0,
      crashes: 0,
      feedbackTimer: 0,
      landingFeedback: "",
    };
  }

  function createLevelState(levelIndex) {
    const cfg = preset();
    const level = getLevel(levelIndex);
    const startPlatform = level.platforms[0];
    const startTop = startPlatform.y - startPlatform.height;

    return {
      status: "running",
      phase: "run",
      level,
      levelIndex,
      score: progress.totalScore,
      runScore: 0,
      coinsBank: progress.coinsBank,
      coinsRun: 0,
      inventory: { ...progress.inventory },
      helmetActive: progress.inventory.helmet > 0,
      bananas: progress.inventory.banana,
      baseballs: progress.inventory.baseball,
      applesGranny: 0,
      applesThief: 0,
      starsEarned: 0,
      flips: 0,
      perfectLandings: 0,
      crashes: 0,
      speed: cfg.runSpeed,
      scrollX: 0,
      playerY: startTop - PLAYER_H,
      playerVy: 0,
      onGround: true,
      jumpQueued: false,
      caneHeld: false,
      canePulse: false,
      mode: "run",
      swingAnchor: null,
      swingRadius: 0,
      swingAngle: 0,
      swingVelocity: 0,
      swingFrames: 0,
      animationClock: 0,
      spinAngle: 0,
      spinInputTimer: 0,
      jumpHeld: false,
      airControlTicks: 0,
      currentJumpFlips: 0,
      landingTimer: 0,
      crashTimer: 0,
      crashAngle: 0,
      feedbackTimer: 90,
      landingFeedback: `${level.name} — grab the apples before the thief!`,
      projectiles: [],
      peels: [],
      thief: createThief(level, cfg),
      message: "",
    };
  }

  function createThief(level, cfg) {
    const startPlatform = level.platforms[0];
    const startTop = startPlatform.y - startPlatform.height;
    return {
      x: 48,
      y: startTop - PLAYER_H,
      vy: 0,
      speed: level.thiefPace * (cfg.runSpeed / 4.6),
      onGround: true,
      mode: "run",
      swingAnchor: null,
      swingRadius: 0,
      swingAngle: 0,
      swingVelocity: 0,
      spinAngle: 0,
      slowTimer: 0,
      animationClock: 0,
    };
  }

  function platformTop(platform) {
    return platform.y - platform.height;
  }

  function getGroundYAt(worldX, platforms) {
    let best = null;
    for (const platform of platforms) {
      if (worldX >= platform.x && worldX <= platform.x + platform.width) {
        const top = platformTop(platform);
        if (best === null || top < best) {
          best = top;
        }
      }
    }
    return best;
  }

  function rampBoostAt(worldX, feetY, ramps) {
    for (const ramp of ramps) {
      if (worldX < ramp.x || worldX > ramp.x + ramp.width) {
        continue;
      }
      const t = (worldX - ramp.x) / ramp.width;
      const rampTop = ramp.y - ramp.rise * t;
      if (Math.abs(feetY - rampTop) < 16) {
        return {
          top: rampTop,
          launch: 0.35 + ramp.rise * 0.045,
        };
      }
    }
    return null;
  }

  function getPlayerWorldX() {
    return state.scrollX + PLAYER_SCREEN_X;
  }

  function tryLatchHook(forThief = false) {
    const worldX = forThief ? state.thief.x : getPlayerWorldX();
    const bodyY = forThief ? state.thief.y : state.playerY;
    const latchY = bodyY + PLAYER_H * 0.35;
    const hooks = state.level.hooks;

    for (const hook of hooks) {
      if (!forThief && hook.used) {
        continue;
      }

      const dx = hook.x - worldX;
      const dy = hook.y - latchY;
      const dist = Math.hypot(dx, dy);

      if (dist < 48) {
        if (!forThief) {
          hook.used = true;
          state.mode = "swing";
          state.swingAnchor = hook;
          state.swingRadius = Math.max(48, dist);
          state.swingAngle = Math.atan2(latchY - hook.y, worldX - hook.x);
          state.swingVelocity = state.speed / Math.max(42, state.swingRadius);
          state.swingFrames = 0;
          state.onGround = false;
          state.playerVy = 0;
          state.runScore += 8;
          state.landingFeedback = "Cane hooked!";
          state.feedbackTimer = 40;
        } else {
          const thief = state.thief;
          thief.mode = "swing";
          thief.swingAnchor = hook;
          thief.swingRadius = Math.max(48, dist);
          thief.swingAngle = Math.atan2(latchY - hook.y, worldX - hook.x);
          thief.swingVelocity = thief.speed / Math.max(42, thief.swingRadius);
          thief.onGround = false;
          thief.vy = 0;
        }
        return true;
      }
    }

    return false;
  }

  function releaseSwing(forThief = false) {
    if (forThief) {
      const thief = state.thief;
      if (thief.mode !== "swing" || !thief.swingAnchor) {
        return;
      }

      const anchor = thief.swingAnchor;
      const tangent = thief.swingVelocity * thief.swingRadius;
      thief.vy = -Math.cos(thief.swingAngle) * tangent;
      const launchVx = Math.sin(thief.swingAngle) * tangent * 0.35;
      thief.speed = clamp(thief.speed + launchVx * 0.08, preset().runSpeed * 0.7, 10);
      thief.mode = "air";
      thief.y = anchor.y + Math.sin(thief.swingAngle) * thief.swingRadius - PLAYER_H;
      thief.swingAnchor = null;
      return;
    }

    if (state.mode !== "swing" || !state.swingAnchor) {
      return;
    }

    const anchor = state.swingAnchor;
    const tangent = state.swingVelocity * state.swingRadius;
    state.playerVy = -Math.cos(state.swingAngle) * tangent;
    const launchVx = Math.sin(state.swingAngle) * tangent * 0.35;
    state.speed = clamp(state.speed + launchVx * 0.08, preset().runSpeed * 0.7, 10);
    state.mode = "air";
    state.playerY = anchor.y + Math.sin(state.swingAngle) * state.swingRadius - PLAYER_H;
    state.swingAnchor = null;
    state.spinAngle = 0;
    state.currentJumpFlips = 0;
    state.spinInputTimer = 0;
  }

  function queueJump() {
    if (state.status !== "running") {
      return false;
    }

    if (state.crashTimer > 0) {
      return true;
    }

    if (state.onGround) {
      state.jumpQueued = true;
      return true;
    }

    state.spinInputTimer = 10;
    return true;
  }

  function pressCane() {
    if (state.status !== "running") {
      return false;
    }

    state.caneHeld = true;
    state.canePulse = true;

    if (state.mode === "swing") {
      return true;
    }

    if (tryLatchHook(false)) {
      return true;
    }

    if (state.baseballs > 0) {
      throwBaseball();
      return true;
    }

    if (state.bananas > 0) {
      dropBanana();
      return true;
    }

    return true;
  }

  function releaseCane() {
    state.caneHeld = false;
    if (state.status === "running" && state.mode === "swing") {
      releaseSwing(false);
      return true;
    }
    return true;
  }

  function throwBaseball() {
    if (state.baseballs <= 0) {
      return;
    }

    state.baseballs -= 1;
    progress.inventory.baseball = Math.max(0, progress.inventory.baseball - 1);
    state.inventory.baseball = progress.inventory.baseball;
    saveProgress(progress);

    const worldX = getPlayerWorldX();
    state.projectiles.push({
      x: worldX + 24,
      y: state.playerY + 16,
      vx: state.speed + 6.5,
      vy: -1.2,
      life: 70,
    });
    state.landingFeedback = "Baseball away!";
    state.feedbackTimer = 36;
  }

  function dropBanana() {
    if (state.bananas <= 0) {
      return;
    }

    state.bananas -= 1;
    progress.inventory.banana = Math.max(0, progress.inventory.banana - 1);
    state.inventory.banana = progress.inventory.banana;
    saveProgress(progress);

    const worldX = getPlayerWorldX();
    state.peels.push({
      x: worldX - 18,
      y: state.playerY + PLAYER_H - 8,
      used: false,
    });
    state.landingFeedback = "Banana peel dropped!";
    state.feedbackTimer = 36;
  }

  function spawnCrashCoins(worldX, groundY) {
    const drops = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drops; i += 1) {
      state.level.coins.push({
        x: worldX - 10 + i * 14,
        y: groundY - 14,
        radius: 7,
        taken: false,
        dropped: true,
      });
    }
  }

  function gradeLanding() {
    const angleError = uprightAngleError(state.spinAngle);
    const completedFlips = state.currentJumpFlips;
    const worldX = getPlayerWorldX();
    const ground = getGroundYAt(worldX, state.level.platforms);

    state.landingTimer = 8;

    if (completedFlips > 0 && angleError <= 0.95) {
      const bonus = 14 + completedFlips * 8;
      state.perfectLandings += 1;
      state.runScore += bonus;
      state.speed = Math.min(10.2, state.speed + 1.15 * preset().speedGain);
      state.landingFeedback = `Perfect landing! +${bonus}`;
      state.feedbackTimer = 72;
    } else if (angleError >= 1.05) {
      state.crashes += 1;
      state.crashTimer = 32;
      state.crashAngle = state.spinAngle;

      if (state.helmetActive || progress.inventory.helmet > 0) {
        if (progress.inventory.helmet > 0) {
          progress.inventory.helmet -= 1;
          state.inventory.helmet = progress.inventory.helmet;
          saveProgress(progress);
        }
        state.helmetActive = progress.inventory.helmet > 0;
        state.speed = Math.max(preset().runSpeed * 0.85, state.speed * 0.9);
        state.landingFeedback = "Helmet saved the coins!";
        state.feedbackTimer = 72;
      } else {
        state.speed = Math.max(preset().runSpeed * 0.55, state.speed * 0.58);
        state.runScore = Math.max(0, state.runScore - 6);
        if (ground !== null) {
          spawnCrashCoins(worldX, ground);
        }
        state.landingFeedback = "Rough landing — coins spilled!";
        state.feedbackTimer = 72;
      }

      smashNearbyBreakables(worldX, state.playerY + PLAYER_H, 34);
    } else if (completedFlips > 0) {
      state.runScore += completedFlips * 4;
      state.landingFeedback = "Clean landing";
      state.feedbackTimer = 42;
    }

    state.spinAngle = 0;
    state.spinInputTimer = 0;
    state.airControlTicks = 0;
    state.currentJumpFlips = 0;
  }

  function smashNearbyBreakables(worldX, y, radius) {
    for (const prop of state.level.breakables) {
      if (prop.broken) {
        continue;
      }
      const cx = prop.x + prop.width / 2;
      const cy = prop.y + prop.height / 2;
      if (Math.hypot(cx - worldX, cy - y) < radius) {
        smashBreakable(prop);
      }
    }
  }

  function smashBreakable(prop) {
    if (prop.broken) {
      return;
    }
    prop.broken = true;
    state.runScore += prop.kind === "window" ? 18 : 12;
    state.level.coins.push({
      x: prop.x + prop.width / 2,
      y: prop.y - 8,
      radius: 7,
      taken: false,
      dropped: true,
    });
    state.landingFeedback = prop.kind === "window" ? "Window smashed!" : "Prop smashed!";
    state.feedbackTimer = 40;
  }

  function collidePlayer() {
    const worldX = getPlayerWorldX();
    const feet = state.playerY + PLAYER_H;
    const ground = getGroundYAt(worldX, state.level.platforms);
    const ramp = rampBoostAt(worldX, feet, state.level.ramps);
    const wasAirborne = !state.onGround && state.mode !== "crash";

    if (ramp && state.playerVy >= -1) {
      state.playerY = ramp.top - PLAYER_H;
      if (state.onGround || state.playerVy >= 0) {
        state.playerVy = -ramp.launch;
        state.onGround = false;
        state.mode = "air";
        state.speed = Math.min(10.2, state.speed + 0.35);
      }
      return;
    }

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
    if (state.mode === "run") {
      state.mode = "air";
    }
  }

  function collectPickups() {
    const worldX = getPlayerWorldX();
    const bodyY = state.playerY + PLAYER_H * 0.45;

    for (const apple of state.level.apples) {
      if (apple.takenBy) {
        continue;
      }
      if (Math.hypot(apple.x - worldX, apple.y - bodyY) < apple.radius + 18) {
        apple.takenBy = "granny";
        state.applesGranny += 1;
        state.runScore += 25;
        state.landingFeedback = `Apple secured! (${state.applesGranny}/3)`;
        state.feedbackTimer = 50;
      }
    }

    for (const pickup of state.level.coins) {
      if (pickup.taken) {
        continue;
      }
      if (Math.hypot(pickup.x - worldX, pickup.y - bodyY) < pickup.radius + 16) {
        pickup.taken = true;
        state.coinsRun += 1;
        state.runScore += 4;
      }
    }
  }

  function thiefCollectApples() {
    const bodyY = state.thief.y + PLAYER_H * 0.45;
    for (const apple of state.level.apples) {
      if (apple.takenBy) {
        continue;
      }
      if (Math.hypot(apple.x - state.thief.x, apple.y - bodyY) < apple.radius + 16) {
        apple.takenBy = "thief";
        state.applesThief += 1;
        state.landingFeedback = "Thief stole an apple!";
        state.feedbackTimer = 50;
      }
    }
  }

  function updateProjectiles() {
    for (const shot of state.projectiles) {
      shot.x += shot.vx;
      shot.y += shot.vy;
      shot.vy += 0.12;
      shot.life -= 1;

      if (Math.hypot(shot.x - state.thief.x, shot.y - (state.thief.y + 16)) < 28) {
        state.thief.slowTimer = Math.max(state.thief.slowTimer, 70);
        shot.life = 0;
        state.landingFeedback = "Thief tagged!";
        state.feedbackTimer = 40;
      }

      for (const prop of state.level.breakables) {
        if (prop.broken) {
          continue;
        }
        if (
          shot.x > prop.x
          && shot.x < prop.x + prop.width
          && shot.y > prop.y
          && shot.y < prop.y + prop.height
        ) {
          smashBreakable(prop);
          shot.life = 0;
        }
      }
    }

    state.projectiles = state.projectiles.filter((shot) => shot.life > 0);
  }

  function updatePeels() {
    for (const peel of state.peels) {
      if (peel.used) {
        continue;
      }
      if (Math.abs(state.thief.x - peel.x) < 22 && Math.abs(state.thief.y + PLAYER_H - peel.y) < 28) {
        peel.used = true;
        state.thief.slowTimer = Math.max(state.thief.slowTimer, 90);
        state.landingFeedback = "Thief slipped!";
        state.feedbackTimer = 40;
      }
    }
  }

  function gapAhead(worldX, platforms, look = 52) {
    const here = getGroundYAt(worldX, platforms);
    const ahead = getGroundYAt(worldX + look, platforms);
    return here !== null && ahead === null;
  }

  function updateThief() {
    const thief = state.thief;
    const cfg = preset();
    const level = state.level;
    thief.animationClock += 0.16;

    if (thief.slowTimer > 0) {
      thief.slowTimer -= 1;
    }

    const pace = level.thiefPace * (cfg.runSpeed / 4.6) * (thief.slowTimer > 0 ? 0.45 : 1);

    if (thief.mode === "swing" && thief.swingAnchor) {
      const anchor = thief.swingAnchor;
      thief.swingVelocity += cfg.gravity / Math.max(36, thief.swingRadius);
      thief.swingAngle += thief.swingVelocity;
      thief.x = anchor.x + Math.cos(thief.swingAngle) * thief.swingRadius;
      thief.y = anchor.y + Math.sin(thief.swingAngle) * thief.swingRadius - PLAYER_H;
      if (thief.swingAngle > 0.2 && thief.swingVelocity > 0) {
        releaseSwing(true);
      }
    } else {
      if (thief.onGround && gapAhead(thief.x, level.platforms, 46)) {
        thief.vy = cfg.jumpVelocity * 0.92;
        thief.onGround = false;
        thief.mode = "air";
      } else if (!thief.onGround && thief.mode === "air") {
        tryLatchHook(true);
      }

      if (thief.mode !== "swing") {
        thief.vy += cfg.gravity;
        thief.y += thief.vy;
        thief.x += pace;

        const feet = thief.y + PLAYER_H;
        const ground = getGroundYAt(thief.x, level.platforms);
        if (ground !== null && thief.vy >= 0 && feet >= ground - 2 && feet <= ground + 20) {
          thief.y = ground - PLAYER_H;
          thief.vy = 0;
          thief.onGround = true;
          thief.mode = "run";
          thief.spinAngle = 0;
        } else {
          thief.onGround = false;
          if (thief.mode === "run") {
            thief.mode = "air";
          }
        }
      }
    }

    thiefCollectApples();
  }

  function checkFall() {
    if (state.playerY > CANVAS_SIZE + 40) {
      failLevel("Granny fell! Restart to retry this rooftop.");
    }
  }

  function failLevel(message) {
    state.status = "failed";
    state.phase = "failed";
    state.landingFeedback = message;
    state.feedbackTimer = 120;
    bestScore = Math.max(bestScore, progress.totalScore);
  }

  function clearLevel() {
    const stars = state.applesGranny;
    state.starsEarned = stars;
    state.status = "cleared";
    state.phase = "cleared";

    const starBonus = STAR_BONUS[stars] || 0;
    const gained = state.runScore + starBonus;
    progress.totalScore += gained;
    progress.coinsBank += state.coinsRun;
    progress.starsByLevel[state.levelIndex] = Math.max(
      progress.starsByLevel[state.levelIndex] || 0,
      stars,
    );

    if (state.levelIndex >= 7) {
      progress.unlockedStanley = true;
    }

    if (state.levelIndex >= levelCount() - 1) {
      state.status = "complete";
      state.phase = "complete";
      state.landingFeedback = `Campaign clear! ${stars}★ · +${gained} pts`;
    } else {
      progress.levelIndex = Math.min(levelCount() - 1, state.levelIndex + 1);
      state.landingFeedback = `${stars}★ · +${gained} pts · Shop unlocks next`;
    }

    state.score = progress.totalScore;
    state.coinsBank = progress.coinsBank;
    saveProgress(progress);
    bestScore = Math.max(bestScore, progress.totalScore);
    state.feedbackTimer = 160;
  }

  function enterShop(message) {
    state = createShopState(message);
  }

  function startLevel(levelIndex) {
    progress.levelIndex = clamp(levelIndex, 0, levelCount() - 1);
    saveProgress(progress);
    state = createLevelState(progress.levelIndex);
  }

  function buyShopItem() {
    const item = SHOP_ITEMS[state.shopIndex];
    if (!item) {
      return false;
    }

    if (item.id === "continue") {
      if (progress.levelIndex >= levelCount()) {
        enterShop("Campaign finished — restart to replay from the yard.");
        return true;
      }
      startLevel(progress.levelIndex);
      return true;
    }

    if (progress.coinsBank < item.cost) {
      state.message = `Need ${item.cost} coins for ${item.name}.`;
      return true;
    }

    progress.coinsBank -= item.cost;
    progress.inventory[item.id] = (progress.inventory[item.id] || 0) + 1;
    state.coinsBank = progress.coinsBank;
    state.inventory = { ...progress.inventory };
    state.message = `Bought ${item.name}!`;
    saveProgress(progress);
    return true;
  }

  function characterFilter() {
    return progress.useStanley && progress.unlockedStanley
      ? "hue-rotate(210deg) saturate(0.75)"
      : "none";
  }

  return {
    title: "Granny Rooftop",
    controlScheme: "jump_cane",
    stageAspect: "square",
    setDifficulty(nextDifficulty) {
      if (!difficultyPresets[nextDifficulty]) {
        difficulty = "normal";
        return;
      }
      difficulty = nextDifficulty;
    },
    start() {
      progress = loadProgress();
      if (progress.levelIndex === 0 && progress.totalScore === 0 && progress.coinsBank === 0) {
        startLevel(0);
      } else {
        enterShop(`World map · Level ${progress.levelIndex + 1}/${levelCount()}`);
      }
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      if (state.status === "shop") {
        return;
      }

      if (state.status !== "running") {
        if (state.feedbackTimer > 0) {
          state.feedbackTimer -= 1;
        }
        return;
      }

      const cfg = preset();
      state.animationClock += 0.16 * Math.max(0.65, state.speed / cfg.runSpeed);
      state.landingTimer = Math.max(0, state.landingTimer - 1);
      state.feedbackTimer = Math.max(0, state.feedbackTimer - 1);
      state.spinInputTimer = Math.max(0, state.spinInputTimer - 1);
      state.canePulse = false;

      if (state.crashTimer > 0) {
        state.crashTimer -= 1;
        if (state.crashTimer === 0 && state.onGround) {
          state.mode = "run";
        }
      }

      const cruiseSpeed = Math.min(9.4, cfg.runSpeed + state.perfectLandings * 0.18);
      const targetSpeed = state.crashTimer > 0 ? cfg.runSpeed * 0.55 : cruiseSpeed;
      state.speed += (targetSpeed - state.speed) * 0.06;
      state.scrollX += state.speed;

      if (state.mode === "swing" && state.swingAnchor) {
        const anchor = state.swingAnchor;
        state.swingFrames += 1;
        state.swingVelocity += cfg.gravity / Math.max(36, state.swingRadius);
        state.swingAngle += state.swingVelocity;
        state.playerY = anchor.y + Math.sin(state.swingAngle) * state.swingRadius - PLAYER_H;

        if (!state.caneHeld || state.swingFrames > 100) {
          releaseSwing(false);
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
          state.jumpQueued = false;
        }

        state.playerVy += cfg.gravity;
        state.playerY += state.playerVy;
        collidePlayer();

        if (!state.onGround && state.mode === "air") {
          state.airControlTicks = state.jumpHeld ? state.airControlTicks + 1 : 0;
        }

        const wantsToSpin = state.spinInputTimer > 0 || state.airControlTicks >= 6;
        if (!state.onGround && state.mode === "air" && wantsToSpin) {
          const turnsBefore = Math.floor(state.spinAngle / FULL_TURN);
          const speedFactor = clamp(state.speed / cfg.runSpeed, 0.85, 1.5);
          state.spinAngle += 0.23 * speedFactor;
          const turnsAfter = Math.floor(state.spinAngle / FULL_TURN);
          if (turnsAfter > turnsBefore) {
            const newFlips = turnsAfter - turnsBefore;
            state.flips += newFlips;
            state.currentJumpFlips += newFlips;
            state.runScore += newFlips * 6;
          }
        }

        if (state.caneHeld && state.mode === "air") {
          tryLatchHook(false);
        }
      }

      updateThief();
      updateProjectiles();
      updatePeels();
      collectPickups();
      checkFall();

      state.score = progress.totalScore + state.runScore;

      if (getPlayerWorldX() >= state.level.finishX) {
        clearLevel();
      }
    },
    render() {
      const world = WORLDS[state.level?.world ?? progress.levelIndex / 4 | 0] || WORLDS[0];
      clearCanvas(ctx, "#f8fbfd");

      ctx.fillStyle = world.tint || "#eaf8fc";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE * 0.55);

      if (state.status === "shop") {
        renderShop(ctx, state, progress);
        return;
      }

      const parallax = (state.scrollX * 0.2) % CANVAS_SIZE;
      ctx.fillStyle = state.level.world === 2 ? "#9aa7b8" : "#c9c2f4";
      for (let i = -1; i < 4; i += 1) {
        const baseX = i * 160 - parallax * 0.35;
        ctx.fillStyle = state.level.world === 2 ? "#8b98aa" : "#c9c2f4";
        ctx.fillRect(baseX, 120, 90, 180);
        ctx.fillRect(baseX + 40, 90, 70, 210);
        ctx.fillStyle = "#ffd34f";
        ctx.fillRect(baseX + 14, 140, 12, 18);
        ctx.fillRect(baseX + 52, 112, 12, 18);
      }

      for (const platform of state.level.platforms) {
        const x = platform.x - state.scrollX;
        if (x + platform.width < -20 || x > CANVAS_SIZE + 20) {
          continue;
        }

        ctx.fillStyle = platform.tone === "#5c6b78" ? "#ff5d73" : "#283043";
        ctx.fillRect(x, platform.y - platform.height, platform.width, platform.height);
        ctx.fillStyle = "#20c7e5";
        ctx.fillRect(x, platform.y - platform.height, platform.width, 6);
      }

      for (const ramp of state.level.ramps) {
        const x = ramp.x - state.scrollX;
        ctx.fillStyle = "#20c7e5";
        ctx.beginPath();
        ctx.moveTo(x, ramp.y);
        ctx.lineTo(x + ramp.width, ramp.y - ramp.rise);
        ctx.lineTo(x + ramp.width, ramp.y);
        ctx.closePath();
        ctx.fill();
      }

      for (const prop of state.level.breakables) {
        if (prop.broken) {
          continue;
        }
        const x = prop.x - state.scrollX;
        if (prop.kind === "window") {
          ctx.fillStyle = "#7ec8ff";
          ctx.fillRect(x, prop.y, prop.width, prop.height);
          ctx.strokeStyle = "#283043";
          ctx.strokeRect(x, prop.y, prop.width, prop.height);
        } else if (prop.kind === "chimney") {
          ctx.fillStyle = "#283043";
          ctx.fillRect(x, prop.y, prop.width, prop.height);
        } else {
          ctx.fillStyle = "#c47b3a";
          ctx.fillRect(x, prop.y, prop.width, prop.height);
        }
      }

      for (const hook of state.level.hooks) {
        const x = hook.x - state.scrollX;
        if (x < -30 || x > CANVAS_SIZE + 30) {
          continue;
        }

        const drawn = drawLcdSprite(ctx, grannyItemSprites, 1, 1, x - 28, hook.y - 58, 56, 76);
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

      for (const apple of state.level.apples) {
        if (apple.takenBy) {
          continue;
        }
        const x = apple.x - state.scrollX;
        const drawn = drawLcdSprite(ctx, grannyItemSprites, 0, 1, x - 18, apple.y - 18, 36, 36);
        if (!drawn) {
          ctx.fillStyle = "#ff5d73";
          drawDot(ctx, x, apple.y, apple.radius);
        }
      }

      for (const pickup of state.level.coins) {
        if (pickup.taken) {
          continue;
        }
        const x = pickup.x - state.scrollX;
        ctx.fillStyle = pickup.dropped ? "#ffd34f" : "#f0c419";
        drawDot(ctx, x, pickup.y, pickup.radius);
      }

      for (const peel of state.peels) {
        if (peel.used) {
          continue;
        }
        ctx.fillStyle = "#d4c84a";
        ctx.fillRect(peel.x - state.scrollX - 8, peel.y - 4, 16, 8);
      }

      for (const shot of state.projectiles) {
        ctx.fillStyle = "#ffffff";
        drawDot(ctx, shot.x - state.scrollX, shot.y, 5);
      }

      const finishX = state.level.finishX - state.scrollX;
      if (finishX > -20 && finishX < CANVAS_SIZE + 20) {
        ctx.fillStyle = "#283043";
        ctx.fillRect(finishX, 80, 6, CANVAS_SIZE - 150);
        ctx.fillStyle = "#ff5d73";
        ctx.fillRect(finishX + 6, 80, 28, 18);
      }

      // Thief
      const thief = state.thief;
      const tx = thief.x - state.scrollX;
      if (tx > -40 && tx < CANVAS_SIZE + 40) {
        if (thief.mode === "swing" && thief.swingAnchor) {
          ctx.strokeStyle = "#283043";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx + PLAYER_W / 2, thief.y + 5);
          ctx.lineTo(thief.swingAnchor.x - state.scrollX, thief.swingAnchor.y);
          ctx.stroke();
        }
        ctx.save();
        ctx.globalAlpha = 0.92;
        const thiefDrawn = drawGrannyFrame(
          ctx,
          Math.floor(thief.animationClock) % 4,
          thief.mode === "air" || thief.mode === "swing" ? 1 : 0,
          tx - 20,
          thief.y - 30,
          66,
          70,
          "hue-rotate(300deg) saturate(1.2)",
        );
        if (!thiefDrawn) {
          ctx.fillStyle = "#283043";
          ctx.fillRect(tx, thief.y + 10, PLAYER_W - 4, PLAYER_H - 10);
        }
        ctx.restore();
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
        visualRotation = state.crashAngle + (32 - state.crashTimer) * 0.075;
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
        characterFilter(),
      );
      if (!playerDrawn) {
        ctx.fillStyle = "#20c7e5";
        ctx.fillRect(px, py + 12, PLAYER_W, PLAYER_H - 12);
        ctx.fillStyle = "#ffffff";
        drawDot(ctx, px + PLAYER_W / 2, py + 10, 11);
      }
      ctx.restore();

      if (state.phase === "cleared" || state.phase === "complete") {
        ctx.fillStyle = "rgba(248, 251, 253, 0.72)";
        ctx.fillRect(40, 150, 400, 140);
        ctx.fillStyle = "#283043";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(state.phase === "complete" ? "Campaign Clear!" : "Level Clear!", 70, 190);
        ctx.font = "18px sans-serif";
        ctx.fillText(`${"★".repeat(state.starsEarned)}${"☆".repeat(3 - state.starsEarned)}  Apples ${state.applesGranny}/3`, 70, 225);
        ctx.fillText("Enter / Select: shop", 70, 258);
      }
    },
    onKeyDown(keyText) {
      const normalized = String(keyText).toLowerCase();

      if (normalized === " ") {
        this.togglePause();
        return true;
      }

      if (normalized === "enter") {
        if (state.status === "failed") {
          this.restart();
          return true;
        }
        if (state.status === "cleared" || state.status === "complete") {
          enterShop(state.landingFeedback || "Shop");
          return true;
        }
        if (state.status === "shop") {
          return buyShopItem();
        }
      }

      if (state.status === "shop") {
        if (normalized === "arrowleft" || normalized === "a") {
          state.shopIndex = (state.shopIndex + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
          return true;
        }
        if (normalized === "arrowright" || normalized === "d") {
          state.shopIndex = (state.shopIndex + 1) % SHOP_ITEMS.length;
          return true;
        }
        if (normalized === "arrowdown" || normalized === "s" || normalized === "arrowup" || normalized === "w") {
          return buyShopItem();
        }
        return false;
      }

      if (normalized === "arrowup" || normalized === "w") {
        state.jumpHeld = true;
        return queueJump();
      }

      if (normalized === "arrowdown" || normalized === "s") {
        return pressCane();
      }

      if (normalized === "c" && progress.unlockedStanley) {
        progress.useStanley = !progress.useStanley;
        saveProgress(progress);
        state.landingFeedback = progress.useStanley ? "Stanley skates in!" : "Granny is back!";
        state.feedbackTimer = 50;
        return true;
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
      if (normalized === "arrowdown" || normalized === "s") {
        return releaseCane();
      }
      return false;
    },
    onControl(action) {
      if (state.status === "shop") {
        if (action === "LEFT") {
          state.shopIndex = (state.shopIndex + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
          return true;
        }
        if (action === "RIGHT") {
          state.shopIndex = (state.shopIndex + 1) % SHOP_ITEMS.length;
          return true;
        }
        if (action === "SELECT" || action === "UP") {
          return buyShopItem();
        }
        return false;
      }

      if (state.status === "cleared" || state.status === "complete") {
        if (action === "SELECT" || action === "UP") {
          enterShop(state.landingFeedback || "Shop");
          return true;
        }
        return false;
      }

      if (state.status === "failed") {
        if (action === "SELECT" || action === "UP") {
          this.restart();
          return true;
        }
        return false;
      }

      if (action === "UP") {
        state.jumpHeld = true;
        return queueJump();
      }
      if (action === "SELECT" || action === "DOWN") {
        return pressCane();
      }
      return false;
    },
    onControlUp(action) {
      if (action === "UP") {
        state.jumpHeld = false;
        state.spinInputTimer = 0;
        return true;
      }
      if (action === "SELECT" || action === "DOWN") {
        return releaseCane();
      }
      return false;
    },
    togglePause() {
      if (state.status === "failed" || state.status === "cleared" || state.status === "complete" || state.status === "shop") {
        return;
      }
      state.status = state.status === "paused" ? "running" : "paused";
    },
    restart() {
      if (state.status === "complete") {
        progress = defaultProgress();
        saveProgress(progress);
        startLevel(0);
        return;
      }
      startLevel(progress.levelIndex);
    },
    getTickMs() {
      return 16;
    },
    getControlHint() {
      if (state.status === "shop") {
        return "Left/Right browse shop · Select buy or skate on.";
      }
      return "Up/W: jump (hold to flip) · Down/S: cane swing · baseball/banana when not on a wire.";
    },
    getHud() {
      const scoreValue = state.status === "shop"
        ? progress.totalScore
        : progress.totalScore + (state.runScore || 0);
      bestScore = Math.max(bestScore, progress.totalScore, scoreValue);
      const scoreLine = `Score: ${Math.floor(scoreValue)} | Best: ${Math.floor(bestScore)}`;

      if (state.status === "shop") {
        const item = SHOP_ITEMS[state.shopIndex];
        return {
          score: scoreLine,
          status: `Shop · Coins ${progress.coinsBank} · ${item.name} (${item.cost || "free"}) · ${state.message || item.blurb}`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "failed") {
        return {
          score: scoreLine,
          status: state.landingFeedback || "Granny fell! Restart to retry.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "cleared" || state.status === "complete") {
        return {
          score: scoreLine,
          status: state.landingFeedback || "Level clear!",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: `Paused (${difficulty}). Up jump · Down cane.`,
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      const levelLabel = `L${state.levelIndex + 1}/${levelCount()}`;
      const appleLabel = `Apples ${state.applesGranny}-${state.applesThief}`;
      const gear = `H${state.inventory.helmet}/B${state.inventory.banana}/S${state.inventory.baseball}`;

      if (state.feedbackTimer > 0 && state.landingFeedback) {
        return {
          score: scoreLine,
          status: `${levelLabel} · ${appleLabel} · ${state.landingFeedback}`,
          pauseLabel: "Pause",
          pauseDisabled: false,
        };
      }

      return {
        score: scoreLine,
        status: `${levelLabel} (${difficulty}) · ${appleLabel} · Coins ${state.coinsRun} · ${gear}`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
    // Test helpers
    _getState() {
      return state;
    },
    _getProgress() {
      return progress;
    },
    _startLevel(index) {
      startLevel(index);
    },
    _enterShop(message) {
      enterShop(message || "Shop");
    },
  };
}

function renderShop(ctx, state, progress) {
  ctx.fillStyle = "#eaf8fc";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#283043";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("Rooftop Shop", 40, 56);
  ctx.font = "16px sans-serif";
  ctx.fillText(`Coins ${progress.coinsBank} · Score ${progress.totalScore}`, 40, 84);
  ctx.fillText(`Next: Level ${progress.levelIndex + 1}/${levelCount()}`, 40, 108);

  if (progress.unlockedStanley) {
    ctx.fillText(progress.useStanley ? "Skater: Stanley (press C in-run)" : "Skater: Granny (press C in-run)", 40, 132);
  }

  SHOP_ITEMS.forEach((item, index) => {
    const y = 168 + index * 58;
    const selected = index === state.shopIndex;
    ctx.fillStyle = selected ? "#20c7e5" : "#d7e6ee";
    ctx.fillRect(36, y - 28, 408, 50);
    ctx.fillStyle = "#283043";
    ctx.font = selected ? "bold 18px sans-serif" : "16px sans-serif";
    ctx.fillText(`${item.name}  ·  ${item.cost || "free"}`, 52, y);
    ctx.font = "13px sans-serif";
    ctx.fillText(item.blurb, 52, y + 18);
  });

  ctx.fillStyle = "#5c6b78";
  ctx.font = "14px sans-serif";
  ctx.fillText(state.message || "Stock up, then skate on.", 40, 430);
  ctx.fillText(`Owned  Helmet ${progress.inventory.helmet} · Banana ${progress.inventory.banana} · Baseball ${progress.inventory.baseball}`, 40, 454);
}
