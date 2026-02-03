import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDot, clamp } from "./shared.mjs";

const GOAL_SCORE = 7;

export function createAirHockeyGame(ctx) {
  let bestWins = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      playerScore: 0,
      cpuScore: 0,
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      player: { x: CANVAS_SIZE / 2, y: CANVAS_SIZE - 74 },
      cpu: { x: CANVAS_SIZE / 2, y: 74 },
      puck: {
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        vx: 4.2,
        vy: -3.4,
      },
    };
  }

  function resetPuck(toPlayer) {
    state.puck.x = CANVAS_SIZE / 2;
    state.puck.y = CANVAS_SIZE / 2;
    state.puck.vx = (Math.random() * 3 + 2) * (Math.random() > 0.5 ? 1 : -1);
    state.puck.vy = (Math.random() * 2 + 2) * (toPlayer ? 1 : -1);
  }

  function collidePaddle(paddle, radius) {
    const dx = state.puck.x - paddle.x;
    const dy = state.puck.y - paddle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = radius + 12;
    if (dist >= minDist || dist === 0) {
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    state.puck.x = paddle.x + nx * minDist;
    state.puck.y = paddle.y + ny * minDist;

    const speed = Math.min(9.5, Math.sqrt(state.puck.vx ** 2 + state.puck.vy ** 2) + 0.5);
    state.puck.vx = nx * speed;
    state.puck.vy = ny * speed;
  }

  return {
    title: "Air Hockey",
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

      if (state.input.left) state.player.x -= 5;
      if (state.input.right) state.player.x += 5;
      if (state.input.up) state.player.y -= 5;
      if (state.input.down) state.player.y += 5;

      state.player.x = clamp(state.player.x, 20, CANVAS_SIZE - 20);
      state.player.y = clamp(state.player.y, CANVAS_SIZE / 2 + 20, CANVAS_SIZE - 20);

      const cpuTargetX = state.puck.x + state.puck.vx * 5;
      const cpuTargetY = Math.min(CANVAS_SIZE / 2 - 20, state.puck.y - 38);
      state.cpu.x += clamp(cpuTargetX - state.cpu.x, -4.2, 4.2);
      state.cpu.y += clamp(cpuTargetY - state.cpu.y, -3.6, 3.6);
      state.cpu.x = clamp(state.cpu.x, 20, CANVAS_SIZE - 20);
      state.cpu.y = clamp(state.cpu.y, 20, CANVAS_SIZE / 2 - 20);

      state.puck.x += state.puck.vx;
      state.puck.y += state.puck.vy;
      state.puck.vx *= 0.997;
      state.puck.vy *= 0.997;

      if (state.puck.x < 12 || state.puck.x > CANVAS_SIZE - 12) {
        state.puck.vx *= -1;
      }

      collidePaddle(state.player, 18);
      collidePaddle(state.cpu, 18);

      if (state.puck.y < -16) {
        state.playerScore += 1;
        if (state.playerScore >= GOAL_SCORE) {
          state.status = "game_over";
          bestWins = Math.max(bestWins, state.playerScore);
        } else {
          resetPuck(false);
        }
      }

      if (state.puck.y > CANVAS_SIZE + 16) {
        state.cpuScore += 1;
        if (state.cpuScore >= GOAL_SCORE) {
          state.status = "game_over";
        } else {
          resetPuck(true);
        }
      }
    },
    render() {
      clearCanvas(ctx, "#0d131f");

      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_SIZE / 2);
      ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
      ctx.stroke();

      ctx.strokeStyle = "#42506a";
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, 52, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#22d3ee";
      drawDot(ctx, state.player.x, state.player.y, 18);
      ctx.fillStyle = "#f97316";
      drawDot(ctx, state.cpu.x, state.cpu.y, 18);
      ctx.fillStyle = "#f8fafc";
      drawDot(ctx, state.puck.x, state.puck.y, 12);
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
      if (direction === "UP") {
        state.input.up = true;
        return true;
      }
      if (direction === "DOWN") {
        state.input.down = true;
        return true;
      }
      if (direction === "LEFT") {
        state.input.left = true;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = true;
        return true;
      }
      return false;
    },
    onKeyUp(keyText) {
      const direction = directionFromKey(keyText);
      if (direction === "UP") {
        state.input.up = false;
        return true;
      }
      if (direction === "DOWN") {
        state.input.down = false;
        return true;
      }
      if (direction === "LEFT") {
        state.input.left = false;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = false;
        return true;
      }
      return false;
    },
    onControl(action) {
      if (action === "UP") {
        state.player.y = clamp(state.player.y - 18, CANVAS_SIZE / 2 + 20, CANVAS_SIZE - 20);
        return true;
      }
      if (action === "DOWN") {
        state.player.y = clamp(state.player.y + 18, CANVAS_SIZE / 2 + 20, CANVAS_SIZE - 20);
        return true;
      }
      if (action === "LEFT") {
        state.player.x = clamp(state.player.x - 18, 20, CANVAS_SIZE - 20);
        return true;
      }
      if (action === "RIGHT") {
        state.player.x = clamp(state.player.x + 18, 20, CANVAS_SIZE - 20);
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
      const scoreLine = `Player ${state.playerScore} : ${state.cpuScore} CPU | Best: ${bestWins}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: state.playerScore > state.cpuScore ? "You win. Press Restart or Enter." : "CPU wins. Press Restart or Enter.",
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
        status: "Move with arrows/WASD. First to 7 goals wins.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
