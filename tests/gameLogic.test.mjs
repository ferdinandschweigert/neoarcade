import test from "node:test";
import assert from "node:assert/strict";

import {
  POWER_UP_TYPES,
  advanceState,
  changeDirection,
  createInitialState,
  spawnFood,
} from "../src/gameLogic.mjs";

function sequence(values) {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? values[values.length - 1] ?? 0;
  };
}

test("moves snake forward one cell on tick", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    nextDirection: "RIGHT",
    food: { x: 5, y: 5 },
    score: 0,
    status: "running",
  };

  const next = advanceState(state);

  assert.deepEqual(next.snake, [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  assert.equal(next.score, 0);
  assert.equal(next.status, "running");
});

test("snake wraps through walls", () => {
  const state = {
    gridSize: 5,
    snake: [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
    ],
    direction: "RIGHT",
    nextDirection: "RIGHT",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  };

  const next = advanceState(state);

  assert.equal(next.status, "running");
  assert.deepEqual(next.snake[0], { x: 0, y: 2 });
});

test("grows snake and increments score when eating food", () => {
  const state = {
    gridSize: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    nextDirection: "RIGHT",
    food: { x: 3, y: 2 },
    score: 0,
    status: "running",
  };

  const next = advanceState(state, () => 0);

  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 3, y: 2 });
  assert.notDeepEqual(next.food, { x: 3, y: 2 });
});

test("ends game on self collision when phase is inactive", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ],
    direction: "UP",
    nextDirection: "UP",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  };

  const next = advanceState(state);

  assert.equal(next.status, "game_over");
});

test("phase upgrade allows moving through self", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ],
    direction: "UP",
    nextDirection: "UP",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
    activeEffects: {
      speed: 0,
      multiplier: 0,
      phase: 2,
    },
  };

  const next = advanceState(state);

  assert.equal(next.status, "running");
});

test("food spawns only in empty cells", () => {
  const food = spawnFood(
    2,
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    () => 0.99,
  );

  assert.deepEqual(food, { x: 1, y: 1 });
});

test("ignores opposite direction changes", () => {
  const initial = createInitialState({ gridSize: 10, rng: () => 0 });

  const next = changeDirection(initial, "LEFT");

  assert.equal(next.nextDirection, "RIGHT");
});

test("spawns an upgrade after countdown expires", () => {
  const state = {
    gridSize: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    nextDirection: "RIGHT",
    food: { x: 4, y: 4 },
    score: 0,
    status: "running",
    ticksUntilPowerUp: 1,
    powerUp: null,
    activeEffects: {
      speed: 0,
      multiplier: 0,
      phase: 0,
    },
  };

  const next = advanceState(state, sequence([0, 0.2]));

  assert.ok(next.powerUp);
  assert.ok(POWER_UP_TYPES.includes(next.powerUp.type));
  assert.notDeepEqual(next.powerUp, next.food);
  assert.ok(
    !next.snake.some(
      (segment) => segment.x === next.powerUp.x && segment.y === next.powerUp.y,
    ),
  );
});

test("multiplier upgrade doubles points for food", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ],
    direction: "RIGHT",
    nextDirection: "RIGHT",
    food: { x: 3, y: 1 },
    score: 0,
    status: "running",
    powerUp: { x: 2, y: 1, type: "multiplier" },
    ticksUntilPowerUp: 8,
    activeEffects: {
      speed: 0,
      multiplier: 0,
      phase: 0,
    },
  };

  const afterPickup = advanceState(state, () => 0);
  const afterFood = advanceState(afterPickup, () => 0);

  assert.equal(afterPickup.powerUp, null);
  assert.ok(afterPickup.activeEffects.multiplier > 0);
  assert.equal(afterFood.score, 2);
});
