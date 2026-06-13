import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDot, drawGrid, clamp } from "./shared.mjs";

const GRID = 12;
const CELL = CANVAS_SIZE / GRID;

const PATH = [
  { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },
  { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 1 },
  { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 },
  { x: 9, y: 2 }, { x: 9, y: 3 }, { x: 9, y: 4 }, { x: 9, y: 5 }, { x: 9, y: 6 }, { x: 9, y: 7 },
  { x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 },
  { x: 3, y: 8 }, { x: 3, y: 9 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 },
  { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 },
];

const PATH_SET = new Set(PATH.map((point) => `${point.x},${point.y}`));

const TOWER_TYPES = [
  {
    id: "pulse",
    name: "Pulse",
    cost: 45,
    range: 2.3,
    damage: 1,
    cooldown: 18,
    color: "#1e61ff",
    splash: 0,
  },
  {
    id: "nova",
    name: "Nova",
    cost: 75,
    range: 1.8,
    damage: 1,
    cooldown: 28,
    color: "#8f5cf7",
    splash: 1.1,
  },
  {
    id: "beam",
    name: "Beam",
    cost: 95,
    range: 4.2,
    damage: 3,
    cooldown: 42,
    color: "#47c3a2",
    splash: 0,
  },
];

const ENEMY_TYPES = [
  { id: "scout", color: "#ef4444", hp: 2, speed: 0.045, reward: 12, radius: 7 },
  { id: "tank", color: "#f97316", hp: 5, speed: 0.028, reward: 22, radius: 9 },
  { id: "swarm", color: "#eab308", hp: 1, speed: 0.06, reward: 8, radius: 5 },
];

const difficultyPresets = {
  easy: { lives: 18, startGold: 130, waveBonus: 45 },
  normal: { lives: 14, startGold: 105, waveBonus: 35 },
  hard: { lives: 10, startGold: 85, waveBonus: 28 },
};

function pathPoint(index) {
  const whole = Math.floor(index);
  const next = Math.min(PATH.length - 1, whole + 1);
  const t = index - whole;
  const a = PATH[whole];
  const b = PATH[next];
  return {
    x: (a.x + (b.x - a.x) * t + 0.5) * CELL,
    y: (a.y + (b.y - a.y) * t + 0.5) * CELL,
  };
}

function cellCenter(x, y) {
  return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
}

function distanceCells(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function wavePlan(wave) {
  const count = 6 + wave * 3;
  const enemies = [];
  for (let i = 0; i < count; i += 1) {
    const roll = (i + wave) % 7;
    if (wave >= 4 && roll === 0) {
      enemies.push("tank");
    } else if (roll <= 2) {
      enemies.push("swarm");
    } else {
      enemies.push("scout");
    }
  }
  return enemies;
}

export function createCircuitSiegeGame(ctx) {
  let difficulty = "normal";
  let bestWave = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    const cfg = preset();
    return {
      status: "running",
      gold: cfg.startGold,
      lives: cfg.lives,
      wave: 1,
      score: 0,
      cursor: { x: 2, y: 2 },
      towers: [],
      enemies: [],
      projectiles: [],
      selectedTower: 0,
      waveQueue: wavePlan(1),
      spawnCooldown: 24,
      betweenWaves: 90,
      message: "Place towers off the circuit path. Flag cycles tower type.",
    };
  }

  function towerAt(x, y) {
    return state.towers.find((tower) => tower.x === x && tower.y === y) || null;
  }

  function canBuildAt(x, y) {
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) {
      return false;
    }
    if (PATH_SET.has(`${x},${y}`)) {
      return false;
    }
    return !towerAt(x, y);
  }

  function spawnEnemy(typeId) {
    const type = ENEMY_TYPES.find((entry) => entry.id === typeId) || ENEMY_TYPES[0];
    const waveScale = 1 + (state.wave - 1) * 0.12;
    state.enemies.push({
      pathIndex: 0,
      hp: Math.ceil(type.hp * waveScale),
      maxHp: Math.ceil(type.hp * waveScale),
      speed: type.speed * (1 + state.wave * 0.015),
      reward: type.reward + Math.floor(state.wave / 2),
      radius: type.radius,
      color: type.color,
      typeId: type.id,
    });
  }

  function startNextWave() {
    state.wave += 1;
    state.waveQueue = wavePlan(state.wave);
    state.spawnCooldown = 18;
    state.betweenWaves = 0;
    state.message = `Wave ${state.wave} incoming.`;
    if (state.wave - 1 > bestWave) {
      bestWave = state.wave - 1;
    }
  }

  function fireTower(tower, type) {
    let target = null;
    let bestProgress = -1;

    for (const enemy of state.enemies) {
      const point = pathPoint(enemy.pathIndex);
      const tx = tower.x + 0.5;
      const ty = tower.y + 0.5;
      const ex = point.x / CELL;
      const ey = point.y / CELL;
      const dist = distanceCells(tx, ty, ex, ey);
      if (dist > type.range) {
        continue;
      }
      if (enemy.pathIndex > bestProgress) {
        bestProgress = enemy.pathIndex;
        target = enemy;
      }
    }

    if (!target) {
      return;
    }

    const origin = cellCenter(tower.x, tower.y);
    const impact = pathPoint(target.pathIndex);
    state.projectiles.push({
      x: origin.x,
      y: origin.y,
      tx: impact.x,
      ty: impact.y,
      ttl: 8,
      color: type.color,
      splash: type.splash,
      damage: type.damage,
      sourceX: tower.x + 0.5,
      sourceY: tower.y + 0.5,
    });
    tower.cooldown = type.cooldown;
  }

  function applyDamage(originX, originY, damage, splash) {
    for (const enemy of state.enemies) {
      const point = pathPoint(enemy.pathIndex);
      const ex = point.x / CELL;
      const ey = point.y / CELL;
      const dist = distanceCells(originX, originY, ex, ey);
      const inRange = splash > 0 ? dist <= splash : dist <= 0.55;
      if (!inRange) {
        continue;
      }
      enemy.hp -= damage;
    }
  }

  function cleanupEnemies() {
    const survivors = [];
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) {
        state.gold += enemy.reward;
        state.score += enemy.reward;
        continue;
      }
      if (enemy.pathIndex >= PATH.length - 1) {
        state.lives -= 1;
        if (state.lives <= 0) {
          state.status = "game_over";
        }
        continue;
      }
      survivors.push(enemy);
    }
    state.enemies = survivors;
  }

  function tryPlaceTower() {
    if (state.status !== "running") {
      return false;
    }

    const type = TOWER_TYPES[state.selectedTower];
    if (state.gold < type.cost) {
      state.message = `Need ${type.cost} gold for ${type.name}.`;
      return true;
    }

    if (!canBuildAt(state.cursor.x, state.cursor.y)) {
      state.message = "Build on open cells away from the circuit.";
      return true;
    }

    state.gold -= type.cost;
    state.towers.push({
      x: state.cursor.x,
      y: state.cursor.y,
      typeId: type.id,
      cooldown: 0,
    });
    state.message = `${type.name} tower placed.`;
    return true;
  }

  function cycleTowerType() {
    state.selectedTower = (state.selectedTower + 1) % TOWER_TYPES.length;
    const type = TOWER_TYPES[state.selectedTower];
    state.message = `Selected ${type.name} (${type.cost} gold).`;
    return true;
  }

  function moveCursor(direction) {
    if (direction === "UP") state.cursor.y = clamp(state.cursor.y - 1, 0, GRID - 1);
    if (direction === "DOWN") state.cursor.y = clamp(state.cursor.y + 1, 0, GRID - 1);
    if (direction === "LEFT") state.cursor.x = clamp(state.cursor.x - 1, 0, GRID - 1);
    if (direction === "RIGHT") state.cursor.x = clamp(state.cursor.x + 1, 0, GRID - 1);
  }

  return {
    title: "Circuit Siege",
    controlScheme: "grid_select_flag",
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

      if (state.enemies.length === 0 && state.waveQueue.length === 0) {
        state.betweenWaves -= 1;
        if (state.betweenWaves <= 0) {
          const cfg = preset();
          state.gold += cfg.waveBonus;
          startNextWave();
        }
      } else if (state.waveQueue.length > 0) {
        state.spawnCooldown -= 1;
        if (state.spawnCooldown <= 0) {
          spawnEnemy(state.waveQueue.shift());
          state.spawnCooldown = Math.max(8, 24 - state.wave);
        }
      }

      for (const enemy of state.enemies) {
        enemy.pathIndex += enemy.speed;
      }

      for (const tower of state.towers) {
        if (tower.cooldown > 0) {
          tower.cooldown -= 1;
          continue;
        }
        const type = TOWER_TYPES.find((entry) => entry.id === tower.typeId) || TOWER_TYPES[0];
        fireTower(tower, type);
      }

      for (const projectile of state.projectiles) {
        projectile.ttl -= 1;
        const t = 1 - projectile.ttl / 8;
        projectile.x = projectile.x + (projectile.tx - projectile.x) * 0.35;
        projectile.y = projectile.y + (projectile.ty - projectile.y) * 0.35;
        if (projectile.ttl <= 0) {
          applyDamage(projectile.tx / CELL, projectile.ty / CELL, projectile.damage, projectile.splash);
        }
      }
      state.projectiles = state.projectiles.filter((projectile) => projectile.ttl > 0);

      cleanupEnemies();
    },
    render() {
      clearCanvas(ctx, "#0b1220");

      for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
          const onPath = PATH_SET.has(`${x},${y}`);
          ctx.fillStyle = onPath ? "#172554" : "#111827";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      drawGrid(ctx, GRID, CELL, "rgba(148, 163, 184, 0.18)");

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const first = PATH[0];
      ctx.moveTo((first.x + 0.5) * CELL, (first.y + 0.5) * CELL);
      for (let i = 1; i < PATH.length; i += 1) {
        const point = PATH[i];
        ctx.lineTo((point.x + 0.5) * CELL, (point.y + 0.5) * CELL);
      }
      ctx.stroke();

      for (const tower of state.towers) {
        const type = TOWER_TYPES.find((entry) => entry.id === tower.typeId) || TOWER_TYPES[0];
        const center = cellCenter(tower.x, tower.y);
        ctx.fillStyle = type.color;
        drawDot(ctx, center.x, center.y, CELL * 0.28);
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, type.range * CELL, 0, Math.PI * 2);
        ctx.globalAlpha = 0.08;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const enemy of state.enemies) {
        const point = pathPoint(enemy.pathIndex);
        ctx.fillStyle = enemy.color;
        drawDot(ctx, point.x, point.y, enemy.radius);
        const barWidth = 18;
        const hpRatio = enemy.hp / enemy.maxHp;
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(point.x - barWidth / 2, point.y - enemy.radius - 8, barWidth, 4);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(point.x - barWidth / 2, point.y - enemy.radius - 8, barWidth * hpRatio, 4);
      }

      for (const projectile of state.projectiles) {
        ctx.fillStyle = projectile.color;
        drawDot(ctx, projectile.x, projectile.y, 3);
      }

      const selectedType = TOWER_TYPES[state.selectedTower];
      const previewCenter = cellCenter(state.cursor.x, state.cursor.y);
      const canBuild = canBuildAt(state.cursor.x, state.cursor.y) && state.gold >= selectedType.cost;
      ctx.strokeStyle = canBuild ? "#22c55e" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.strokeRect(state.cursor.x * CELL + 2, state.cursor.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = selectedType.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(previewCenter.x, previewCenter.y, selectedType.range * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 14px Avenir, Futura, sans-serif";
      ctx.fillText(`Next: ${selectedType.name} (${selectedType.cost})`, 10, 18);
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
      if (direction) {
        moveCursor(direction);
        return true;
      }

      if (key === "tab" || key === "q") {
        return cycleTowerType();
      }

      if (key === "f" || key === "enter") {
        return tryPlaceTower();
      }

      if (key === "r") {
        return cycleTowerType();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        moveCursor(action);
        return true;
      }
      if (action === "SELECT") {
        return tryPlaceTower();
      }
      if (action === "FLAG") {
        return cycleTowerType();
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
      const scoreLine = `Gold: ${state.gold} | Lives: ${state.lives} | Wave: ${state.wave} | Score: ${state.score} | Best Wave: ${bestWave}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Circuit breached on wave ${state.wave} (${difficulty}). Press Restart or Enter.`,
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
        status: state.message,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
