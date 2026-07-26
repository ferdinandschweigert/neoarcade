import {
  TABLETOP_GAMES,
  getTabletopGame,
  wizardRoundScore,
  wizardMaxRounds,
  defaultPlayerNames,
} from "./games.mjs";
import {
  safeStorageGetJson,
  safeStorageSetJson,
  STORAGE_KEYS,
} from "../storage.mjs";

const MAX_HISTORY = 10;

export function createTabletopManager(config = {}) {
  const rootEl = config.rootEl;
  const openButtonEl = config.openButtonEl;
  const closeButtonEl = config.closeButtonEl;

  /** @type {"picker" | "rules" | "setup" | "session" | "history" | "history-detail"} */
  let view = "picker";
  /** @type {string | null} */
  let rulesGameId = null;
  /** @type {"picker" | "setup" | "session" | "history" | "history-detail"} */
  let rulesReturnView = "picker";
  /** @type {object | null} */
  let activeSession = null;
  /** @type {object | null} */
  let viewedSession = null;
  /** @type {number | null} */
  let viewedHistoryIndex = null;
  let setupGameId = null;
  let setupNames = [];
  let message = "";

  function init() {
    if (!rootEl || !openButtonEl) {
      return;
    }

    openButtonEl.addEventListener("click", () => {
      open();
    });

    if (closeButtonEl) {
      closeButtonEl.addEventListener("click", () => {
        close();
      });
    }

    rootEl.addEventListener("click", (event) => {
      if (event.target === rootEl) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && rootEl && !rootEl.classList.contains("hidden")) {
        close();
      }
    });

    rootEl.addEventListener("click", onRootClick);
    rootEl.addEventListener("submit", onRootSubmit);
    rootEl.addEventListener("change", onRootChange);
  }

  function open() {
    const stored = loadStore();
    if (stored.active) {
      activeSession = stored.active;
      view = "session";
    } else {
      view = "picker";
      activeSession = null;
    }
    viewedSession = null;
    viewedHistoryIndex = null;
    message = "";
    rootEl.classList.remove("hidden");
    document.body.classList.add("tabletop-open");
    render();
  }

  function close() {
    if (activeSession && activeSession.status === "active") {
      persistActive(activeSession);
    }
    rootEl.classList.add("hidden");
    document.body.classList.remove("tabletop-open");
  }

  function loadStore() {
    return safeStorageGetJson(STORAGE_KEYS.TABLETOP_SESSIONS, {
      active: null,
      history: [],
    });
  }

  function saveStore(store) {
    safeStorageSetJson(STORAGE_KEYS.TABLETOP_SESSIONS, store);
  }

  function persistActive(session) {
    const store = loadStore();
    store.active = session;
    saveStore(store);
  }

  function clearActive() {
    const store = loadStore();
    store.active = null;
    saveStore(store);
    activeSession = null;
  }

  function pushHistory(session) {
    const store = loadStore();
    const finished = {
      ...session,
      status: "finished",
      finishedAt: new Date().toISOString(),
    };
    store.history = [finished, ...(store.history || [])].slice(0, MAX_HISTORY);
    store.active = null;
    saveStore(store);
    activeSession = null;
    return finished;
  }

  function onRootClick(event) {
    const button = event.target.closest("[data-tt-action]");
    if (!button || !rootEl.contains(button)) {
      return;
    }

    const action = button.dataset.ttAction;
    const gameId = button.dataset.ttGame || null;

    if (action === "close") {
      close();
      return;
    }
    if (action === "picker") {
      view = "picker";
      message = "";
      render();
      return;
    }
    if (action === "history") {
      viewedSession = null;
      viewedHistoryIndex = null;
      view = "history";
      message = "";
      render();
      return;
    }
    if (action === "view-history") {
      const index = Number(button.dataset.ttIndex);
      const store = loadStore();
      const item = store.history?.[index];
      if (item) {
        viewedSession = structuredClone(item);
        viewedHistoryIndex = index;
        view = "history-detail";
        message = "";
        render();
      }
      return;
    }
    if (action === "view-active") {
      const store = loadStore();
      if (store.active) {
        viewedSession = structuredClone(store.active);
        viewedHistoryIndex = null;
        view = "history-detail";
        message = "";
        render();
      }
      return;
    }
    if (action === "delete-history") {
      const index = Number(button.dataset.ttIndex);
      const store = loadStore();
      if (store.history?.[index]) {
        store.history.splice(index, 1);
        saveStore(store);
        viewedSession = null;
        viewedHistoryIndex = null;
        view = "history";
        message = "Partie gelöscht.";
        render();
      }
      return;
    }
    if (action === "rules" && gameId) {
      rulesGameId = gameId;
      rulesReturnView =
        view === "session"
          ? "session"
          : view === "setup"
            ? "setup"
            : view === "history-detail"
              ? "history-detail"
              : view === "history"
                ? "history"
                : "picker";
      view = "rules";
      render();
      return;
    }
    if (action === "rules-back") {
      view = rulesReturnView;
      render();
      return;
    }
    if (action === "play" && gameId) {
      startSetup(gameId);
      return;
    }
    if (action === "undo-round" && activeSession) {
      if (activeSession.rounds.length > 0) {
        activeSession.rounds.pop();
        recomputeSession(activeSession);
        persistActive(activeSession);
        message = "Letzte Runde entfernt.";
        render();
      }
      return;
    }
    if (action === "finish" && activeSession) {
      const finished = pushHistory(activeSession);
      viewedSession = structuredClone(finished);
      viewedHistoryIndex = 0;
      message = "Partie gespeichert.";
      view = "history-detail";
      render();
      return;
    }
    if (action === "discard" && activeSession) {
      clearActive();
      message = "Partie verworfen.";
      view = "picker";
      render();
      return;
    }
    if (action === "resume-history") {
      const index =
        button.dataset.ttIndex != null
          ? Number(button.dataset.ttIndex)
          : viewedHistoryIndex;
      const store = loadStore();
      const item =
        index == null || Number.isNaN(index) ? null : store.history?.[index];
      if (item) {
        activeSession = {
          ...structuredClone(item),
          status: "active",
        };
        delete activeSession.finishedAt;
        persistActive(activeSession);
        viewedSession = null;
        viewedHistoryIndex = null;
        view = "session";
        message = "Partie geladen.";
        render();
      }
      return;
    }
    if (action === "resume-active") {
      const store = loadStore();
      if (store.active) {
        activeSession = store.active;
        viewedSession = null;
        viewedHistoryIndex = null;
        view = "session";
        message = "Aktive Partie fortgesetzt.";
        render();
      }
    }
  }

  function onRootChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset.ttSetupName != null) {
      const index = Number(target.dataset.ttSetupName);
      setupNames[index] = target.value;
    }
  }

  function onRootSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !rootEl.contains(form)) {
      return;
    }
    event.preventDefault();
    const formAction = form.dataset.ttForm;

    if (formAction === "setup") {
      const game = getTabletopGame(setupGameId);
      if (!game) {
        return;
      }
      const countInput = form.querySelector("[name=player-count]");
      let count = game.players.fixed || Number(countInput?.value || setupNames.length);
      count = clamp(count, game.players.min, game.players.max);
      const names = [];
      for (let i = 0; i < count; i += 1) {
        const input = form.querySelector(`[name="player-${i}"]`);
        const value = (input?.value || setupNames[i] || `Spieler ${i + 1}`).trim();
        names.push(value || `Spieler ${i + 1}`);
      }
      activeSession = createSession(game, names);
      persistActive(activeSession);
      view = "session";
      message = "Partie gestartet.";
      render();
      return;
    }

    if (formAction === "round" && activeSession) {
      const game = getTabletopGame(activeSession.gameId);
      if (!game) {
        return;
      }
      try {
        const round = readRoundFromForm(form, game, activeSession);
        activeSession.rounds.push(round);
        recomputeSession(activeSession);
        persistActive(activeSession);
        message = `Runde ${activeSession.rounds.length} gespeichert.`;
        render();
      } catch (error) {
        message = error.message || "Runde ungültig.";
        render();
      }
    }
  }

  function startSetup(gameId) {
    const game = getTabletopGame(gameId);
    if (!game) {
      return;
    }
    setupGameId = gameId;
    const count = game.players.fixed || game.players.min;
    setupNames = defaultPlayerNames(count);
    view = "setup";
    message = "";
    render();
  }

  function createSession(game, names) {
    const players = names.map((name, index) => ({
      id: `p${index}`,
      name,
      total: 0,
      phase: game.scoreMode === "phase10" ? 1 : null,
    }));
    return {
      id: `tt-${Date.now()}`,
      gameId: game.id,
      status: "active",
      startedAt: new Date().toISOString(),
      players,
      rounds: [],
    };
  }

  function recomputeSession(session) {
    const game = getTabletopGame(session.gameId);
    for (const player of session.players) {
      player.total = 0;
      if (game?.scoreMode === "phase10") {
        player.phase = 1;
      }
    }
    for (const round of session.rounds) {
      for (let i = 0; i < session.players.length; i += 1) {
        session.players[i].total += Number(round.scores[i]) || 0;
        if (game?.scoreMode === "phase10" && round.phaseDone?.[i]) {
          session.players[i].phase = Math.min(11, (session.players[i].phase || 1) + 1);
        }
      }
    }
  }

  function readRoundFromForm(form, game, session) {
    const playerCount = session.players.length;
    if (game.scoreMode === "wizard") {
      const bids = [];
      const tricks = [];
      const scores = [];
      let trickSum = 0;
      const maxTricks = session.rounds.length + 1;
      for (let i = 0; i < playerCount; i += 1) {
        const bid = Number(form.querySelector(`[name="bid-${i}"]`)?.value);
        const trick = Number(form.querySelector(`[name="tricks-${i}"]`)?.value);
        if (!Number.isFinite(bid) || !Number.isFinite(trick) || bid < 0 || trick < 0) {
          throw new Error("Bitte Ansagen und Stiche für alle Spieler eingeben.");
        }
        if (trick > maxTricks) {
          throw new Error(`Maximal ${maxTricks} Stiche in dieser Runde.`);
        }
        bids.push(bid);
        tricks.push(trick);
        trickSum += trick;
        scores.push(wizardRoundScore(bid, trick));
      }
      if (trickSum !== maxTricks) {
        throw new Error(`Stiche müssen zusammen ${maxTricks} ergeben (aktuell ${trickSum}).`);
      }
      return { bids, tricks, scores };
    }

    if (game.scoreMode === "phase10") {
      const scores = [];
      const phaseDone = [];
      for (let i = 0; i < playerCount; i += 1) {
        const score = Number(form.querySelector(`[name="score-${i}"]`)?.value);
        if (!Number.isFinite(score)) {
          throw new Error("Bitte Strafpunkte für alle Spieler eingeben.");
        }
        scores.push(score);
        phaseDone.push(Boolean(form.querySelector(`[name="phase-${i}"]`)?.checked));
      }
      return { scores, phaseDone };
    }

    const scores = [];
    for (let i = 0; i < playerCount; i += 1) {
      const score = Number(form.querySelector(`[name="score-${i}"]`)?.value);
      if (!Number.isFinite(score)) {
        throw new Error("Bitte Punkte für alle Spieler eingeben.");
      }
      scores.push(score);
    }
    return { scores };
  }

  function render() {
    if (!rootEl) {
      return;
    }
    const body = rootEl.querySelector("[data-tt-body]");
    if (!body) {
      return;
    }

    if (view === "picker") {
      body.innerHTML = renderPicker();
    } else if (view === "rules") {
      body.innerHTML = renderRules();
    } else if (view === "setup") {
      body.innerHTML = renderSetup();
    } else if (view === "session") {
      body.innerHTML = renderSession();
    } else if (view === "history") {
      body.innerHTML = renderHistory();
    } else if (view === "history-detail") {
      body.innerHTML = renderHistoryDetail();
    }

    body.scrollTop = 0;

    const messageEl = rootEl.querySelector("[data-tt-message]");
    if (messageEl) {
      messageEl.textContent = message || "";
    }
  }

  function renderPicker() {
    const cards = TABLETOP_GAMES.map(
      (game) => `
      <article class="tt-game-card">
        <h3>${escapeHtml(game.name)}</h3>
        <p class="tt-blurb">${escapeHtml(game.blurb)}</p>
        <p class="tt-meta">${game.players.min === game.players.max ? `${game.players.min} Spieler` : `${game.players.min}–${game.players.max} Spieler`}${game.lowerIsBetter ? " · wenig Punkte gewinnt" : " · viele Punkte gewinnt"}</p>
        <div class="tt-card-actions">
          <button type="button" class="tt-secondary" data-tt-action="rules" data-tt-game="${game.id}">Regeln</button>
          <button type="button" data-tt-action="play" data-tt-game="${game.id}">Spielen</button>
        </div>
      </article>`,
    ).join("");

    return `
      <div class="tt-toolbar">
        <h2>Tischspiele</h2>
        <button type="button" class="tt-secondary" data-tt-action="history">Vergangene</button>
      </div>
      <p class="tt-lead">Wähle ein Spiel, lies die Regeln oder starte eine Partie zum Mitzählen.</p>
      <div class="tt-game-grid">${cards}</div>`;
  }

  function renderRules() {
    const game = getTabletopGame(rulesGameId);
    if (!game) {
      return `<p>Spiel nicht gefunden.</p><button type="button" data-tt-action="picker">Zurück</button>`;
    }
    const sections = game.rules
      .map(
        (section) => `
        <section class="tt-rule-section">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.body)}</p>
        </section>`,
      )
      .join("");
    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="rules-back">Zurück</button>
        <h2>${escapeHtml(game.name)} — Regeln</h2>
      </div>
      <p class="tt-blurb">${escapeHtml(game.blurb)}</p>
      <div class="tt-rules">${sections}</div>
      <div class="tt-card-actions">
        <button type="button" data-tt-action="play" data-tt-game="${game.id}">Partie starten</button>
      </div>`;
  }

  function renderSetup() {
    const game = getTabletopGame(setupGameId);
    if (!game) {
      return `<p>Spiel nicht gefunden.</p>`;
    }
    const fixed = Boolean(game.players.fixed);
    const count = fixed ? game.players.fixed : setupNames.length || game.players.min;
    if (setupNames.length !== count) {
      setupNames = defaultPlayerNames(count);
    }
    const nameFields = setupNames
      .map(
        (name, index) => `
        <label class="tt-field">
          <span>Spieler ${index + 1}</span>
          <input name="player-${index}" data-tt-setup-name="${index}" type="text" maxlength="24" value="${escapeAttr(name)}" required />
        </label>`,
      )
      .join("");

    const countField = fixed
      ? `<input type="hidden" name="player-count" value="${count}" />`
      : `<label class="tt-field">
          <span>Anzahl Spieler (${game.players.min}–${game.players.max})</span>
          <input name="player-count" type="number" min="${game.players.min}" max="${game.players.max}" value="${count}" />
        </label>`;

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>${escapeHtml(game.name)} — Setup</h2>
        <button type="button" class="tt-secondary" data-tt-action="rules" data-tt-game="${game.id}">Regeln</button>
      </div>
      <form class="tt-form" data-tt-form="setup">
        ${countField}
        <div class="tt-name-grid" data-tt-names>${nameFields}</div>
        <button type="submit">Partie starten</button>
      </form>`;
  }

  function renderSession() {
    if (!activeSession) {
      return `<p>Keine aktive Partie.</p><button type="button" data-tt-action="picker">Zur Auswahl</button>`;
    }
    const game = getTabletopGame(activeSession.gameId);
    if (!game) {
      return `<p>Spiel fehlt.</p>`;
    }

    const { leader, totalsHtml, tableHtml } = renderScoreboard(activeSession, game);

    let endHint = "";
    if (game.id === "skyjo" && activeSession.players.some((p) => p.total >= 100)) {
      endHint = `<p class="tt-hint">Mindestens ein Spieler hat ≥100 Punkte — Partie kann beendet werden.</p>`;
    }
    if (game.scoreMode === "wizard") {
      const maxR = wizardMaxRounds(activeSession.players.length);
      const next = activeSession.rounds.length + 1;
      endHint = `<p class="tt-hint">Runde ${Math.min(next, maxR)} von ${maxR} (je ${Math.min(next, maxR)} Karten).</p>`;
      if (activeSession.rounds.length >= maxR) {
        endHint = `<p class="tt-hint">Alle Wizard-Runden sind gespielt. ${escapeHtml(leader.name)} führt mit ${leader.total}.</p>`;
      }
    }
    if (game.scoreMode === "phase10" && activeSession.players.some((p) => (p.phase || 1) > 10)) {
      endHint = `<p class="tt-hint">Jemand hat Phase 10 geschafft — Partie kann beendet werden.</p>`;
    }

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Spiele</button>
        <h2>${escapeHtml(game.name)}</h2>
        <button type="button" class="tt-secondary" data-tt-action="rules" data-tt-game="${game.id}">Regeln</button>
      </div>
      <p class="tt-lead">Führung: <strong>${escapeHtml(leader.name)}</strong> (${leader.total})</p>
      ${endHint}
      ${totalsHtml}
      ${tableHtml}
      ${renderRoundForm(game, activeSession)}
      <div class="tt-session-actions">
        <button type="button" class="tt-secondary" data-tt-action="undo-round">Undo Runde</button>
        <button type="button" data-tt-action="finish">Partie beenden</button>
        <button type="button" class="tt-danger" data-tt-action="discard">Verwerfen</button>
      </div>`;
  }

  function renderRoundForm(game, session) {
    if (game.scoreMode === "wizard") {
      const maxR = wizardMaxRounds(session.players.length);
      if (session.rounds.length >= maxR) {
        return `<p class="tt-hint">Keine weiteren Wizard-Runden.</p>`;
      }
      const fields = session.players
        .map(
          (player, index) => `
          <fieldset class="tt-player-round">
            <legend>${escapeHtml(player.name)}</legend>
            <label>Ansage <input name="bid-${index}" type="number" min="0" max="${session.rounds.length + 1}" value="0" required /></label>
            <label>Stiche <input name="tricks-${index}" type="number" min="0" max="${session.rounds.length + 1}" value="0" required /></label>
          </fieldset>`,
        )
        .join("");
      return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1}</h3><div class="tt-round-grid">${fields}</div><button type="submit">Runde speichern</button></form>`;
    }

    if (game.scoreMode === "phase10") {
      const fields = session.players
        .map(
          (player, index) => `
          <fieldset class="tt-player-round">
            <legend>${escapeHtml(player.name)} (Phase ${(player.phase || 1) > 10 ? "fertig" : String(player.phase || 1)})</legend>
            <label>Strafpunkte <input name="score-${index}" type="number" value="0" required /></label>
            <label class="tt-check"><input name="phase-${index}" type="checkbox" /> Phase geschafft</label>
          </fieldset>`,
        )
        .join("");
      return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1}</h3><div class="tt-round-grid">${fields}</div><button type="submit">Runde speichern</button></form>`;
    }

    const fields = session.players
      .map(
        (player, index) => `
        <label class="tt-field">
          <span>${escapeHtml(player.name)}</span>
          <input name="score-${index}" type="number" value="0" required />
        </label>`,
      )
      .join("");
    return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1} — Punkte</h3><div class="tt-round-grid">${fields}</div><button type="submit">Runde speichern</button></form>`;
  }

  function renderScoreboard(session, game) {
    const totals = session.players
      .map((player) => {
        const phase =
          game.scoreMode === "phase10"
            ? (player.phase || 1) > 10
              ? " · fertig"
              : ` · Phase ${player.phase || 1}`
            : "";
        return `<li><strong>${escapeHtml(player.name)}</strong><span>${player.total}${phase}</span></li>`;
      })
      .join("");

    const sorted = [...session.players].sort((a, b) =>
      game.lowerIsBetter ? a.total - b.total : b.total - a.total,
    );
    const leader = sorted[0];

    const roundRows = (session.rounds || [])
      .map((round, roundIndex) => {
        const cells = round.scores
          .map((score, i) => {
            let extra = "";
            if (round.bids) {
              extra = ` <small>(${round.bids[i]}/${round.tricks[i]})</small>`;
            }
            return `<td>${score}${extra}</td>`;
          })
          .join("");
        return `<tr><th>R${roundIndex + 1}</th>${cells}</tr>`;
      })
      .join("");

    const headerCells = session.players
      .map((player) => `<th>${escapeHtml(player.name)}</th>`)
      .join("");

    return {
      leader,
      totalsHtml: `<ul class="tt-totals">${totals}</ul>`,
      tableHtml: `
        <div class="tt-table-wrap">
          <table class="tt-score-table">
            <thead><tr><th>Rd</th>${headerCells}</tr></thead>
            <tbody>${
              roundRows ||
              `<tr><td colspan="${session.players.length + 1}">Noch keine Runden</td></tr>`
            }</tbody>
          </table>
        </div>`,
    };
  }

  function renderHistory() {
    const store = loadStore();
    const items = store.history || [];
    const active = store.active;

    let activeCard = "";
    if (active) {
      const game = getTabletopGame(active.gameId);
      const scoreLine = (active.players || [])
        .map((p) => `${escapeHtml(p.name)} ${p.total}`)
        .join(" · ");
      activeCard = `
        <article class="tt-history-card tt-history-active">
          <p class="tt-badge">Laufend</p>
          <h3>${escapeHtml(game?.name || active.gameId)}</h3>
          <p class="tt-meta">${escapeHtml(formatDate(active.startedAt))} · ${active.rounds?.length || 0} Runden</p>
          <p class="tt-blurb">${scoreLine}</p>
          <div class="tt-card-actions">
            <button type="button" class="tt-secondary" data-tt-action="view-active">Anschauen</button>
            <button type="button" data-tt-action="resume-active">Weiterzählen</button>
          </div>
        </article>`;
    }

    if (!active && items.length === 0) {
      return `
        <div class="tt-toolbar">
          <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
          <h2>Vergangene Partien</h2>
        </div>
        <p class="tt-lead">Noch keine Partien gespeichert. Beende eine Partie mit „Partie beenden“, dann erscheint sie hier.</p>`;
    }

    const list = items
      .map((item, index) => {
        const game = getTabletopGame(item.gameId);
        const when = item.finishedAt || item.startedAt || "";
        const scoreLine = (item.players || [])
          .map((p) => `${escapeHtml(p.name)} ${p.total}`)
          .join(" · ");
        const winner = getLeader(item, game);
        return `
          <article class="tt-history-card">
            <h3>${escapeHtml(game?.name || item.gameId)}</h3>
            <p class="tt-meta">${escapeHtml(formatDate(when))} · ${item.rounds?.length || 0} Runden${
              winner ? ` · Sieger: ${escapeHtml(winner.name)}` : ""
            }</p>
            <p class="tt-blurb">${scoreLine}</p>
            <div class="tt-card-actions">
              <button type="button" class="tt-secondary" data-tt-action="view-history" data-tt-index="${index}">Anschauen</button>
              <button type="button" data-tt-action="resume-history" data-tt-index="${index}">Weiterzählen</button>
            </div>
          </article>`;
      })
      .join("");

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>Vergangene Partien</h2>
      </div>
      <p class="tt-lead">Tippe auf Anschauen, um Ergebnis und alle Runden zu sehen.</p>
      <div class="tt-history-list">${activeCard}${list}</div>`;
  }

  function renderHistoryDetail() {
    if (!viewedSession) {
      return `
        <div class="tt-toolbar">
          <button type="button" class="tt-secondary" data-tt-action="history">Zurück</button>
          <h2>Partie</h2>
        </div>
        <p class="tt-lead">Partie nicht gefunden.</p>`;
    }

    const game = getTabletopGame(viewedSession.gameId);
    if (!game) {
      return `<p>Spiel fehlt.</p><button type="button" data-tt-action="history">Zurück</button>`;
    }

    const { leader, totalsHtml, tableHtml } = renderScoreboard(viewedSession, game);
    const when = viewedSession.finishedAt || viewedSession.startedAt || "";
    const isFinished = viewedSession.status === "finished" || Boolean(viewedSession.finishedAt);
    const isActiveView = !isFinished && viewedHistoryIndex == null;

    let actions = `
      <div class="tt-session-actions">
        <button type="button" class="tt-secondary" data-tt-action="history">Zur Liste</button>`;
    if (isActiveView) {
      actions += `<button type="button" data-tt-action="resume-active">Weiterzählen</button>`;
    } else if (viewedHistoryIndex != null) {
      actions += `
        <button type="button" data-tt-action="resume-history" data-tt-index="${viewedHistoryIndex}">Weiterzählen</button>
        <button type="button" class="tt-danger" data-tt-action="delete-history" data-tt-index="${viewedHistoryIndex}">Löschen</button>`;
    }
    actions += `</div>`;

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="history">Zurück</button>
        <h2>${escapeHtml(game.name)}</h2>
        <button type="button" class="tt-secondary" data-tt-action="rules" data-tt-game="${game.id}">Regeln</button>
      </div>
      <p class="tt-meta">${isFinished ? "Beendet" : "Laufend"} · ${escapeHtml(formatDate(when))} · ${viewedSession.rounds?.length || 0} Runden</p>
      <p class="tt-lead">${
        leader
          ? `${isFinished ? "Sieger" : "Führung"}: <strong>${escapeHtml(leader.name)}</strong> (${leader.total})`
          : ""
      }</p>
      ${totalsHtml}
      ${tableHtml}
      ${actions}`;
  }

  function getLeader(session, game) {
    if (!session?.players?.length || !game) {
      return null;
    }
    const sorted = [...session.players].sort((a, b) =>
      game.lowerIsBetter ? a.total - b.total : b.total - a.total,
    );
    return sorted[0] || null;
  }

  // Keep player name fields in sync when count changes on setup form
  rootEl?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== "player-count") {
      return;
    }
    const game = getTabletopGame(setupGameId);
    if (!game || view !== "setup") {
      return;
    }
    let count = Number(target.value);
    count = clamp(count, game.players.min, game.players.max);
    const previous = [...setupNames];
    setupNames = defaultPlayerNames(count).map((fallback, i) => previous[i] || fallback);
    const namesHost = rootEl.querySelector("[data-tt-names]");
    if (namesHost) {
      namesHost.innerHTML = setupNames
        .map(
          (name, index) => `
          <label class="tt-field">
            <span>Spieler ${index + 1}</span>
            <input name="player-${index}" data-tt-setup-name="${index}" type="text" maxlength="24" value="${escapeAttr(name)}" required />
          </label>`,
        )
        .join("");
    }
  });

  return { init, open, close };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function formatDate(iso) {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
