import { directionFromKey } from "../gameLogic.mjs";
import {
  CANVAS_SIZE,
  drawDot,
  drawDiamond,
  clearCanvas,
  clamp,
} from "./shared.mjs";

const GRID_SIZE = 12;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;

const VECTORS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const DIRECTION_LIST = Object.values(VECTORS);

let nextEnemyId = 1;

export function createRogueliteGame(ctx) {
  let bestScore = 0;
  let rng = createRng(createSeed());
  let state = createInitialState();

  function createInitialState() {
    const initial = {
      status: "running",
      won: false,
      floor: 1,
      score: 0,
      maxHp: 10,
      hp: 10,
      attack: 2,
      armor: 0,
      medkits: 1,
      pulse: 1,
      turn: 0,
      idleTicks: 0,
      message: "Explore the floor",
      walls: new Set(),
      player: { x: 1, y: 1 },
      exit: { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
      enemies: [],
      loot: [],
    };

    applyFloor(initial, buildFloor(initial.floor));
    return initial;
  }

  function buildFloor(floor) {
    const walls = createBorderWalls();
    const interior = listInteriorCells();

    const player = pickRandomCell(interior);
    const exit = pickFarCell(interior, player, 6 + Math.min(4, floor));

    const wallTarget = clamp(8 + floor * 2, 8, 26);
    let attempts = 0;
    while (attempts < 900 && countInteriorWalls(walls) < wallTarget) {
      attempts += 1;
      const candidate = pickRandomCell(interior);
      if (!candidate) {
        break;
      }

      if (isReservedCell(candidate, player, exit) || walls.has(keyOf(candidate))) {
        continue;
      }

      walls.add(keyOf(candidate));
      if (!pathExists(player, exit, walls)) {
        walls.delete(keyOf(candidate));
      }
    }

    const blocked = new Set(walls);
    blocked.add(keyOf(player));
    blocked.add(keyOf(exit));

    const enemyCount = clamp(2 + floor, 3, 10);
    const enemies = [];
    for (let i = 0; i < enemyCount; i += 1) {
      const cell = takeOpenCell(interior, blocked);
      if (!cell) {
        break;
      }

      const roll = rng();
      const type = roll < 0.28 ? "brute" : roll < 0.67 ? "stalker" : "skitter";

      enemies.push(createEnemy(cell.x, cell.y, type, floor));
      blocked.add(keyOf(cell));
    }

    const lootCount = clamp(2 + Math.floor(floor / 2), 2, 6);
    const loot = [];
    for (let i = 0; i < lootCount; i += 1) {
      const cell = takeOpenCell(interior, blocked);
      if (!cell) {
        break;
      }

      loot.push({ x: cell.x, y: cell.y, type: pickLootType() });
      blocked.add(keyOf(cell));
    }

    return {
      walls,
      player,
      exit,
      enemies,
      loot,
    };
  }

  function createEnemy(x, y, type, floor) {
    if (type === "brute") {
      return {
        id: nextEnemyId++,
        type,
        x,
        y,
        hp: 5 + floor,
        damage: 3 + Math.floor(floor / 3),
      };
    }

    if (type === "skitter") {
      return {
        id: nextEnemyId++,
        type,
        x,
        y,
        hp: 2 + floor,
        damage: 1 + Math.floor(floor / 4),
      };
    }

    return {
      id: nextEnemyId++,
      type: "stalker",
      x,
      y,
      hp: 3 + floor,
      damage: 2 + Math.floor(floor / 4),
    };
  }

  function applyFloor(targetState, floorLayout) {
    targetState.walls = floorLayout.walls;
    targetState.player = floorLayout.player;
    targetState.exit = floorLayout.exit;
    targetState.enemies = floorLayout.enemies;
    targetState.loot = floorLayout.loot;
    targetState.idleTicks = 0;
  }

  function advanceFloor() {
    state.floor += 1;
    state.score += 120 + state.floor * 18;
    if (state.floor % 3 === 0) {
      state.maxHp += 1;
    }
    state.hp = Math.min(state.maxHp, state.hp + 3);
    state.pulse += 1;
    state.message = `Floor ${state.floor} deployed`;

    applyFloor(state, buildFloor(state.floor));
    refreshBestScore();
  }

  function movePlayer(direction) {
    if (state.status !== "running") {
      return false;
    }

    const vector = VECTORS[direction];
    if (!vector) {
      return false;
    }

    const next = {
      x: state.player.x + vector.x,
      y: state.player.y + vector.y,
    };

    if (isWall(next.x, next.y)) {
      state.message = "Blocked path";
      return false;
    }

    const targetEnemy = enemyAt(next.x, next.y);
    if (targetEnemy) {
      state.message = `You strike ${enemyName(targetEnemy.type)}`;
      damageEnemy(targetEnemy, state.attack + (state.turn % 5 === 0 ? 1 : 0));
      runEnemyTurn();
      refreshBestScore();
      return true;
    }

    state.player = next;
    collectLoot();

    if (sameCell(state.player, state.exit) && state.enemies.length > 0) {
      state.message = "Exit sealed until enemies are cleared";
    }

    runEnemyTurn();

    if (state.status === "running" && sameCell(state.player, state.exit) && state.enemies.length === 0) {
      advanceFloor();
    }

    refreshBestScore();
    return true;
  }

  function usePulseSkill() {
    if (state.status !== "running") {
      return false;
    }

    if (state.pulse <= 0) {
      if (state.medkits > 0 && state.hp < state.maxHp) {
        state.medkits -= 1;
        state.hp = Math.min(state.maxHp, state.hp + 4);
        state.message = "Used medkit";
        runEnemyTurn();
        refreshBestScore();
        return true;
      }

      state.message = "No pulse charges";
      return false;
    }

    state.pulse -= 1;
    let hitCount = 0;

    for (const vector of DIRECTION_LIST) {
      const enemy = enemyAt(state.player.x + vector.x, state.player.y + vector.y);
      if (!enemy) {
        continue;
      }

      hitCount += 1;
      damageEnemy(enemy, Math.max(2, state.attack - 1));
    }

    if (hitCount === 0) {
      state.hp = Math.min(state.maxHp, state.hp + 1);
      state.message = "Pulse barrier restored 1 HP";
    } else {
      state.message = `Pulse hit ${hitCount} foe${hitCount > 1 ? "s" : ""}`;
    }

    runEnemyTurn();

    if (state.status === "running" && sameCell(state.player, state.exit) && state.enemies.length === 0) {
      advanceFloor();
    }

    refreshBestScore();
    return true;
  }

  function runEnemyTurn() {
    if (state.status !== "running") {
      return;
    }

    state.turn += 1;

    const order = [...state.enemies].sort((a, b) => {
      const priority = { brute: 0, stalker: 1, skitter: 2 };
      return priority[a.type] - priority[b.type];
    });

    for (const enemyRef of order) {
      if (state.status !== "running") {
        return;
      }

      const enemy = state.enemies.find((item) => item.id === enemyRef.id);
      if (!enemy) {
        continue;
      }

      if (manhattan(enemy, state.player) === 1) {
        enemyAttack(enemy);
        continue;
      }

      if (enemy.type === "brute" && state.turn % 2 === 1) {
        continue;
      }

      const next = chooseEnemyStep(enemy);
      if (!next) {
        continue;
      }

      if (next.x === state.player.x && next.y === state.player.y) {
        enemyAttack(enemy);
      } else if (!isWall(next.x, next.y) && !enemyAt(next.x, next.y, enemy.id)) {
        enemy.x = next.x;
        enemy.y = next.y;
      }
    }

    if (state.status === "running" && state.turn % 6 === 0 && state.loot.length < 4) {
      spawnLootCrate();
    }
  }

  function chooseEnemyStep(enemy) {
    const candidates = [];

    for (const vector of shuffleVectors()) {
      const next = {
        x: enemy.x + vector.x,
        y: enemy.y + vector.y,
      };

      if (isWall(next.x, next.y) || enemyAt(next.x, next.y, enemy.id)) {
        continue;
      }

      candidates.push(next);
    }

    if (candidates.length === 0) {
      return null;
    }

    if (enemy.type === "skitter" && rng() < 0.48) {
      return candidates[Math.floor(rng() * candidates.length)];
    }

    candidates.sort((left, right) => {
      const leftScore = manhattan(left, state.player);
      const rightScore = manhattan(right, state.player);
      return leftScore - rightScore;
    });

    return candidates[0];
  }

  function shuffleVectors() {
    const vectors = [...DIRECTION_LIST];

    for (let index = vectors.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      const temp = vectors[index];
      vectors[index] = vectors[swapIndex];
      vectors[swapIndex] = temp;
    }

    return vectors;
  }

  function enemyAttack(enemy) {
    const damage = Math.max(1, enemy.damage - state.armor);
    state.hp -= damage;
    state.message = `${enemyName(enemy.type)} hits for ${damage}`;

    if (state.hp <= 0) {
      state.hp = 0;
      state.status = "game_over";
      state.won = false;
      state.message = `Run lost on floor ${state.floor}`;
    }
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    if (enemy.hp > 0) {
      return;
    }

    state.enemies = state.enemies.filter((item) => item.id !== enemy.id);
    state.score += 24 + state.floor * 6;
    state.message = `${enemyName(enemy.type)} defeated`;

    if (state.enemies.length === 0 && sameCell(state.player, state.exit)) {
      advanceFloor();
    }
  }

  function collectLoot() {
    const index = state.loot.findIndex((item) => sameCell(item, state.player));
    if (index < 0) {
      return;
    }

    const [loot] = state.loot.splice(index, 1);

    if (loot.type === "potion") {
      state.hp = Math.min(state.maxHp, state.hp + 3);
      state.message = "Found nanite potion (+3 HP)";
    } else if (loot.type === "forge") {
      state.attack += 1;
      state.message = "Found forge core (+1 ATK)";
    } else if (loot.type === "shield") {
      state.armor = clamp(state.armor + 1, 0, 4);
      state.message = "Found shield plate (+1 ARM)";
    } else if (loot.type === "medkit") {
      state.medkits += 1;
      state.message = "Found medkit";
    } else if (loot.type === "pulse") {
      state.pulse += 1;
      state.message = "Found pulse charge";
    }

    state.score += 12;
  }

  function spawnLootCrate() {
    const blocked = new Set(state.walls);
    blocked.add(keyOf(state.player));
    blocked.add(keyOf(state.exit));

    for (const enemy of state.enemies) {
      blocked.add(keyOf(enemy));
    }

    for (const item of state.loot) {
      blocked.add(keyOf(item));
    }

    const cell = takeOpenCell(listInteriorCells(), blocked);
    if (!cell) {
      return;
    }

    state.loot.push({ x: cell.x, y: cell.y, type: pickLootType() });
  }

  function refreshBestScore() {
    if (state.score > bestScore) {
      bestScore = state.score;
    }
  }

  function enemyAt(x, y, exceptId = null) {
    return state.enemies.find(
      (enemy) => enemy.id !== exceptId && enemy.x === x && enemy.y === y,
    );
  }

  function isWall(x, y) {
    return x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || state.walls.has(`${x},${y}`);
  }

  return {
    title: "Roguelite Grid",
    controlScheme: "grid_select",
    start() {
      rng = createRng(createSeed());
      state = createInitialState();
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

      state.idleTicks += 1;
      if (state.idleTicks % 32 === 0 && state.enemies.length > 0) {
        state.message = "Controller hint: D-pad/Left Stick + A(Select)";
      }
    },
    render() {
      clearCanvas(ctx, "#0d1016");

      for (let y = 0; y < GRID_SIZE; y += 1) {
        for (let x = 0; x < GRID_SIZE; x += 1) {
          const px = x * CELL_SIZE;
          const py = y * CELL_SIZE;

          if (state.walls.has(`${x},${y}`)) {
            ctx.fillStyle = "#26354a";
            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
            continue;
          }

          ctx.fillStyle = (x + y) % 2 === 0 ? "#121b27" : "#111821";
          ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        }
      }

      ctx.fillStyle = "#22c76e";
      ctx.fillRect(
        state.exit.x * CELL_SIZE + 6,
        state.exit.y * CELL_SIZE + 6,
        CELL_SIZE - 12,
        CELL_SIZE - 12,
      );

      for (const item of state.loot) {
        const cx = item.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = item.y * CELL_SIZE + CELL_SIZE / 2;

        if (item.type === "potion") {
          ctx.fillStyle = "#ef4444";
          drawDot(ctx, cx, cy, CELL_SIZE * 0.18);
        } else if (item.type === "forge") {
          ctx.fillStyle = "#f59e0b";
          drawDiamond(ctx, cx, cy, CELL_SIZE * 0.26);
        } else if (item.type === "shield") {
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(cx - CELL_SIZE * 0.16, cy - CELL_SIZE * 0.16, CELL_SIZE * 0.32, CELL_SIZE * 0.32);
        } else if (item.type === "medkit") {
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(cx - CELL_SIZE * 0.06, cy - CELL_SIZE * 0.2, CELL_SIZE * 0.12, CELL_SIZE * 0.4);
          ctx.fillRect(cx - CELL_SIZE * 0.2, cy - CELL_SIZE * 0.06, CELL_SIZE * 0.4, CELL_SIZE * 0.12);
        } else if (item.type === "pulse") {
          ctx.fillStyle = "#a855f7";
          drawDiamond(ctx, cx, cy, CELL_SIZE * 0.2);
        }
      }

      for (const enemy of state.enemies) {
        const cx = enemy.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = enemy.y * CELL_SIZE + CELL_SIZE / 2;

        ctx.fillStyle =
          enemy.type === "brute"
            ? "#ef4444"
            : enemy.type === "skitter"
              ? "#fb7185"
              : "#f97316";
        drawDot(ctx, cx, cy, CELL_SIZE * 0.28);

        ctx.fillStyle = "#111827";
        ctx.font = "700 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(enemy.hp), cx, cy + 1);
      }

      ctx.fillStyle = "#f4d20b";
      drawDiamond(
        ctx,
        state.player.x * CELL_SIZE + CELL_SIZE / 2,
        state.player.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE * 0.31,
      );

      if (state.status !== "running") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "700 36px Arial";
        ctx.fillText(state.status === "paused" ? "PAUSED" : "GAME OVER", CANVAS_SIZE / 2, CANVAS_SIZE / 2);
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

      if (key === "f" || key === "e" || key === "q") {
        return usePulseSkill();
      }

      const direction = directionFromKey(keyText);
      if (!direction) {
        return false;
      }

      return movePlayer(direction);
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return movePlayer(action);
      }

      if (action === "SELECT") {
        return usePulseSkill();
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
      rng = createRng(createSeed());
      state = createInitialState();
    },
    getTickMs() {
      return 120;
    },
    getHud() {
      const scoreLine =
        `Score: ${state.score} | Floor: ${state.floor} | HP: ${state.hp}/${state.maxHp}` +
        ` | ATK: ${state.attack} | ARM: ${state.armor}` +
        ` | Med: ${state.medkits} | Pulse: ${state.pulse} | Best: ${bestScore}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Run over. Press Restart or Enter.",
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
        status: `${state.message}. Reach exit after clearing enemies. Select/F uses pulse skill.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}

function createSeed() {
  const randomPart = Math.floor(Math.random() * 0xffffffff);
  return (Date.now() ^ randomPart) >>> 0;
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function keyOf(position) {
  return `${position.x},${position.y}`;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function createBorderWalls() {
  const walls = new Set();

  for (let line = 0; line < GRID_SIZE; line += 1) {
    walls.add(`${line},0`);
    walls.add(`${line},${GRID_SIZE - 1}`);
    walls.add(`0,${line}`);
    walls.add(`${GRID_SIZE - 1},${line}`);
  }

  return walls;
}

function listInteriorCells() {
  const cells = [];

  for (let y = 1; y < GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

function countInteriorWalls(walls) {
  let count = 0;
  for (const id of walls) {
    const [xText, yText] = id.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (x > 0 && x < GRID_SIZE - 1 && y > 0 && y < GRID_SIZE - 1) {
      count += 1;
    }
  }
  return count;
}

function pickRandomCell(cells) {
  if (cells.length === 0) {
    return null;
  }

  return cells[Math.floor(Math.random() * cells.length)];
}

function pickFarCell(cells, from, minimumDistance) {
  const farCells = cells.filter((cell) => manhattan(cell, from) >= minimumDistance);
  if (farCells.length === 0) {
    return pickRandomCell(cells);
  }
  return pickRandomCell(farCells);
}

function isReservedCell(candidate, player, exit) {
  return sameCell(candidate, player) || sameCell(candidate, exit);
}

function takeOpenCell(cells, blocked) {
  const open = cells.filter((cell) => !blocked.has(keyOf(cell)));
  if (open.length === 0) {
    return null;
  }

  return open[Math.floor(Math.random() * open.length)];
}

function pickLootType() {
  const roll = Math.random();
  if (roll < 0.28) {
    return "potion";
  }
  if (roll < 0.48) {
    return "forge";
  }
  if (roll < 0.66) {
    return "shield";
  }
  if (roll < 0.84) {
    return "medkit";
  }
  return "pulse";
}

function enemyName(type) {
  if (type === "brute") {
    return "Brute";
  }
  if (type === "skitter") {
    return "Skitter";
  }
  return "Stalker";
}

function pathExists(start, goal, walls) {
  const queue = [start];
  const visited = new Set([keyOf(start)]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (sameCell(current, goal)) {
      return true;
    }

    for (const vector of DIRECTION_LIST) {
      const next = {
        x: current.x + vector.x,
        y: current.y + vector.y,
      };

      if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
        continue;
      }

      const nextKey = keyOf(next);
      if (walls.has(nextKey) || visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      queue.push(next);
    }
  }

  return false;
}
