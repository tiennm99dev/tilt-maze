import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSensors, createWakeLock, screenAngle } from '../../src/input/sensors.js';

/** @param {'granted' | 'denied'} result */
const permissionCtor = (result) => ({ requestPermission: vi.fn(() => Promise.resolve(result)) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestAccess', () => {
  it('needs no permission where the browser asks for none', async () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    vi.stubGlobal('DeviceMotionEvent', undefined);
    await expect(createSensors().requestAccess()).resolves.toBe(true);
  });

  it('asks for both and keeps tilt when only motion is refused', async () => {
    const orientation = permissionCtor('granted');
    const motion = permissionCtor('denied');
    vi.stubGlobal('DeviceOrientationEvent', orientation);
    vi.stubGlobal('DeviceMotionEvent', motion);
    await expect(createSensors().requestAccess()).resolves.toBe(true);
    expect(orientation.requestPermission).toHaveBeenCalledTimes(1);
    expect(motion.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal when orientation is denied', async () => {
    vi.stubGlobal('DeviceOrientationEvent', permissionCtor('denied'));
    vi.stubGlobal('DeviceMotionEvent', permissionCtor('granted'));
    await expect(createSensors().requestAccess()).resolves.toBe(false);
  });

  it('treats a throwing or rejecting request as a refusal', async () => {
    vi.stubGlobal('DeviceOrientationEvent', {
      requestPermission: () => Promise.reject(new Error('NotAllowedError')),
    });
    vi.stubGlobal('DeviceMotionEvent', {
      requestPermission: () => {
        throw new Error('no gesture');
      },
    });
    await expect(createSensors().requestAccess()).resolves.toBe(false);
  });
});

describe('screenAngle', () => {
  it('reads the current screen orientation angle each call', () => {
    const orientation = { angle: 0 };
    vi.stubGlobal('screen', { orientation });
    expect(screenAngle()).toBe(0);
    orientation.angle = 90;
    expect(screenAngle()).toBe(90);
  });

  it('falls back to the legacy window.orientation, then 0', () => {
    vi.stubGlobal('screen', {});
    vi.stubGlobal('orientation', -90);
    expect(screenAngle()).toBe(-90);
    vi.stubGlobal('orientation', undefined);
    expect(screenAngle()).toBe(0);
  });
});

describe('createWakeLock', () => {
  it('takes the lock when enabled and releases it when disabled', async () => {
    const release = vi.fn(() => Promise.resolve());
    const sentinel = { release, addEventListener: vi.fn() };
    const request = vi.fn(() => Promise.resolve(sentinel));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    /** @type {Record<string, () => void>} */
    const handlers = {};
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (/** @type {string} */ type, /** @type {() => void} */ fn) => {
        handlers[type] = fn;
      },
    });

    const lock = createWakeLock();
    lock.enable();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);

    lock.disable();
    expect(release).toHaveBeenCalledTimes(1);

    // Returning to the tab must not take the lock again while disabled.
    handlers.visibilitychange();
    expect(request).toHaveBeenCalledTimes(1);
  });

  /** Wake lock API whose requests resolve only when the test says so. */
  const deferredLock = () => {
    /** @type {Array<() => void>} */
    const resolvers = [];
    const sentinels = /** @type {Array<{release: ReturnType<typeof vi.fn>}>} */ ([]);
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          const s = { release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() };
          sentinels.push(s);
          resolvers.push(() => resolve(s));
        }),
    );
    vi.stubGlobal('navigator', { wakeLock: { request } });
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
    return { request, sentinels, resolveAll: () => resolvers.splice(0).forEach((r) => r()) };
  };

  it('sends one request when enabled twice before the first resolves', async () => {
    const { request, sentinels, resolveAll } = deferredLock();
    const lock = createWakeLock();
    lock.enable();
    lock.enable();
    expect(request).toHaveBeenCalledTimes(1);
    resolveAll();
    await Promise.resolve();
    await Promise.resolve();
    lock.disable();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('releases a lock that arrives after disable()', async () => {
    const { sentinels, resolveAll } = deferredLock();
    const lock = createWakeLock();
    lock.enable();
    lock.disable();
    resolveAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });
});
