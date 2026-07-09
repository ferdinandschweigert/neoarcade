# Brain Break Arcade

Eleven classic browser games for short brain breaks between work sessions — with friend sign-in and rankings on Vercel.

Play at **[neoarcade.vercel.app](https://neoarcade.vercel.app)**.

## Games (11 classics)

- Snake
- Tetris (Blockfall engine)
- 2048
- Pong
- Breakout
- Pac-Maze
- Asteroids
- Frogger
- Space Invaders
- Memory Match
- Minefield

## Features

- Cursor-inspired full-page layout
- Optional sign-in via **Sign in** link (top right) for friend rankings
- Play immediately without an account; guest scores stay on device
- Per-game and overall leaderboards
- Personal stats with progress visuals
- Difficulty and control settings
- Keyboard, touch, and gamepad support

## Code structure

- `index.html` — app shell and game cards
- `src/main.mjs` — runtime, auth wiring, game loop
- `src/games/*.mjs` — one file per game
- `api/*.js` — Vercel serverless routes (auth, scores, leaderboard, stats)
- `api/cloud.js` — legacy cloud snapshot sync

## Run locally

### UI only (guest play)

```bash
python3 start_arcade.py
```

### Full stack (auth + rankings APIs)

```bash
npx vercel dev
```

## Deploy to Vercel

1. Import the repo on [Vercel](https://vercel.com/new)
2. Framework preset: **Other**
3. Build command: leave empty
4. Output directory: `.`
5. Add environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NEO_ARCADE_INVITE_CODE` (optional — gates friend registration)

Push to `main` to auto-deploy.

## Tests

```bash
node --test tests/*.test.mjs
```

## Friend rankings

1. Open https://neoarcade.vercel.app
2. Sign up (enter invite code if configured on Vercel)
3. Play classics — bests sync to shared leaderboards
4. Check **Rankings** and **My Stats** tabs

Guest mode keeps scores in browser storage only and does not appear on leaderboards.
