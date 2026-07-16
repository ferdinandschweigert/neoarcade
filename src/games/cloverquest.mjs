import { CANVAS_SIZE, clamp, clearCanvas, rectsOverlap } from "./shared.mjs";

const GRAVITY = 0.62;
const PLAYER_W = 25;
const PLAYER_H = 34;
const LEVEL_WIDTH = 2380;
const GROUND_Y = 404;

const PLATFORMS = [
  [0, GROUND_Y, 360, 76], [440, 372, 170, 108], [680, 330, 130, 150],
  [900, 392, 220, 88], [1190, 344, 170, 136], [1430, 294, 160, 186],
  [1670, 370, 210, 110], [1940, 328, 190, 152], [2180, 382, 200, 98],
];
const BLOCKS = [
  [300, 270, "brick"], [336, 270, "brick"], [372, 270, "pot"], [408, 270, "mystery"],
  [724, 225, "brick"], [760, 225, "pot"], [1240, 242, "mystery"], [1276, 242, "brick"],
  [1500, 196, "pot"], [1536, 196, "brick"], [1990, 238, "mystery"],
];
const POTS = [[515, 329], [770, 287], [1250, 301], [1510, 251], [1755, 326], [2025, 287], [2240, 331]];
const ENEMIES = [[530, 350], [1030, 370], [1745, 345], [2050, 305]];

export function createCloverQuestGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "ready", score: 0, clovers: 0, pots: new Set(), blocks: new Map(BLOCKS.map(([x, y, kind]) => [`${x},${y}`, { x, y, kind, broken: false }])),
      enemies: ENEMIES.map(([x, y]) => ({ x, y, dir: -1, alive: true })), player: { x: 74, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0, onGround: true, invuln: 0, facing: 1 },
      cameraX: 0, held: new Set(), checkpointX: 74, message: "Press Jump to begin your clover run.",
    };
  }

  function platformTopAt(x, previousY) {
    let top = null;
    for (const [px, py, width] of PLATFORMS) {
      if (x + PLAYER_W > px && x < px + width && (top === null || py < top)) top = py;
    }
    return top === null ? previousY : top;
  }

  function startRun() {
    if (state.status === "ready") state.status = "running";
  }

  function jump() {
    startRun();
    if (state.status === "running" && state.player.onGround) {
      state.player.vy = -11.5;
      state.player.onGround = false;
      return true;
    }
    return false;
  }

  function breakBlocks() {
    const head = { x: state.player.x + 3, y: state.player.y - 6, w: PLAYER_W - 6, h: 10 };
    for (const block of state.blocks.values()) {
      if (block.broken || !rectsOverlap(head.x, head.y, head.w, head.h, block.x, block.y, 34, 30)) continue;
      block.broken = true;
      state.score += block.kind === "pot" ? 120 : 25;
      state.clovers += block.kind === "mystery" ? 3 : 1;
      state.message = block.kind === "pot" ? "Gold pot block! +120" : "Block broken!";
    }
  }

  function collectThings() {
    const cx = state.player.x + PLAYER_W / 2;
    const cy = state.player.y + PLAYER_H / 2;
    POTS.forEach(([x, y], index) => {
      if (!state.pots.has(index) && Math.hypot(cx - x, cy - y) < 26) {
        state.pots.add(index); state.score += 180; state.message = "Gold pot found!";
      }
    });
    for (const enemy of state.enemies) {
      if (!enemy.alive || !rectsOverlap(state.player.x, state.player.y, PLAYER_W, PLAYER_H, enemy.x, enemy.y, 28, 22)) continue;
      if (state.player.vy > 1 && state.player.y + PLAYER_H - enemy.y < 15) {
        enemy.alive = false; state.player.vy = -7.4; state.score += 50; state.message = "Bounced a hedgehopper!";
      } else if (state.player.invuln === 0) {
        state.player.x = state.checkpointX; state.player.y = platformTopAt(state.checkpointX, GROUND_Y) - PLAYER_H; state.player.vy = 0; state.player.invuln = 90; state.message = "Back to the clover flag.";
      }
    }
  }

  function updatePlayer() {
    const p = state.player;
    const direction = (state.held.has("LEFT") ? -1 : 0) + (state.held.has("RIGHT") ? 1 : 0);
    p.vx += (direction * 0.7 - p.vx) * 0.28;
    if (direction) p.facing = direction;
    p.x = clamp(p.x + p.vx, 0, LEVEL_WIDTH - PLAYER_W);
    p.vy += GRAVITY;
    const priorBottom = p.y + PLAYER_H;
    p.y += p.vy;
    const top = platformTopAt(p.x + PLAYER_W / 2, p.y + PLAYER_H);
    if (p.vy >= 0 && priorBottom <= top + 8 && p.y + PLAYER_H >= top) {
      p.y = top - PLAYER_H; p.vy = 0; p.onGround = true;
    } else {
      p.onGround = false;
      if (p.vy < 0) breakBlocks();
    }
    if (p.y > CANVAS_SIZE + 80) { p.x = state.checkpointX; p.y = platformTopAt(p.x, GROUND_Y) - PLAYER_H; p.vy = 0; state.message = "The river sends you back."; }
    if (p.x > 1120) state.checkpointX = 1210;
    if (p.x > LEVEL_WIDTH - 150) { state.status = "complete"; bestScore = Math.max(bestScore, state.score); state.message = "Rainbow gate reached!"; }
    p.invuln = Math.max(0, p.invuln - 1);
    state.cameraX += (clamp(p.x - 150, 0, LEVEL_WIDTH - CANVAS_SIZE) - state.cameraX) * 0.12;
  }

  function drawPlatform(x, y, width, height) {
    ctx.fillStyle = "#4a3028"; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#2a8b56"; ctx.fillRect(x, y, width, 12);
    ctx.fillStyle = "#8edb70"; ctx.fillRect(x, y, width, 4);
    for (let i = 10; i < width; i += 28) { ctx.fillStyle = "#694334"; ctx.fillRect(x + i, y + 24, 13, 8); }
  }

  function worldX(x) { return Math.round(x - state.cameraX); }

  return {
    title: "Clover Quest", controlScheme: "dpad", stageAspect: "landscape",
    setDifficulty() {},
    start() { state = createState(); }, stop() { if (state.status === "running") state.status = "paused"; },
    tick() {
      if (state.status !== "running") return;
      updatePlayer();
      for (const enemy of state.enemies) { if (enemy.alive) { enemy.x += enemy.dir * 0.6; if (enemy.x % 95 < 1) enemy.dir *= -1; } }
    },
    render() {
      clearCanvas(ctx, "#8edcf0");
      const parallax = state.cameraX * 0.18;
      ctx.fillStyle = "#a7e7f4"; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = "#92b9b5";
      for (let x = -120; x < CANVAS_SIZE + 180; x += 170) { ctx.beginPath(); ctx.moveTo(x - parallax % 170, 260); ctx.lineTo(x + 80 - parallax % 170, 90); ctx.lineTo(x + 165 - parallax % 170, 260); ctx.fill(); }
      ctx.fillStyle = "#5f9c87"; ctx.fillRect(0, 285, CANVAS_SIZE, 120);
      for (const [px, py, width, height] of PLATFORMS) { const x = worldX(px); if (x + width > -30 && x < CANVAS_SIZE + 30) drawPlatform(x, py, width, height); }
      for (const block of state.blocks.values()) {
        if (block.broken) continue; const x = worldX(block.x); if (x < -40 || x > CANVAS_SIZE + 40) continue;
        ctx.fillStyle = block.kind === "mystery" ? "#ffd34f" : block.kind === "pot" ? "#ffae35" : "#a96b45"; ctx.fillRect(x, block.y, 34, 30);
        ctx.strokeStyle = "#283043"; ctx.lineWidth = 2; ctx.strokeRect(x, block.y, 34, 30);
        if (block.kind === "mystery") { ctx.fillStyle = "#fff4b0"; ctx.font = "bold 22px monospace"; ctx.fillText("?", x + 9, block.y + 23); }
      }
      POTS.forEach(([px, py], index) => { if (!state.pots.has(index)) { const x = worldX(px); ctx.fillStyle = "#ffd34f"; ctx.beginPath(); ctx.arc(x, py, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ff9f2f"; ctx.fillRect(x - 13, py - 7, 26, 8); } });
      for (const enemy of state.enemies) { if (enemy.alive) { const x = worldX(enemy.x); ctx.fillStyle = "#7bd66f"; ctx.fillRect(x, enemy.y, 28, 20); ctx.fillStyle = "#283043"; ctx.fillRect(x + 6, enemy.y + 6, 4, 4); } }
      const p = state.player; const px = worldX(p.x); if (!(p.invuln && Math.floor(p.invuln / 6) % 2)) { ctx.fillStyle = "#58a953"; ctx.fillRect(px + 5, p.y + 9, 18, 22); ctx.fillStyle = "#ffe3bc"; ctx.fillRect(px + 8, p.y + 2, 15, 13); ctx.fillStyle = "#28633a"; ctx.fillRect(px + 5, p.y, 18, 6); ctx.fillStyle = "#6b3c2c"; ctx.fillRect(px + 3, p.y + 29, 9, 5); ctx.fillRect(px + 17, p.y + 29, 9, 5); }
      const gateX = worldX(2290); if (gateX > -80 && gateX < CANVAS_SIZE + 80) { ctx.strokeStyle = "#ff78d7"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(gateX, 345, 40, Math.PI, 0); ctx.stroke(); ctx.fillStyle = "#fff0a5"; ctx.font = "bold 12px monospace"; ctx.fillText("GATE", gateX - 17, 360); }
      if (state.status === "ready" || state.status === "paused" || state.status === "complete") { ctx.fillStyle = "rgba(17,24,39,.72)"; ctx.fillRect(72, 172, 336, 110); ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "bold 22px monospace"; ctx.fillText(state.status === "complete" ? "RAINBOW GATE!" : state.status === "paused" ? "PAUSED" : "CLOVER QUEST", 240, 214); ctx.font = "14px monospace"; ctx.fillText(state.status === "ready" ? "Press Up or Select to begin" : state.message, 240, 244); ctx.textAlign = "left"; }
    },
    onKeyDown(key) { const k = String(key).toLowerCase(); if (["arrowleft", "a"].includes(k)) { state.held.add("LEFT"); startRun(); return true; } if (["arrowright", "d"].includes(k)) { state.held.add("RIGHT"); startRun(); return true; } if (["arrowup", "w", "enter"].includes(k)) return jump(); return false; },
    onKeyUp(key) { const k = String(key).toLowerCase(); if (["arrowleft", "a"].includes(k)) { state.held.delete("LEFT"); return true; } if (["arrowright", "d"].includes(k)) { state.held.delete("RIGHT"); return true; } return false; },
    onControl(action) { if (action === "LEFT" || action === "RIGHT") { state.held.add(action); startRun(); return true; } return action === "UP" || action === "SELECT" ? jump() : false; },
    togglePause() { if (state.status === "ready") startRun(); else if (state.status !== "complete") state.status = state.status === "paused" ? "running" : "paused"; },
    restart() { state = createState(); }, getTickMs() { return 16; },
    getControlHint() { return "Left/Right: run · Up/Select: jump · hit blocks from below · find the rainbow gate."; },
    getHud() { return { score: `Score: ${state.score} | Gold pots: ${state.pots.size}/7 | Best: ${bestScore}`, status: state.message, pauseLabel: state.status === "paused" || state.status === "ready" ? "Start" : "Pause", pauseDisabled: state.status === "complete" }; },
  };
}
