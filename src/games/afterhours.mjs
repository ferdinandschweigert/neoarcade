import { CANVAS_SIZE, clamp, clearCanvas } from "./shared.mjs";
import { safeStorageGetJson, safeStorageSetJson } from "../storage.mjs";

const SAVE_KEY = "neoArcade.afterHours.v1";
const MAX_OFFLINE_MS = 1000 * 60 * 60 * 8;

const CABINETS = [
  { name: "Pixel Pusher", color: "#9b78f6", base: 3, restore: 42, automate: 120, upgrade: 180 },
  { name: "Orbit Racer", color: "#20c7e5", base: 7, restore: 115, automate: 320, upgrade: 460 },
  { name: "Star Brawl", color: "#ff5d73", base: 14, restore: 300, automate: 850, upgrade: 1200 },
];

function defaultSave() {
  return { tickets: 55, parts: 1, selected: 0, lastSeen: Date.now(), cabinets: CABINETS.map(() => ({ quality: 0, automated: false, level: 0, pending: 0 })) };
}

function loadSave() {
  const stored = safeStorageGetJson(SAVE_KEY, null);
  if (!stored || !Array.isArray(stored.cabinets) || stored.cabinets.length !== CABINETS.length) return defaultSave();
  return { ...defaultSave(), ...stored, cabinets: stored.cabinets.map((cabinet, index) => ({ ...defaultSave().cabinets[index], ...cabinet })) };
}

export function createAfterHoursArcadeGame(ctx) {
  let state = null;
  let message = "Restore your first cabinet, then collect its tickets.";
  let lastPersist = 0;

  function productionPerSecond(cabinet, definition) {
    if (cabinet.quality === 0) return 0;
    return definition.base * (1 + cabinet.level * 0.65) * (cabinet.automated ? 1.5 : 1);
  }

  function totalRate() {
    return state.cabinets.reduce((sum, cabinet, index) => sum + productionPerSecond(cabinet, CABINETS[index]), 0);
  }

  function persist() {
    if (!state) return;
    state.lastSeen = Date.now();
    safeStorageSetJson(SAVE_KEY, state);
  }

  function applyOfflineProgress() {
    const elapsed = clamp(Date.now() - Number(state.lastSeen || Date.now()), 0, MAX_OFFLINE_MS);
    const earned = Math.floor((elapsed / 1000) * totalRate());
    if (earned > 0) { state.tickets += earned; message = `Welcome back — ${earned} offline tickets collected.`; }
  }

  function restoreSelected() {
    const cabinet = state.cabinets[state.selected]; const definition = CABINETS[state.selected];
    const cost = definition.restore * (cabinet.quality + 1);
    if (state.tickets < cost) { message = `Need ${cost} tickets to restore ${definition.name}.`; return false; }
    state.tickets -= cost; cabinet.quality += 1; state.parts += 1; message = `${definition.name} restoration improved.`; persist(); return true;
  }

  function automateSelected() {
    const cabinet = state.cabinets[state.selected]; const definition = CABINETS[state.selected];
    if (!cabinet.quality) { message = "Restore this cabinet first."; return false; }
    if (cabinet.automated) { message = "This cabinet already has a technician."; return false; }
    if (state.parts < 2) { message = "Need 2 parts to automate this cabinet."; return false; }
    state.parts -= 2; cabinet.automated = true; message = `${definition.name} now runs itself.`; persist(); return true;
  }

  function upgradeSelected() {
    const cabinet = state.cabinets[state.selected]; const definition = CABINETS[state.selected];
    if (!cabinet.quality) { message = "Restore this cabinet first."; return false; }
    const cost = definition.upgrade * (cabinet.level + 1);
    if (state.tickets < cost) { message = `Need ${cost} tickets for a performance upgrade.`; return false; }
    state.tickets -= cost; cabinet.level += 1; message = `${definition.name} earnings increased.`; persist(); return true;
  }

  function collect() {
    const cabinet = state.cabinets[state.selected];
    const amount = Math.floor(cabinet.pending);
    if (amount <= 0) { message = "No tickets ready at this cabinet yet."; return false; }
    cabinet.pending -= amount; state.tickets += amount; message = `Collected ${amount} tickets.`; persist(); return true;
  }

  function drawCabinet(x, y, index) {
    const cabinet = state.cabinets[index]; const definition = CABINETS[index]; const selected = state.selected === index;
    ctx.fillStyle = selected ? "#ffd34f" : "#273246"; ctx.fillRect(x - 5, y - 5, 112, 142);
    ctx.fillStyle = cabinet.quality ? definition.color : "#536070"; ctx.fillRect(x, y, 102, 132);
    ctx.fillStyle = "#111827"; ctx.fillRect(x + 12, y + 16, 78, 55);
    ctx.fillStyle = cabinet.quality ? "#7bd66f" : "#728090"; ctx.fillRect(x + 19, y + 24, 64, 37);
    ctx.fillStyle = "#111827"; ctx.fillRect(x + 14, y + 82, 74, 35);
    ctx.fillStyle = "#f8fbfd"; ctx.font = "bold 10px monospace"; ctx.fillText(definition.name.toUpperCase(), x + 8, y + 128);
    if (cabinet.quality) { ctx.fillStyle = "#ffd34f"; ctx.fillRect(x + 14, y + 91, Math.min(60, cabinet.quality * 18), 6); }
    if (cabinet.automated) { ctx.fillStyle = "#7bd66f"; ctx.beginPath(); ctx.arc(x + 92, y + 10, 7, 0, Math.PI * 2); ctx.fill(); }
    if (cabinet.pending >= 1) { ctx.fillStyle = "#ffd34f"; ctx.fillRect(x + 38, y - 20, 28, 14); ctx.fillStyle = "#283043"; ctx.font = "bold 9px monospace"; ctx.fillText(`${Math.floor(cabinet.pending)}`, x + 42, y - 9); }
  }

  return {
    title: "After Hours Arcade", controlScheme: "dpad", stageAspect: "landscape",
    setDifficulty() {},
    start() { state = loadSave(); applyOfflineProgress(); persist(); },
    stop() { persist(); },
    tick() {
      if (!state) return;
      state.cabinets.forEach((cabinet, index) => { cabinet.pending = Math.min(999, cabinet.pending + productionPerSecond(cabinet, CABINETS[index]) / 10); });
      if (Date.now() - lastPersist > 2000) { lastPersist = Date.now(); persist(); }
    },
    render() {
      clearCanvas(ctx, "#111827");
      ctx.fillStyle = "#182235"; ctx.fillRect(0, 0, CANVAS_SIZE, 78);
      ctx.fillStyle = "#2e3b50"; ctx.fillRect(0, 78, CANVAS_SIZE, 280);
      ctx.fillStyle = "#182235"; ctx.fillRect(0, 358, CANVAS_SIZE, 122);
      for (let x = 0; x < CANVAS_SIZE; x += 32) { ctx.fillStyle = x % 64 ? "#223148" : "#263750"; ctx.fillRect(x, 358, 30, 122); }
      ctx.fillStyle = "#20c7e5"; ctx.font = "bold 20px monospace"; ctx.fillText("AFTER HOURS ARCADE", 116, 35);
      ctx.fillStyle = "#ffd34f"; ctx.font = "bold 13px monospace"; ctx.fillText(`${Math.floor(state.tickets)} tickets`, 18, 65);
      ctx.fillStyle = "#7bd66f"; ctx.fillText(`+${totalRate().toFixed(1)}/sec`, 196, 65);
      ctx.fillStyle = "#f8fbfd"; ctx.fillText(`${state.parts} parts`, 363, 65);
      ctx.fillStyle = "#4c5f78"; ctx.fillRect(22, 108, 436, 178);
      ctx.fillStyle = "#6c4f3c"; ctx.fillRect(22, 274, 436, 12);
      drawCabinet(45, 138, 0); drawCabinet(188, 138, 1); drawCabinet(331, 138, 2);
      const selected = state.cabinets[state.selected]; const definition = CABINETS[state.selected];
      ctx.fillStyle = "#283043"; ctx.fillRect(24, 390, 432, 68);
      ctx.fillStyle = definition.color; ctx.font = "bold 14px monospace"; ctx.fillText(definition.name.toUpperCase(), 38, 415);
      ctx.fillStyle = "#f8fbfd"; ctx.font = "11px monospace"; ctx.fillText(`quality ${selected.quality} · level ${selected.level} · ${selected.automated ? "automated" : "manual"}`, 38, 438);
      ctx.fillStyle = "#ffd34f"; ctx.fillText("← → select   Select collect   ↑ restore   A automate   U upgrade", 38, 474);
    },
    onKeyDown(key) { const k = String(key).toLowerCase(); if (k === "arrowleft" || k === "a") { state.selected = (state.selected + CABINETS.length - 1) % CABINETS.length; return true; } if (k === "arrowright" || k === "d") { state.selected = (state.selected + 1) % CABINETS.length; return true; } if (k === "arrowup" || k === "w") return restoreSelected(); if (k === "enter" || k === " ") return collect(); if (k === "q") return automateSelected(); if (k === "u") return upgradeSelected(); return false; },
    onKeyUp() { return false; },
    onControl(action) { if (action === "LEFT") { state.selected = (state.selected + CABINETS.length - 1) % CABINETS.length; return true; } if (action === "RIGHT") { state.selected = (state.selected + 1) % CABINETS.length; return true; } if (action === "UP") return restoreSelected(); return action === "SELECT" ? collect() : false; },
    togglePause() {}, restart() { state = defaultSave(); message = "Fresh workshop opened."; persist(); }, getTickMs() { return 100; },
    getControlHint() { return "Left/Right: select cabinet · Up: restore · Select: collect · Q: automate · U: upgrade."; },
    getHud() { return { score: `Tickets: ${Math.floor(state?.tickets || 0)} | Rate: ${totalRate().toFixed(1)}/sec | Parts: ${state?.parts || 0}`, status: message, pauseLabel: "Idle runs", pauseDisabled: true }; },
  };
}
