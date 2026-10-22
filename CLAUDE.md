# Tilt Maze — agent notes

Browser marble-maze game: Three.js + Rapier, plain JavaScript with JSDoc, Vite, GitHub Pages.
Docs index: [docs/README.md](docs/README.md).

## Commands

- Verify before every commit: `npm run lint && npm run typecheck && npm test && npm run build`.
  Add `npm run test:e2e` when touching boot, input wiring or rendering. It needs
  `npx playwright install chromium` once, or `CHROMIUM_PATH` pointing at a system Chromium.
  Keep `channel: 'chromium'` in `playwright.config.js`: the headless shell drops the synthetic
  orientation events the smoke test sends.
- Dev server port is 5188 and preview is 4188, both with `strictPort`. If a port is busy, stop
  the stale server instead of picking another port.

## Rules

- JavaScript only. Never add `.ts` or `.d.ts` files; type with JSDoc and fix `tsc` errors.
  TypeScript 7 rejects Closure-style JSDoc (`@enum`, `@constructor`, `function(x): y`).
- Lint must end with zero warnings.
- Tunable numbers belong in `src/tuning.js`. When a value changes for gameplay reasons, update
  the reasoning in `docs/game-design.md`.
- All Rapier calls stay in `src/physics/world.js`.
- Keep logic that can run without a DOM in pure modules with Vitest specs; do not add test-only
  globals or hooks to shipped code.
- The first tap must call the iOS `requestPermission()` functions before any `await`
  (see `startFromTap` in `src/main.js`).
- npm only. `.npmrc` sets `min-release-age=3`: if an install fails with `ETARGET`, the newest
  release is too young; use the previous version in the range.
- Bump `three` and `@types/three` together.
- Push straight to `main` (no PRs); each push redeploys GitHub Pages. Conventional Commits.
