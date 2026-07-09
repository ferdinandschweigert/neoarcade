import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

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

test("classic game list has eleven entries", () => {
  assert.equal(CLASSIC_GAME_IDS.length, 11);
});
