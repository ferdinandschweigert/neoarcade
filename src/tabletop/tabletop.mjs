import {
  TABLETOP_GAMES,
  getTabletopGame,
  wizardRoundScore,
  wizardMaxRounds,
  defaultPlayerNames,
} from "./games.mjs";
import {
  captureRoundDraftFromForm,
  draftFieldValue,
  draftCheckValue,
} from "./draft.mjs";
import {
  loadFriendsStore,
  saveFriendsStore,
  promotePlayers,
  normalizePlayerName,
  applySessionToStats,
  buildRankings,
  fetchCircle,
  mergeRemoteCircle,
  apiPromotePlayers,
  apiJoinByCode,
  apiRemovePlayer,
  apiSubmitSession,
  apiGetRankings,
  nameKey,
} from "./friends.mjs";
import {
  safeStorageGetJson,
  safeStorageSetJson,
  STORAGE_KEYS,
} from "../storage.mjs";

const MAX_HISTORY = 10;
/** Chips stay readable up to this many options (e.g. 0..6). Larger ranges use steppers. */
const CHIP_OPTION_LIMIT = 7;

export function createTabletopManager(config = {}) {
  const rootEl = config.rootEl;
  const openButtonEl = config.openButtonEl;
  const closeButtonEl = config.closeButtonEl;
  const isAuthenticated = config.isAuthenticated || (() => false);

  /** @type {"picker" | "rules" | "setup" | "session" | "history" | "history-detail" | "players" | "rankings" | "promote" | "join"} */
  let view = "picker";
  /** @type {string | null} */
  let rulesGameId = null;
  /** @type {string} */
  let rulesReturnView = "picker";
  /** @type {object | null} */
  let activeSession = null;
  /** @type {object | null} */
  let viewedSession = null;
  /** @type {number | null} */
  let viewedHistoryIndex = null;
  let setupGameId = null;
  let setupNames = [];
  /** @type {(string|null)[]} */
  let setupProfileIds = [];
  let message = "";
  /** @type {object | null} */
  let friendsStore = null;
  let rankingsGameFilter = "";
  /** @type {object | null} */
  let pendingPromoteSession = null;

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
    rootEl.addEventListener("input", onRootInput);
  }

  async function open() {
    friendsStore = loadFriendsStore();
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
    pendingPromoteSession = null;
    message = "";
    rootEl.classList.remove("hidden");
    document.body.classList.add("tabletop-open");
    render();
    if (isAuthenticated()) {
      void syncFriendsFromCloud();
    }
  }

  function close() {
    snapshotDraftFromDom();
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
    delete finished.draftRound;
    store.history = [finished, ...(store.history || [])].slice(0, MAX_HISTORY);
    store.active = null;
    saveStore(store);
    activeSession = null;
    return finished;
  }

  function getFriends() {
    if (!friendsStore) {
      friendsStore = loadFriendsStore();
    }
    return friendsStore;
  }

  function persistFriends() {
    if (friendsStore) {
      saveFriendsStore(friendsStore);
    }
  }

  async function syncFriendsFromCloud() {
    try {
      const remote = await fetchCircle();
      if (!remote) {
        return;
      }
      friendsStore = mergeRemoteCircle(getFriends(), remote);
      persistFriends();
      if (view === "players" || view === "rankings" || view === "setup") {
        render();
      }
    } catch {
      // offline / API unavailable — keep local roster
    }
  }

  async function refreshRankingsFromCloud() {
    if (!isAuthenticated()) {
      return;
    }
    try {
      const payload = await apiGetRankings({
        gameId: rankingsGameFilter || null,
      });
      if (!payload || view !== "rankings") {
        return;
      }
      const friends = getFriends();
      if (payload.stats) {
        friends.localStats = payload.stats;
      }
      if (payload.players) {
        friends.players = payload.players;
      }
      persistFriends();
      render();
    } catch {
      // keep local rankings
    }
  }

  function snapshotDraftFromDom() {
    if (!activeSession || view !== "session" || !rootEl) {
      return;
    }
    const form = rootEl.querySelector('form[data-tt-form="round"]');
    const game = getTabletopGame(activeSession.gameId);
    if (!form || !game) {
      return;
    }
    const draft = captureRoundDraftFromForm(
      form,
      game.scoreMode,
      activeSession.players.length,
    );
    if (draft) {
      activeSession.draftRound = draft;
      persistActive(activeSession);
    }
  }

  function clearDraft() {
    if (activeSession) {
      delete activeSession.draftRound;
    }
  }

  function onRootClick(event) {
    const button = event.target.closest("[data-tt-action]");
    if (!button || !rootEl.contains(button)) {
      return;
    }

    const action = button.dataset.ttAction;
    const gameId = button.dataset.ttGame || null;

    if (action === "step") {
      event.preventDefault();
      const targetName = button.dataset.ttStepTarget;
      const delta = Number(button.dataset.ttStepDelta || "1");
      if (!targetName || !Number.isFinite(delta)) {
        return;
      }
      const input = rootEl.querySelector(`input[name="${CSS.escape(targetName)}"]`);
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      const current = Number(input.value);
      const base = Number.isFinite(current) ? current : 0;
      let next = base + delta;
      const min = input.min !== "" ? Number(input.min) : null;
      const max = input.max !== "" ? Number(input.max) : null;
      if (min != null && Number.isFinite(min)) {
        next = Math.max(min, next);
      }
      if (max != null && Number.isFinite(max)) {
        next = Math.min(max, next);
      }
      setNumericFieldValue(input, next);
      snapshotDraftFromDom();
      return;
    }
    if (action === "set-value") {
      event.preventDefault();
      const targetName = button.dataset.ttTarget;
      const value = Number(button.dataset.ttValue);
      if (!targetName || !Number.isFinite(value)) {
        return;
      }
      const input = rootEl.querySelector(`input[name="${CSS.escape(targetName)}"]`);
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      setNumericFieldValue(input, value);
      snapshotDraftFromDom();
      return;
    }
    if (action === "close") {
      close();
      return;
    }
    if (action === "picker") {
      snapshotDraftFromDom();
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
    if (action === "players") {
      view = "players";
      message = "";
      render();
      void syncFriendsFromCloud();
      return;
    }
    if (action === "rankings") {
      view = "rankings";
      message = "";
      render();
      void refreshRankingsFromCloud();
      return;
    }
    if (action === "join") {
      view = "join";
      message = "";
      render();
      return;
    }
    if (action === "copy-code") {
      const code = getFriends().joinCode;
      if (code && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(formatJoinCode(code)).then(() => {
          message = "Code kopiert.";
          render();
        });
      }
      return;
    }
    if (action === "use-player") {
      const profileId = button.dataset.ttPlayer;
      const friends = getFriends();
      const player = friends.players.find((p) => p.id === profileId);
      if (!player || view !== "setup") {
        return;
      }
      const emptyIndex = setupNames.findIndex(
        (name, i) =>
          !normalizePlayerName(name) ||
          /^Spieler\s+\d+$/i.test(normalizePlayerName(name)) ||
          !setupProfileIds[i],
      );
      const index =
        emptyIndex >= 0
          ? emptyIndex
          : Math.min(setupNames.length - 1, setupNames.length);
      if (index < 0) {
        return;
      }
      if (setupProfileIds.includes(profileId)) {
        message = `${player.name} ist schon ausgewählt.`;
        render();
        return;
      }
      setupNames[index] = player.name;
      setupProfileIds[index] = player.id;
      message = "";
      render();
      return;
    }
    if (action === "remember-setup") {
      rememberSetupNames();
      return;
    }
    if (action === "remove-player") {
      const profileId = button.dataset.ttPlayer;
      void removePermanentPlayer(profileId);
      return;
    }
    if (action === "set-rank-filter") {
      rankingsGameFilter = button.dataset.ttGame || "";
      render();
      void refreshRankingsFromCloud();
      return;
    }
    if (action === "skip-promote") {
      void finalizePromote(false);
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
      snapshotDraftFromDom();
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
                : view === "players"
                  ? "players"
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
        clearDraft();
        persistActive(activeSession);
        message = "Letzte Runde entfernt.";
        render();
      }
      return;
    }
    if (action === "finish" && activeSession) {
      snapshotDraftFromDom();
      clearDraft();
      linkSessionToProfiles(activeSession);
      const finished = pushHistory(activeSession);
      pendingPromoteSession = finished;
      viewedSession = structuredClone(finished);
      viewedHistoryIndex = 0;
      const friends = getFriends();
      const newNames = finished.players.filter(
        (p) => !friends.players.some((fp) => nameKey(fp.name) === nameKey(p.name)),
      );
      if (newNames.length > 0) {
        view = "promote";
        message = "Partie gespeichert — Spieler für später merken?";
      } else {
        void finalizePromote(true);
        return;
      }
      render();
      return;
    }
    if (action === "discard" && activeSession) {
      clearDraft();
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
      setupProfileIds[index] = null;
    }
    if (target.closest('form[data-tt-form="round"]')) {
      snapshotDraftFromDom();
    }
  }

  function onRootInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.name === "player-count") {
      handlePlayerCountInput(target);
      return;
    }
    if (target.closest('form[data-tt-form="round"]')) {
      snapshotDraftFromDom();
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
      const profileIds = [];
      for (let i = 0; i < count; i += 1) {
        const input = form.querySelector(`[name="player-${i}"]`);
        const value = (input?.value || setupNames[i] || `Spieler ${i + 1}`).trim();
        names.push(value || `Spieler ${i + 1}`);
        profileIds.push(setupProfileIds[i] || null);
      }
      activeSession = createSession(game, names, profileIds);
      linkSessionToProfiles(activeSession);
      const friends = getFriends();
      friends.lastGroupIds = activeSession.players
        .map((p) => p.profileId)
        .filter(Boolean);
      persistFriends();
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
        clearDraft();
        persistActive(activeSession);
        message = `Runde ${activeSession.rounds.length} gespeichert.`;
        render();
      } catch (error) {
        snapshotDraftFromDom();
        message = error.message || "Runde ungültig.";
        render();
      }
      return;
    }

    if (formAction === "promote") {
      void finalizePromote(true, form);
      return;
    }

    if (formAction === "join") {
      void handleJoinSubmit(form);
    }
  }

  function rememberSetupNames() {
    const names = setupNames.map((n) => normalizePlayerName(n)).filter(Boolean);
    if (!names.length) {
      message = "Keine Namen zum Speichern.";
      render();
      return;
    }
    const friends = getFriends();
    const result = promotePlayers(friends.players, names);
    friends.players = result.players;
    setupProfileIds = result.ids;
    persistFriends();
    message = "Spieler gemerkt.";
    render();
    if (isAuthenticated()) {
      void apiPromotePlayers(names)
        .then((payload) => {
          friendsStore = mergeRemoteCircle(getFriends(), payload);
          persistFriends();
        })
        .catch(() => {});
    }
  }

  async function removePermanentPlayer(profileId) {
    const friends = getFriends();
    friends.players = friends.players.filter((p) => p.id !== profileId);
    friends.lastGroupIds = friends.lastGroupIds.filter((id) => id !== profileId);
    if (friends.localStats?.[profileId]) {
      delete friends.localStats[profileId];
    }
    persistFriends();
    message = "Spieler entfernt.";
    render();
    if (isAuthenticated()) {
      try {
        const payload = await apiRemovePlayer(profileId);
        friendsStore = mergeRemoteCircle(getFriends(), payload);
        persistFriends();
        render();
      } catch {
        // keep local removal
      }
    }
  }

  async function finalizePromote(saveSelected, form = null) {
    const session = pendingPromoteSession || viewedSession;
    if (!session) {
      view = "history-detail";
      render();
      return;
    }

    const friends = getFriends();
    let namesToSave = [];
    if (saveSelected && form) {
      namesToSave = session.players
        .map((player, index) => {
          const box = form.querySelector(`[name="promote-${index}"]`);
          return box instanceof HTMLInputElement && box.checked ? player.name : null;
        })
        .filter(Boolean);
    } else if (saveSelected) {
      namesToSave = session.players
        .filter(
          (p) => !friends.players.some((fp) => nameKey(fp.name) === nameKey(p.name)),
        )
        .map((p) => p.name);
    }

    if (namesToSave.length) {
      const result = promotePlayers(friends.players, namesToSave);
      friends.players = result.players;
      persistFriends();
      if (isAuthenticated()) {
        try {
          const payload = await apiPromotePlayers(namesToSave);
          friendsStore = mergeRemoteCircle(getFriends(), payload);
          persistFriends();
        } catch {
          // local keep
        }
      }
    }

    linkSessionToProfiles(session);
    friends.lastGroupIds = session.players.map((p) => p.profileId).filter(Boolean);
    const game = getTabletopGame(session.gameId);
    friends.localStats = applySessionToStats(friends.localStats, session, game);
    persistFriends();

    // Keep local history in sync with linked profile ids.
    const store = loadStore();
    if (store.history?.[0]?.id === session.id) {
      store.history[0] = {
        ...store.history[0],
        players: session.players.map((p) => ({ ...p })),
      };
      saveStore(store);
    }

    if (isAuthenticated() && session.players.some((p) => p.profileId)) {
      try {
        const payload = await apiSubmitSession(session);
        if (payload?.stats) {
          friends.localStats = payload.stats;
          if (payload.players) {
            friends.players = payload.players;
          }
          persistFriends();
        }
      } catch {
        // rankings stay local
      }
    }

    pendingPromoteSession = null;
    viewedSession = structuredClone(session);
    viewedHistoryIndex = 0;
    view = "history-detail";
    message = namesToSave.length
      ? "Partie und Spieler gespeichert."
      : "Partie gespeichert.";
    render();
  }

  async function handleJoinSubmit(form) {
    const code = String(form.querySelector("[name=join-code]")?.value || "");
    const name = String(form.querySelector("[name=join-name]")?.value || "");
    try {
      const payload = await apiJoinByCode({ joinCode: code, name });
      const friends = getFriends();
      const result = promotePlayers(friends.players, [name]);
      friends.players = result.players;
      if (payload?.joinCode) {
        friends.joinCode = payload.joinCode;
      }
      if (payload?.ownerId) {
        friends.ownerId = payload.ownerId;
      }
      persistFriends();
      message = `${normalizePlayerName(name)} ist dabei.`;
      view = "players";
      render();
    } catch (error) {
      message = error.message || "Beitritt fehlgeschlagen.";
      render();
    }
  }

  function startSetup(gameId) {
    const game = getTabletopGame(gameId);
    if (!game) {
      return;
    }
    setupGameId = gameId;
    const count = game.players.fixed || game.players.min;
    const friends = getFriends();
    const last = (friends.lastGroupIds || [])
      .map((id) => friends.players.find((p) => p.id === id))
      .filter(Boolean);
    if (last.length >= game.players.min) {
      const used = last.slice(0, count);
      setupNames = used.map((p) => p.name);
      setupProfileIds = used.map((p) => p.id);
      while (setupNames.length < count) {
        setupNames.push(`Spieler ${setupNames.length + 1}`);
        setupProfileIds.push(null);
      }
    } else {
      setupNames = defaultPlayerNames(count);
      setupProfileIds = Array.from({ length: count }, () => null);
    }
    view = "setup";
    message = "";
    render();
  }

  function createSession(game, names, profileIds = []) {
    const players = names.map((name, index) => ({
      id: `p${index}`,
      name,
      profileId: profileIds[index] || null,
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

  function linkSessionToProfiles(session) {
    const friends = getFriends();
    const byName = new Map(friends.players.map((p) => [nameKey(p.name), p]));
    for (const player of session.players) {
      if (player.profileId && friends.players.some((p) => p.id === player.profileId)) {
        continue;
      }
      const match = byName.get(nameKey(player.name));
      if (match) {
        player.profileId = match.id;
        player.name = match.name;
      }
    }
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
    } else if (view === "players") {
      body.innerHTML = renderPlayers();
    } else if (view === "rankings") {
      body.innerHTML = renderRankings();
    } else if (view === "promote") {
      body.innerHTML = renderPromote();
    } else if (view === "join") {
      body.innerHTML = renderJoin();
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
      <div class="tt-toolbar-links">
        <button type="button" class="tt-secondary" data-tt-action="players">Spieler</button>
        <button type="button" class="tt-secondary" data-tt-action="rankings">Rangliste</button>
        <button type="button" class="tt-secondary" data-tt-action="join">Mit Code</button>
      </div>
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
      const previous = [...setupNames];
      const prevIds = [...setupProfileIds];
      setupNames = defaultPlayerNames(count).map((fallback, i) => previous[i] || fallback);
      setupProfileIds = Array.from({ length: count }, (_, i) => prevIds[i] || null);
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
      : `${renderStepper({
          label: `Anzahl Spieler (${game.players.min}–${game.players.max})`,
          name: "player-count",
          value: count,
          min: game.players.min,
          max: game.players.max,
        })}`;

    const friends = getFriends();
    const rosterChips =
      friends.players.length > 0
        ? `<div class="tt-roster-block">
            <p class="tt-meta">Feste Spieler antippen:</p>
            <div class="tt-chip-row tt-roster-chips">${friends.players
              .map((p) => {
                const selected = setupProfileIds.includes(p.id);
                return `<button type="button" class="tt-chip tt-secondary${selected ? " is-active" : ""}" data-tt-action="use-player" data-tt-player="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`;
              })
              .join("")}</div>
          </div>`
        : `<p class="tt-hint">Tipp: Nach einer Partie kannst du Namen als feste Spieler speichern.</p>`;

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>${escapeHtml(game.name)} — Setup</h2>
        <button type="button" class="tt-secondary" data-tt-action="rules" data-tt-game="${game.id}">Regeln</button>
      </div>
      ${rosterChips}
      <form class="tt-form" data-tt-form="setup">
        ${countField}
        <div class="tt-name-grid" data-tt-names>${nameFields}</div>
        <div class="tt-card-actions">
          <button type="button" class="tt-secondary" data-tt-action="remember-setup">Für später merken</button>
          <button type="submit">Partie starten</button>
        </div>
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
      endHint = `<p class="tt-hint">Runde ${Math.min(next, maxR)} von ${maxR} (je ${Math.min(next, maxR)} ${Math.min(next, maxR) === 1 ? "Karte" : "Karten"}).</p>`;
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
    const draft = session.draftRound || null;

    if (game.scoreMode === "wizard") {
      const maxR = wizardMaxRounds(session.players.length);
      if (session.rounds.length >= maxR) {
        return `<p class="tt-hint">Keine weiteren Wizard-Runden.</p>`;
      }
      const maxTricks = session.rounds.length + 1;
      const fields = session.players
        .map(
          (player, index) => `
          <fieldset class="tt-player-round">
            <legend>${escapeHtml(player.name)}</legend>
            ${renderBoundedNumber({
              label: "Ansage",
              name: `bid-${index}`,
              value: draftFieldValue(draft, `bid-${index}`, 0),
              min: 0,
              max: maxTricks,
            })}
            ${renderBoundedNumber({
              label: "Stiche",
              name: `tricks-${index}`,
              value: draftFieldValue(draft, `tricks-${index}`, 0),
              min: 0,
              max: maxTricks,
            })}
          </fieldset>`,
        )
        .join("");
      return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1}</h3><p class="tt-meta">${
        maxTricks + 1 <= CHIP_OPTION_LIMIT
          ? "Zahl antippen"
          : "Mit − / + einstellen (viele Stiche in dieser Runde)"
      }</p><div class="tt-round-grid">${fields}</div><button type="submit" class="tt-save-round">Runde speichern</button></form>`;
    }

    if (game.scoreMode === "phase10") {
      const fields = session.players
        .map(
          (player, index) => `
          <fieldset class="tt-player-round">
            <legend>${escapeHtml(player.name)} (Phase ${(player.phase || 1) > 10 ? "fertig" : String(player.phase || 1)})</legend>
            ${renderStepper({
              label: "Strafpunkte",
              name: `score-${index}`,
              value: draftFieldValue(draft, `score-${index}`, 0),
              min: 0,
              max: 500,
              step: 1,
              bigStep: 5,
            })}
            <label class="tt-check"><input name="phase-${index}" type="checkbox"${draftCheckValue(draft, `phase-${index}`) ? " checked" : ""} /> Phase geschafft</label>
          </fieldset>`,
        )
        .join("");
      return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1}</h3><div class="tt-round-grid">${fields}</div><button type="submit">Runde speichern</button></form>`;
    }

    const allowNegative = game.id === "doppelkopf" || game.id === "romme";
    const fields = session.players
      .map(
        (player, index) => `
        <div class="tt-field">
          <span>${escapeHtml(player.name)}</span>
          ${renderStepper({
            label: null,
            name: `score-${index}`,
            value: draftFieldValue(draft, `score-${index}`, 0),
            min: allowNegative ? -999 : 0,
            max: 999,
            step: 1,
            bigStep: allowNegative || game.id === "skyjo" ? 5 : null,
          })}
        </div>`,
      )
      .join("");
    return `<form class="tt-form" data-tt-form="round"><h3>Runde ${session.rounds.length + 1} — Punkte</h3><div class="tt-round-grid">${fields}</div><button type="submit">Runde speichern</button></form>`;
  }

  function renderPlayers() {
    const friends = getFriends();
    const code = friends.joinCode;
    const list =
      friends.players.length === 0
        ? `<p class="tt-lead">Noch keine festen Spieler. Speichere Namen nach einer Partie oder tippe im Setup auf „Für später merken“.</p>`
        : `<ul class="tt-player-list">${friends.players
            .map(
              (p) => `
            <li>
              <span>${escapeHtml(p.name)}</span>
              <button type="button" class="tt-danger tt-small" data-tt-action="remove-player" data-tt-player="${escapeAttr(p.id)}">Entfernen</button>
            </li>`,
            )
            .join("")}</ul>`;

    const codeBlock = isAuthenticated()
      ? code
        ? `<div class="tt-code-block">
            <p class="tt-meta">Freundes-Code (andere können sich selbst hinzufügen):</p>
            <p class="tt-join-code">${escapeHtml(formatJoinCode(code))}</p>
            <button type="button" class="tt-secondary" data-tt-action="copy-code">Code kopieren</button>
          </div>`
        : `<p class="tt-hint">Code wird geladen…</p>`
      : `<p class="tt-hint">Melde dich an, um Spieler weltweit zu synchronisieren und einen Freundes-Code zu erhalten.</p>`;

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>Feste Spieler</h2>
        <button type="button" class="tt-secondary" data-tt-action="join">Mit Code</button>
      </div>
      ${codeBlock}
      ${list}`;
  }

  function renderRankings() {
    const friends = getFriends();
    const filterButtons = [
      `<button type="button" class="tt-chip tt-secondary${!rankingsGameFilter ? " is-active" : ""}" data-tt-action="set-rank-filter" data-tt-game="">Gesamt</button>`,
      ...TABLETOP_GAMES.map(
        (g) =>
          `<button type="button" class="tt-chip tt-secondary${rankingsGameFilter === g.id ? " is-active" : ""}" data-tt-action="set-rank-filter" data-tt-game="${g.id}">${escapeHtml(g.name)}</button>`,
      ),
    ].join("");

    const rows = buildRankings(
      friends.players,
      friends.localStats,
      rankingsGameFilter || null,
    );
    const table =
      rows.length === 0
        ? `<p class="tt-lead">Noch keine Ranglisten-Daten. Beende Partien mit gemerkten Spielern.</p>`
        : `<div class="tt-table-wrap"><table class="tt-score-table tt-rank-table">
            <thead><tr><th>#</th><th>Spieler</th><th>Siege</th><th>Partien</th><th>Ø Punkte</th></tr></thead>
            <tbody>${rows
              .map(
                (row, i) =>
                  `<tr><td>${i + 1}</td><td>${escapeHtml(row.name)}</td><td>${row.wins}</td><td>${row.games}</td><td>${formatAvg(row.avgPoints)}</td></tr>`,
              )
              .join("")}</tbody>
          </table></div>`;

    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>Rangliste</h2>
      </div>
      <p class="tt-lead">Siege und Punkte unter euren festen Spielern — alle Tischspiele.</p>
      <div class="tt-chip-row tt-rank-filters">${filterButtons}</div>
      ${table}`;
  }

  function renderPromote() {
    const session = pendingPromoteSession || viewedSession;
    if (!session) {
      return `<p>Keine Partie.</p><button type="button" data-tt-action="picker">Zurück</button>`;
    }
    const friends = getFriends();
    const checks = session.players
      .map((player, index) => {
        const already = friends.players.some(
          (fp) => nameKey(fp.name) === nameKey(player.name),
        );
        return `
          <label class="tt-check tt-promote-row">
            <input name="promote-${index}" type="checkbox"${already ? "" : " checked"} ${already ? "disabled" : ""} />
            <span>${escapeHtml(player.name)}${already ? " <small>(schon gespeichert)</small>" : ""}</span>
          </label>`;
      })
      .join("");

    return `
      <div class="tt-toolbar">
        <h2>Als feste Spieler speichern</h2>
      </div>
      <p class="tt-lead">Diese Namen beim nächsten Spiel wiederverwenden und für die Rangliste zählen.</p>
      <form class="tt-form" data-tt-form="promote">
        <div class="tt-promote-list">${checks}</div>
        <div class="tt-card-actions">
          <button type="button" class="tt-secondary" data-tt-action="skip-promote">Überspringen</button>
          <button type="submit">Speichern</button>
        </div>
      </form>`;
  }

  function renderJoin() {
    return `
      <div class="tt-toolbar">
        <button type="button" class="tt-secondary" data-tt-action="picker">Zurück</button>
        <h2>Mit Code beitreten</h2>
      </div>
      <p class="tt-lead">Freundes-Code eingeben und deinen Namen hinzufügen.</p>
      <form class="tt-form" data-tt-form="join">
        <label class="tt-field">
          <span>Freundes-Code</span>
          <input name="join-code" type="text" maxlength="12" placeholder="NEO-AB12" required autocomplete="off" />
        </label>
        <label class="tt-field">
          <span>Dein Name</span>
          <input name="join-name" type="text" maxlength="24" required />
        </label>
        <button type="submit">Beitreten</button>
      </form>`;
  }

  function renderBoundedNumber({ label, name, value = 0, min = 0, max = 0 }) {
    const optionCount = max - min + 1;
    if (optionCount <= CHIP_OPTION_LIMIT) {
      return renderChipPicker({ label, name, value, min, max });
    }
    return renderStepper({
      label,
      name,
      value,
      min,
      max,
      step: 1,
      bigStep: optionCount > 12 ? 5 : null,
    });
  }

  function renderChipPicker({ label, name, value = 0, min = 0, max = 0 }) {
    const chips = [];
    const compact = max - min + 1 >= 6 ? " tt-chip-row-compact" : "";
    for (let n = min; n <= max; n += 1) {
      const active = n === value ? " is-active" : "";
      chips.push(
        `<button type="button" class="tt-chip tt-secondary${active}" data-tt-action="set-value" data-tt-target="${escapeAttr(name)}" data-tt-value="${n}" aria-pressed="${n === value ? "true" : "false"}">${n}</button>`,
      );
    }
    return `
      <div class="tt-chip-field" data-tt-chip-field="${escapeAttr(name)}">
        <span class="tt-stepper-label">${escapeHtml(label)}</span>
        <input type="hidden" name="${escapeAttr(name)}" value="${value}" min="${min}" max="${max}" required />
        <div class="tt-chip-row${compact}" role="group" aria-label="${escapeAttr(label)}">${chips.join("")}</div>
      </div>`;
  }

  function setNumericFieldValue(input, next) {
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const field = input.closest("[data-tt-chip-field]");
    if (field) {
      for (const chip of field.querySelectorAll(".tt-chip")) {
        const isActive = Number(chip.dataset.ttValue) === next;
        chip.classList.toggle("is-active", isActive);
        chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    }
  }

  function renderStepper({
    label,
    name,
    value = 0,
    min = null,
    max = null,
    step = 1,
    bigStep = null,
  }) {
    const minAttr = min == null ? "" : ` min="${min}"`;
    const maxAttr = max == null ? "" : ` max="${max}"`;
    const minData = min == null ? "" : ` data-tt-min="${min}"`;
    const maxData = max == null ? "" : ` data-tt-max="${max}"`;
    const labelHtml = label
      ? `<span class="tt-stepper-label">${escapeHtml(label)}</span>`
      : "";
    const bigBtns =
      bigStep != null
        ? `
        <button type="button" class="tt-step-btn tt-step-big tt-secondary" data-tt-action="step" data-tt-step-target="${escapeAttr(name)}" data-tt-step-delta="${-bigStep}" aria-label="Minus ${bigStep}">−${bigStep}</button>
        <button type="button" class="tt-step-btn tt-step-big tt-secondary" data-tt-action="step" data-tt-step-target="${escapeAttr(name)}" data-tt-step-delta="${bigStep}" aria-label="Plus ${bigStep}">+${bigStep}</button>`
        : "";
    return `
      <div class="tt-stepper"${minData}${maxData}>
        ${labelHtml}
        <div class="tt-stepper-row">
          <button type="button" class="tt-step-btn tt-secondary" data-tt-action="step" data-tt-step-target="${escapeAttr(name)}" data-tt-step-delta="${-step}" aria-label="Verringern">−</button>
          <input
            class="tt-stepper-input"
            name="${escapeAttr(name)}"
            type="number"
            inputmode="numeric"
            pattern="[0-9\\-]*"
            value="${value}"
            ${minAttr}
            ${maxAttr}
            step="1"
            required
          />
          <button type="button" class="tt-step-btn tt-secondary" data-tt-action="step" data-tt-step-target="${escapeAttr(name)}" data-tt-step-delta="${step}" aria-label="Erhöhen">+</button>
        </div>
        ${bigStep != null ? `<div class="tt-stepper-quick">${bigBtns}</div>` : ""}
      </div>`;
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
        <button type="button" class="tt-secondary" data-tt-action="history">Zur Liste</button>
        <button type="button" class="tt-secondary" data-tt-action="rankings">Rangliste</button>`;
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

  function handlePlayerCountInput(target) {
    const game = getTabletopGame(setupGameId);
    if (!game || view !== "setup") {
      return;
    }
    let count = Number(target.value);
    count = clamp(count, game.players.min, game.players.max);
    if (String(count) !== target.value) {
      target.value = String(count);
    }
    const previous = [...setupNames];
    const prevIds = [...setupProfileIds];
    setupNames = defaultPlayerNames(count).map((fallback, i) => previous[i] || fallback);
    setupProfileIds = Array.from({ length: count }, (_, i) => prevIds[i] || null);
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
  }

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

function formatJoinCode(code) {
  const clean = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 7 && clean.startsWith("NEO")) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

function formatAvg(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return (Math.round(value * 10) / 10).toLocaleString("de-DE");
}
