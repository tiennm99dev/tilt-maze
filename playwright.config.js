import { defineConfig, devices } from '@playwright/test';

const PORT = 4188;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    ...devices['Desktop Chrome'],
    // Full Chromium in new headless mode. With the headless shell the game
    // never saw the dispatched deviceorientation events, so sensors read as
    // missing and the smoke test failed.
    channel: 'chromium',
    // Kept only for failed tests; CI uploads test-results/ when a run fails. The
    // trace skips its screencast, which slowed the software-rendered canvas.
    trace: { mode: 'retain-on-failure', screenshots: false },
    screenshot: 'only-on-failure',
    launchOptions: {
      // CHROMIUM_PATH runs a system Chromium instead of Playwright's download.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    // Always build and serve fresh: reusing a running preview would test a stale dist/.
    // A busy port fails the run; stop the stale server instead.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
