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
