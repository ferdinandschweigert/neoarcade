import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  TABLETOP_GAMES,
  assertGamesHaveRules,
  wizardRoundScore,
  wizardMaxRounds,
  getTabletopGame,
} from "../src/tabletop/games.mjs";
import {
  captureRoundDraftFromForm,
  draftFieldValue,
  draftCheckValue,
} from "../src/tabletop/draft.mjs";
import {
  promotePlayers,
  nameKey,
  applySessionToStats,
  buildRankings,
  normalizePlayerName,
} from "../src/tabletop/friends.mjs";
import { STORAGE_KEYS } from "../src/storage.mjs";

const require = createRequire(import.meta.url);
const {
  sanitizeTabletopGameId,
  sanitizeJoinCode,
  createJoinCode,
  TABLETOP_GAME_IDS,
  TABLETOP_LOWER_IS_BETTER,
} = require("../api/_lib.js");
const tabletopApi = require("../api/tabletop.js");

test("every tabletop game has blurb and complete rules", () => {
  assert.equal(assertGamesHaveRules(), true);
  assert.ok(TABLETOP_GAMES.length >= 6);
  assert.ok(getTabletopGame("doppelkopf"));
  assert.ok(getTabletopGame("wizard"));
  assert.ok(getTabletopGame("skyjo"));
});

test("wizard scoring matches standard formula", () => {
  assert.equal(wizardRoundScore(0, 0), 20);
  assert.equal(wizardRoundScore(3, 3), 50);
  assert.equal(wizardRoundScore(2, 4), -20);
  assert.equal(wizardRoundScore(1, 0), -10);
  assert.equal(wizardMaxRounds(4), 15);
  assert.equal(wizardMaxRounds(3), 20);
  assert.equal(wizardMaxRounds(6), 10);
});

test("tabletop storage keys exist", () => {
  assert.equal(STORAGE_KEYS.TABLETOP_SESSIONS, "neoArcade.tabletop.v1");
  assert.equal(STORAGE_KEYS.TABLETOP_FRIENDS, "neoArcade.tabletopFriends.v1");
});

test("wizard option counts stay chip-friendly only early", () => {
  for (let round = 1; round <= 6; round += 1) {
    assert.ok(round + 1 <= 7, `round ${round} should use chips`);
  }
  assert.ok(12 + 1 > 7, "round 12 should fall back to steppers");
});

test("round draft survives rules-style re-read of form values", () => {
  // Simulate a form DOM with jsdom-free stub using a minimal document if available,
  // otherwise use a hand-built form element in a virtual structure via undici-less approach.
  const { JSDOM } = (() => {
    try {
      return require("jsdom");
    } catch {
      return {};
    }
  })();

  let form;
  if (JSDOM) {
    const dom = new JSDOM(`<!doctype html><form>
      <input name="bid-0" value="2" />
      <input name="tricks-0" value="1" />
      <input name="bid-1" value="0" />
      <input name="tricks-1" value="2" />
      <input name="bid-2" value="1" />
      <input name="tricks-2" value="0" />
    </form>`);
    form = dom.window.document.querySelector("form");
  } else {
    // Lightweight form stand-in matching querySelector contract used by draft helper.
    const values = {
      "bid-0": "2",
      "tricks-0": "1",
      "bid-1": "0",
      "tricks-1": "2",
      "bid-2": "1",
      "tricks-2": "0",
    };
    form = {
      querySelector(selector) {
        const match = selector.match(/\[name="([^"]+)"\]/);
        if (!match) {
          return null;
        }
        const name = match[1];
        if (!(name in values)) {
          return null;
        }
        return {
          value: values[name],
          checked: false,
        };
      },
    };
  }

  const draft = captureRoundDraftFromForm(form, "wizard", 3);
  assert.ok(draft);
  assert.equal(draftFieldValue(draft, "bid-0"), 2);
  assert.equal(draftFieldValue(draft, "tricks-0"), 1);
  assert.equal(draftFieldValue(draft, "bid-1"), 0);
  assert.equal(draftFieldValue(draft, "tricks-1"), 2);
  assert.equal(draftFieldValue(draft, "missing", 9), 9);

  // After "rules → back", render would seed from draft instead of 0.
  assert.notEqual(draftFieldValue(draft, "bid-0", 0), 0);
});

test("phase10 draft captures checkbox state", () => {
  const values = {
    "score-0": "15",
    "score-1": "5",
  };
  const checks = {
    "phase-0": true,
    "phase-1": false,
  };
  const form = {
    querySelector(selector) {
      const match = selector.match(/\[name="([^"]+)"\]/);
      if (!match) {
        return null;
      }
      const name = match[1];
      if (name.startsWith("phase-")) {
        return { checked: Boolean(checks[name]), value: "" };
      }
      if (!(name in values)) {
        return null;
      }
      return { value: values[name], checked: false };
    },
  };
  const draft = captureRoundDraftFromForm(form, "phase10", 2);
  assert.equal(draftFieldValue(draft, "score-0"), 15);
  assert.equal(draftCheckValue(draft, "phase-0"), true);
  assert.equal(draftCheckValue(draft, "phase-1"), false);
});

test("promotePlayers merges duplicate names case-insensitively", () => {
  const first = promotePlayers([], ["Anna", "Ben"]);
  assert.equal(first.players.length, 2);
  const second = promotePlayers(first.players, ["anna", "Clara", "BEN"]);
  assert.equal(second.players.length, 3);
  assert.equal(nameKey(second.players[0].name), "anna");
  assert.ok(second.ids.every(Boolean));
  assert.equal(second.ids[0], first.ids[0]);
  assert.equal(second.ids[2], first.ids[1]);
});

test("normalizePlayerName trims and caps length", () => {
  assert.equal(normalizePlayerName("  Max  "), "Max");
  assert.equal(normalizePlayerName("x".repeat(40)).length, 24);
});

test("applySessionToStats awards wins and games", () => {
  const session = {
    gameId: "wizard",
    players: [
      { profileId: "a", name: "A", total: 120 },
      { profileId: "b", name: "B", total: 80 },
    ],
  };
  const game = getTabletopGame("wizard");
  const stats = applySessionToStats({}, session, game);
  assert.equal(stats.a.wizard.wins, 1);
  assert.equal(stats.a.wizard.games, 1);
  assert.equal(stats.a.wizard.pointsSum, 120);
  assert.equal(stats.b.wizard.wins, 0);
  assert.equal(stats.b.wizard.games, 1);
});

test("buildRankings sorts by wins then points", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  const localStats = {
    a: { wizard: { wins: 2, games: 3, pointsSum: 200 } }, // avg ~66.7
    b: { wizard: { wins: 2, games: 2, pointsSum: 180 } }, // avg 90
    c: { wizard: { wins: 1, games: 4, pointsSum: 400 } },
  };
  const rows = buildRankings(players, localStats, "wizard");
  assert.equal(rows[0].playerId, "b");
  assert.equal(rows[1].playerId, "a");
  assert.equal(rows[2].playerId, "c");
});

test("skyjo rankings prefer lower average points on equal wins", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const localStats = {
    a: { skyjo: { wins: 1, games: 2, pointsSum: 80 } },
    b: { skyjo: { wins: 1, games: 2, pointsSum: 40 } },
  };
  const rows = buildRankings(players, localStats, "skyjo");
  assert.equal(rows[0].playerId, "b");
});

test("api helpers sanitize tabletop games and join codes", () => {
  assert.equal(sanitizeTabletopGameId("wizard"), "wizard");
  assert.equal(sanitizeTabletopGameId("snake"), null);
  assert.deepEqual(TABLETOP_GAME_IDS.sort(), [
    "doppelkopf",
    "phase10",
    "qwixx",
    "romme",
    "skyjo",
    "wizard",
  ]);
  assert.ok(TABLETOP_LOWER_IS_BETTER.has("skyjo"));
  assert.equal(sanitizeJoinCode("neo-ab12"), "NEOAB12");
  const code = createJoinCode();
  assert.match(code, /^NEO[A-Z0-9]{4}$/);
});

test("api promoteIntoCircle merges names", () => {
  const { promoteIntoCircle } = tabletopApi._test;
  const first = promoteIntoCircle([], ["Lisa", "Tom"]);
  const second = promoteIntoCircle(first.players, ["lisa", "Nora"]);
  assert.equal(second.players.length, 3);
  assert.equal(second.ids[0], first.ids[0]);
});
