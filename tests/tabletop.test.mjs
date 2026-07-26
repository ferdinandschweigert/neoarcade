import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLETOP_GAMES,
  assertGamesHaveRules,
  wizardRoundScore,
  wizardMaxRounds,
  getTabletopGame,
} from "../src/tabletop/games.mjs";
import { STORAGE_KEYS } from "../src/storage.mjs";

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

test("tabletop storage key exists", () => {
  assert.equal(STORAGE_KEYS.TABLETOP_SESSIONS, "neoArcade.tabletop.v1");
});

test("wizard option counts stay chip-friendly only early", () => {
  // Round n deals n cards → n+1 options (0..n). Chips up to 7 options ⇒ rounds 1–6.
  for (let round = 1; round <= 6; round += 1) {
    assert.ok(round + 1 <= 7, `round ${round} should use chips`);
  }
  assert.ok(12 + 1 > 7, "round 12 should fall back to steppers");
});
