import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTROL_SCHEMES,
  shouldShowTouchButtons,
  shouldUseGestures,
} from "../src/input.mjs";
import { detectTouchDevice } from "../src/ui/responsive.mjs";
import { createCloverQuestGame } from "../src/games/cloverquest.mjs";

test("auto mode shows touch buttons only on touch devices", () => {
  assert.equal(shouldShowTouchButtons("auto", true, "dpad"), true);
  assert.equal(shouldShowTouchButtons("auto", false, "dpad"), false);
});

test("on-screen buttons never appear on non-touch devices", () => {
  assert.equal(shouldShowTouchButtons("buttons", false, "horizontal"), false);
  assert.equal(shouldShowTouchButtons("both", false, "vertical"), false);
  assert.equal(shouldShowTouchButtons("buttons", true, "horizontal"), true);
  assert.equal(shouldShowTouchButtons("both", true, "vertical"), true);
  assert.equal(shouldShowTouchButtons("gestures", true, "dpad"), false);
});

test("empty schemes never show touch buttons", () => {
  assert.equal(shouldShowTouchButtons("both", true, "none"), false);
  assert.equal(CONTROL_SCHEMES.none.length, 0);
});

test("gestures stay off on desktop keyboards", () => {
  assert.equal(shouldUseGestures("auto", true), true);
  assert.equal(shouldUseGestures("auto", false), false);
  assert.equal(shouldUseGestures("gestures", false), false);
  assert.equal(shouldUseGestures("buttons", true), false);
  assert.equal(shouldUseGestures("both", true), true);
  assert.equal(shouldUseGestures("both", false), false);
});

test("touch detection ignores laptop touchscreen false positives", () => {
  const desktop = {
    matchMedia(query) {
      const map = {
        "(pointer: coarse)": false,
        "(hover: none)": false,
      };
      return { matches: Boolean(map[query]) };
    },
    navigator: { maxTouchPoints: 10 },
  };
  assert.equal(detectTouchDevice(desktop), false);

  const phone = {
    matchMedia(query) {
      const map = {
        "(pointer: coarse)": true,
        "(hover: none)": true,
      };
      return { matches: Boolean(map[query]) };
    },
    navigator: { maxTouchPoints: 5 },
  };
  assert.equal(detectTouchDevice(phone), true);
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
