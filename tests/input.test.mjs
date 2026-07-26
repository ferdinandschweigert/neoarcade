import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTROL_SCHEMES,
  shouldShowTouchButtons,
  shouldUseGestures,
} from "../src/input.mjs";
import { createCloverQuestGame } from "../src/games/cloverquest.mjs";

test("auto mode shows touch buttons only on touch devices", () => {
  assert.equal(shouldShowTouchButtons("auto", true, "dpad"), true);
  assert.equal(shouldShowTouchButtons("auto", false, "dpad"), false);
});

test("buttons and both modes always show scheme buttons", () => {
  assert.equal(shouldShowTouchButtons("buttons", false, "horizontal"), true);
  assert.equal(shouldShowTouchButtons("both", false, "vertical"), true);
  assert.equal(shouldShowTouchButtons("gestures", true, "dpad"), false);
});

test("empty schemes never show touch buttons", () => {
  assert.equal(shouldShowTouchButtons("both", true, "none"), false);
  assert.equal(CONTROL_SCHEMES.none.length, 0);
});

test("gesture usage follows control mode", () => {
  assert.equal(shouldUseGestures("auto", true), true);
  assert.equal(shouldUseGestures("auto", false), false);
  assert.equal(shouldUseGestures("gestures", false), true);
  assert.equal(shouldUseGestures("buttons", true), false);
  assert.equal(shouldUseGestures("both", false), true);
});

test("clover quest releases held touch directions", () => {
  const ctx = {
    canvas: { width: 480, height: 480 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    fillText() {},
    save() {},
    restore() {},
  };

  const game = createCloverQuestGame(ctx);
  game.start();

  assert.equal(game.onControl("RIGHT"), true);
  assert.equal(game.onControlRelease("RIGHT"), true);
  assert.equal(game.onControlRelease("LEFT"), true);
});
