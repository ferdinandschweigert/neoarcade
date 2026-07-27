import test from "node:test";
import assert from "node:assert/strict";
import { createPongGame } from "../src/games/pong.mjs";
import { CANVAS_SIZE } from "../src/games/shared.mjs";

function stubContext() {
  return {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect() {},
    arc() {},
    fill() {},
  };
}

function trackBallWithPlayer(game) {
  const state = game.getDebugState();
  const paddleHeight = 88;
  const center = state.playerY + paddleHeight / 2;
  const delta = state.ballY - center;
  state.input.up = delta < -8;
  state.input.down = delta > 8;
}

test("pong CPU lets a competent player score points on normal", () => {
  const game = createPongGame(stubContext());
  game.setDifficulty("normal");
  game.start();

  let scored = false;
  for (let tick = 0; tick < 12000; tick += 1) {
    trackBallWithPlayer(game);
    game.tick();
    const state = game.getDebugState();
    if (state.playerScore > 0) {
      scored = true;
      break;
    }
    if (state.status === "game_over") {
      break;
    }
  }

  assert.equal(scored, true, "player should be able to score against the CPU");
});

test("pong CPU can miss returns instead of always blocking", () => {
  let playerPoints = 0;
  let cpuReturnsBlockedForever = true;

  for (let match = 0; match < 8; match += 1) {
    const game = createPongGame(stubContext());
    game.setDifficulty("easy");
    game.start();

    for (let tick = 0; tick < 9000; tick += 1) {
      trackBallWithPlayer(game);
      game.tick();
      const state = game.getDebugState();
      if (state.playerScore > 0) {
        playerPoints += state.playerScore;
        cpuReturnsBlockedForever = false;
        break;
      }
      if (state.status === "game_over") {
        break;
      }
    }
  }

  assert.ok(playerPoints >= 3, `expected several player points across matches, got ${playerPoints}`);
  assert.equal(cpuReturnsBlockedForever, false);
});

test("pong match can end with either side winning on easy", () => {
  let playerWins = 0;
  let cpuWins = 0;

  for (let match = 0; match < 16; match += 1) {
    const game = createPongGame(stubContext());
    game.setDifficulty("easy");
    game.start();

    // Alternate between a solid player and a sloppy one.
    const sloppy = match % 2 === 1;
    const lag = sloppy ? 36 : 8;

    for (let tick = 0; tick < 50000; tick += 1) {
      const state = game.getDebugState();
      const paddleHeight = 88;
      const desired = clampDesired(state.ballY - paddleHeight / 2 + (sloppy ? 22 : -6));
      // Only correct when meaningfully off — mimics human reaction lag.
      if (tick % (sloppy ? 3 : 1) === 0) {
        state.input.up = state.playerY > desired + lag;
        state.input.down = state.playerY < desired - lag;
      }
      game.tick();

      if (state.status === "game_over") {
        if (state.playerScore > state.cpuScore) {
          playerWins += 1;
        } else {
          cpuWins += 1;
        }
        break;
      }
    }
  }

  assert.ok(playerWins >= 1, `player should win some matches, got ${playerWins}`);
  assert.ok(cpuWins >= 1, `CPU should still win some matches, got ${cpuWins}`);
});

function clampDesired(y) {
  const paddleHeight = 88;
  return Math.max(0, Math.min(CANVAS_SIZE - paddleHeight, y));
}
