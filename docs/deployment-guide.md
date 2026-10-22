# Deployment guide

## Production

Every push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):
lint, type check, unit tests, the Playwright smoke test and the build, then a deploy to GitHub
Pages at <https://tiennm99dev.github.io/tilt-maze/>. A failed gate stops the deploy, and Pages
keeps serving the last good build. The repository's Pages source is set to "GitHub Actions";
nothing else needs configuring.

The build uses a relative base (`./`), so the same output works on the Pages subpath and behind
any proxy path.

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
