# Tilt Maze

Tilt your phone to roll a marble through a 3D maze to the green ring. Shake hard and the marble
jumps: over an inner wall if you are lucky, off the edge of the board if you are not.

**Play it:** <https://tiennm99dev.github.io/tilt-maze/>

## How to play

- Tap **Tap to play**. On an iPhone, allow motion access when Safari asks.
- Hold the phone however is comfortable: the game takes that angle as level. Tap the ⟲ button
  any time to re-level at your current angle.
- Tilt to roll the marble. Reach the green ring to finish the level.
- Shake the phone sharply to make the marble jump. A strong shake can hop a wall or throw the
  marble right off the board.
- Falling through a hole or off the board puts the marble back at the start and adds 5 seconds.
- Ten levels unlock one after another, and your best time for each is saved in the browser.
  **Endless** makes a new random maze every time.
- Portrait and landscape both work. Settings has a sensitivity slider and an invert switch.

No motion sensors (desktop, or a phone browser that blocks them)? Drag the board with a finger or
the mouse, or use the arrow keys or WASD, and Space to jump.

## Run it locally

Requirements: Node.js 22.12 or newer, and npm.

```sh
npm ci
npm run dev        # http://localhost:5188/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload on port 5188 |
| `npm run dev:lan` | Same, over self-signed HTTPS on your local network, for phones |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build on port 4188 |
| `npm run lint` | ESLint (with JSDoc rules) |
| `npm run typecheck` | Type-check the JSDoc types with TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser smoke test (Playwright); run `npx playwright install chromium` once first, or set `CHROMIUM_PATH` to a local Chromium |
| `npm run check` | Lint, type check, unit and smoke tests |

## Testing on a phone

Browsers only send motion sensor data to pages served over HTTPS, so a plain `http://` address
from your computer shows the board but tilting does nothing.

- **Easiest:** push to `main` and open the live URL above once the deploy finishes (about a
  minute).
- **On your home network:** run `npm run dev:lan` and open the `https://` Network address it
  prints on the phone. The certificate is self-signed, so accept the warning. Some browsers then
  still withhold sensor data; if tilting does nothing, use the live URL.
- **Android with USB debugging:** `adb reverse tcp:5188 tcp:5188`, then open
  `http://localhost:5188/` on the phone (localhost counts as secure).

More detail is in [docs/deployment-guide.md](docs/deployment-guide.md).

## How it is built

Three.js draws the board, Rapier simulates the marble, and the game is plain JavaScript with
JSDoc types, bundled by Vite and deployed to GitHub Pages by GitHub Actions. The board never
moves in the physics world: tilting the phone turns gravity instead. See [docs/](docs/README.md)
for the design and the reasons behind it.

## Licence

[Apache-2.0](LICENSE)
