import { clamp, clearCanvas, drawDot } from "./shared.mjs";
import { CANVAS_SIZE } from "./shared.mjs";

export function createPongGame(ctx) {
  const paddleWidth = 12;
  const paddleHeight = 88;
  const ballRadius = 8;
  const paddleMargin = 18;

  // CPU is intentionally imperfect: slower than the player, delayed reactions,
  // noisy aim, and occasional misses so matches stay winnable.
  const difficultyPresets = {
    easy: {
      playerStep: 8.2,
      cpuStep: 2.9,
      cpuIdleStep: 1.5,
      baseBallSpeed: 3.7,
      winScore: 5,
      cpuError: 64,
      cpuReactionTicks: 10,
      cpuDeadZone: 16,
      cpuMissChance: 0.2,
      cpuTrackLead: 0.62,
    },
    normal: {
      playerStep: 7.4,
      cpuStep: 3.35,
      cpuIdleStep: 1.8,
      baseBallSpeed: 4.1,
      winScore: 7,
      cpuError: 44,
      cpuReactionTicks: 7,
      cpuDeadZone: 13,
      cpuMissChance: 0.14,
      cpuTrackLead: 0.75,
    },
    hard: {
      playerStep: 6.9,
      cpuStep: 4.2,
      cpuIdleStep: 2.2,
      baseBallSpeed: 4.6,
      winScore: 9,
      cpuError: 24,
      cpuReactionTicks: 4,
      cpuDeadZone: 10,
      cpuMissChance: 0.06,
      cpuTrackLead: 0.9,
    },
  };

  let difficulty = "normal";
  let state = createState();

  function currentPreset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    const preset = currentPreset();
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
      level: 1,
      targetScore: preset.winScore,
      ballX: CANVAS_SIZE / 2,
      ballY: CANVAS_SIZE / 2,
      ballVx: preset.baseBallSpeed,
      ballVy: preset.baseBallSpeed * 0.52,
      cpuAimOffset: 0,
      cpuReaction: 0,
      cpuTargetY: CANVAS_SIZE / 2,
    };
  }

  function refreshLevelAndTarget() {
    const totalPoints = state.playerScore + state.cpuScore;
    state.level = Math.min(10, Math.floor(totalPoints / 2) + 1);
    state.targetScore = currentPreset().winScore;
  }

  function resetBall(towardsPlayer) {
    const preset = currentPreset();
    const direction = towardsPlayer ? -1 : 1;
    const speed = preset.baseBallSpeed + (state.level - 1) * 0.22;

    state.ballX = CANVAS_SIZE / 2;
    state.ballY = CANVAS_SIZE / 2;
    state.ballVx = speed * direction;
    state.ballVy = (Math.random() * (speed * 0.85) + speed * 0.28) * (Math.random() > 0.5 ? 1 : -1);
    prepareCpuForIncomingRally(preset);
  }

  function prepareCpuForIncomingRally(preset = currentPreset()) {
    const willMiss = Math.random() < preset.cpuMissChance;
    const missSign = Math.random() > 0.5 ? 1 : -1;
    state.cpuAimOffset = willMiss
      ? missSign * (paddleHeight * 0.55 + Math.random() * paddleHeight * 0.35)
      : (Math.random() - 0.5) * preset.cpuError;
    state.cpuReaction = preset.cpuReactionTicks + Math.floor(Math.random() * 4);
    state.cpuTargetY = CANVAS_SIZE / 2;
  }

  function clampPaddles() {
    state.playerY = clamp(state.playerY, 0, CANVAS_SIZE - paddleHeight);
    state.cpuY = clamp(state.cpuY, 0, CANVAS_SIZE - paddleHeight);
  }

  function addSpinAndSpeed(offset) {
    const maxVy = 8.2 + state.level * 0.24;
    state.ballVy = clamp(state.ballVy + offset * 1.6, -maxVy, maxVy);

    const speedBoost = 1 + Math.min(0.14, state.level * 0.018);
    state.ballVx *= speedBoost;
    const maxVx = 8.4 + state.level * 0.22;
    state.ballVx = clamp(state.ballVx, -maxVx, maxVx);
  }

  function predictBallYAt(targetX) {
    let x = state.ballX;
    let y = state.ballY;
    let vx = state.ballVx;
    let vy = state.ballVy;

    if (vx <= 0) {
      return y;
    }

    for (let step = 0; step < 2400; step += 1) {
      x += vx;
      y += vy;

      if (y - ballRadius <= 0) {
        y = ballRadius;
        vy = Math.abs(vy);
      } else if (y + ballRadius >= CANVAS_SIZE) {
        y = CANVAS_SIZE - ballRadius;
        vy = -Math.abs(vy);
      }

      if (x >= targetX) {
        return y;
      }
    }

    return y;
  }

  function updateCpu(preset) {
    const cpuPaddleX = CANVAS_SIZE - paddleMargin - paddleWidth;
    const ballComing = state.ballVx > 0;
    const cpuCenter = state.cpuY + paddleHeight / 2;

    if (state.cpuReaction > 0) {
      state.cpuReaction -= 1;
    }

    if (ballComing && state.cpuReaction <= 0) {
      const predictedY = predictBallYAt(cpuPaddleX);
      // Blend prediction with live ball Y so the CPU is not laser-perfect.
      const blended = predictedY * preset.cpuTrackLead + state.ballY * (1 - preset.cpuTrackLead);
      state.cpuTargetY = blended + state.cpuAimOffset;
    } else if (!ballComing) {
      // Drift toward center while the ball is on the player's side.
      state.cpuTargetY = CANVAS_SIZE / 2 + state.cpuAimOffset * 0.15;
    }

    const desiredCenter = clamp(
      state.cpuTargetY,
      paddleHeight / 2,
      CANVAS_SIZE - paddleHeight / 2,
    );
    const delta = desiredCenter - cpuCenter;
    const deadZone = preset.cpuDeadZone;
    if (Math.abs(delta) <= deadZone) {
      return;
    }

    const maxStep = ballComing && state.cpuReaction <= 0
      ? preset.cpuStep + state.level * 0.08
      : preset.cpuIdleStep;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    state.cpuY += step;
  }

  return {
    title: "Pong",
    controlScheme: "vertical",
    setDifficulty(nextDifficulty) {
      if (!difficultyPresets[nextDifficulty]) {
        difficulty = "normal";
        return;
      }
      difficulty = nextDifficulty;
      state.targetScore = currentPreset().winScore;
    },
    start() {
      state = createState();
      prepareCpuForIncomingRally();
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

      const preset = currentPreset();

      if (state.input.up) {
        state.playerY -= preset.playerStep;
      }
      if (state.input.down) {
        state.playerY += preset.playerStep;
      }

      updateCpu(preset);
      clampPaddles();

      state.ballX += state.ballVx;
      state.ballY += state.ballVy;

      if (state.ballY - ballRadius <= 0 || state.ballY + ballRadius >= CANVAS_SIZE) {
        state.ballVy *= -1;
        state.ballY = clamp(state.ballY, ballRadius, CANVAS_SIZE - ballRadius);
      }

      const playerPaddleX = paddleMargin;
      const cpuPaddleX = CANVAS_SIZE - paddleMargin - paddleWidth;

      if (
        state.ballVx < 0 &&
        state.ballX - ballRadius <= playerPaddleX + paddleWidth &&
        state.ballX - ballRadius >= playerPaddleX - 2 &&
        state.ballY >= state.playerY &&
        state.ballY <= state.playerY + paddleHeight
      ) {
        const offset = (state.ballY - (state.playerY + paddleHeight / 2)) / (paddleHeight / 2);
        state.ballVx = Math.abs(state.ballVx);
        state.ballX = playerPaddleX + paddleWidth + ballRadius;
        addSpinAndSpeed(offset);
        prepareCpuForIncomingRally(preset);
      }

      if (
        state.ballVx > 0 &&
        state.ballX + ballRadius >= cpuPaddleX &&
        state.ballX + ballRadius <= cpuPaddleX + paddleWidth + 2 &&
        state.ballY >= state.cpuY &&
        state.ballY <= state.cpuY + paddleHeight
      ) {
        const offset = (state.ballY - (state.cpuY + paddleHeight / 2)) / (paddleHeight / 2);
        state.ballVx = -Math.abs(state.ballVx);
        state.ballX = cpuPaddleX - ballRadius;
        addSpinAndSpeed(offset);
      }

      if (state.ballX + ballRadius < 0) {
        state.cpuScore += 1;
        refreshLevelAndTarget();
        if (state.cpuScore >= state.targetScore) {
          state.status = "game_over";
        } else {
          resetBall(false);
        }
      }

      if (state.ballX - ballRadius > CANVAS_SIZE) {
        state.playerScore += 1;
        refreshLevelAndTarget();
        if (state.playerScore >= state.targetScore) {
          state.status = "game_over";
        } else {
          resetBall(true);
        }
      }
    },
    render() {
      clearCanvas(ctx, "#f8fbfd");

      ctx.strokeStyle = "#c7d5df";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_SIZE / 2, 0);
      ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#20c7e5";
      ctx.fillRect(paddleMargin, state.playerY, paddleWidth, paddleHeight);
      ctx.fillStyle = "#ff5d73";
      ctx.fillRect(CANVAS_SIZE - paddleMargin - paddleWidth, state.cpuY, paddleWidth, paddleHeight);

      ctx.fillStyle = "#ffd34f";
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
        state.playerY -= 24;
        clampPaddles();
        return true;
      }

      if (action === "DOWN") {
        state.playerY += 24;
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
      prepareCpuForIncomingRally();
    },
    getTickMs() {
      return 16;
    },
    /** @internal test helper */
    getDebugState() {
      return state;
    },
    getHud() {
      if (state.status === "game_over") {
        const winner = state.playerScore > state.cpuScore ? "You win" : "CPU wins";
        return {
          score: `Player ${state.playerScore} : ${state.cpuScore} CPU | Level: ${state.level} | Best: ${state.playerScore}`,
          status: `${winner} (${difficulty}). Press Restart or Enter.`,
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }

      if (state.status === "paused") {
        return {
          score: `Player ${state.playerScore} : ${state.cpuScore} CPU | Level: ${state.level} | Best: ${state.playerScore}`,
          status: `Paused (${difficulty}). Press Pause or Space to continue.`,
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }

      return {
        score: `Player ${state.playerScore} : ${state.cpuScore} CPU | Level: ${state.level} | Best: ${state.playerScore}`,
        status: `Use Arrow keys/W,S (${difficulty}). First to ${state.targetScore} wins.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
