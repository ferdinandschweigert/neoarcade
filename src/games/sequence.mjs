import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const PAD_COLORS = [
  { idle: "#1e61ff", lit: "#7eb0ff" },
  { idle: "#e24739", lit: "#ff8f84" },
  { idle: "#22c55e", lit: "#86efac" },
  { idle: "#f4d20b", lit: "#ffe66d" },
];

export function createSequenceEchoGame(ctx) {
  const difficultyConfig = {
    easy: { startLength: 2, flashTicks: 18, gapTicks: 10, inputTimeout: 220 },
    normal: { startLength: 3, flashTicks: 14, gapTicks: 8, inputTimeout: 180 },
    hard: { startLength: 4, flashTicks: 10, gapTicks: 6, inputTimeout: 140 },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function config() {
    return difficultyConfig[difficulty] || difficultyConfig.normal;
  }

  function createState() {
    return {
      status: "running",
      phase: "watch",
      sequence: [],
      playbackIndex: 0,
      inputIndex: 0,
      flashPad: -1,
      litTicks: 0,
      timer: 20,
      score: 0,
      round: 0,
      cursor: 0,
      message: "Watch",
    };
  }

  function buildOpeningSequence() {
    const startLength = config().startLength;
    const sequence = [];
    for (let i = 0; i < startLength; i += 1) {
      sequence.push(Math.floor(Math.random() * 4));
    }
    return sequence;
  }

  function extendSequence() {
    state.sequence.push(Math.floor(Math.random() * 4));
    state.round += 1;
    state.inputIndex = 0;
    state.playbackIndex = 0;
    state.phase = "watch";
    state.flashPad = -1;
    state.litTicks = 0;
    state.timer = 16;
    state.message = "Watch";
  }

  function beginPlayback() {
    state.phase = "playback";
    state.playbackIndex = 0;
    state.flashPad = state.sequence[0];
    state.timer = config().flashTicks;
    state.message = "Watch";
  }

  function beginInput() {
    state.phase = "input";
    state.inputIndex = 0;
    state.flashPad = -1;
    state.litTicks = 0;
    state.timer = config().inputTimeout;
    state.message = "Echo";
  }

  function pressPad(index) {
    if (state.status !== "running" || state.phase !== "input") {
      return false;
    }

    if (state.sequence[state.inputIndex] !== index) {
      state.status = "game_over";
      state.message = "Miss";
      state.flashPad = -1;
      state.litTicks = 0;
      return true;
    }

    state.flashPad = index;
    state.litTicks = 8;
    state.inputIndex += 1;
    state.timer = config().inputTimeout;

    if (state.inputIndex >= state.sequence.length) {
      state.score = Math.max(state.score, state.sequence.length);
      bestScore = Math.max(bestScore, state.score);
      state.phase = "success";
      state.timer = 28;
      state.message = "Nice";
    }

    return true;
  }

  function moveCursor(direction) {
    const row = Math.floor(state.cursor / 2);
    const col = state.cursor % 2;
    let nextRow = row;
    let nextCol = col;

    if (direction === "UP") {
      nextRow = Math.max(0, row - 1);
    } else if (direction === "DOWN") {
      nextRow = Math.min(1, row + 1);
    } else if (direction === "LEFT") {
      nextCol = Math.max(0, col - 1);
    } else if (direction === "RIGHT") {
      nextCol = Math.min(1, col + 1);
    }

    const next = nextRow * 2 + nextCol;
    if (next !== state.cursor) {
      state.cursor = next;
      return true;
    }
    return false;
  }

  return {
    title: "Sequence Echo",
    controlScheme: "grid_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyConfig[nextDifficulty]) {
        difficulty = "normal";
        return;
      }
      difficulty = nextDifficulty;
    },
    start() {
      state = createState();
      state.sequence = buildOpeningSequence();
      state.round = 1;
      state.timer = 24;
      state.phase = "watch";
      state.message = "Watch";
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

      if (state.litTicks > 0) {
        state.litTicks -= 1;
        if (state.litTicks === 0 && state.phase === "input") {
          state.flashPad = -1;
        }
      }

      if (state.phase === "watch") {
        state.timer -= 1;
        if (state.timer <= 0) {
          beginPlayback();
        }
        return;
      }

      if (state.phase === "playback") {
        state.timer -= 1;
        if (state.timer > 0) {
          return;
        }

        if (state.flashPad >= 0) {
          state.flashPad = -1;
          state.timer = config().gapTicks;
          return;
        }

        state.playbackIndex += 1;
        if (state.playbackIndex >= state.sequence.length) {
          beginInput();
          return;
        }

        state.flashPad = state.sequence[state.playbackIndex];
        state.timer = config().flashTicks;
        return;
      }

      if (state.phase === "input") {
        state.timer -= 1;
        if (state.timer <= 0) {
          state.status = "game_over";
          state.message = "Too slow";
        }
        return;
      }

      if (state.phase === "success") {
        state.timer -= 1;
        if (state.timer <= 0) {
          extendSequence();
        }
      }
    },
    render() {
      clearCanvas(ctx, "#151b24");

      const boardX = 70;
      const boardY = 90;
      const cell = 160;
      const gap = 18;

      for (let index = 0; index < 4; index += 1) {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = boardX + col * (cell + gap);
        const y = boardY + row * (cell + gap);
        const lit = state.flashPad === index;
        const colors = PAD_COLORS[index];

        ctx.fillStyle = lit ? colors.lit : colors.idle;
        ctx.fillRect(x, y, cell, cell);

        if (state.cursor === index && state.status !== "game_over" && state.phase === "input") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 5;
          ctx.strokeRect(x + 8, y + 8, cell - 16, cell - 16);
        }
      }

      ctx.fillStyle = "#f7f7f7";
      ctx.font = "900 28px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.message, CANVAS_SIZE / 2, 48);

      ctx.fillStyle = "#9aa7b8";
      ctx.font = "700 18px Arial";
      ctx.fillText(`Round ${state.round} · Length ${state.sequence.length}`, CANVAS_SIZE / 2, 440);
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
      if (key === "f" || key === "enter") {
        return pressPad(state.cursor);
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
        return pressPad(state.cursor);
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
      this.start();
    },
    getTickMs() {
      return 50;
    },
    getHud() {
      const best = bestScore > 0 ? bestScore : "-";
      const scoreLine = `Length: ${state.sequence.length} | Score: ${state.score} | Best: ${best}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `${state.message} (${difficulty}). Press Restart or Enter.`,
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
        status: "Watch the pattern, then echo it with Select.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
