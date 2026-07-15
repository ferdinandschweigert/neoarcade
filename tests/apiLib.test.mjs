import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { CLASSIC_GAME_IDS as FRONTEND_GAME_IDS } from "../src/ui/layout.mjs";

const require = createRequire(import.meta.url);
const {
  boardScore,
  isBetterScore,
  sanitizeUsername,
  sanitizeGameId,
  CLASSIC_GAME_IDS,
} = require("../api/_lib.js");

test("sanitizeUsername keeps safe characters", () => {
  assert.equal(sanitizeUsername("Ferdinand!"), "ferdinand");
  assert.equal(sanitizeUsername("  bob_1  "), "bob_1");
});

test("sanitizeGameId allows only classic games", () => {
  assert.equal(sanitizeGameId("snake"), "snake");
  assert.equal(sanitizeGameId("labyrinth"), "labyrinth");
  assert.equal(sanitizeGameId("grannyrun"), "grannyrun");
  assert.equal(sanitizeGameId("blaster"), null);
});

test("boardScore inverts lower-is-better games", () => {
  assert.equal(boardScore("memory", 12), 999999988);
  assert.equal(boardScore("snake", 42), 42);
});

test("isBetterScore respects game direction", () => {
  assert.equal(isBetterScore("memory", 20, 15), true);
  assert.equal(isBetterScore("snake", 20, 15), false);
  assert.equal(isBetterScore("snake", null, 5), true);
});

test("classic game list has thirteen entries", () => {
  assert.equal(CLASSIC_GAME_IDS.length, 13);
  assert.deepEqual(FRONTEND_GAME_IDS, CLASSIC_GAME_IDS);
});
