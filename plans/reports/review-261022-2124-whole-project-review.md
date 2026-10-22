# Whole-project review: final verification

Date: 2026-10-22. Scope: the whole repo, reviewed in four areas (input, physics-game-levels,
render-ui-audio, tooling-docs). Each area's fixer applied its findings; a final verifier then
checked the combined diff, ran every check, played the build in a browser and shipped it.

## Shipped

| Commit | Area |
| --- | --- |
| `377e67f` | fix(physics): roll the ball on one floor mesh instead of seamed boxes |
| `a0b8f4e` | feat(levels): keep loops from collapsing the route and make holes count |
| `75cf253` | fix(input): stop game keys leaking into menus and stuck inputs |
| `eaa2786` | feat(play): clearer falls, wins, HUD and pause on phones |
| `c415515` | ci: least-privilege Pages deploy, zero lint warnings, failure traces |

Deploy run `39848124130` passed both jobs (build, deploy). The live site serves the new build:
its `index-*.js` hash matches the local build, and the page has the new "Play" and "Esc to
pause" text.

## Verification

- `npm run lint` (now `--max-warnings=0`), `npm run typecheck`, `npm test` (15 files, 106
  tests), `npm run build`: all pass.
- `npm run test:e2e`: passed 4 of 4 runs after the timeout fix below. CI's smoke test passed in
  10 s.
- Browser smoke play of the production build at 390×844 (agent-browser, system Chromium):
  - Keyboard fallback, no sensors: level 1 cleared with the arrow keys. The win screen showed
    "Level 1 complete", "0 falls", "New best!" and "Next level".
  - Synthetic `deviceorientation`: the board tilted and the ball rolled. The hint hid on the
    first input.
  - Board tilted toward the rim plus a hard synthetic `devicemotion` shake: the ball left the
    board. Falls went to 1, "+5s" showed, and the ball came back on the start ring.
  - No console errors or page errors.

## Fixes applied

The fixer reports carry the details. In summary:

- **Input:**
  - game keys work only in ready, playing and falling;
  - modifier chords and Meta-up no longer leave keys stuck;
  - only a primary pointer drags; the context menu and lost pointer capture are handled;
  - wake-lock requests no longer leak;
  - a calibration interrupted by a hide or a rotation is not saved and pauses instead.
- **Physics and levels:**
  - a trimesh floor removes the seam hops;
  - falls and wins are judged after every physics step;
  - the braid guard keeps loops from cutting the route below 80%;
  - holes go first on cells the player cannot route around;
  - fixed hole counts per level;
  - a `LEVELS` block in `tuning.js`;
  - re-picked campaign seeds with a monotone curve and pinned fingerprints;
  - the Endless seed is shown in the level label;
  - real Rapier specs.
- **Render, UI and audio:**
  - Rapier downloads alongside the game chunk;
  - reflections are rebuilt after WebGL context loss;
  - the room environment is freed after use;
  - the browser's default GPU power preference;
  - a fall cue ("+5s" and the falls count flashes);
  - a 600 ms calibration lead;
  - unlit goal and start rings;
  - portrait framing solver;
  - Escape or P pauses;
  - a 500 ms goal flash before the win screen;
  - Endless says "New maze";
  - a narrow HUD layout;
  - level-select styling;
  - modal dialogs, with the HUD inert behind them;
  - the button says "Play".
- **Tooling and docs:**
  - lint fails on warnings;
  - per-job Pages permissions;
  - a newer push no longer cancels a running deploy;
  - `--no-shell` Chromium;
  - e2e always builds and serves its own preview;
  - traces of failed runs are uploaded;
  - shake-height specs;
  - docs synced.
- **Final verifier:** the "flaky e2e after the fixes" concern turned out to be machine load,
  not a regression.
  - Rendering ran at 2 to 5 frames a second on this 4-core host while another session compiled
    Rust (load average about 16).
  - Measured side by side on the same host, HEAD and the new tree ran at the same frame rate:
    2 to 5.5 fps for each.
  - Failures came only when the hint appeared quickly and the 5 s default poll ran out before
    the smoothed tilt crossed 3°.
  - Fix: the two tilt polls in `tests/e2e/smoke.spec.js` now wait 15 s, with a comment that
    says why.

## Rejected findings

The full reasons are in the verification list that came with the fixes.

| Finding | Reason |
| --- | --- |
| Sensors steer in drag mode after a late probe | Not shown to be reachable; the next level start probes again |
| `screenAngleSign` should be a runtime check | Speculative; no device is known to disagree |
| `load()` keeps a freed world if it throws | No trigger found that can be reached |
| A single ground ray misses a ball on a hole lip | The window is shorter than a human can react; the trimesh removes the seam case |
| Ball rotation is not interpolated | An untextured, evenly coloured sphere looks the same at any rotation |
| Storage overwrite across tabs or versions | Speculative; there is only one save format |
| The menu loop keeps running | Cheap: the render is skipped; stopping it would freeze the pause tilt indicator |
| Endless luck | Accepted design; the braid guard already narrows it |
| Inline base64 wasm | Unmeasured; touches the open Rapier size question |
| Near-plane depth precision | No flicker seen |
| Pixel cost and thermal load | No profile shows a problem |
| High refresh rates | A taste trade-off; nothing measured |
| Async shader compile | The stall is hidden behind the loading screen |
| Muted-state visibility | Already visible, with `aria-pressed` set |
| Holes look flat | They read clearly as openings |
| README iOS denied-access recovery | Cannot be checked without an iPhone |
| `allowScripts` missing | fsevents installs only on macOS; npm 11 already blocks unreviewed scripts |

## Open questions for the user

These decisions were kept as they are.

- **Rapier size:** the Rapier chunk is 4.33 MB raw and 1.67 MB gzip. Shipping a separate
  `.wasm` file instead of inline base64 could save about 27%, if GitHub Pages compresses wasm.
  That is not measured yet.
- **How often the ball flies off:** the rim is 0.7 ball diameters high and the board tilts at
  most 15°. With the floor seams gone, the ball no longer hops before a shake, so it may fly off
  slightly less often than in earlier simulations. At the threshold strength the centre still
  rises to about 0.47, a 1.3× shake clears the rim, and 2× is tested to clear it.
- **No portrait lock:** unchanged.

## Remaining concerns

- **Narrow HUD:** it still wraps to two rows for Endless, at both 360 and 390 px, because of
  the 8-character seed. It also wraps at 360 px once the time passes 10 minutes.
- **Portrait framing:** the gain is only about 6%, limited by keeping the fully tilted board
  in view.
- **Holes:** the cell centre always passes a hole (the lane design), so holes catch only a ball
  that drifts off line.
- **Not seen on a device yet:**
  - the goal flash and the "+5s" cue were checked only by code review and the play-through
    above;
  - the calibration lead needs a real phone.
- **CI timing:** this run's Playwright install spent about 10 minutes on an Azure apt mirror
  timeout. That came from the runner, not from the `--no-shell` change.
