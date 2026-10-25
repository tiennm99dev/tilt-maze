# Deployment guide

## Production

Every push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):
lint (zero warnings), type check, unit tests, then the Playwright smoke test, whose web server
runs the production build that is deployed, then a deploy to GitHub Pages at
<https://tiennm99dev.github.io/tilt-maze/>. A failed gate stops the deploy, and Pages keeps
serving the last good build. When the smoke test fails, its traces and screenshots are
uploaded as the `playwright-test-results` artifact (kept 7 days); open a trace with
`npx playwright show-trace <file>.zip`.

The build job points `CHROMIUM_PATH` at the Google Chrome that GitHub's Ubuntu runner images
preinstall (`/usr/bin/google-chrome`), so CI downloads no browser and installs no system packages; the
`playwright install --with-deps` apt step it replaced stalled some runs for up to ten minutes.
The build job is capped at 15 minutes (8 for the smoke test) and the deploy job at 10, so a
hung step fails fast instead of holding the Pages concurrency group.

Only the deploy job holds `pages: write` and `id-token: write`; the build job, which runs
`npm ci` and the test tooling, reads only. A push during a run waits for it rather than
cancelling a deploy halfway. The repository's Pages source is set to "GitHub Actions";
nothing else needs configuring.

The build uses a relative base (`./`), so the same output works on the Pages subpath and behind
any proxy path.

Rapier's physics engine ships as its own `.wasm` file in `assets/`. Pages serves it gzipped as
`application/wasm`, which lets the browser compile it while it downloads. A host that sends
another content type still works, but the game then waits for the whole file before compiling.

Roll back with `git revert` on `main`; the next run redeploys the previous behaviour.

## Testing on a phone

Motion sensors only work over HTTPS (or on `localhost`), so:

1. **GitHub Pages** is the reliable route: push, wait about a minute, open the live URL.
2. **`npm run dev:lan`** serves the dev server on the local network over HTTPS with a
   self-signed certificate. Accept the warning on the phone. Whether a page loaded after a
   certificate warning gets orientation events differs by browser; check once per phone.
3. **Android only:** `adb reverse tcp:5188 tcp:5188`, then open `http://localhost:5188/` on the
   phone; `localhost` counts as secure.

Chrome DevTools' Sensors panel can fake orientation on a desktop for quick checks.
