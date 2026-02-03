import { CANVAS_SIZE, clearCanvas, clamp } from "./shared.mjs";

export function createHeliGame(ctx) {
  const difficultyPresets = {
    easy: {
      gravity: 0.18,
      flap: -3.8,
      baseSpeed: 2.3,
      gapStart: 170,
      timeBonus: 0,
    },
    normal: {
      gravity: 0.22,
      flap: -4.2,
      baseSpeed: 2.7,
      gapStart: 156,
      timeBonus: 0,
    },
    hard: {
      gravity: 0.26,
      flap: -4.6,
      baseSpeed: 3.1,
      gapStart: 142,
      timeBonus: 0,
    },
  };

  let difficulty = "normal";
  let bestScore = 0;
  let state = createState();

  function preset() {
    return difficultyPresets[difficulty] || difficultyPresets.normal;
  }

  function createState() {
    return {
      status: "running",
      score: 0,
      level: 1,
      y: CANVAS_SIZE / 2,
      vy: 0,
      flapQueued: false,
      speed: preset().baseSpeed,
      columns: [],
      spawnCooldown: 46,
      message: "",
    };
  }

  function spawnColumn() {
    const gapHeight = Math.max(96, preset().gapStart - state.level * 5);
    const gapTop = 36 + Math.random() * (CANVAS_SIZE - gapHeight - 72);

    state.columns.push({
      x: CANVAS_SIZE + 24,
      width: 54,
      gapTop,
      gapHeight,
      scored: false,
    });
  }

  function onCrash() {
    state.status = "game_over";
  }

  return {
    title: "Heli Tunnel",
    controlScheme: "select_only",
    setDifficulty(nextDifficulty) {
      if (!difficultyPresets[nextDifficulty]) {
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
    tick() {
      if (state.status !== "running") {
        return;
      }

      const cfg = preset();
      state.level = Math.max(1, Math.floor(state.score / 6) + 1);
      state.speed = Math.min(7.6, cfg.baseSpeed + state.level * 0.22);

      if (state.flapQueued) {
        state.vy += cfg.flap;
      }
      state.flapQueued = false;

      state.vy += cfg.gravity;
      state.vy = clamp(state.vy, -7.8, 7.8);
      state.y += state.vy;

      state.spawnCooldown -= 1;
      if (state.spawnCooldown <= 0) {
        spawnColumn();
        state.spawnCooldown = Math.max(24, 46 - state.level * 2) + Math.floor(Math.random() * 14);
      }

      for (const column of state.columns) {
        column.x -= state.speed;
      }
      state.columns = state.columns.filter((column) => column.x + column.width > -20);

      const heliX = 120;
      const heliW = 38;
      const heliH = 20;

      if (state.y - heliH / 2 < 10 || state.y + heliH / 2 > CANVAS_SIZE - 10) {
        onCrash();
      }

      for (const column of state.columns) {
        const overlapX = heliX + heliW > column.x && heliX < column.x + column.width;
        if (!overlapX) {
          continue;
        }

        const inGap = state.y - heliH / 2 > column.gapTop && state.y + heliH / 2 < column.gapTop + column.gapHeight;
        if (!inGap) {
          onCrash();
          break;
        }
      }

      if (state.status === "game_over") {
        return;
      }

      for (const column of state.columns) {
        if (!column.scored && column.x + column.width < heliX) {
          column.scored = true;
          state.score += 1;
          if (state.score > bestScore) {
            bestScore = state.score;
          }
        }
      }
    },
    render() {
      clearCanvas(ctx, "#e8eef5");

      ctx.fillStyle = "#d6e3f2";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      for (const column of state.columns) {
        ctx.fillStyle = "#2f7d55";
        ctx.fillRect(column.x, 0, column.width, column.gapTop);
        ctx.fillRect(
          column.x,
          column.gapTop + column.gapHeight,
          column.width,
          CANVAS_SIZE - (column.gapTop + column.gapHeight),
        );
      }

      const heliX = 120;
      ctx.fillStyle = "#1e61ff";
      ctx.fillRect(heliX, state.y - 10, 38, 20);
      ctx.fillRect(heliX + 9, state.y - 16, 20, 4);
      ctx.fillStyle = "#111827";
      ctx.fillRect(heliX + 12, state.y - 19, 14, 2);
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
      if (key === "arrowup" || key === "w" || key === "f" || key === "enter") {
        state.flapQueued = true;
        return true;
      }
      return false;
    },
    onKeyUp() {
      return false;
    },
    onControl(action) {
      if (action === "UP" || action === "SELECT") {
        state.flapQueued = true;
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
      const scoreLine = `Score: ${state.score} | Level: ${state.level} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: `Crash (${difficulty}). Press Restart or Enter.`,
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
        status: `Tap Up/Select (${difficulty}) to hold altitude through each tunnel level.`,
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
