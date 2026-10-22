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

  await page.getByRole('button', { name: 'Tap to play' }).click();
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
  await expect.poll(async () => Number(await indicator.getAttribute('data-roll'))).toBeGreaterThan(3);
  await expect.poll(async () => Number(await indicator.getAttribute('data-pitch'))).toBeGreaterThan(3);
  await expect(page.locator('#hint')).toBeHidden();

  expect(errors).toEqual([]);
});
