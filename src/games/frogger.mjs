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

export function createFroggerGame(ctx) {
  const gridW = 13;
  const gridH = 13;
  const cell = CANVAS_SIZE / gridW;
  const laneRows = [2, 3, 4, 6, 7, 8, 9, 10];

  let bestScore = 0;
  let state = createState();

  function randomCar(length) {
    return Math.random() * (gridW + length) - length;
  }

  function createLanes(level = 1) {
    return laneRows.map((row, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const speed = (0.03 + index * 0.006 + level * 0.008) * direction;
      const carCount = 2 + (index % 3);
      const cars = [];
      for (let i = 0; i < carCount; i += 1) {
        const length = 1.4 + Math.random() * 1.6;
        cars.push({
          x: randomCar(length),
          length,
        });
      }
      return {
        row,
        speed,
        cars,
      };
    });
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      level: 1,
      player: {
        x: Math.floor(gridW / 2),
        y: gridH - 1,
      },
      lanes: createLanes(1),
    };
  }

  function resetPlayer() {
    state.player = {
      x: Math.floor(gridW / 2),
      y: gridH - 1,
    };
  }

  function movePlayer(direction) {
    if (state.status !== "running") {
      return false;
    }

    if (direction === "UP") {
      state.player.y = Math.max(0, state.player.y - 1);
    } else if (direction === "DOWN") {
      state.player.y = Math.min(gridH - 1, state.player.y + 1);
    } else if (direction === "LEFT") {
      state.player.x = Math.max(0, state.player.x - 1);
    } else if (direction === "RIGHT") {
      state.player.x = Math.min(gridW - 1, state.player.x + 1);
    }

    return true;
  }

  function collides() {
    for (const lane of state.lanes) {
      if (lane.row !== state.player.y) {
        continue;
      }

      for (const car of lane.cars) {
        const minX = car.x;
        const maxX = car.x + car.length;
        const px = state.player.x + 0.5;
        if (px >= minX && px <= maxX) {
          return true;
        }
      }
    }
    return false;
  }

  return {
    title: "Frogger Rush",
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

      for (const lane of state.lanes) {
        for (const car of lane.cars) {
          car.x += lane.speed;
          const min = -car.length - 1;
          const max = gridW + 1;
          if (lane.speed > 0 && car.x > max) {
            car.x = min;
          } else if (lane.speed < 0 && car.x + car.length < min) {
            car.x = max;
          }
        }
      }

      if (collides()) {
        state.status = "game_over";
        return;
      }

      if (state.player.y === 0) {
        state.score += 1;
        bestScore = Math.max(bestScore, state.score);
        state.level += 1;
        state.lanes = createLanes(state.level);
        resetPlayer();
      }
    },
    render() {
      clearCanvas(ctx, "#edf0e6");

      for (let y = 0; y < gridH; y += 1) {
        if (y === 0 || y === gridH - 1) {
          ctx.fillStyle = "#96c071";
        } else {
          ctx.fillStyle = laneRows.includes(y) ? "#1f1f23" : "#5f7488";
        }
        ctx.fillRect(0, y * cell, CANVAS_SIZE, cell);
      }

      for (const lane of state.lanes) {
        for (const car of lane.cars) {
          const x = car.x * cell;
          const y = lane.row * cell + 6;
          const width = car.length * cell;
          ctx.fillStyle = lane.row % 2 === 0 ? "#e24739" : "#f4d20b";
          ctx.fillRect(x, y, width, cell - 12);
        }
      }

      const px = state.player.x * cell + cell / 2;
      const py = state.player.y * cell + cell / 2;
      ctx.fillStyle = "#1e61ff";
      drawDot(ctx, px, py, cell * 0.32);
      ctx.fillStyle = "#ffffff";
      drawDot(ctx, px - 6, py - 4, 2.5);
      drawDot(ctx, px + 6, py - 4, 2.5);
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
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(action)) {
        return false;
      }
      return movePlayer(action);
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
      return 55;
    },
    getHud() {
      if (state.status === "game_over") {
        return {
          score: `Score: ${state.score} | Best: ${bestScore}`,
          status: "Hit by traffic. Press Restart or Enter.",
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
        status: "Cross lanes with Arrow keys/WASD.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
