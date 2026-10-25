# Second review fixes: verification

Date: 2026-10-25. Working tree only, nothing committed.

## What changed, per group

- **main-screens** (`src/main.js`, `src/ui/screens.js`)
  - The first calibration in `run()` now uses the result of `calibrate()`. If calibration was
    interrupted (rotation, page hidden), the game goes to `paused` with `pausedFrom = 'ready'`,
    the same way `recalibrate()` handles it. It re-reads the state after the await.
  - `closeLevels` and `closeSettings` are now named functions. Escape on the level list or in
    settings calls the same code as the Back buttons.
  - `show()` focuses the first button that is neither disabled nor hidden, so on the last level's
    win screen focus goes to Retry instead of the hidden Next.
- **holes** (`src/level/holes.js`, `tests/unit/holes.test.js`, `docs/game-design.md`)
  - Crossroads are dropped from the candidates before placement. This draws no random numbers,
    so the output is unchanged.
  - A `spacedCount` helper (a leftmost-first greedy) and a look-ahead check now make sure as many
    forced holes are placed as the spacing rule allows. Campaign layouts are unchanged. Before
    the fix, 28 of 500 Endless seeds fell one forced hole short; now none do.
  - A new spec covers seeds 1 to 150, two braid values and three hole counts.
- **css** (`src/styles.css`)
  - Under 440px, `.level-long` is visually hidden instead of `display: none`, so screen readers
    still get the full level name.
  - `.falls::before` has a plain `content` fallback for browsers that do not support alt text
    in `content`.
  - `.hint` wraps inside `max-width: calc(100% - 32px)` instead of `nowrap`.
- **tooling** (`.github/workflows/deploy.yml`, `package.json`, `package-lock.json`, `README.md`,
  `docs/deployment-guide.md`)
  - CI drops `playwright install --with-deps` and uses the runner's `/usr/bin/google-chrome`
    through `CHROMIUM_PATH`. The build job runs on `ubuntu-24.04` with timeouts of 15 minutes for
    the job and 8 for the smoke test; the deploy job has a 10-minute timeout.
  - `engines.node` is now `^22.22.2 || ^24.15.0 || >=26`, the range the locked dev tools accept.

## Fixes made during verification

- `src/main.js`, keydown handler: the form-field guard ran before the Escape check, so Escape did
  nothing in Settings while the sensitivity slider or the invert checkbox had focus, which is
  where focus is right after changing a setting. The Escape-closes-dialog branch now runs before
  that guard. The pause and resume keys still ignore form fields.
- `docs/game-design.md`: reflowed an over-long line in the holes paragraph.

## Review notes (no change needed)

- Hole look-ahead: if a forced cell is skipped, it is never retried. That cannot lose the target.
  Any cell still open at the end would also have passed the check when it was first seen,
  because the holes placed after it, together with the remaining spaced set, stay a valid set.
- No review ids in comments, no stray files. `git status` shows only the 11 intended files.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | pass, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 15 files, 107 tests pass |
| `npm run build` | pass |
| `npm run test:e2e` (`CHROMIUM_PATH=/usr/bin/chromium`) | 1 of 1 passed on the first run (16.1s) |

Browser check of the production build (`vite preview` on 4188, agent-browser with system Chromium):

- **320x640**
  - The start hint wraps to two lines, 288x58 px, from x=16 to x=304.
  - `scrollWidth` is 320, so there is no horizontal scroll.
  - The HUD shows "Lv 1", and the accessibility tree reads "Level 1".
  - The falls glyph renders.
- **390x844**
  - The hint fits on one line (355x39 px).
  - `#hud-level` is the 1px visually hidden box; `#hud-level-short` is shown.
- **Escape**
  - Settings with the slider focused, and the level list, both return to the title.
  - Settings opened from pause, with the checkbox focused, returns to Paused.
  - In play, Escape pauses and a second Escape resumes.
- **Keyboard play:** level 1 cleared with the arrow keys and 0 falls. The win dialog opened with
  focus on Next.
- **Console:** no console messages and no page errors.
- **Cleanup:** the browser session is closed, the preview server is stopped, and ports 4188 and
  5188 are free.

## Not fixed or not verified

- The new CI path (runner Google Chrome instead of the Chromium Playwright bundles) only gets
  proven on the next push. The `ubuntu-24.04` pin has to move when GitHub retires that image.
- Win-screen focus on the last level (Next hidden) was checked by reading the code, not in the
  browser, because reaching level 10 by script was out of scope.
- Unchanged behaviour: Back or Escape from a level list opened from pause or a win still goes to
  the title, because the state machine only allows `levelSelect -> title`.
- Unchanged behaviour: when the level list opens, focus lands on Back, because the list is
  rendered after `show()` focuses a button.
- Cosmetic: a hint that wraps kept `border-radius: 999px` here; the user-approved changes below
  replace it with 20px (a pill on one line, a rounded box when it wraps).
- Unchanged behaviour: at 320x640 the stats pill still wraps to a second HUD row, about 8px
  short, on campaign levels too.
- Unchanged behaviour: the no-sensors toast (`top: 72px`, z-index 20) draws over the pause
  panel's heading in short landscape windows.
- Unchanged behaviour: short landscape windows narrower than 7:4 have no free strip beside the
  board, so the start hint stays at the bottom centre there.

## User-approved changes

Working tree only, nothing committed.

### What changed

- **Endless HUD label** (`src/ui/hud.js`, `src/ui/screens.js`, `index.html`, `src/styles.css`,
  `docs/game-design.md`)
  - The short level pill shows only `∞` in Endless (`Lv N` on campaign levels). The full
    `Endless #seed` stays in `#hud-level` for screen readers.
  - The short form now applies up to 600px wide instead of 440px: at 568x320 the full Endless
    name pushed the stats onto a second row.
  - The pause dialog has a new `#paused-level` line (also its `aria-describedby`) with the full
    level name. The Endless win details start with the seed, e.g.
    `seed #a16f9d99 · 2 falls · best 0:50.0`. Both read the text of `#hud-level`.
- **Landscape start hint** (`src/styles.css`, `docs/game-design.md`)
  - In landscape up to 500px tall and at least 7:4, the hint sits at the bottom left with
    `max-width: calc(50vw - 49vh - 12px - safe-area)`, the free strip left of the fully tilted
    board (`render/framing.js`).
  - The default hint radius is 20px instead of 999px.
- **Rapier as a separate `.wasm`** (`package.json`, `package-lock.json`, `vite.config.js`,
  `vitest.config.js`, `src/physics/world.js`, `src/main.js` comment, `docs/system-architecture.md`,
  `docs/deployment-guide.md`, `docs/project-roadmap.md`)
  - `@dimforge/rapier3d` ^0.21.0 replaces `@dimforge/rapier3d-compat`, whose `init()` always uses
    its inlined base64 copy. One lockfile (`package-lock.json`); no compat package remains in it.
  - The `rapierManualWasm` plugin in `vite.config.js` replaces the package entry with its plain
    JS glue, so the package never imports the `.wasm` itself (that compiles to a top-level await
    and would leave the module failed for good after one bad download).
  - `loadPhysics()` fetches the `.wasm` with Vite's `.wasm?init` loader, in parallel with the JS
    API, links it, and still drops a rejected promise so the next tap fetches again.
  - `chunkSizeWarningLimit` is down from 5000 to 600; the largest chunk is the 555 kB game chunk.

### Rapier download size (`dist/assets`, raw / `gzip -9` bytes)

| | Rapier JS | `world` chunk | `.wasm` | Total |
| --- | --- | --- | --- | --- |
| Before (compat) | 4,332,821 / 1,651,379 | 4,142 / 1,877 | inlined | 4,336,963 / 1,653,256 |
| After | 103,443 / 21,613 | 126,560 / 19,988 (includes the glue) | 3,082,103 / 1,168,731 | 3,312,106 / 1,210,332 |

About 0.44 MB less gzipped. The game chunk is unchanged at 554,668 / 137,792.

### Fixes made during verification

- `vitest.config.js` now loads `rapierManualWasm()` from `vite.config.js`. Without it Node also
  loaded the package's own `.wasm` import, printing an `ExperimentalWarning` and creating a second
  instance. The physics specs pass and the warning is gone.
- `docs/system-architecture.md`: the Vitest note names that plugin.

### Verification

| Check | Result |
| --- | --- |
| `npm run lint` | pass, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 15 files, 107 tests pass, no wasm warning |
| `npm run build` | pass, no chunk-size warning |
| `npm run test:e2e` (`CHROMIUM_PATH=/usr/bin/chromium`) | 1 of 1 passed on the first run |

Browser check of the production build (`vite preview` on 4188, agent-browser and Playwright with
system Chromium):

- **Network**
  - The `.wasm` is its own `fetch` request, served as `application/wasm` (3,082,103 bytes; the
    preview server does not compress).
  - Throttled to 1.6 Mbps and 150 ms latency, `game` and `world` start at 629 ms, the `.wasm`
    and `rapier` JS start at 1005 ms, and `game` finishes at 2106 ms, so the `.wasm` downloads
    alongside the game chunk.
  - No console errors or page errors on load.
- **Retry**
  - With `**/*.wasm` aborted, Play shows "Could not start the game. Check your connection and
    try again." on the title screen.
  - After removing the block, Play again fetches the `.wasm` (200) and the game starts (start
    hint shown, HUD "Level 1") in the same document, with no reload.
- **Endless at 360x740 and 390x844**
  - Both HUD pills share one row (y=10): the `∞` pill is 25px wide, the stats pill 99px.
  - The accessibility tree reads the full name, e.g. "Endless #32ab3bfe".
  - Pause shows "Endless #32ab3bfe" under the heading, and the dialog reads it.
  - Win screen: winning Endless by script was not feasible, so the real `showWin()` from
    `src/ui/screens.js` was run in the page. Endless gives `seed #a16f9d99 · 2 falls · best 0:50.0`,
    campaign `2 falls · best 0:50.0`.
- **Landscape start hint** (Level 1, screenshots checked)

  | Viewport | Hint box (left, top, right, bottom) | Overlaps HUD | Over board, ball or ring |
  | --- | --- | --- | --- |
  | 740x360 | 12, 297, 182, 348 | no | no |
  | 667x375 | 12, 276, 138, 363 | no | no |
  | 844x390 | 12, 327, 219, 378 | no | no |

- **Cleanup:** the browser session is closed, the preview server is stopped, and ports 4188 and
  5188 are free.

### Not verified

- That GitHub Pages serves the `.wasm` gzipped as `application/wasm` is only proven on the next
  push. Any other content type still works, but the browser then compiles after the download.
- The Endless win screen was checked through `showWin()`, not by clearing a maze.
