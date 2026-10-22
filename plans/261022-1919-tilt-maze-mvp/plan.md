---
title: "Tilt Maze: gyro-tilted 3D marble maze"
description: "Three.js + Rapier browser game where phone tilt steers a marble through a seeded maze, and a hard shake can fling it off the board."
status: completed
priority: P2
effort: 26h
branch: main
tags: [game, threejs, rapier, gyroscope, github-pages, javascript]
created: 2026-10-22
---

# Tilt Maze

Repo `tiennm99dev/tilt-maze` (public, non-production: verified work merges straight to `main`, no PR).
Live at `https://tiennm99dev.github.io/tilt-maze/`. The four research reports behind this plan
(gyro input, physics, game design, tooling) stayed in the author's workspace; their conclusions are
recorded in the decisions below and in `docs/game-design.md`.

## Decisions

| # | Area | Decision | Reason |
|---|------|----------|--------|
| 1 | Name | `tilt-maze`, title "Tilt Maze" | Descriptive; no clash in any of the 7 namespaces (`gh repo view` checked 2026-10-22); no `miti99` in a public product name |
| 2 | Audience | Personal game, others welcome | Per `audience.md`; the user's taste wins on defaults |
| 3 | Licence | Apache-2.0 | Matches `tiennm99dev/nntv` |
| 4 | Stack | Plain JS ES modules + JSDoc, Three.js, npm only | User requirement; `language-preferences.md` |
| 5 | Physics | `@dimforge/rapier3d-compat@^0.21.0`, loaded by dynamic `import()` after the title screen paints | Only maintained engine with CCD against thin walls; compat build needs no Vite wasm plugin; ~1.65 MB gzip is a one-time cached download |
| 6 | Tilt model | World geometry fixed; gravity = board tilt quaternion applied to `(0,-9.81·k,0)`; board group rotated by the same quaternion for rendering; ball mesh is a child of the board group, so physics coords are used verbatim | Most stable contact; fall-off from open edges is natural |
| 7 | Ball body | Dynamic sphere, `setCcdEnabled(true)`, `canSleep=false`, small angular damping | Fast flings must not tunnel; Rapier does not wake on gravity change |
| 8 | Sensors | `deviceorientation` (beta, gamma) for tilt, `devicemotion` for shake; no alpha, no Generic Sensor API | Works on iOS Safari and Android Chrome |
| 9 | Permission | "Tap to play" `click` handler calls `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()` (when present) before any `await`, plus Wake Lock and AudioContext resume in the same tap; sensors count as live only after a real event with non-null beta within 1 s | iOS gesture rule; desktop Chrome has the API but never fires |
| 10 | Tilt maths | Up vector `(-cos b·sin g, sin b, cos b·cos g)`, rotated by `screen.orientation.angle`; neutral = 250 ms average; correction `Quaternion.setFromUnitVectors(neutral, Z)`; pitch/roll via `asin` | No gimbal jump at gamma ±90° |
| 11 | Filter chain | Frame-rate-independent EMA (tau 80 ms) → dead zone 2° rescaled → phone tilt clamp ±25° mapped linearly to board tilt ±15° → sensitivity 0.5–2× and invert toggle | Research starting values; all in one `tuning.js` |
| 12 | Orientation | Portrait and landscape both work; recalibrate on `screen.orientation` change and on `visibilitychange` to visible; no rotate overlay | iOS cannot lock orientation; simpler than an overlay |
| 13 | Shake | `acceleration` magnitude (fallback: high-passed `accelerationIncludingGravity`, tau 300 ms) > 15 m/s², cooldown 500 ms; impulse direction = up + current tilt direction, size scales with excess over threshold, capped; applied only when grounded (short downward ray from ball) | Sign of raw axes varies by browser; no mid-air double jumps |
| 14 | Fly-off | Outer rim walls 0.7 ball diameters high, inner walls 1.2 diameters; normal tilt never ejects, a hard shake can hop inner walls or clear the rim | Fly-off is a deliberate-shake hazard, not a frequent accident |
| 15 | Fallback input | WASD/arrows set target tilt, pointer drag with spring-back, Space = shake; same filter chain. Drag is used automatically when sensors never fire (desktop, denied, in-app browsers like Zalo/Facebook) | One code path for all inputs; no on-screen jump button |
| 16 | Levels | Seeded PRNG (mulberry32) + Growing Tree (newest-pick bias ~0.9); grids 5x5 → 11x11; later levels remove 5–15% inner walls; holes on/next to the BFS solution path, off-centre leaving a 1.5-ball lane, none at start/goal, density 0 → 0.12 per path cell; 10 campaign seeds + Endless (random seed, difficulty 10) | Reproducible, testable, no level editor; endless costs nothing extra |
| 17 | Falls | Kill plane at y = -6 (board-local); no lives; fall = short drop, respawn at start, +5 s penalty | Holes and fly-off share one path |
| 18 | Camera / look | Fixed perspective camera above the board leaned 20° toward the player, frames whole board on resize; one directional light (shadow map 1024, `PCFShadowMap`) + hemisphere fill; flat-colour `MeshStandardMaterial`; inner walls merged into one geometry; pixel ratio capped at 2; no textures or post-processing | Readable on phones; ball shadow shows airborne state |
| 19 | Loop | rAF render; fixed physics step 1/60 s with accumulator, max 5 substeps, dt clamped at 0.1 s; pause on `visibilitychange` hidden | Deterministic physics independent of refresh rate |
| 20 | States | `title → permission → calibrating → ready → playing ⇄ paused`, `playing → falling → playing`, `playing → won → (next | levelSelect)`; one small state machine module, no library | KISS; testable transitions |
| 21 | Timer / saves | Timer starts on first non-zero input; one localStorage key `tilt-maze:v1` `{v:1, best:{[level]:ms}, unlocked, calibration?, sensitivity, invert, muted}` wrapped in try/catch; sequential unlock | Survives blocked storage |
| 22 | HUD / UI | DOM overlay: level, time, falls, pause, recalibrate, mute; screens: title, level select, win, pause, settings (sensitivity, invert) | Plain DOM is cheaper than in-canvas UI |
| 23 | Audio / haptics | WebAudio synthesised SFX (roll loop scaled by speed, wall hit, fall, win), mute toggle; `navigator.vibrate` where present, no iOS workaround | No asset pipeline |
| 24 | Build | Vite `^8.3.5`, `base: './'`, dev port 5188 with `strictPort`; `@vitejs/plugin-basic-ssl` only in `--mode lan` (`npm run dev:lan`) | Pages subpath and code-server proxy both work; no duplicate dev servers |
| 25 | Lint / types | ESLint `^10` flat config based on `tiennm99dev/mititgcloudbot/eslint.config.js` with `eslint-plugin-jsdoc` `flat/recommended-typescript-flavor`; `typescript@^7` `tsc -p jsconfig.json` (`checkJs`, `strict`, `noEmit`); `@types/three` with the same caret as `three`; iOS `requestPermission` typed by a JSDoc typedef + cast | Type safety without TS sources |
| 26 | Tests | Vitest `^5` (node env) for pure modules; Playwright (`@playwright/test`) one smoke spec run in CI on every push | Pure logic carries the risk; one e2e proves boot + sensor wiring |
| 27 | npm | `.npmrc` with `min-release-age=3`; one `package-lock.json`; no `allowScripts` needed (no install scripts in the tree) | Supply-chain delay per workspace npm conventions |
| 28 | Deploy | One workflow `.github/workflows/deploy.yml` from `nntv`'s, actions `checkout@v7`, `setup-node@v7` (Node 24), `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`; jobs: lint → typecheck → unit → e2e → build → deploy on `main`; Pages source set to "GitHub Actions" once | Phone testing needs trusted HTTPS; Pages gives it on every push |
| 29 | AgentKit | Commit `CLAUDE.md`; generate the standard `docs/` set via the installed docs-init skill; add `docs/game-design.md` holding the tuning rationale; `plans/` in-repo for future work | AgentKit ecosystem requirement |

## Non-goals (MVP)

Lives/game-over, follow camera, moving traps/ice/bumpers, level editor, online leaderboards, textures, post-processing, iOS vibration workaround, on-screen jump button, kinematic rotating board, non-compat Rapier build, One Euro filter (only if play-testing shows lag), PWA/offline, i18n.

## File layout (repo `tiennm99dev/tilt-maze`)

```
index.html                 canvas + DOM overlay root
src/main.js                bootstrap: title screen, lazy-load game
src/tuning.js              every tunable constant (tilt, shake, walls, physics, camera)
src/game/state-machine.js  states + transitions (pure)
src/game/game.js           wires input, physics, render, UI, timer; owns the loop
src/game/loop.js           fixed-step accumulator (pure)
src/input/tilt-math.js     beta/gamma → up vector, screen-angle rotation, calibration, pitch/roll (pure)
src/input/filter.js        EMA, dead zone, clamp/map, sensitivity, invert (pure)
src/input/shake-detector.js threshold, high-pass fallback, cooldown (pure)
src/input/sensors.js       permission flow, listeners, liveness probe, wake lock
src/input/fallback.js      keyboard + pointer drag
src/input/input.js         merges sources → {pitch, roll} + shake events
src/level/rng.js           mulberry32 (pure)
src/level/maze.js          Growing Tree, wall removal, BFS solution (pure)
src/level/holes.js         hole placement (pure)
src/level/levels.js        campaign seeds + difficulty table + endless (pure)
src/physics/world.js       Rapier init, colliders from level, ball, gravity, grounded ray, kill plane
src/render/scene.js        renderer, camera framing, lights, resize
src/render/board-mesh.js   floor with holes, merged walls, goal marker, ball
src/ui/screens.js          title, level select, pause, settings, win
src/ui/hud.js              level, time, falls, buttons
src/audio/sfx.js           WebAudio synth + vibrate
src/storage.js             versioned localStorage with try/catch
src/styles.css
tests/unit/*.test.js       rng, maze, holes, levels, tilt-math, filter, shake-detector, loop, state-machine, storage
tests/e2e/smoke.spec.js
vite.config.js  eslint.config.js  jsconfig.json  vitest.config.js  playwright.config.js
.npmrc  .gitignore  LICENSE  README.md  CLAUDE.md  docs/  .github/workflows/deploy.yml
```

## Phases

| # | Phase | Blocked by | Files owned | Effort |
|---|-------|-----------|-------------|--------|
| 1 | Scaffold, tooling, CI, Pages deploy of a spinning-cube page | — | configs, `index.html`, `src/main.js` stub, workflow, LICENSE, README, CLAUDE.md, `.npmrc` | 3h |
| 2 | Level generation (pure + unit tests) | 1 | `src/level/*`, matching tests | 4h |
| 3 | Input (pure maths + sensors + fallback + tests) | 1 | `src/input/*`, `src/tuning.js` (input section), matching tests | 5h |
| 4 | Physics + rendering + fixed loop, playable with keyboard | 2 | `src/physics/*`, `src/render/*`, `src/game/loop.js`, `src/tuning.js` (physics/render section) | 6h |
| 5 | Game states, HUD, screens, storage, audio, shake hook-up, full input wiring | 3, 4 | `src/game/*`, `src/ui/*`, `src/audio/*`, `src/storage.js`, `src/main.js`, `src/styles.css`, e2e spec | 5h |
| 6 | Docs set, real-phone tuning pass, README | 5 | `docs/*`, `README.md`, `src/tuning.js` values only | 3h |

Phases 2 and 3 run in parallel. `src/tuning.js` is created in phase 1 with empty sections; phases 3 and 4 edit only their own section (sequence the edits if run in parallel worktrees).

Each phase ends with `npm run lint && npm run typecheck && npm test && npm run build` green, then commit to `main` and push (Pages redeploys; no running service restarts).

## Acceptance criteria

1. `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` all pass locally and in the Actions run on `main`; the Pages URL serves the game over HTTPS.
2. Unit tests prove: same seed → identical maze; every maze is a spanning tree before wall removal (cells − 1 passages, all reachable); BFS path joins start to goal; no hole on start/goal cell and every hole leaves the lane open; level table is monotonic in size and hole density; tilt maths gives no discontinuity across gamma ±90°; calibrated neutral pose → pitch = roll = 0; dead zone, clamp, sensitivity, invert behave per `tuning.js`; shake fires once above threshold and not again within the cooldown; state machine rejects illegal transitions; storage survives a throwing `localStorage` and an unknown version.
3. Playwright smoke (headless Chromium on `http://localhost`): canvas has a WebGL context, no console errors, a dispatched `deviceorientation` event changes the reported board tilt.
4. On an iPhone (Safari) and an Android phone (Chrome) via the Pages URL: Tap to play shows the iOS permission prompt; after granting, tilting rolls the ball in the matching direction in portrait and in both landscape directions; recalibrate re-zeroes at the current hold angle.
5. On those phones, a hard shake while the ball is grounded makes it hop an inner wall or leave the board; a normal max tilt never ejects it; falling through a hole or off the edge respawns at start with +5 s and falls +1.
6. Denying permission (or desktop) leaves the game playable by drag and by WASD/arrows + Space.
7. Reaching the goal shows the win screen with time, saves the best time and unlocks the next level; reload keeps progress; Endless generates a new solvable maze each run.
8. Frame rate holds about 60 fps on a mid-range Android phone on the 11x11 level (checked with the Chrome remote-inspect performance panel).
9. No local machine paths, no `miti99` product naming, no AI attribution in any commit.

## Risks

| Risk | L x I | Mitigation |
|------|-------|-----------|
| Landscape sign conventions wrong on a real device | M x H | Screen-angle rotation isolated in `tilt-math.js` with tests per angle; phone check in phase 6 |
| Rapier 0.x API drift | M x M | Caret `^0.21.0` holds below 0.22; all Rapier calls confined to `src/physics/world.js` |
| Shake feel wrong (too easy / impossible) | H x M | All thresholds in `tuning.js`; phase 6 tuning on real phones |
| 1.65 MB physics download slows first load | M x L | Dynamic import after the title paints; loading indicator on Tap to play |
| In-app browsers deny sensors silently | M x M | 1 s liveness probe falls back to drag automatically |

## Rollback

Each phase is one or more commits on `main`; revert them with `git revert` and the next push redeploys the previous build. Pages keeps serving the last successful deploy if a workflow fails.

## Unresolved questions

1. Is a ~1.65 MB physics download acceptable on mobile data, or should the custom sphere-vs-box solver replace Rapier? (Plan assumes acceptable.)
2. Fly-off is set as a deliberate-shake hazard (rim 0.7 ball diameters, board tilt cap 15°); does the user want it more frequent?
3. Does the self-signed `dev:lan` route on a home LAN machine deliver orientation events on the user's phones? (Pages remains the primary phone-test route.)

## Implementation status (2026-10-22)

Phases 1 to 5 are built and verified: lint, type check, unit tests, the Playwright smoke spec and
the build pass locally and in CI, and the game is live on GitHub Pages. Phase 6 is half done: the
docs set exists, but the real-phone checks in acceptance criteria 4, 5 and 8 (iOS permission prompt,
landscape signs, shake feel, frame rate) still need a person holding an iPhone and an Android phone.

Deviations from the file layout above:

- `src/level/layout.js` turns a level into boxes once, so physics and rendering build from the
  same geometry instead of each computing it.
- `src/physics/gravity.js` holds the tilt-to-gravity maths, so it is unit-tested without Rapier.
- `src/ui/dom.js` holds the two DOM helpers shared by the HUD and the screens.
- Holes are square floor openings, not round ones, so the drawn hole matches the physics
  opening exactly.
- `vite` resolves to 8.3.4 and `eslint-plugin-jsdoc` to 65.3.x: the newest releases were younger
  than the three-day `min-release-age` window on the day of the build.
- Keyboard Space is a 1.8× shake, not a fixed 1×, so desktop players can hop an inner wall.
