import test from "node:test";
import assert from "node:assert/strict";
import { createGrannyRunGame } from "../src/games/grannyrun.mjs";

test("Granny starts on the opening rooftop instead of falling immediately", () => {
  const noop = () => {};
  const context = new Proxy({}, {
    get(_target, property) {
      return property === "canvas" ? { width: 480, height: 480 } : noop;
    },
    set() {
      return true;
    },
  });
  const game = createGrannyRunGame(context);

  game.start();
  for (let frame = 0; frame < 90; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /^Run rooftops/);
});
