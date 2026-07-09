import test from "node:test";
import assert from "node:assert/strict";
import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  STORAGE_KEYS,
} from "../src/storage.mjs";

const memory = new Map();

test("auth token storage keys exist", () => {
  assert.ok(STORAGE_KEYS.AUTH_TOKEN);
  assert.ok(STORAGE_KEYS.GUEST_MODE);
});

test("auth token round trip in storage helpers", () => {
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
    safeStorageSet(STORAGE_KEYS.AUTH_TOKEN, "test-token");
    assert.equal(safeStorageGet(STORAGE_KEYS.AUTH_TOKEN), "test-token");
    safeStorageRemove(STORAGE_KEYS.AUTH_TOKEN);
    assert.equal(safeStorageGet(STORAGE_KEYS.AUTH_TOKEN), null);
  } finally {
    globalThis.localStorage = original;
    memory.clear();
  }
});
