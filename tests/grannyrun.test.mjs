import test from "node:test";
import assert from "node:assert/strict";
import { createGrannyRunGame } from "../src/games/grannyrun.mjs";

function createTestContext() {
  const noop = () => {};
  return new Proxy({}, {
    get(_target, property) {
      return property === "canvas" ? { width: 480, height: 480 } : noop;
    },
    set() {
      return true;
    },
  });
}

test("Granny starts on the opening rooftop instead of falling immediately", () => {
  const game = createGrannyRunGame(createTestContext());

  game.start();
  for (let frame = 0; frame < 90; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /^Run rooftops/);
});

test("holding the existing jump control completes a rewarded roller-skate flip", () => {
  const game = createGrannyRunGame(createTestContext());

  game.start();
  game.onKeyDown("ArrowUp");
  for (let frame = 0; frame < 48; frame += 1) {
    game.tick();
  }
  game.onKeyUp("ArrowUp");

  assert.match(game.getHud().status, /Perfect landing!/);
});

test("a rough landing slows Granny down without ending the run", () => {
  const game = createGrannyRunGame(createTestContext());

  game.start();
  game.onKeyDown("ArrowUp");
  for (let frame = 0; frame < 18; frame += 1) {
    game.tick();
  }
  game.onKeyUp("ArrowUp");
  for (let frame = 0; frame < 32; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /Rough landing/);
  assert.doesNotMatch(game.getHud().status, /Restart to retry/);
});
