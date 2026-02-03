import { CANVAS_SIZE, clearCanvas } from "./shared.mjs";

export function createHanoiGame(ctx) {
  const difficultyBaseDisks = {
    easy: 3,
    normal: 4,
    hard: 5,
  };

  const totalRounds = 3;

  let difficulty = "normal";
  let bestMoves = Infinity;
  let state = createState();

  function baseDisks() {
    return difficultyBaseDisks[difficulty] || difficultyBaseDisks.normal;
  }

  function stackFor(disks) {
    const stack = [];
    for (let disk = disks; disk >= 1; disk -= 1) {
      stack.push(disk);
    }
    return stack;
  }

  function createState() {
    const disks = baseDisks();
    return {
      status: "running",
      round: 1,
      disks,
      towers: [stackFor(disks), [], []],
      cursor: 0,
      held: null,
      moves: 0,
      message: "",
      won: false,
    };
  }

  function loadRound(round) {
    const disks = baseDisks() + (round - 1);
    state.round = round;
    state.disks = disks;
    state.towers = [stackFor(disks), [], []];
    state.cursor = 0;
    state.held = null;
    state.moves = 0;
    state.message = `Round ${round}`;
  }

  function attemptAction() {
    if (state.status !== "running") {
      return false;
    }

    const tower = state.towers[state.cursor];
    if (state.held == null) {
      if (tower.length === 0) {
        return false;
      }
      state.held = tower.pop();
      return true;
    }

    const top = tower[tower.length - 1];
    if (top != null && top < state.held) {
      return false;
    }

    tower.push(state.held);
    state.held = null;
    state.moves += 1;

    if (state.towers[2].length === state.disks) {
      if (state.round >= totalRounds) {
        state.status = "game_over";
        state.won = true;
        bestMoves = Math.min(bestMoves, state.moves);
      } else {
        loadRound(state.round + 1);
      }
    }

    return true;
  }

  return {
    title: "Tower of Hanoi",
    controlScheme: "horizontal_select",
    setDifficulty(nextDifficulty) {
      if (!difficultyBaseDisks[nextDifficulty]) {
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
      clearCanvas(ctx, "#121826");

      const baseY = CANVAS_SIZE - 44;
      const towerXs = [110, 240, 370];

      ctx.fillStyle = "#334155";
      ctx.fillRect(40, baseY, CANVAS_SIZE - 80, 8);

      for (let i = 0; i < towerXs.length; i += 1) {
        const x = towerXs[i];
        ctx.fillStyle = "#64748b";
        ctx.fillRect(x - 4, 120, 8, baseY - 112);

        if (i === state.cursor) {
          ctx.strokeStyle = "#f4d20b";
          ctx.lineWidth = 4;
          ctx.strokeRect(x - 48, 104, 96, baseY - 84);
        }
      }

      for (let towerIndex = 0; towerIndex < state.towers.length; towerIndex += 1) {
        const tower = state.towers[towerIndex];
        for (let layer = 0; layer < tower.length; layer += 1) {
          const disk = tower[layer];
          const width = 32 + disk * 18;
          const x = towerXs[towerIndex] - width / 2;
          const y = baseY - (layer + 1) * 22;

          ctx.fillStyle = ["#60a5fa", "#34d399", "#f472b6", "#f59e0b", "#a78bfa", "#fb7185", "#22d3ee"][disk % 7];
          ctx.fillRect(x, y, width, 18);
        }
      }

      if (state.held != null) {
        const width = 32 + state.held * 18;
        const x = towerXs[state.cursor] - width / 2;
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x, 72, width, 18);
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
        state.cursor = Math.min(2, state.cursor + 1);
        return true;
      }
      if (key === "f" || key === "enter" || key === "arrowup" || key === "w") {
        return attemptAction();
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
        state.cursor = Math.min(2, state.cursor + 1);
        return true;
      }
      if (action === "SELECT") {
        return attemptAction();
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
      return 130;
    },
    getHud() {
      const best = Number.isFinite(bestMoves) ? bestMoves : "-";
      const scoreLine = `Round: ${state.round}/${totalRounds} | Disks: ${state.disks} | Moves: ${state.moves} | Best: ${best}`;

      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Puzzle solved (${difficulty}). Press Restart or Enter.`,
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
        status: "Move between towers and stack smaller disks on larger ones.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
