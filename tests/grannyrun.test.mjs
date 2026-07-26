import test from "node:test";
import assert from "node:assert/strict";
import { createGrannyRunGame } from "../src/games/grannyrun.mjs";
import { STORAGE_KEYS } from "../src/storage.mjs";

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

function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
  };
  return map;
}

function freshGame() {
  installMemoryStorage();
  const game = createGrannyRunGame(createTestContext());
  game.start();
  game._startLevel(0);
  return game;
}

test("Granny starts on the opening rooftop instead of falling immediately", () => {
  const game = freshGame();

  for (let frame = 0; frame < 90; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /^L1\//);
  assert.equal(game._getState().status, "running");
  assert.ok(game._getState().playerY < 480);
});

test("holding jump completes a rewarded roller-skate flip without latching a cane", () => {
  const game = freshGame();
  const beforeSpeed = game._getState().speed;

  game.onKeyDown("ArrowUp");
  for (let frame = 0; frame < 48; frame += 1) {
    game.tick();
  }
  game.onKeyUp("ArrowUp");
  for (let frame = 0; frame < 30; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /Perfect landing/);
  assert.equal(game._getState().mode === "swing", false);
  assert.ok(game._getState().speed > beforeSpeed);
});

test("jump does not cane-latch; cane does", () => {
  const game = freshGame();
  game._startLevel(0);
  const state = game._getState();
  const hook = state.level.hooks[0];

  state.scrollX = hook.x - 108;
  state.playerY = hook.y - 10;
  state.onGround = false;
  state.mode = "air";
  state.playerVy = 0;
  game.onKeyDown("ArrowUp");
  assert.notEqual(game._getState().mode, "swing");
  game.onKeyUp("ArrowUp");

  game.onKeyDown("ArrowDown");
  assert.equal(game._getState().mode, "swing");
  game.onKeyUp("ArrowDown");
  assert.notEqual(game._getState().mode, "swing");
});

test("a rough landing spills coins without ending the run", () => {
  const game = freshGame();
  const coinsBefore = game._getState().level.coins.length;

  game.onKeyDown("ArrowUp");
  for (let frame = 0; frame < 18; frame += 1) {
    game.tick();
  }
  game.onKeyUp("ArrowUp");
  for (let frame = 0; frame < 40; frame += 1) {
    game.tick();
  }

  assert.match(game.getHud().status, /Rough landing|coins spilled|Helmet/i);
  assert.doesNotMatch(game.getHud().status, /fell/i);
  assert.equal(game._getState().status, "running");
  assert.ok(game._getState().level.coins.length >= coinsBefore);
});

test("the thief can claim an apple before Granny", () => {
  const game = freshGame();
  const state = game._getState();
  const apple = state.level.apples[0];

  state.scrollX = 0;
  state.playerY = 500;
  state.thief.x = apple.x;
  state.thief.y = apple.y - 20;
  state.thief.onGround = true;
  state.thief.mode = "run";

  game.tick();

  assert.equal(apple.takenBy, "thief");
  assert.equal(game._getState().applesThief, 1);
  assert.match(game.getHud().status, /Thief stole an apple/);
});

test("finishing with three apples awards three stars", () => {
  const game = freshGame();
  const state = game._getState();

  for (const apple of state.level.apples) {
    apple.takenBy = "granny";
  }
  state.applesGranny = 3;
  state.scrollX = state.level.finishX;
  state.playerY = 300;
  state.onGround = true;
  state.mode = "run";

  game.tick();

  assert.equal(game._getState().status, "cleared");
  assert.equal(game._getState().starsEarned, 3);
  assert.match(game.getHud().status, /3★/);
  assert.match(game.getHud().score, /Score:/);
  assert.match(game.getHud().score, /Best:/);
});

test("baseball destroys a breakable crate", () => {
  const game = freshGame();
  const state = game._getState();
  const crate = state.level.breakables[0];

  for (const apple of state.level.apples) {
    apple.takenBy = "thief";
  }

  state.baseballs = 1;
  state.inventory.baseball = 1;
  state.scrollX = crate.x - 160;
  state.playerY = crate.y - 8;
  state.onGround = true;
  state.mode = "run";
  state.speed = 4.6;

  game.onKeyDown("ArrowDown");
  game.onKeyUp("ArrowDown");
  assert.equal(game._getState().projectiles.length, 1);

  for (let frame = 0; frame < 50; frame += 1) {
    game.tick();
  }

  assert.equal(crate.broken, true);
});

test("shop continue advances into the next rooftop run", () => {
  installMemoryStorage();
  globalThis.localStorage.setItem(
    STORAGE_KEYS.GRANNY_PROGRESS,
    JSON.stringify({
      levelIndex: 1,
      coinsBank: 50,
      totalScore: 120,
      starsByLevel: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      inventory: { helmet: 0, banana: 0, baseball: 0 },
      unlockedStanley: false,
      useStanley: false,
    }),
  );

  const game = createGrannyRunGame(createTestContext());
  game.start();
  assert.equal(game._getState().status, "shop");

  game.onControl("RIGHT");
  game.onControl("RIGHT");
  game.onControl("RIGHT");
  game.onControl("SELECT");

  assert.equal(game._getState().status, "running");
  assert.equal(game._getState().levelIndex, 1);
});
