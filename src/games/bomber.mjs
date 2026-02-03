import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const GRID = 11;
const CELL = CANVAS_SIZE / GRID;

const STEPS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

let enemyId = 1;

export function createBomberVaultGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    const initial = {
      status: "running",
      score: 0,
      lives: 3,
      floor: 1,
      invuln: 0,
      message: "Clear enemies and find the exit",
      player: { x: 1, y: 1 },
      walls: new Set(),
      breakables: new Set(),
      bombs: [],
      flames: [],
      enemies: [],
      exit: { x: GRID - 2, y: GRID - 2 },
      exitRevealed: false,
    };

    setupFloor(initial);
    return initial;
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function setupFloor(target) {
    target.walls = createWalls();
    target.breakables = createBreakables(target.floor, target.walls);
    target.player = { x: 1, y: 1 };
    target.bombs = [];
    target.flames = [];
    target.enemies = createEnemies(target.floor, target.walls, target.breakables);
    target.exitRevealed = false;

    const breakableList = [...target.breakables];
    if (breakableList.length > 0) {
      const chosen = breakableList[Math.floor(Math.random() * breakableList.length)];
      const [xText, yText] = chosen.split(",");
      target.exit = { x: Number(xText), y: Number(yText) };
    } else {
      target.exit = { x: GRID - 2, y: GRID - 2 };
    }
  }

  function createWalls() {
    const walls = new Set();
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if (x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1 || (x % 2 === 0 && y % 2 === 0)) {
          walls.add(keyOf(x, y));
        }
      }
    }
    walls.delete(keyOf(1, 1));
    walls.delete(keyOf(1, 2));
    walls.delete(keyOf(2, 1));
    return walls;
  }

  function createBreakables(floor, walls) {
    const set = new Set();
    const desired = Math.min(42, 22 + floor * 4);
    let attempts = 0;

    while (set.size < desired && attempts < 1800) {
      attempts += 1;
      const x = 1 + Math.floor(Math.random() * (GRID - 2));
      const y = 1 + Math.floor(Math.random() * (GRID - 2));
      const key = keyOf(x, y);
      if (walls.has(key) || key === keyOf(1, 1) || key === keyOf(1, 2) || key === keyOf(2, 1)) {
        continue;
      }
      set.add(key);
    }

    return set;
  }

  function createEnemies(floor, walls, breakables) {
    const enemies = [];
    const target = Math.min(8, 2 + floor);
    let attempts = 0;

    while (enemies.length < target && attempts < 1200) {
      attempts += 1;
      const x = 1 + Math.floor(Math.random() * (GRID - 2));
      const y = 1 + Math.floor(Math.random() * (GRID - 2));
      const key = keyOf(x, y);
      if (walls.has(key) || breakables.has(key) || (x <= 2 && y <= 2) || enemies.some((item) => item.x === x && item.y === y)) {
        continue;
      }

      enemies.push({
        id: enemyId += 1,
        x,
        y,
        moveTick: Math.floor(Math.random() * 10),
      });
    }

    return enemies;
  }

  function isBlocked(x, y) {
    const key = keyOf(x, y);
    if (state.walls.has(key) || state.breakables.has(key)) {
      return true;
    }

    if (state.bombs.some((bomb) => bomb.x === x && bomb.y === y)) {
      return true;
    }

    return false;
  }

  function canMoveTo(x, y) {
    if (x < 1 || y < 1 || x > GRID - 2 || y > GRID - 2) {
      return false;
    }
    return !isBlocked(x, y);
  }

  function movePlayer(direction) {
    if (state.status !== "running") {
      return false;
    }

    const step = STEPS[direction];
    if (!step) {
      return false;
    }

    const nx = state.player.x + step.x;
    const ny = state.player.y + step.y;
    if (!canMoveTo(nx, ny)) {
      return false;
    }

    state.player = { x: nx, y: ny };

    if (state.exitRevealed && state.enemies.length === 0 && state.player.x === state.exit.x && state.player.y === state.exit.y) {
      state.floor += 1;
      state.score += 140;
      state.message = `Floor ${state.floor}`;
      setupFloor(state);
    }

    return true;
  }

  function placeBomb() {
    if (state.status !== "running") {
      return false;
    }

    const hasBomb = state.bombs.some((bomb) => bomb.x === state.player.x && bomb.y === state.player.y);
    if (hasBomb || state.bombs.length >= 2) {
      return false;
    }

    state.bombs.push({ x: state.player.x, y: state.player.y, timer: 28, range: 2 });
    state.message = "Bomb planted";
    return true;
  }

  function hitPlayer() {
    if (state.invuln > 0 || state.status !== "running") {
      return;
    }

    state.lives -= 1;
    state.invuln = 72;
    state.player = { x: 1, y: 1 };

    if (state.lives <= 0) {
      state.lives = 0;
      state.status = "game_over";
      state.message = "Vault lost";
    }
  }

  function explodeBomb(bomb) {
    const flames = [{ x: bomb.x, y: bomb.y, ttl: 10 }];

    for (const step of Object.values(STEPS)) {
      for (let distance = 1; distance <= bomb.range; distance += 1) {
        const x = bomb.x + step.x * distance;
        const y = bomb.y + step.y * distance;
        const key = keyOf(x, y);

        if (state.walls.has(key)) {
          break;
        }

        flames.push({ x, y, ttl: 10 });

        const bombHit = state.bombs.find((item) => item !== bomb && item.x === x && item.y === y);
        if (bombHit) {
          bombHit.timer = 0;
        }

        if (state.breakables.has(key)) {
          state.breakables.delete(key);
          state.score += 8;
          if (state.exit.x === x && state.exit.y === y) {
            state.exitRevealed = true;
            state.message = "Exit revealed";
          }
          break;
        }
      }
    }

    for (const flame of flames) {
      if (flame.x === state.player.x && flame.y === state.player.y) {
        hitPlayer();
      }

      const before = state.enemies.length;
      state.enemies = state.enemies.filter((enemy) => !(enemy.x === flame.x && enemy.y === flame.y));
      if (state.enemies.length < before) {
        state.score += 30;
      }
    }

    state.flames.push(...flames);

    if (state.enemies.length === 0) {
      state.exitRevealed = true;
    }
  }

  function enemyTurn() {
    for (const enemy of state.enemies) {
      enemy.moveTick += 1;
      if (enemy.moveTick % 7 !== 0) {
        continue;
      }

      const options = [];
      for (const step of Object.values(STEPS)) {
        const x = enemy.x + step.x;
        const y = enemy.y + step.y;
        if (!canMoveTo(x, y) || state.enemies.some((other) => other !== enemy && other.x === x && other.y === y)) {
          continue;
        }
        options.push({ x, y });
      }

      if (options.length === 0) {
        continue;
      }

      options.sort((left, right) => {
        const leftDist = Math.abs(left.x - state.player.x) + Math.abs(left.y - state.player.y);
        const rightDist = Math.abs(right.x - state.player.x) + Math.abs(right.y - state.player.y);
        return leftDist - rightDist;
      });

      const selected = Math.random() < 0.25 ? options[Math.floor(Math.random() * options.length)] : options[0];
      enemy.x = selected.x;
      enemy.y = selected.y;

      if (enemy.x === state.player.x && enemy.y === state.player.y) {
        hitPlayer();
      }
    }
  }

  return {
    title: "Bomber Vault",
    controlScheme: "grid_select",
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

      if (state.invuln > 0) {
        state.invuln -= 1;
      }

      for (const bomb of state.bombs) {
        bomb.timer -= 1;
      }

      const exploding = state.bombs.filter((bomb) => bomb.timer <= 0);
      state.bombs = state.bombs.filter((bomb) => bomb.timer > 0);
      for (const bomb of exploding) {
        explodeBomb(bomb);
      }

      for (const flame of state.flames) {
        flame.ttl -= 1;
      }
      state.flames = state.flames.filter((flame) => flame.ttl > 0);

      for (const flame of state.flames) {
        if (flame.x === state.player.x && flame.y === state.player.y) {
          hitPlayer();
        }
      }

      enemyTurn();

      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#111827");

      for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
          const px = x * CELL;
          const py = y * CELL;

          if (state.walls.has(keyOf(x, y))) {
            ctx.fillStyle = "#374151";
            ctx.fillRect(px, py, CELL, CELL);
          } else {
            ctx.fillStyle = (x + y) % 2 === 0 ? "#1f2937" : "#111827";
            ctx.fillRect(px, py, CELL, CELL);
          }
        }
      }

      for (const block of state.breakables) {
        const [xText, yText] = block.split(",");
        const x = Number(xText);
        const y = Number(yText);
        ctx.fillStyle = "#a16207";
        ctx.fillRect(x * CELL + 6, y * CELL + 6, CELL - 12, CELL - 12);
      }

      if (state.exitRevealed) {
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(state.exit.x * CELL + 10, state.exit.y * CELL + 10, CELL - 20, CELL - 20);
      }

      for (const bomb of state.bombs) {
        const cx = bomb.x * CELL + CELL / 2;
        const cy = bomb.y * CELL + CELL / 2;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const flame of state.flames) {
        ctx.fillStyle = "#f97316";
        ctx.fillRect(flame.x * CELL + 10, flame.y * CELL + 10, CELL - 20, CELL - 20);
      }

      for (const enemy of state.enemies) {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(enemy.x * CELL + 12, enemy.y * CELL + 12, CELL - 24, CELL - 24);
      }

      const blink = state.invuln > 0 && state.invuln % 8 < 4;
      if (!blink) {
        ctx.fillStyle = "#f4d20b";
        ctx.fillRect(state.player.x * CELL + 10, state.player.y * CELL + 10, CELL - 20, CELL - 20);
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
      if (direction) {
        return movePlayer(direction);
      }

      if (key === "f" || key === "e" || key === "q") {
        return placeBomb();
      }

      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return movePlayer(action);
      }
      if (action === "SELECT") {
        return placeBomb();
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
      return 90;
    },
    getHud() {
      const scoreLine = `Score: ${state.score} | Floor: ${state.floor} | Lives: ${state.lives} | Bombs: ${state.bombs.length}/2 | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Vault run failed. Press Restart or Enter.",
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
        status: `${state.message}. Move, place bombs with Select/F.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
