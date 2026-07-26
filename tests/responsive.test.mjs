import test from "node:test";
import assert from "node:assert/strict";
import { computeShellScale } from "../src/ui/responsive.mjs";

test("computeShellScale keeps full size when shell fits", () => {
  assert.equal(
    computeShellScale({
      shellWidth: 1000,
      shellHeight: 700,
      viewportWidth: 1280,
      viewportHeight: 800,
    }),
    1,
  );
});

test("computeShellScale shrinks to fit short viewports", () => {
  const scale = computeShellScale({
    shellWidth: 1180,
    shellHeight: 980,
    viewportWidth: 1440,
    viewportHeight: 820,
  });

  assert.ok(scale < 1);
  assert.ok(scale > 0.55);
  assert.ok(scale * 980 <= 820 - 16 + 0.5);
});

test("computeShellScale respects minimum scale", () => {
  assert.equal(
    computeShellScale({
      shellWidth: 2000,
      shellHeight: 2000,
      viewportWidth: 400,
      viewportHeight: 300,
      minScale: 0.55,
    }),
    0.55,
  );
});

test("computeShellScale disabled returns 1", () => {
  assert.equal(
    computeShellScale({
      shellWidth: 1200,
      shellHeight: 1000,
      viewportWidth: 800,
      viewportHeight: 600,
      enabled: false,
    }),
    1,
  );
});
