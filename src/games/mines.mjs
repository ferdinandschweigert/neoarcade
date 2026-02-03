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

export function createMinefieldGame(ctx) {
  const size = 8;
  const minesCount = 10;
  const cell = 52;
  const boardX = 32;
  const boardY = 32;

  let bestSafe = 0;
  let state = createState();

  function key(x, y) {
    return `${x},${y}`;
  }

  function parseKey(text) {
    const [xText, yText] = text.split(",");
    return {
      x: Number(xText),
      y: Number(yText),
    };
  }

  function createState() {
    return {
      status: "running",
      firstMove: true,
      mines: new Set(),
      revealed: new Set(),
      flags: new Set(),
      cursor: { x: 0, y: 0 },
      won: false,
    };
  }

  function inBounds(x, y) {
    return x >= 0 && x < size && y >= 0 && y < size;
  }

  function neighbors(x, y) {
    const list = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny)) {
          list.push({ x: nx, y: ny });
        }
      }
    }
    return list;
  }

  function plantMines(excludeX, excludeY) {
    while (state.mines.size < minesCount) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      if (x === excludeX && y === excludeY) {
        continue;
      }
      state.mines.add(key(x, y));
    }
  }

  function adjacentCount(x, y) {
    let count = 0;
    for (const neighbor of neighbors(x, y)) {
      if (state.mines.has(key(neighbor.x, neighbor.y))) {
        count += 1;
      }
    }
    return count;
  }

  function revealCell(x, y) {
    if (!inBounds(x, y)) {
      return false;
    }

    const id = key(x, y);
    if (state.revealed.has(id) || state.flags.has(id)) {
      return false;
    }

    if (state.mines.has(id)) {
      state.status = "game_over";
      state.won = false;
      return true;
    }

    state.revealed.add(id);

    if (adjacentCount(x, y) === 0) {
      const queue = [{ x, y }];
      while (queue.length > 0) {
        const current = queue.shift();
        for (const next of neighbors(current.x, current.y)) {
          const nextId = key(next.x, next.y);
          if (state.revealed.has(nextId) || state.flags.has(nextId)) {
            continue;
          }
          if (state.mines.has(nextId)) {
            continue;
          }
          state.revealed.add(nextId);
          if (adjacentCount(next.x, next.y) === 0) {
            queue.push(next);
          }
        }
      }
    }

    const safeRevealed = state.revealed.size;
    bestSafe = Math.max(bestSafe, safeRevealed);
    if (safeRevealed >= size * size - minesCount) {
      state.status = "game_over";
      state.won = true;
    }

    return true;
  }

  function moveCursor(direction) {
    if (direction === "UP") {
      state.cursor.y = Math.max(0, state.cursor.y - 1);
    } else if (direction === "DOWN") {
      state.cursor.y = Math.min(size - 1, state.cursor.y + 1);
    } else if (direction === "LEFT") {
      state.cursor.x = Math.max(0, state.cursor.x - 1);
    } else if (direction === "RIGHT") {
      state.cursor.x = Math.min(size - 1, state.cursor.x + 1);
    }

    return true;
  }

  function actionReveal() {
    if (state.status !== "running") {
      return false;
    }

    if (state.firstMove) {
      plantMines(state.cursor.x, state.cursor.y);
      state.firstMove = false;
    }

    return revealCell(state.cursor.x, state.cursor.y);
  }

  function actionFlag() {
    if (state.status !== "running") {
      return false;
    }

    const id = key(state.cursor.x, state.cursor.y);
    if (state.revealed.has(id)) {
      return false;
    }

    if (state.flags.has(id)) {
      state.flags.delete(id);
    } else {
      state.flags.add(id);
    }

    return true;
  }

  return {
    title: "Minefield",
    controlScheme: "grid_select_flag",
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      // Turn-based puzzle.
    },
    render() {
      clearCanvas(ctx, "#efece4");

      const numberColors = [
        "#111",
        "#1e61ff",
        "#2e7d32",
        "#c62828",
        "#6a1b9a",
        "#ff6f00",
        "#00838f",
        "#37474f",
        "#000000",
      ];

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const px = boardX + x * cell;
          const py = boardY + y * cell;
          const id = key(x, y);
          const isRevealed = state.revealed.has(id);
          const hasMine = state.mines.has(id);
          const showMine = state.status === "game_over" && !state.won && hasMine;

          ctx.fillStyle = isRevealed ? "#ddd6c7" : "#5c6a7a";
          ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);

          if (showMine) {
            ctx.fillStyle = "#e24739";
            drawDot(ctx, px + cell / 2, py + cell / 2, 12);
          } else if (isRevealed) {
            const adjacent = adjacentCount(x, y);
            if (adjacent > 0) {
              ctx.fillStyle = numberColors[adjacent];
              ctx.font = "900 24px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(adjacent), px + cell / 2, py + cell / 2 + 2);
            }
          } else if (state.flags.has(id)) {
            ctx.fillStyle = "#f4d20b";
            ctx.fillRect(px + 16, py + 10, 6, 28);
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.moveTo(px + 22, py + 10);
            ctx.lineTo(px + 36, py + 16);
            ctx.lineTo(px + 22, py + 22);
            ctx.closePath();
            ctx.fill();
          }

          if (state.cursor.x === x && state.cursor.y === y && state.status !== "game_over") {
            ctx.strokeStyle = "#1e61ff";
            ctx.lineWidth = 3;
            ctx.strokeRect(px + 6, py + 6, cell - 12, cell - 12);
          }
        }
      }
    },
    onKeyDown(keyText) {
      const keyLower = String(keyText).toLowerCase();
      if (keyLower === " ") {
        this.togglePause();
        return true;
      }
      if (keyLower === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }
      if (keyLower === "f" || keyLower === "enter") {
        return actionReveal();
      }
      if (keyLower === "x" || keyLower === "q") {
        return actionFlag();
      }
      const direction = directionFromKey(keyText);
      if (!direction) {
        return false;
      }
      return moveCursor(direction);
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "SELECT") {
        return actionReveal();
      }
      if (action === "FLAG") {
        return actionFlag();
      }
      if (["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return moveCursor(action);
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
      return 180;
    },
    getHud() {
      const safe = state.revealed.size;
      if (state.status === "game_over") {
        return {
          score: `Safe: ${safe}/${size * size - minesCount} | Flags: ${state.flags.size} | Best safe: ${bestSafe}`,
          status: state.won
            ? "Board cleared. Press Restart or Enter."
            : "Boom. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: `Safe: ${safe}/${size * size - minesCount} | Flags: ${state.flags.size} | Best safe: ${bestSafe}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: `Safe: ${safe}/${size * size - minesCount} | Flags: ${state.flags.size} | Best safe: ${bestSafe}`,
        status: "Reveal: Enter/F. Flag: X/Q. Move with arrows/WASD.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
