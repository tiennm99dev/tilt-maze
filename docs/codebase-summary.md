# Codebase summary

| Path | Owns |
| --- | --- |
| `index.html` | Canvas, HUD and menu markup |
| `src/main.js` | Entry point: menu flow and the first-tap permission sequence |
| `src/tuning.js` | Every tunable constant |
| `src/game/` | In-level engine (`game.js`), fixed-step loop, state machine |
| `src/input/` | Tilt maths, filters, shake detection, sensors, keyboard and drag |
| `src/level/` | Seeded RNG, maze generation, holes, level table, layout boxes |
| `src/physics/` | Rapier world and tilt-to-gravity maths |
| `src/render/` | Renderer, camera and lights; board meshes |
| `src/ui/` | Screens, HUD, DOM helpers |
| `src/audio/sfx.js` | Synthesised sound and vibration |
| `src/storage.js` | Versioned save data in localStorage |
| `tests/unit/` | Vitest specs for the pure modules |
| `tests/e2e/smoke.spec.js` | Playwright boot and sensor smoke test |
| `.github/workflows/deploy.yml` | CI gates and the Pages deploy |
| `plans/` | Plans for past and future work |
