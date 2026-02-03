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

export function createPongGame(ctx) {
  const paddleWidth = 12;
  const paddleHeight = 88;
  const ballRadius = 8;
  const paddleMargin = 18;
  const winScore = 7;

  let state = createState();

  function createState() {
    return {
      status: "running",
      playerY: CANVAS_SIZE / 2 - paddleHeight / 2,
      cpuY: CANVAS_SIZE / 2 - paddleHeight / 2,
      input: {
        up: false,
        down: false,
      },
      playerScore: 0,
      cpuScore: 0,
      ballX: CANVAS_SIZE / 2,
      ballY: CANVAS_SIZE / 2,
      ballVx: 4.2,
      ballVy: 2.2,
    };
  }

  function resetBall(towardsPlayer) {
    const direction = towardsPlayer ? -1 : 1;
    state.ballX = CANVAS_SIZE / 2;
    state.ballY = CANVAS_SIZE / 2;
    state.ballVx = 4.2 * direction;
    state.ballVy = (Math.random() * 3 + 1.5) * (Math.random() > 0.5 ? 1 : -1);
  }

  function clampPaddles() {
    state.playerY = clamp(state.playerY, 0, CANVAS_SIZE - paddleHeight);
    state.cpuY = clamp(state.cpuY, 0, CANVAS_SIZE - paddleHeight);
  }

  return {
    title: "Pong",
    controlScheme: "vertical",
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

      if (state.input.up) {
        state.playerY -= 7;
      }
      if (state.input.down) {
        state.playerY += 7;
      }

      const cpuCenter = state.cpuY + paddleHeight / 2;
      if (cpuCenter < state.ballY - 10) {
        state.cpuY += 4.5;
      } else if (cpuCenter > state.ballY + 10) {
        state.cpuY -= 4.5;
      }

      clampPaddles();

      state.ballX += state.ballVx;
      state.ballY += state.ballVy;

      if (state.ballY - ballRadius <= 0 || state.ballY + ballRadius >= CANVAS_SIZE) {
        state.ballVy *= -1;
      }

      const playerPaddleX = paddleMargin;
      const cpuPaddleX = CANVAS_SIZE - paddleMargin - paddleWidth;

      if (
        state.ballVx < 0 &&
        state.ballX - ballRadius <= playerPaddleX + paddleWidth &&
        state.ballX - ballRadius >= playerPaddleX &&
        state.ballY >= state.playerY &&
        state.ballY <= state.playerY + paddleHeight
      ) {
        const offset =
          (state.ballY - (state.playerY + paddleHeight / 2)) / (paddleHeight / 2);
        state.ballVx = Math.abs(state.ballVx);
        state.ballVy = clamp(state.ballVy + offset * 1.6, -7, 7);
      }

      if (
        state.ballVx > 0 &&
        state.ballX + ballRadius >= cpuPaddleX &&
        state.ballX + ballRadius <= cpuPaddleX + paddleWidth &&
        state.ballY >= state.cpuY &&
        state.ballY <= state.cpuY + paddleHeight
      ) {
        const offset =
          (state.ballY - (state.cpuY + paddleHeight / 2)) / (paddleHeight / 2);
        state.ballVx = -Math.abs(state.ballVx);
        state.ballVy = clamp(state.ballVy + offset * 1.6, -7, 7);
      }

      if (state.ballX + ballRadius < 0) {
        state.cpuScore += 1;
        if (state.cpuScore >= winScore) {
          state.status = "game_over";
        } else {
          resetBall(false);
        }
      }

      if (state.ballX - ballRadius > CANVAS_SIZE) {
        state.playerScore += 1;
        if (state.playerScore >= winScore) {
          state.status = "game_over";
        } else {
          resetBall(true);
        }
      }
    },
    render() {
      clearCanvas(ctx, "#10161d");

      ctx.strokeStyle = "#2a3342";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_SIZE / 2, 0);
      ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(paddleMargin, state.playerY, paddleWidth, paddleHeight);
      ctx.fillRect(
        CANVAS_SIZE - paddleMargin - paddleWidth,
        state.cpuY,
        paddleWidth,
        paddleHeight,
      );

      drawDot(ctx, state.ballX, state.ballY, ballRadius);
    },
    onKeyDown(key) {
      const normalized = String(key).toLowerCase();

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

      return false;
    },
    onKeyUp(key) {
      const normalized = String(key).toLowerCase();

      if (normalized === "arrowup" || normalized === "w") {
        state.input.up = false;
        return true;
      }

      if (normalized === "arrowdown" || normalized === "s") {
        state.input.down = false;
        return true;
      }

      return false;
    },
    onControl(action) {
      if (action === "UP") {
        state.playerY -= 26;
        clampPaddles();
        return true;
      }

      if (action === "DOWN") {
        state.playerY += 26;
        clampPaddles();
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
        const winner = state.playerScore > state.cpuScore ? "You win" : "CPU wins";
        return {
          score: `Player ${state.playerScore} : ${state.cpuScore} CPU`,
          status: `${winner}. Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Player ${state.playerScore} : ${state.cpuScore} CPU`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Player ${state.playerScore} : ${state.cpuScore} CPU`,
        status: "Use Arrow keys/W,S. First to 7 points wins.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
