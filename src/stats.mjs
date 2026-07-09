import { fetchMyStats } from "./apiClient.mjs";
import { GAME_LABELS } from "./ui/layout.mjs";

export function createStatsView(config = {}) {
  const summaryEl = config.summaryEl;
  const barsEl = config.barsEl;
  const recentEl = config.recentEl;
  const progressEl = config.progressEl;
  const messageEl = config.messageEl;

  async function refresh() {
    setMessage("Loading your stats…");

    try {
      const payload = await fetchMyStats();
      renderSummary(payload.summary || {});
      renderBars(payload.bests || []);
      renderRecent(payload.recent || []);
      renderProgress(payload.summary || {});
      setMessage("");
    } catch (error) {
      setMessage(error.message, true);
      if (summaryEl) {
        summaryEl.innerHTML = "";
      }
      if (barsEl) {
        barsEl.innerHTML = "";
      }
      if (recentEl) {
        recentEl.innerHTML = "";
      }
      if (progressEl) {
        progressEl.innerHTML = "";
      }
    }
  }

  function showGuestMessage() {
    setMessage("Sign in to track stats and appear on friend rankings.");
    if (summaryEl) {
      summaryEl.innerHTML = "";
    }
    if (barsEl) {
      barsEl.textContent = "Guest scores stay on this device only.";
    }
    if (recentEl) {
      recentEl.innerHTML = "";
    }
    if (progressEl) {
      progressEl.innerHTML = "";
    }
  }

  function renderSummary(summary) {
    if (!summaryEl) {
      return;
    }

    summaryEl.innerHTML = "";

    const cards = [
      { label: "Games scored", value: `${summary.gamesWithScores || 0} / ${summary.totalGames || 11}` },
      { label: "Recent plays", value: String(summary.playCount || 0) },
      { label: "Active days", value: String(summary.activeDays || 0) },
    ];

    for (const card of cards) {
      const el = document.createElement("div");
      el.className = "stat-card";
      el.innerHTML = `<span class="stat-card-label">${card.label}</span><strong class="stat-card-value">${card.value}</strong>`;
      summaryEl.appendChild(el);
    }
  }

  function renderBars(bests) {
    if (!barsEl) {
      return;
    }

    barsEl.innerHTML = "";

    if (bests.length === 0) {
      barsEl.textContent = "Play a game while signed in to start tracking stats.";
      return;
    }

    const maxMetric = Math.max(...bests.map((item) => item.metric));

    for (const item of bests) {
      const row = document.createElement("div");
      row.className = "stat-bar-row";

      const label = document.createElement("span");
      label.className = "stat-bar-label";
      label.textContent = item.label || GAME_LABELS[item.gameId] || item.gameId;

      const track = document.createElement("div");
      track.className = "stat-bar-track";

      const fill = document.createElement("div");
      fill.className = "stat-bar-fill";
      const width = maxMetric > 0 ? Math.max(8, (item.metric / maxMetric) * 100) : 8;
      fill.style.width = `${width}%`;

      const value = document.createElement("span");
      value.className = "stat-bar-value";
      value.textContent = item.metricLabel || String(item.metric);

      track.appendChild(fill);
      row.append(label, track, value);
      barsEl.appendChild(row);
    }
  }

  function renderRecent(recent) {
    if (!recentEl) {
      return;
    }

    recentEl.innerHTML = "";

    if (recent.length === 0) {
      recentEl.textContent = "No recent activity yet.";
      return;
    }

    const list = document.createElement("ul");
    list.className = "recent-activity-list";

    for (const entry of recent) {
      const item = document.createElement("li");
      const label = GAME_LABELS[entry.gameId] || entry.gameId;
      const when = entry.at ? new Date(entry.at).toLocaleString() : "recently";
      item.textContent = `${label} — ${entry.metric}${entry.improved ? " (new best)" : ""} · ${when}`;
      list.appendChild(item);
    }

    recentEl.appendChild(list);
  }

  function renderProgress(summary) {
    if (!progressEl) {
      return;
    }

    const total = summary.totalGames || 11;
    const done = summary.gamesWithScores || 0;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    progressEl.innerHTML = `
      <div class="usage-header">
        <span>Classics explored</span>
        <strong>${percent}%</strong>
      </div>
      <div class="usage-track">
        <div class="usage-fill" style="width: ${percent}%"></div>
      </div>
      <p class="usage-copy">${done} of ${total} classic games with a saved best score.</p>
    `;
  }

  function setMessage(message, isError = false) {
    if (!messageEl) {
      return;
    }

    messageEl.textContent = message;
    messageEl.classList.toggle("is-error", isError);
  }

  return { refresh, showGuestMessage };
}
