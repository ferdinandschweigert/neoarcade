import assert from "node:assert/strict";
import test from "node:test";
import {
  safeStorageGet,
  safeStorageSet,
  safeStorageSetJson,
  safeStorageGetJson,
  STORAGE_KEYS,
} from "../src/storage.mjs";

const memory = new Map();

test("storage helpers read and write json values", () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, value);
    },
    removeItem(key) {
      memory.delete(key);
    },
  };

  try {
    assert.equal(safeStorageSet(STORAGE_KEYS.CONTROL_MODE, "both"), true);
    assert.equal(safeStorageGet(STORAGE_KEYS.CONTROL_MODE), "both");
    assert.equal(safeStorageSetJson(STORAGE_KEYS.RECENT_GAMES, ["snake", "pong"]), true);
    assert.deepEqual(safeStorageGetJson(STORAGE_KEYS.RECENT_GAMES, []), ["snake", "pong"]);
  } finally {
    globalThis.localStorage = original;
    memory.clear();
  }
});
