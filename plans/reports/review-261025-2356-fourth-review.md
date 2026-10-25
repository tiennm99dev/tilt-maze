# Fourth review: final verification

Date: 2026-10-26. Working tree only, nothing committed. Builds on
`plans/reports/review-261022-2124-whole-project-review.md`,
`plans/reports/review-261025-0846-second-review-fixes.md` and
`plans/reports/review-261025-1646-third-review.md`; nothing listed there as fixed, rejected or
decided by the user is reopened. The user's earlier choices stand: Endless HUD shows only `∞`,
landscape hint beside the board, Rapier as a separate `.wasm` loaded by `world.js`, wake lock in
play states, no portrait lock.

## Advisor decisions

The user delegated the open decisions to an advisor this round.

| Item | Decision | Choice | Rationale |
| --- | --- | --- | --- |
| Open 1: Menu button | do (docs only) | Keep Menu on the pause and win screens; record it in the Decisions table of `docs/system-architecture.md`, with an Endless tile in the level list as the rejected alternative | Back from the level list returns to the run, so Menu is the only route from a run to the title, Endless and title Settings; an Endless tile would restore only Endless. The third round measured that the button rows fit at 320, 390 and 568×320 |
| Open 2: `user-scalable=no` | do | Remove the flag; `touch-action: manipulation` on `.screen` and `.hud`; keep `touch-action: none` on `#stage`; one sentence under "Look" in `docs/game-design.md` | WCAG 1.4.4 and Lighthouse flag the lock, and iOS has ignored it since iOS 10. The board still blocks pinch and double-tap; menus can be pinch-zoomed, and quick taps on buttons do not zoom. Accepted: a zoom carried into play is undone from a menu |
| Open 3: title scroll at 568×320 | do | Inside `@media (max-height: 400px)`: `h1 { font-size: 2rem; margin-bottom: 4px }`, `.tagline { margin-bottom: 12px }`. Do not hide the "No phone?" line | Measured: the title fits with no scroll and the two-line start error stays inside the panel. Hiding the help line would take the only static help from a sensorless device |
| Open 4: hint over the board, narrow landscape | do | New `(orientation: landscape) and (max-height: 500px) and (max-aspect-ratio: 7/4)` block tucks the hint under the board's near rim, placed before the 7:4+ side-strip block | Screenshots showed the hint covering the start ring at 600×400, 520×400, 660×380 and 640×480. The user's "beside the board" choice covers 7:4 and wider and is untouched |
| Open 5: level-list focus | do | `show()` focuses `.level-btn.next`, else the highest unlocked level, else the generic first button | Focus on Level 1 cost a player on level 7 six Tabs. The fallback matches what Play starts. No "current level from pause" variant |
| Tilt dot overflows at 340 px | do | `hud.js` writes unitless `--tx`/`--ty` (fraction of full tilt); CSS scales by `--travel`: 14 px, 12 px (440 px block), 9 px (340 px block) | A 14 px travel plus the 6 px dot radius crossed the 34 px ring by 3 px, and covered the ring at 40 px |
| Win Next/Retry skip calibration | do | `won` may go to `calibrating`; a shared `enterReady(g)` recalibrates when sensors steer and goes straight to `ready` without them. Used by `run()`, Next / New maze and win Retry. State-machine test added; documented in `docs/game-design.md` | Every other way into a run already recalibrated. A phone still tilted toward the last goal started the new maze's ball and clock within about 33-100 ms. The ~850 ms "Hold your phone" wait per Next is the accepted price |
| No-sensors toast on every start | do | `sensorsToastShown` flag: the toast shows once per page; the re-probe stays | Desktop players got the 6 s toast at every level start from a menu |
| Focus not returned to the opener | skip | Keep focusing the screen's primary action | Full-screen menus that replace each other; the opener is at most 3 Tabs away, and a return-focus store adds state for a marginal gain |
| Audio not resumed from the win screen | do | `sfx.resume()` at the top of the `next` and `winRetry` handlers; no window-wide listener | An AudioContext iOS suspended while the win screen was hidden stayed silent for the next level |
| Context restore disposes a dead target | do | `onRestored` in `src/render/scene.js` no longer calls `envTarget.dispose()`; `stage.dispose()` still does | Reproduced: 3 "object does not belong to this context" warnings from deletes of dead handles; nothing references the old target afterwards |
| E2E has no route back to the title | do | Extend the first smoke test: pause → Levels → Escape → Paused → Menu → title → Endless → ready with `Endless #…` | The third round's dead end was found only by hand |
| Rapier row in the architecture doc | do | Reword its Why cell to name the manual `.wasm` wiring and `tests/unit/rapier-manual-wasm.test.js` | "An upgrade touches one file" was no longer true |
| Smoke-spec row in the codebase summary | do | List boot, tilt, pause, the route back to the title and Endless, and the download retry | The row described a single boot test |
| Merged duplicates | — | `recent-code-open-item-5-focus-next-level`, `gameplay-open-5-level-list-focus` and `ui-a11y-level-list-focus-next` into open 5; `gameplay-open-1-menu-button` into open 1; `gameplay-open-2-user-scalable` and `tests-tooling-docs-4` into open 2; `gameplay-open-3-title-scroll` (its "hide `.small`" option skipped) into open 3; `gameplay-open-4-narrow-landscape-hint` superseded by the measured fix in open 4 | Same fixes |

## What changed

- **Flow** (`src/main.js`, `src/game/state-machine.js`, `tests/unit/state-machine.test.js`):
  `enterReady`, recalibration on Next / New maze / win Retry, `sfx.resume()` in the win
  handlers, the once-per-page toast, `won → calibrating`, and a unit test walking
  won → calibrating → ready and won → calibrating → paused.
- **Level-list focus** (`src/ui/screens.js`).
- **Layout** (`index.html`, `src/styles.css`, `src/ui/hud.js`): viewport flag removed,
  `touch-action: manipulation` on `.screen` and `.hud`, the tilt dot's `--travel`, the short
  landscape title, and the tucked hint for narrow landscape.
- **Render** (`src/render/scene.js`): no dispose of the dead environment target on restore.
- **Tests and docs** (`tests/e2e/smoke.spec.js`, `docs/game-design.md`,
  `docs/system-architecture.md`, `docs/codebase-summary.md`). The e2e step also waits for the
  resume calibration to close before its Escape, because Escape is ignored in `calibrating`.

## Fixes made during verification

- **Play failed without motion sensors** (`src/main.js`). This was a regression from the flow
  change. Without sensors, `enterReady` went straight from `permission` to `ready`, which the
  state machine rejects (`permission` allows only `calibrating` and `title`). Every desktop or
  sensorless start then threw "Illegal transition permission -> ready" and showed the title
  error. The second e2e test (no orientation events) would have failed. Fix: skip
  `calibrating` only when `fsm.can('ready')`. The first start still passes through
  `calibrating`, as it did at HEAD, where `calibrate()` returns at once without sensors, so no
  "Hold your phone" text is painted.
- **Doc wording** (`docs/game-design.md`): "recalibrates from the pose at the tap" contradicted
  the sentence before it (sampling starts 600 ms after the tap); it now says "recalibrates
  first".

## Review notes (no change needed)

- Fractions from `hud.js` stay within the ring: the filter caps the radial magnitude at
  `boardMaxDeg`, so a diagonal tilt cannot exceed 1.
- `.level-btn.next` is never disabled: it marks the highest unlocked level not yet cleared.
- A page hidden during the Next calibration counts as an interruption, so it ends in `paused`
  with `pausedFrom = 'ready'`, like Resume.
- No review ids in comments, no local paths in the diff, no stray files.

## Rejected findings

| Finding | Reason |
| --- | --- |
| Open item 1: keep the Menu button rather than an Endless tile | The analysis holds, but there is no defect to fix: `paused → title` and `won → title` are the only ways from a run to the title, and Menu provides both. Recorded as a decision row instead |
| The 555 kB game chunk is three's `WebGLRenderer` floor | Correct measurement, nothing to fix: a minimal `WebGLRenderer` + mesh bundle is the same size, so tree-shaking saves nothing |

## Needs the user

These were decided by the advisor on the user's delegation; say if either should change.

- **Pinch-zoom now allowed** (the third round's "Needs the user" item, option A). Menus can be
  zoomed on Android; a zoom carried into play is undone only from a menu. Option B (put
  `user-scalable=no` back) is a one-line revert plus the docs sentence.
- **Next and win Retry now wait ~850 ms on phones** for the "Hold your phone" calibration.
  Keyboard and drag play see no change.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | pass, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 16 files, 111 tests pass |
| `npm run build` | pass; `.wasm` 3,082.10 kB (1,187.63 kB gzip), `rapier` 103.44 kB, `world` 126.56 kB, `game` 554.69 kB |
| `npm run test:e2e` (`CHROMIUM_PATH=/usr/bin/chromium`) | 2 of 2 passed on the first run, after the verification fix (48 s, load average about 14) |

Production build (`vite preview` on 4188, agent-browser with system Chromium, session
`r4-final`):

- **Sensorless start (390×844):** Play reaches `ready` with "Drag or press an arrow key to
  start" and the no-sensors toast. Pause → Menu → Endless starts with no second toast
  (`Endless #…` in `#hud-level`).
- **Keyboard play of level 1:** cleared with arrow keys, 0 falls, "New best!", focus on Next.
- **Win Retry and Next without sensors:** both reach `ready` at 0:00.0 with the hint; the
  loading screen never shows.
- **Level list from pause:** focus on "Level 2, next" after clearing level 1; Escape returns to
  Paused with focus on Resume.
- **Tilt dot at full tilt** (dot edge / ring inner radius): 15/15 at 34 px (320 wide), 18/18 at
  40 px (390 and 420 wide), 20/20 at 44 px (800 wide), on axis and diagonal.
- **Touch action:** `.screen` and `#hud` `manipulation`, `#stage` `none`, `.hint` `auto`; the
  viewport has no `user-scalable`.
- **Hint box** (left, top, right, bottom), in `ready`:
  - tucked under the board: 600×400 153,366-447,394; 520×400 113,366-407,394; 660×380
    183,346-477,374; 640×480 173,446-467,474 (13.6 px text). The 520×400 screenshot shows it
    below the board's near rim, clear of the ball and start ring.
  - side strip unchanged: 568×320 12,221-115,308; 740×360 12,297-182,348.
  - 800×600 keeps the default hint (16 px). No horizontal scroll at any size.
- **Title at 568×320:** 294/294 with no error. With the `.wasm` blocked, the error ends at
  y=295 inside the panel (ends y=312), h1 at 32 px; the panel then scrolls 44 px, and only the
  "No phone?" line is below the fold.
- **Context lose/restore** (Level 2, 390×844, twice): no "object does not belong to this
  context" warnings. The deletes during restore are 1 framebuffer and 1 texture that are valid
  in the new context (the environment rebuild's own temporaries). The board redraws, and arrow
  keys still move the ball.
- **Console:** no errors or warnings, apart from the expected "Failed to fetch" while the
  `.wasm` was blocked on purpose.
- **Cleanup:** browser session closed, preview stopped, ports 4188 and 5188 free.

## Not verified

- Every sensor path on a real phone: recalibration on Next / New maze / win Retry, its
  interruption by hiding the page or rotating, and audio resuming from a hidden win screen on
  iOS.
- Pinch-zoom and double-tap behaviour on real touch devices (checked only through computed
  `touch-action`).
- Level-list focus with every level cleared was checked by the fixer, not again here.
