import { fetchLeaderboard } from "./apiClient.mjs";
import { CLASSIC_GAME_IDS, GAME_LABELS } from "./ui/layout.mjs";

export function createLeaderboardView(config = {}) {
  const rootEl = config.rootEl;
  const gameSelectEl = config.gameSelectEl;
  const overallTabEl = config.overallTabEl;
  const gameTabEl = config.gameTabEl;
  const tableBodyEl = config.tableBodyEl;
  const messageEl = config.messageEl;
  const titleEl = config.titleEl;

  let mode = "game";
  let selectedGameId = CLASSIC_GAME_IDS[0];

  if (gameSelectEl instanceof HTMLSelectElement) {
    gameSelectEl.innerHTML = "";
    for (const gameId of CLASSIC_GAME_IDS) {
      const option = document.createElement("option");
      option.value = gameId;
      option.textContent = GAME_LABELS[gameId] || gameId;
      gameSelectEl.appendChild(option);
    }

    gameSelectEl.value = selectedGameId;
    gameSelectEl.addEventListener("change", () => {
      selectedGameId = gameSelectEl.value;
      void refresh();
    });
  }

  if (overallTabEl) {
    overallTabEl.addEventListener("click", () => {
      mode = "overall";
      overallTabEl.classList.add("is-active");
      gameTabEl?.classList.remove("is-active");
      gameSelectEl?.classList.add("hidden");
      void refresh();
    });
  }

  if (gameTabEl) {
    gameTabEl.addEventListener("click", () => {
      mode = "game";
      gameTabEl.classList.add("is-active");
      overallTabEl?.classList.remove("is-active");
      gameSelectEl?.classList.remove("hidden");
      void refresh();
    });
  }

  async function refresh() {
    if (!rootEl) {
      return;
    }

    setMessage("Loading rankings…");

    try {
      const payload = mode === "overall"
        ? await fetchLeaderboard({ overall: true })
        : await fetchLeaderboard({ gameId: selectedGameId });

      renderRows(payload.rows || [], payload);
      setMessage("");
    } catch (error) {
      setMessage(error.message, true);
      if (tableBodyEl) {
        tableBodyEl.innerHTML = "";
      }
    }
  }

  function renderRows(rows, payload) {
    if (titleEl) {
      titleEl.textContent = mode === "overall"
        ? "Overall rankings"
        : `${payload.gameLabel || "Game"} leaderboard`;
    }

    if (!tableBodyEl) {
      return;
    }

    tableBodyEl.innerHTML = "";

    if (rows.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "No scores yet. Be the first to play.";
      row.appendChild(cell);
      tableBodyEl.appendChild(row);
      return;
    }

    for (const entry of rows) {
      const row = document.createElement("tr");
      if (entry.isCurrentUser) {
        row.classList.add("is-current-user");
      }

      const rankCell = document.createElement("td");
      rankCell.textContent = String(entry.rank);

      const nameCell = document.createElement("td");
      nameCell.textContent = entry.displayName;

      const scoreCell = document.createElement("td");
      if (mode === "overall") {
        scoreCell.textContent = `${entry.points} pts (${entry.gamesPlayed} games)`;
      } else {
        scoreCell.textContent = entry.metricLabel || String(entry.metric);
      }

      const gameCell = document.createElement("td");
      gameCell.textContent = mode === "overall" ? "All classics" : (GAME_LABELS[entry.gameId] || entry.gameId);

      row.append(rankCell, nameCell, scoreCell, gameCell);
      tableBodyEl.appendChild(row);
    }
  }

  function setMessage(message, isError = false) {
    if (!messageEl) {
      return;
    }

    messageEl.textContent = message;
    messageEl.classList.toggle("is-error", isError);
  }

  return { refresh };
}
