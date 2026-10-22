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
   ├── level/      seeded maze, holes, layout boxes (pure)
   ├── physics/    Rapier world (all engine calls) + tilt-to-gravity maths
   └── render/     Three.js stage, board meshes
```

- **Pure modules** (`level/*`, `input/tilt-math.js`, `input/filter.js`,
  `input/shake-detector.js`, `game/loop.js`, `game/state-machine.js`, `storage.js`,
  `physics/gravity.js`) use no DOM or WebGL and carry the unit tests.
- **Browser glue** (`input/sensors.js`, `input/fallback.js`, `render/*`, `ui/*`, `audio/*`,
  `game/game.js`, `main.js`) is covered by the Playwright smoke spec and by hand.

## Decisions

| Decision | Why | Rejected |
| --- | --- | --- |
| The board never moves in physics; tilt rotates gravity, and the drawn board turns by the same rotation | Resting contact against fixed colliders is the most stable case; falling off an edge needs no special code | A kinematic rotating board: jittery with noisy sensor input |
| Rapier (`@dimforge/rapier3d-compat`) | The only maintained JS engine with continuous collision detection, which stops a fast ball tunnelling through thin walls | cannon-es (no CCD, dormant), ammo.js (stale npm build), a hand-written solver (more to tune) |
| Every Rapier call stays in `physics/world.js` | Rapier is 0.x and breaks between minors; an upgrade touches one file | |
| Physics and drawing both build from `level/layout.js` boxes | What you see is exactly what the ball hits | |
| The engine chunk loads lazily | The title screen paints at once; Three.js and the ~1.7 MB (gzip) Rapier chunk download while the player reads it | |
| iOS permission, audio unlock and wake lock run inside the first tap, before any `await` | iOS refuses the motion permission once the gesture has been awaited away | |
| Only the orientation permission decides sensor mode; motion only powers the shake | A refused motion prompt must not force drag mode when tilt works | |
| The wake lock is held only in play states, and the scene renders only while the board can move | Menus, pause and the win screen let the phone dim and stop drawing | |
| Sensors count as live only after a real reading within 1 s | Desktop Chrome exposes the API but never fires; in-app browsers deny silently | |
| Fixed 1/60 s physics step with an accumulator | Same behaviour on 60 Hz and 120 Hz screens | Stepping by frame time |
| Plain DOM overlay for menus and HUD | Cheaper and more accessible than UI drawn in the canvas | |
| One hand-written state machine | Rejects impossible transitions from late async callbacks; small enough to need no library | |
