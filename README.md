# NeoArcade

Minimal browser arcade with 42 games, profile-based scores, difficulty settings, category filters, and gamepad support.

Scores are saved per profile and per game in browser storage and persist across restarts.

## Code structure

- `src/main.mjs`: menu/runtime/filtering/input wiring
- `src/games/shared.mjs`: shared canvas/math helpers
- `src/games/*.mjs`: one file per game

## Games

- Snake (wall-wrap + collectible upgrades)
- Pong
- Breakout
- Pac-Maze (Pac-Man style)
- Blaster
- Dodger
- Blockfall (advanced line-clearing puzzle)
- Tron Trail
- Sky Runner
- Orbit Dodge
- 2048 Grid
- Tic-Tac-Toe
- Connect Four
- Lights Out
- Memory Match
- Minefield
- Frogger Rush
- Gem Catch
- Quick Draw
- Labyrinth Heist (guard pathfinding)
- Roguelite Grid (procedural dungeon run)
- Asteroids Drift
- Flappy Neon
- River Raid
- Air Hockey
- Slide Quest
- Reversi Royale (sophisticated strategy board AI)
- Bomber Vault (sophisticated maze/combat loop)
- Portal Dash
- Stacker Rush
- Color Flood
- Backgammon
- Invaders Command
- Heli Tunnel
- Sokoban Crates
- Battleship Grid
- Mastermind Code
- Tower of Hanoi
- Neon Drifter
- Turret Defense
- Word Hunt
- Quantum Flip
## Run (auto-opens browser)

```bash
python3 start_arcade.py
```

The launcher chooses a stable local port automatically (prefers `18765`) and reuses it.

## Desktop icon launch

### macOS

Best option (custom app icon + one click):

1. Run:
   ```bash
   ./CreateDesktopArcadeApp.command
   ```
2. Double-click `Neo Arcade.app` on Desktop.
   - It starts in the background (no Terminal window) and opens your browser automatically.
3. If macOS still shows the old generic icon, remove and recreate:
   ```bash
   rm -rf ~/Desktop/Neo\ Arcade.app
   ./CreateDesktopArcadeApp.command
   ```
4. If macOS blocks launch once, allow it and/or run:
   ```bash
   xattr -d com.apple.quarantine ~/Desktop/Neo\ Arcade.app
   ```

Alternative (`.command` launcher):

1. Copy `LaunchArcade.command` to Desktop.
2. Double-click it.
3. If you already copied an older launcher, replace it with the latest one:
   ```bash
   cp /Users/ferdinandschweigert/Documents/neoarcade/LaunchArcade.command ~/Desktop/
   chmod +x ~/Desktop/LaunchArcade.command
   ```
4. Optional custom icon: open `assets/arcade-mark.svg` (or generated `assets/arcade-mark.png`) in Preview, copy it, then `Get Info` on `~/Desktop/LaunchArcade.command` and paste onto the top-left icon.

### Windows

1. Copy `LaunchArcade.bat` to Desktop.
2. Double-click it.

## Manual run

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 once and bookmark it.

## Test core Snake logic

```bash
node --test tests/gameLogic.test.mjs
```


## Cloud profiles (same data on any device)

For remote profile + high-score sync, deploy on Vercel and add Upstash Redis:

1. In Vercel Storage, create a **KV (Upstash Redis)** database.
2. Add env vars to the project:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy.
4. In NeoArcade, enter a **Cloud ID** (same ID on your other device) once.

After that, sync runs automatically in the background (profiles, active profile, difficulty, and high scores).

## Deploy to Vercel

1. Open [Vercel](https://vercel.com/new) and import `ferdinandschweigert/neoarcade`.
2. Framework preset: `Other`.
3. Build command: leave empty.
4. Output directory: `.`
5. Click **Deploy**.

After that, every push to `main` auto-deploys.
