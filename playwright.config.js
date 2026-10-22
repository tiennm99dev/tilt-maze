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
    launchOptions: {
      // CHROMIUM_PATH runs a system Chromium instead of Playwright's download.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
