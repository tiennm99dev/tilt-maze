# System architecture

A static single-page app: Vite bundles plain JavaScript modules, GitHub Pages serves them, and
everything runs in the browser.

## Boundaries

```
main.js ──── menu flow, state machine, storage, sound, sensor permission
   │  (dynamic import after the title screen paints)
   ▼
game/game.js ── render loop, fixed-step physics, falls and wins
   ├── input/      sensors + keyboard/drag → board tilt and shakes
   ├── level/      seeded maze, holes, layout boxes and floor mesh (pure)
   ├── physics/    Rapier world (all engine calls) + tilt-to-gravity maths
   └── render/     Three.js stage, board meshes
```

- **Pure modules** (`level/*`, `input/tilt-math.js`, `input/filter.js`,
  `input/shake-detector.js`, `game/loop.js`, `game/state-machine.js`, `storage.js`,
  `physics/gravity.js`) use no DOM or WebGL and carry the unit tests.
- **Browser glue** (`input/sensors.js`, `input/fallback.js`, `render/*`, `ui/*`, `audio/*`,
  `game/game.js`, `main.js`) is covered by the Playwright smoke spec and by hand. Small glue
  helpers that take their browser globals as arguments also have Vitest specs: the sensor
  permission, screen-angle and wake-lock helpers (`sensors.test.js`), the keyboard and drag
  fallback (`fallback.test.js`) and the portrait framing solver (`render/framing.js`).
- **`physics/world.js`** runs under Node too, so `physics.test.js` drives the real Rapier world
  on small hand-built boards (floor seams, shake height against the rim, wall tunnelling,
  holes, respawn). `vitest.config.js` loads the same `rapierManualWasm` plugin as the build (the
  dev server excludes Rapier from dependency pre-bundling, so the plugin applies there too), and
  Vite's `.wasm?init` loader reads the Rapier `.wasm` from disk instead of fetching it.

## Decisions

| Decision | Why | Rejected |
| --- | --- | --- |
| The board never moves in physics; tilt rotates gravity, and the drawn board turns by the same rotation | Resting contact against fixed colliders is the most stable case; falling off an edge needs no special code | A kinematic rotating board: jittery with noisy sensor input |
| Rapier (`@dimforge/rapier3d`) | The only maintained JS engine with continuous collision detection, which stops a fast ball tunnelling through thin walls | cannon-es (no CCD, dormant), ammo.js (stale npm build), a hand-written solver (more to tune) |
| Every Rapier call stays in `physics/world.js` | Rapier is 0.x and breaks between minors, so API changes stay in one file. The manual `.wasm` wiring (`world.js` imports and the `rapierManualWasm` filter in `vite.config.js`) depends on the package's file layout, which `tests/unit/rapier-manual-wasm.test.js` checks; run it after an upgrade | |
| Physics and drawing both build from `level/layout.js` boxes | What you see is exactly what the ball hits | |
| The engine chunk loads lazily | The title screen paints at once; Three.js and Rapier (about 1.35 MB gzip, almost all of it Rapier's `.wasm`) download in parallel while the player reads it | |
| Rapier's `.wasm` is a separate file that `physics/world.js` fetches and links itself | About 0.44 MB less to download than the base64 copy, and the browser compiles it while it streams in. A failed download only rejects the load, so the next tap fetches again; `vite.config.js` drops the package's own `.wasm` import to keep it that way | `@dimforge/rapier3d-compat` (base64 `.wasm` inside a 1.65 MB gzip JS chunk); `vite-plugin-wasm` or Vite's built-in `.wasm` import (a top-level await that leaves the module failed for good after one bad download) |
| iOS permission, audio unlock and wake lock run inside the first tap, before any `await` | iOS refuses the motion permission once the gesture has been awaited away | |
| Only the orientation permission decides sensor mode; motion only powers the shake | A refused motion prompt must not force drag mode when tilt works | |
| The wake lock is held only in play states, and the scene renders only while the board can move | Menus, pause and the win screen let the phone dim and stop drawing | |
| Sensors count as live only after a real reading within 1 s | Desktop Chrome exposes the API but never fires; in-app browsers deny silently | |
| Fixed 1/60 s physics step with an accumulator | Same behaviour on 60 Hz and 120 Hz screens | Stepping by frame time |
| Plain DOM overlay for menus and HUD | Cheaper and more accessible than UI drawn in the canvas | |
| Back from the level list returns to the screen that opened it (title, pause or win); the pause and win screens carry a Menu button | Back keeps the run; Menu is then the only route from a run to the title, Endless and title Settings | An Endless tile in the level list: it would bring back Endless but leave the title unreachable |
| One hand-written state machine | Rejects impossible transitions from late async callbacks; small enough to need no library | |
