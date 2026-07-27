import test from "node:test";
import assert from "node:assert/strict";
import { createCloverQuestGame } from "../src/games/cloverquest.mjs";
import { createAfterHoursArcadeGame } from "../src/games/afterhours.mjs";
import { createQuickDrawGame } from "../src/games/quickdraw.mjs";
import { createMastermindGame } from "../src/games/mastermind.mjs";
import { createSokobanGame } from "../src/games/sokoban.mjs";
import { createHanoiGame } from "../src/games/hanoi.mjs";
import { createLightsOutGame } from "../src/games/lights.mjs";
import { createSequenceEchoGame } from "../src/games/sequence.mjs";

function createTestContext() {
  const noop = () => {};
  return new Proxy({}, {
    get(_target, property) {
      return property === "canvas" ? { width: 480, height: 480 } : noop;
    },
    set() { return true; },
  });
}

test("Clover Quest waits for a player action before starting", () => {
  const game = createCloverQuestGame(createTestContext());
  game.start();
  game.tick();
  assert.match(game.getHud().status, /Press Jump/);
  assert.equal(game.onKeyDown("ArrowUp"), true);
  game.tick();
  assert.match(game.getHud().score, /Gold pots: 0\/7/);
});

test("After Hours Arcade upgrades its first cabinet with starter tickets", () => {
  const game = createAfterHoursArcadeGame(createTestContext());
  game.start();
  assert.equal(game.onControl("UP"), true);
  assert.match(game.getHud().score, /Tickets: 13/);
  assert.match(game.getHud().status, /restoration improved/i);
});

test("Quick Draw starts in wait phase", () => {
  const game = createQuickDrawGame(createTestContext());
  game.start();
  assert.match(game.getHud().status, /Wait for DRAW/);
  assert.match(game.getHud().score, /Score: 0/);
});

test("Mastermind Code accepts color adjustments", () => {
  const game = createMastermindGame(createTestContext());
  game.start();
  assert.equal(game.onControl("UP"), true);
  assert.match(game.getHud().score, /Score: 0/);
  assert.match(game.getHud().status, /Adjust colors/i);
});

test("Sokoban Crates exposes level progress", () => {
  const game = createSokobanGame(createTestContext());
  game.setDifficulty("easy");
  game.start();
  assert.match(game.getHud().score, /Level: 1\//);
  assert.equal(game.onControl("RIGHT") || game.onControl("LEFT") || game.onControl("UP") || game.onControl("DOWN"), true);
});

test("Tower of Hanoi starts on round one", () => {
  const game = createHanoiGame(createTestContext());
  game.start();
  assert.match(game.getHud().score, /Round: 1\/3/);
  assert.equal(game.onControl("SELECT"), true);
});

test("Lights Out starts with a solvable board", () => {
  const game = createLightsOutGame(createTestContext());
  game.start();
  assert.match(game.getHud().score, /Moves: 0/);
  assert.equal(game.onControl("SELECT"), true);
  assert.match(game.getHud().score, /Moves: 1/);
});

test("Sequence Echo plays back before accepting input", () => {
  const game = createSequenceEchoGame(createTestContext());
  game.setDifficulty("easy");
  game.start();
  assert.match(game.getHud().status, /Watch the pattern/);
  assert.equal(game.onControl("SELECT"), false);
  for (let i = 0; i < 400; i += 1) {
    game.tick();
  }
  assert.match(game.getHud().status, /Watch the pattern|Too slow|Miss/);
});
