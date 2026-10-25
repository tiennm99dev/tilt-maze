import { expect, test } from '@playwright/test';

test('boots, renders WebGL and follows device orientation', async ({ page }) => {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Tilt Maze' })).toBeVisible();

  // Feed a steady stream of orientation readings, like a phone lying flat.
  await page.evaluate(() => {
    const w = /** @type {Window & {fakeTilt?: {beta: number, gamma: number}}} */ (window);
    w.fakeTilt = { beta: 0, gamma: 0 };
    setInterval(() => {
      const t = /** @type {{beta: number, gamma: number}} */ (w.fakeTilt);
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: t.beta, gamma: t.gamma }));
    }, 16);
  });

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#hint')).toHaveText('Tilt your phone to start', { timeout: 30_000 });

  const hasWebGl = await page.evaluate(() => {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('stage'));
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  });
  expect(hasWebGl).toBe(true);

  const indicator = page.locator('#tilt-indicator');
  await expect(indicator).toHaveAttribute('data-roll', '0.0');

  // Lower the right edge and the top edge of the phone.
  await page.evaluate(() => {
    const w = /** @type {Window & {fakeTilt?: {beta: number, gamma: number}}} */ (window);
    w.fakeTilt = { beta: -10, gamma: 12 };
  });
  // Software WebGL on a busy machine can drop to 2-3 frames a second, and the
  // smoothed tilt needs a few frames to cross the threshold.
  const slow = { timeout: 15_000 };
  await expect.poll(async () => Number(await indicator.getAttribute('data-roll')), slow).toBeGreaterThan(3);
  await expect.poll(async () => Number(await indicator.getAttribute('data-pitch')), slow).toBeGreaterThan(3);
  await expect(page.locator('#hint')).toBeHidden();

  // Escape pauses, keeps Tab out of the HUD behind the dialog, and resumes.
  await page.keyboard.press('Escape');
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect(paused).toBeVisible();
  expect(await page.locator('#hud').evaluate((el) => /** @type {HTMLElement} */ (el).inert)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(paused).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();

  // Back from the level list returns to the run, so Menu is the only way from a run to the
  // title and Endless; a broken button id or quit wiring would pass every other gate.
  // Resume recalibrates first, and Escape does nothing until that ends.
  await expect(page.locator('#screen-loading')).toBeHidden(slow);
  await page.keyboard.press('Escape');
  await expect(paused).toBeVisible();
  await paused.getByRole('button', { name: 'Levels' }).click();
  const levels = page.getByRole('dialog', { name: 'Levels' });
  await expect(levels).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(paused).toBeVisible();
  await paused.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Tilt Maze' })).toBeVisible();
  await page.getByRole('button', { name: 'Endless', exact: true }).click();
  await expect(page.locator('#hint')).toHaveText('Tilt your phone to start', { timeout: 30_000 });
  await expect(page.locator('#hud-level')).toHaveText(/^Endless #/);

  expect(errors).toEqual([]);
});

test('a failed engine download leaves Play able to retry', async ({ page }) => {
  // Blocked before the page loads, because the title screen preloads the engine.
  await page.route('**/*.wasm', (route) => route.abort());
  await page.goto('./');

  const play = page.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  await expect(page.locator('#title-error')).toContainText('Could not start the game', { timeout: 30_000 });

  // The retry must fetch the .wasm again instead of reusing a failed module.
  await page.unroute('**/*.wasm');
  await play.click();
  await expect(page.locator('#hint')).toBeVisible({ timeout: 30_000 });
});
