import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getRedisConfig } = require("../api/_redis.js");

test("getRedisConfig reads Upstash env vars", () => {
  const original = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  };

  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-a";

  try {
    assert.deepEqual(getRedisConfig(), {
      redisUrl: "https://example.upstash.io",
      redisToken: "token-a",
    });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("getRedisConfig discovers prefixed Vercel storage env vars", () => {
  const original = {};
  const keys = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "NEOARCADE_KV_REST_API_URL",
    "NEOARCADE_KV_REST_API_TOKEN",
  ];

  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }

  process.env.NEOARCADE_KV_REST_API_URL = "https://neoarcade.upstash.io";
  process.env.NEOARCADE_KV_REST_API_TOKEN = "token-c";

  try {
    assert.deepEqual(getRedisConfig(), {
      redisUrl: "https://neoarcade.upstash.io",
      redisToken: "token-c",
    });
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
});

test("getRedisConfig falls back to standard Vercel KV env vars", () => {
  const keys = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "NEOARCADE_KV_REST_API_URL",
    "NEOARCADE_KV_REST_API_TOKEN",
  ];
  const original = {};

  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }

  process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
  process.env.KV_REST_API_TOKEN = "token-b";

  try {
    assert.deepEqual(getRedisConfig(), {
      redisUrl: "https://kv.example.upstash.io",
      redisToken: "token-b",
    });
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
});
