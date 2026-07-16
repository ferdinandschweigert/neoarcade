import test from "node:test";
import assert from "node:assert/strict";
import { createCloverQuestGame } from "../src/games/cloverquest.mjs";
import { createAfterHoursArcadeGame } from "../src/games/afterhours.mjs";

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
