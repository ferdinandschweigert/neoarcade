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

export function createBreakoutGame(ctx) {
  const paddleWidth = 90;
  const paddleHeight = 12;
  const paddleY = CANVAS_SIZE - 28;
  const ballRadius = 8;

  const brickRows = 5;
  const brickCols = 8;
  const brickGap = 4;
  const brickHeight = 18;
  const brickPaddingX = 16;
  const brickOffsetTop = 56;
  const brickWidth =
    (CANVAS_SIZE - brickPaddingX * 2 - (brickCols - 1) * brickGap) / brickCols;

  const brickColors = ["#f94144", "#f3722c", "#f8961e", "#f9c74f", "#43aa8b"];

  let bestScore = 0;
  let state = createState();

  function createBricks() {
    const bricks = [];

    for (let row = 0; row < brickRows; row += 1) {
      for (let col = 0; col < brickCols; col += 1) {
        bricks.push({
          x: brickPaddingX + col * (brickWidth + brickGap),
          y: brickOffsetTop + row * (brickHeight + brickGap),
          color: brickColors[row % brickColors.length],
          alive: true,
        });
      }
    }

    return bricks;
  }

  function createState() {
    return {
      status: "running",
      won: false,
      score: 0,
      lives: 3,
      input: {
        left: false,
        right: false,
      },
      paddleX: CANVAS_SIZE / 2 - paddleWidth / 2,
      ballX: CANVAS_SIZE / 2,
      ballY: CANVAS_SIZE - 72,
      ballVx: 3.2,
      ballVy: -3.4,
      bricks: createBricks(),
    };
  }

  function resetBall() {
    state.ballX = state.paddleX + paddleWidth / 2;
    state.ballY = CANVAS_SIZE - 72;
    state.ballVx = state.ballVx >= 0 ? 3.2 : -3.2;
    state.ballVy = -3.4;
  }

  function clampPaddle() {
    state.paddleX = clamp(state.paddleX, 0, CANVAS_SIZE - paddleWidth);
  }

  return {
    title: "Breakout",
    controlScheme: "horizontal",
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

      if (state.input.left) {
        state.paddleX -= 7;
      }
      if (state.input.right) {
        state.paddleX += 7;
      }
      clampPaddle();

      state.ballX += state.ballVx;
      state.ballY += state.ballVy;

      if (state.ballX - ballRadius <= 0 || state.ballX + ballRadius >= CANVAS_SIZE) {
        state.ballVx *= -1;
      }

      if (state.ballY - ballRadius <= 0) {
        state.ballVy *= -1;
      }

      if (
        state.ballVy > 0 &&
        state.ballY + ballRadius >= paddleY &&
        state.ballY + ballRadius <= paddleY + paddleHeight &&
        state.ballX >= state.paddleX &&
        state.ballX <= state.paddleX + paddleWidth
      ) {
        const hitOffset =
          (state.ballX - (state.paddleX + paddleWidth / 2)) / (paddleWidth / 2);
        state.ballVy = -Math.abs(state.ballVy);
        state.ballVx = clamp(state.ballVx + hitOffset * 1.4, -6.5, 6.5);
      }

      for (const brick of state.bricks) {
        if (!brick.alive) {
          continue;
        }

        const hit =
          state.ballX + ballRadius > brick.x &&
          state.ballX - ballRadius < brick.x + brickWidth &&
          state.ballY + ballRadius > brick.y &&
          state.ballY - ballRadius < brick.y + brickHeight;

        if (!hit) {
          continue;
        }

        brick.alive = false;
        state.score += 10;
        state.ballVy *= -1;

        if (state.score > bestScore) {
          bestScore = state.score;
        }

        break;
      }

      if (state.bricks.every((brick) => !brick.alive)) {
        state.status = "game_over";
        state.won = true;
      }

      if (state.ballY - ballRadius > CANVAS_SIZE) {
        state.lives -= 1;
        if (state.lives <= 0) {
          state.status = "game_over";
          state.won = false;
        } else {
          resetBall();
        }
      }
    },
    render() {
      clearCanvas(ctx, "#10161d");

      for (const brick of state.bricks) {
        if (!brick.alive) {
          continue;
        }

        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brickWidth, brickHeight);
      }

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(state.paddleX, paddleY, paddleWidth, paddleHeight);
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

      if (normalized === "arrowleft" || normalized === "a") {
        state.input.left = true;
        return true;
      }

      if (normalized === "arrowright" || normalized === "d") {
        state.input.right = true;
        return true;
      }

      return false;
    },
    onKeyUp(key) {
      const normalized = String(key).toLowerCase();

      if (normalized === "arrowleft" || normalized === "a") {
        state.input.left = false;
        return true;
      }

      if (normalized === "arrowright" || normalized === "d") {
        state.input.right = false;
        return true;
      }

      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.paddleX -= 30;
        clampPaddle();
        return true;
      }

      if (action === "RIGHT") {
        state.paddleX += 30;
        clampPaddle();
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
        const winText = state.won ? "Board cleared" : "Out of lives";
        return {
          score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
          status: `${winText}. Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Score: ${state.score} | Lives: ${state.lives} | Best: ${bestScore}`,
        status: "Move with Arrow keys/A,D and clear every brick.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
