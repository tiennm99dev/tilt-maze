# Third review: final verification

Date: 2026-10-25. Working tree only, nothing committed. Builds on
`plans/reports/review-261022-2124-whole-project-review.md` and
`plans/reports/review-261025-0846-second-review-fixes.md`; nothing listed there as fixed, rejected
or decided by the user is reopened.

## What changed, per group

- **rapier-dev-wasm-and-guard** (`vite.config.js`, `tests/unit/rapier-manual-wasm.test.js`,
  `tests/e2e/smoke.spec.js`, `docs/system-architecture.md`)
  - `optimizeDeps.exclude: ['@dimforge/rapier3d']`, and the `rapierManualWasm` filter accepts a
    `?v=` query, so the dev server also skips the package's own `.wasm` import. Before, dev
    pre-bundling bypassed the plugin.
  - A unit guard checks that the filter matches the resolved entry (with and without a query)
    and not `rapier_wasm3d_bg.js`. It also checks that the `rapier.js` → `exports.js` → `raw.js`
    → `rapier_wasm3d.js` chain and the entry's `.wasm` import still exist, so a Rapier upgrade
    that rewires them fails a test.
  - A new e2e test blocks `**/*.wasm`, expects the title error, unblocks, and expects the game
    to start in the same document.
  - The architecture doc gives the engine download as about 1.35 MB gzip.
- **main-flow-levels-retry** (`src/main.js`, `src/game/state-machine.js`,
  `tests/unit/state-machine.test.js`)
  - Back and Escape from the level list return to whatever opened it: title, pause or win.
    `levelSelect` may now go to `paused` and `won`. Going back to `won` re-shows the win screen
    and makes the HUD inert again.
  - The grid is rendered before `show()`, so focus lands on the first level button instead of
    Back.
  - Retry on the pause screen goes through `resume()` with `pausedFrom = 'ready'`, so it
    recalibrates the same way Resume does.
- **ui-a11y-and-layout** (`index.html`, `src/ui/screens.js`, `src/ui/hud.js`, `src/styles.css`)
  - The loading panel is focusable (`tabindex="-1"`, no outline) and takes focus. `#loading-text`
    is `role="status"` and `#title-error` is `role="alert"`.
  - Level buttons are labelled `Level N, locked`, `Level N, best 0:42.1` or `Level N, next`.
  - `#win-best` is emptied when it is hidden, because `aria-describedby` reads hidden text.
  - Mute keeps the label "Mute" and only toggles `aria-pressed`.
  - The toast sits just below the HUD row (safe-area aware) at z-index 9, under the menu
    screens (10).
  - A `max-width: 340px` block shrinks the HUD buttons and pills, so both pills share the row at
    320 px.
- **render-shader-reuse** (`src/game/game.js`)
  - `load()` takes the old board group off the scene, builds and draws the new one, and only
    then disposes the old meshes. The new materials pick up the cached programs first, so three
    does not delete and relink them.
- **docs-and-report-corrections** (`docs/game-design.md`,
  `plans/reports/review-261025-0846-second-review-fixes.md`)
  - The rotation note says the resume or retry tap recalibrates.
  - The landscape hint sentence states the real condition: up to 500 px tall and at least 7:4.
  - The second report now says both CI jobs run on `ubuntu-latest`.

## Fixes made during verification

- **Pause and win screens had no way back to the title** (`index.html`, `src/ui/screens.js`,
  `src/main.js`). This was a regression from the level-list change.
  - At HEAD, pause → Levels → Back was the only route from a run back to the title.
  - Once Back returned to the pause screen, Endless could no longer be reached after starting a
    campaign level without reloading the page. The same was true from a win, where Back now
    returns to the win screen.
  - Pause and win screens now have a **Menu** button (`quit` action). It goes to the title from
    `paused` or `won`, using transitions that already existed.
  - Checked in the browser:
    - win → Menu → Endless starts;
    - pause → Menu reaches the title;
    - the pause row wraps to 2×2 at 320 and 390 px, and to 3+1 at 568×320.
- **Win panel overflow on short landscape phones** (`src/styles.css`).
  - At 568×320, the win panel with "New best!" was 332 px of content in 286 px. Retry, Levels and
    Menu sat below the fold behind a scroll. The overflow was already there before the Menu
    button, which shares the row.
  - A `max-height: 400px` block tightens screen and panel padding, heading gaps, the win time
    (2.1rem) and the primary button.
  - Win, pause and settings panels now fit with no scroll at 568×320, 667×375 and 844×390:
    win 280/280, pause 244/244, settings 215/215, level list 270/270.

## Review notes (no change needed)

- Going back to `won` does not record the win twice. `onWin` fires only from the game loop's
  `pendingWin` timer, which has already cleared, so it never fires on a state change.
- Pause Retry without sensors does what it did before: `resume()` calls `resetClock()` and goes
  to `ready`.
- `load()` now calls `removeFromParent()` twice (once early, once inside `dispose()`). The second
  call does nothing.
- No review ids in comments, no local paths in the diff, no stray files. The only untracked file
  is the new unit test.

## Rejected findings

| Finding | Reason |
| --- | --- |
| A fall costs about 5.6 s, not the 5 s the "+5s" cue says | The measurement is right: falling 5.7 m takes about 0.59 s at 17.66 m/s². The penalty added is exactly `RULES.fallPenaltyMs`; the extra time is the ball visibly dropping, which the clock should count. |
| The Endless label format is parsed by regex in three modules with no test | No defect today: `main.js` writes `Endless #<hex>` and `Level N`, `hud.js` and `screens.js` parse exactly that, and the second report checked both in the browser. |

## Dropped as duplicates

| Item | Reason |
| --- | --- |
| new-code-2 | The same as the level-list focus and return fix, which was merged into the main-flow-levels-retry group with the won-return handling. |
| gameplay-levels-back-loses-run | The same as above. |

## Needs the user

- **Viewport `user-scalable=no`:** menus cannot be pinch-zoomed on Android.
  - Option A: remove the flag, add `touch-action: manipulation` to `.screen`, and accept that a
    zoom carried into play can only be undone from a menu.
  - Option B: keep the flag (current), for a fixed game viewport.

  Record the choice in the docs.
- **Menu button:** added during verification to restore the route to the title. Say if you
  would rather have the route elsewhere, for example an Endless tile in the level list.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | pass, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 16 files, 110 tests pass |
| `npm run build` | pass, no chunk-size warning |
| `npm run test:e2e` (`CHROMIUM_PATH=/usr/bin/chromium`) | 2 of 2 passed on the first run, twice: before and after the verification fixes (about 40 s, load average about 7) |

The build output keeps its shape: `rapier_wasm3d_bg-*.wasm` is 3,082.10 kB (1,187.63 kB gzip in
Vite's report), with `rapier` 103.44 kB, `world` 126.56 kB and `game` 554.70 kB.

Dev server (scratch port 5299, fresh dep cache, the real `vite.config.js`, Playwright with system
Chromium):

- One raw `.wasm` fetch per attempt, so the package's own `.wasm` import no longer runs in dev.
- With the `.wasm` blocked, Play shows "Could not start the game…". After unblocking, the second
  Play starts the game in the same document.

Production build (`vite preview` on 4188, agent-browser with system Chromium, session `r3-final`):

- **320×640, Level 1**
  - Both pills share the row at y=10. The stats pill ends at x=141, or x=150 with the time set to
    `10:00.0`, and the tilt indicator starts at x=155.
  - `scrollWidth` is 320. The hint is 16–304.
- **Loading:** focus is on the loading panel after Play.
- **Toast and pause** (toast forced visible with the no-sensors text):
  - At 740×360 and 568×320, `elementFromPoint` at the pause heading returns the heading, and at
    the toast's centre it returns pause-panel content.
  - The toast now draws under the pause screen.
- **Level list**
  - From title, pause and win, focus lands on `Level 1, next` (later `Level 1, best 1:13.4`).
    Labels read `Level 2, next` and `Level 3, locked`.
  - Back and Escape return to title, Paused (focus on Resume) and the win screen (focus on Next,
    HUD inert), matching the screen that opened the list.
- **Keyboard play of level 1** (arrow keys, 390×844)
  - Cleared three times with 0 falls.
  - The win dialog opened with focus on Next and "New best!" visible.
  - A slower third run (1:23.0) showed `0 falls · best 0:46.9`, with `#win-best` hidden and
    empty. The accessibility tree no longer reads "New best!".
- **Mute:** the label stays "Mute" while `aria-pressed` toggles between true and false.
- **Pause Retry (Endless, no sensors):** back to `ready`, the hint shows again and the time is
  0:00.0.
- **Console:** no console messages and no page errors for the whole session.
- **Shader reuse** (Playwright, swiftshader, three level reloads through pause → Levels → 1):
  - `linkProgram` stays at 10 and `deleteProgram` at 6 after the first load, so later loads add
    0 of each.
  - Over 15 Endless reloads (pause → Menu → Endless), buffers, textures, programs and
    framebuffers stay at 29, 8, 5 and 5.
  - Wasm memory stays at 1.44 MB.
- **Cleanup:** browser session closed, preview stopped, ports 4188, 5188 and 5299 free.

## Not fixed or not verified

- The title panel still scrolls by 19 px at 568×320: only the "No phone?" line falls below the
  fold, and all four buttons stay visible.
- Landscape windows narrower than 7:4 still keep the start hint at the bottom centre. This round
  only documents it.
- The no-sensors toast starts under the loading overlay (z-index 9 under 10) until the game
  reaches `ready`. This is accepted.
- Focus in the level list goes to the first enabled level, not to the `next` one.
- The pause-Retry recalibration with live sensors, and every other sensor path, still needs a
  real phone.
