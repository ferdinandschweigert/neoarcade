import { directionFromKey } from "../gameLogic.mjs";
import { CANVAS_SIZE, clearCanvas, drawDot, clamp } from "./shared.mjs";

const TURN_SPEED = 0.09;
const THRUST = 0.22;
const MAX_SPEED = 6.3;
const FIRE_COOLDOWN = 8;

export function createAsteroidsGame(ctx) {
  let bestScore = 0;
  let state = createState();

  function createState() {
    return {
      status: "running",
      score: 0,
      lives: 3,
      wave: 1,
      fireCooldown: 0,
      invuln: 0,
      input: {
        left: false,
        right: false,
        thrust: false,
        fire: false,
      },
      ship: {
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
      },
      bullets: [],
      rocks: createWave(1),
    };
  }

  function createWave(wave) {
    const count = Math.min(10, 3 + wave);
    const rocks = [];
    for (let i = 0; i < count; i += 1) {
      const edge = i % 4;
      const radius = 18 + Math.random() * 14;
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = Math.random() * CANVAS_SIZE;
        y = -20;
      } else if (edge === 1) {
        x = CANVAS_SIZE + 20;
        y = Math.random() * CANVAS_SIZE;
      } else if (edge === 2) {
        x = Math.random() * CANVAS_SIZE;
        y = CANVAS_SIZE + 20;
      } else {
        x = -20;
        y = Math.random() * CANVAS_SIZE;
      }

      rocks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2.6,
        vy: (Math.random() - 0.5) * 2.6,
        radius,
      });
    }
    return rocks;
  }

  function wrapPosition(obj) {
    if (obj.x < -30) obj.x = CANVAS_SIZE + 30;
    if (obj.x > CANVAS_SIZE + 30) obj.x = -30;
    if (obj.y < -30) obj.y = CANVAS_SIZE + 30;
    if (obj.y > CANVAS_SIZE + 30) obj.y = -30;
  }

  function shoot() {
    if (state.fireCooldown > 0) {
      return false;
    }

    state.fireCooldown = FIRE_COOLDOWN;
    const muzzle = 14;
    const speed = 8.8;
    state.bullets.push({
      x: state.ship.x + Math.cos(state.ship.angle) * muzzle,
      y: state.ship.y + Math.sin(state.ship.angle) * muzzle,
      vx: state.ship.vx + Math.cos(state.ship.angle) * speed,
      vy: state.ship.vy + Math.sin(state.ship.angle) * speed,
      life: 60,
    });
    return true;
  }

  function handleShipHit() {
    if (state.invuln > 0 || state.status !== "running") {
      return;
    }

    state.lives -= 1;
    state.invuln = 84;
    state.ship.x = CANVAS_SIZE / 2;
    state.ship.y = CANVAS_SIZE / 2;
    state.ship.vx = 0;
    state.ship.vy = 0;

    if (state.lives <= 0) {
      state.status = "game_over";
      state.lives = 0;
      state.input.fire = false;
      state.input.left = false;
      state.input.right = false;
      state.input.thrust = false;
    }
  }

  function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  return {
    title: "Asteroids Drift",
    controlScheme: "grid_select",
    start() {
      state = createState();
    },
    stop() {
      if (state.status === "running") {
        state.status = "paused";
      }
    },
    tick() {
      if (state.status !== "running") {
        return;
      }

      if (state.input.left) {
        state.ship.angle -= TURN_SPEED;
      }
      if (state.input.right) {
        state.ship.angle += TURN_SPEED;
      }
      if (state.input.thrust) {
        state.ship.vx += Math.cos(state.ship.angle) * THRUST;
        state.ship.vy += Math.sin(state.ship.angle) * THRUST;
      }

      state.ship.vx *= 0.992;
      state.ship.vy *= 0.992;
      state.ship.vx = clamp(state.ship.vx, -MAX_SPEED, MAX_SPEED);
      state.ship.vy = clamp(state.ship.vy, -MAX_SPEED, MAX_SPEED);

      state.ship.x += state.ship.vx;
      state.ship.y += state.ship.vy;
      wrapPosition(state.ship);

      if (state.fireCooldown > 0) {
        state.fireCooldown -= 1;
      }

      if (state.input.fire) {
        shoot();
      }

      for (const bullet of state.bullets) {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life -= 1;
        wrapPosition(bullet);
      }
      state.bullets = state.bullets.filter((bullet) => bullet.life > 0);

      for (const rock of state.rocks) {
        rock.x += rock.vx;
        rock.y += rock.vy;
        wrapPosition(rock);
      }

      const newRocks = [];
      for (const rock of state.rocks) {
        let destroyed = false;

        for (const bullet of state.bullets) {
          const hitRadius = rock.radius + 2;
          if (distanceSq(rock, bullet) <= hitRadius * hitRadius) {
            bullet.life = 0;
            destroyed = true;
            state.score += Math.round(12 + rock.radius);
            if (rock.radius > 16) {
              for (let i = 0; i < 2; i += 1) {
                const angle = Math.random() * Math.PI * 2;
                newRocks.push({
                  x: rock.x,
                  y: rock.y,
                  vx: Math.cos(angle) * (2 + Math.random() * 1.5),
                  vy: Math.sin(angle) * (2 + Math.random() * 1.5),
                  radius: rock.radius * 0.62,
                });
              }
            }
            break;
          }
        }

        if (!destroyed) {
          newRocks.push(rock);
        }
      }

      state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
      state.rocks = newRocks;

      if (state.invuln > 0) {
        state.invuln -= 1;
      } else {
        for (const rock of state.rocks) {
          const hitRadius = rock.radius + 11;
          if (distanceSq(rock, state.ship) <= hitRadius * hitRadius) {
            handleShipHit();
            break;
          }
        }
      }

      if (state.status === "running" && state.rocks.length === 0) {
        state.wave += 1;
        state.score += 50;
        state.rocks = createWave(state.wave);
      }

      if (state.score > bestScore) {
        bestScore = state.score;
      }
    },
    render() {
      clearCanvas(ctx, "#050913");

      ctx.fillStyle = "rgba(146, 187, 255, 0.35)";
      for (let i = 0; i < 70; i += 1) {
        const x = (i * 67) % CANVAS_SIZE;
        const y = (i * 41 + state.wave * 17) % CANVAS_SIZE;
        drawDot(ctx, x, y, (i % 3) + 0.7);
      }

      for (const rock of state.rocks) {
        ctx.strokeStyle = "#89a0c2";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "#f8fafc";
      for (const bullet of state.bullets) {
        drawDot(ctx, bullet.x, bullet.y, 2.2);
      }

      const blink = state.invuln > 0 && state.invuln % 10 < 5;
      if (!blink) {
        ctx.save();
        ctx.translate(state.ship.x, state.ship.y);
        ctx.rotate(state.ship.angle);
        ctx.strokeStyle = "#f4d20b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(-11, -9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-11, 9);
        ctx.closePath();
        ctx.stroke();

        if (state.input.thrust) {
          ctx.strokeStyle = "#ef4444";
          ctx.beginPath();
          ctx.moveTo(-9, -3);
          ctx.lineTo(-15 - Math.random() * 4, 0);
          ctx.lineTo(-9, 3);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    onKeyDown(keyText) {
      const key = String(keyText).toLowerCase();

      if (key === " ") {
        this.togglePause();
        return true;
      }

      if (key === "enter" && state.status === "game_over") {
        this.restart();
        return true;
      }

      const direction = directionFromKey(keyText);
      if (direction === "LEFT") {
        state.input.left = true;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = true;
        return true;
      }
      if (direction === "UP") {
        state.input.thrust = true;
        return true;
      }

      if (key === "f" || key === "q" || key === "e") {
        state.input.fire = true;
        shoot();
        return true;
      }

      return false;
    },
    onKeyUp(keyText) {
      const direction = directionFromKey(keyText);
      if (direction === "LEFT") {
        state.input.left = false;
        return true;
      }
      if (direction === "RIGHT") {
        state.input.right = false;
        return true;
      }
      if (direction === "UP") {
        state.input.thrust = false;
        return true;
      }

      const key = String(keyText).toLowerCase();
      if (key === "f" || key === "q" || key === "e") {
        state.input.fire = false;
        return true;
      }

      return false;
    },
    onControl(action) {
      if (action === "LEFT") {
        state.ship.angle -= TURN_SPEED * 2.4;
        return true;
      }
      if (action === "RIGHT") {
        state.ship.angle += TURN_SPEED * 2.4;
        return true;
      }
      if (action === "UP") {
        state.ship.vx += Math.cos(state.ship.angle) * THRUST * 3;
        state.ship.vy += Math.sin(state.ship.angle) * THRUST * 3;
        return true;
      }
      if (action === "SELECT") {
        return shoot();
      }
      return false;
    },
    togglePause() {
      if (state.status === "game_over") {
        return;
      }
      state.status = state.status === "paused" ? "running" : "paused";
    },
    restart() {
      state = createState();
    },
    getTickMs() {
      return 16;
    },
    getHud() {
      const scoreLine = `Score: ${state.score} | Lives: ${state.lives} | Wave: ${state.wave} | Best: ${bestScore}`;
      if (state.status === "game_over") {
        return {
          score: scoreLine,
          status: "Hull destroyed. Press Restart or Enter.",
          pauseLabel: "Pause",
          pauseDisabled: true,
        };
      }
      if (state.status === "paused") {
        return {
          score: scoreLine,
          status: "Paused. Press Pause or Space to continue.",
          pauseLabel: "Resume",
          pauseDisabled: false,
        };
      }
      return {
        score: scoreLine,
        status: "Steer with arrows/WASD, thrust up, fire with Select or F.",
        pauseLabel: "Pause",
        pauseDisabled: false,
      };
    },
  };
}
