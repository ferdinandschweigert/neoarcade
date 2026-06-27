import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchWithRetry,
  mergeCloudSnapshots,
  pickBetterMetric,
  sanitizeCloudCode,
  sanitizeCloudSnapshot,
} from "../src/cloudSync.mjs";

test("sanitizeCloudCode strips invalid characters", () => {
  assert.equal(sanitizeCloudCode("  Ferdinand-Home!  "), "ferdinand-home");
});

test("pickBetterMetric prefers higher score by default", () => {
  assert.equal(pickBetterMetric("snake", 10, 20, new Set()), 20);
});

test("pickBetterMetric prefers lower score for timed games", () => {
  assert.equal(pickBetterMetric("quickdraw", 400, 250, new Set(["quickdraw"])), 250);
});

test("mergeCloudSnapshots keeps best scores from both sides", () => {
  const local = {
    version: 1,
    profiles: [{ id: "p1", name: "Local", color: "#2563eb" }],
    scoreStoreByProfile: { p1: { snake: 10 } },
    activeProfileId: "p1",
    activeDifficulty: "normal",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  const remote = {
    version: 1,
    profiles: [{ id: "p1", name: "Remote", color: "#ef6351" }],
    scoreStoreByProfile: { p1: { snake: 25, pong: 3 } },
    activeProfileId: "p1",
    activeDifficulty: "hard",
    updatedAt: "2025-06-01T00:00:00.000Z",
  };

  const merged = mergeCloudSnapshots(local, remote, {
    difficultyOptions: new Set(["easy", "normal", "hard"]),
    profileColors: ["#2563eb"],
    maxProfiles: 8,
    lowerIsBetterGames: new Set(),
  });

  assert.equal(merged.scoreStoreByProfile.p1.snake, 25);
  assert.equal(merged.scoreStoreByProfile.p1.pong, 3);
  assert.equal(merged.activeDifficulty, "hard");
  assert.equal(merged.profiles[0].name, "Remote");
});

test("sanitizeCloudSnapshot rejects empty profiles", () => {
  const result = sanitizeCloudSnapshot(
    { profiles: [], scoreStoreByProfile: {} },
    new Set(["normal"]),
    ["#2563eb"],
    8,
  );
  assert.equal(result, null);
});

test("fetchWithRetry returns 404 without throwing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });

  try {
    const response = await fetchWithRetry("/missing", {}, { maxAttempts: 1 });
    assert.equal(response.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
