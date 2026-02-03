import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];

export function createMastermindGame(ctx) {
  const difficultyAttempts = {
    easy: 12,
    normal: 10,
    hard: 8,
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function maxAttempts() {
    return difficultyAttempts[difficulty] || difficultyAttempts.normal;
  }

  function randomCode() {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * COLORS.length));
  }

  function createState() {
    return {
      status: "running",
      round: 1,
      score: 0,
      attempts: 0,
      cursor: 0,
      guess: [0, 0, 0, 0],
      secret: randomCode(),
      history: [],
      message: "Crack the code",
      won: false,
    };
  }

  function evaluateGuess(guess, secret) {
    let exact = 0;
    const remainingGuess = [];
    const remainingSecret = [];

    for (let i = 0; i < guess.length; i += 1) {
      if (guess[i] === secret[i]) {
        exact += 1;
      } else {
        remainingGuess.push(guess[i]);
        remainingSecret.push(secret[i]);
      }
    }

    let partial = 0;
    for (const color of remainingGuess) {
      const index = remainingSecret.indexOf(color);
      if (index >= 0) {
        partial += 1;
        remainingSecret.splice(index, 1);
      }
    }

    return { exact, partial };
  }

  function submitGuess() {
    if (state.status !== "running") {
      return false;
    }

    const feedback = evaluateGuess(state.guess, state.secret);
    state.history.unshift({
      guess: [...state.guess],
      feedback,
    });
    state.attempts += 1;

    if (feedback.exact === 4) {
      const gain = Math.max(4, maxAttempts() - state.attempts + 1) * state.round;
      state.score += gain;
      if (state.score > bestScore) {
        bestScore = state.score;
      }

      if (state.round >= 3) {
        state.status = "game_over";
        state.won = true;
        state.message = "Code cracked";
      } else {
        state.round += 1;
        state.attempts = 0;
        state.cursor = 0;
        state.guess = [0, 0, 0, 0];
        state.secret = randomCode();
        state.history = [];
        state.message = `Round ${state.round}`;
      }
      return true;
    }

    if (state.attempts >= maxAttempts()) {
      state.status = "game_over";
      state.won = false;
      state.message = "No attempts left";
      return true;
    }

    state.message = `${feedback.exact} exact, ${feedback.partial} near`;
    return true;
  }

  return {
    title: "Mastermind Code",
    controlScheme: "grid_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyAttempts[nextDifficulty]) {
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
    tick() {},
    render() {
      clearCanvas(ctx, "#101722");

      const slotW = 90;
      const topY = 70;

      for (let i = 0; i < 4; i += 1) {
        const x = 58 + i * slotW;
        const y = topY;

        ctx.fillStyle = COLORS[state.guess[i]];
        ctx.fillRect(x + 8, y + 8, 58, 58);

        if (i === state.cursor) {
          ctx.strokeStyle = "#f4d20b";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 4, y + 4, 66, 66);
        }
      }

      ctx.fillStyle = "#dbeafe";
      ctx.font = "700 14px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("History", 24, 168);

      const visible = state.history.slice(0, 6);
      for (let row = 0; row < visible.length; row += 1) {
        const item = visible[row];
        const y = 198 + row * 42;

        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = COLORS[item.guess[i]];
          ctx.fillRect(24 + i * 30, y, 22, 22);
        }

        ctx.fillStyle = "#f8fafc";
        ctx.fillText(`Exact ${item.feedback.exact} / Near ${item.feedback.partial}`, 160, y + 4);
      }

      if (state.status === "game_over" && !state.won) {
        ctx.fillStyle = "#93c5fd";
        ctx.fillText(`Secret: ${state.secret.join("-")}`, 24, CANVAS_SIZE - 32);
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

      if (key === "arrowleft" || key === "a") {
        state.cursor = Math.max(0, state.cursor - 1);
        return true;
      }
      if (key === "arrowright" || key === "d") {
        state.cursor = Math.min(3, state.cursor + 1);
        return true;
      }
      if (key === "arrowup" || key === "w") {
        state.guess[state.cursor] = (state.guess[state.cursor] + COLORS.length - 1) % COLORS.length;
        return true;
      }
      if (key === "arrowdown" || key === "s") {
        state.guess[state.cursor] = (state.guess[state.cursor] + 1) % COLORS.length;
        return true;
      }
      if (key === "f" || key === "enter") {
        return submitGuess();
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.cursor = Math.max(0, state.cursor - 1);
        return true;
      }
      if (action === "RIGHT") {
        state.cursor = Math.min(3, state.cursor + 1);
        return true;
      }
      if (action === "UP") {
        state.guess[state.cursor] = (state.guess[state.cursor] + COLORS.length - 1) % COLORS.length;
        return true;
      }
      if (action === "DOWN") {
        state.guess[state.cursor] = (state.guess[state.cursor] + 1) % COLORS.length;
        return true;
      }
      if (action === "SELECT") {
        return submitGuess();
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
      return 120;
    },
    getHud() {
      const attemptsLeft = maxAttempts() - state.attempts;
      const scoreLine = `Score: ${state.score} | Round: ${state.round}/3 | Attempts: ${attemptsLeft} | Best: ${bestScore}`;

      if (state.status === "game_over") {
        const result = state.won ? "All rounds solved" : "Code failed";
        return {
          score: scoreLine,
          status: `${result} (${difficulty}). Press Restart or Enter.`,
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
        status: `${state.message}. Adjust colors and press Select.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
