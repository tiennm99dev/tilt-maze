/**
 * Device sensors: the iOS permission gesture, orientation and motion
 * listeners, a liveness probe, and the screen wake lock.
 *
 * Sensors count as working only after a real `deviceorientation` event with
 * a non-null beta arrives. Desktop Chrome exposes the API but never fires,
 * and in-app browsers can deny without a prompt.
 */

/**
 * iOS Safari adds a static `requestPermission()`; lib.dom does not know it.
 * @typedef {{ requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'> }} PermissionCtor
 */

/**
 * @typedef {object} OrientationReading
 * @property {number} beta
 * @property {number} gamma
 */

/** @returns {number} Current screen orientation angle in degrees. */
export function screenAngle() {
  const angle = globalThis.screen?.orientation?.angle;
  if (typeof angle === 'number') return angle;
  const legacy = /** @type {{orientation?: number}} */ (/** @type {unknown} */ (globalThis)).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/**
 * @param {unknown} ctor
 * @returns {Promise<boolean> | null} Pending request, or null when the
 *   browser needs no permission.
 */
function requestFrom(ctor) {
  const c = /** @type {PermissionCtor | undefined} */ (ctor);
  if (!c || typeof c.requestPermission !== 'function') return null;
  try {
    return c.requestPermission().then((r) => r === 'granted', () => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** Creates the orientation and motion sensor hub. */
export function createSensors() {
  /** @type {OrientationReading | null} */
  let latest = null;
  let live = false;
  let listening = false;
  /** @type {Set<(reading: OrientationReading) => void>} */
  const orientationListeners = new Set();
  /** @type {Set<(event: DeviceMotionEvent) => void>} */
  const motionListeners = new Set();

  /** @param {DeviceOrientationEvent} event */
  const onOrientation = (event) => {
    if (event.beta === null || event.gamma === null) return;
    latest = { beta: event.beta, gamma: event.gamma };
    live = true;
    for (const fn of orientationListeners) fn(latest);
  };
  /** @param {DeviceMotionEvent} event */
  const onMotion = (event) => {
    for (const fn of motionListeners) fn(event);
  };

  return {
    /**
     * Must run synchronously inside a click handler: iOS rejects the
     * permission request once anything has been awaited.
     * Only orientation decides the result: tilt is the game, and motion only
     * powers the shake, so a refused motion prompt must not force drag mode.
     * @returns {Promise<boolean>} False only when orientation was refused.
     */
    requestAccess() {
      const orientation = requestFrom(globalThis.DeviceOrientationEvent);
      // Requested in the same gesture; a refusal just disables the shake.
      requestFrom(globalThis.DeviceMotionEvent);
      this.start();
      return orientation ?? Promise.resolve(true);
    },

    /** Attaches the listeners once. */
    start() {
      if (listening || typeof window === 'undefined') return;
      listening = true;
      window.addEventListener('deviceorientation', onOrientation);
      window.addEventListener('devicemotion', onMotion);
    },

    stop() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    },

    /**
     * Resolves true as soon as a real reading arrives, false after timeoutMs.
     * @param {number} timeoutMs
     * @returns {Promise<boolean>}
     */
    probe(timeoutMs) {
      if (live) return Promise.resolve(true);
      return new Promise((resolve) => {
        const done = (/** @type {boolean} */ ok) => {
          clearTimeout(timer);
          orientationListeners.delete(listener);
          resolve(ok);
        };
        const listener = () => done(true);
        const timer = setTimeout(() => done(false), timeoutMs);
        orientationListeners.add(listener);
      });
    },

    /** @returns {OrientationReading | null} */
    latest: () => latest,
    isLive: () => live,

    /**
     * @param {(reading: OrientationReading) => void} fn
     * @returns {() => void} Unsubscribe.
     */
    onOrientation(fn) {
      orientationListeners.add(fn);
      return () => orientationListeners.delete(fn);
    },

    /**
     * @param {(event: DeviceMotionEvent) => void} fn
     * @returns {() => void} Unsubscribe.
     */
    onMotion(fn) {
      motionListeners.add(fn);
      return () => motionListeners.delete(fn);
    },
  };
}

/** @typedef {ReturnType<typeof createSensors>} Sensors */

/**
 * Keeps the screen awake while playing: nobody touches the screen during
 * tilt play, so the phone would otherwise dim. Re-acquires the lock when the
 * page becomes visible again, since the browser drops it on hide. Menus and
 * pause call disable() so the phone can dim and sleep as usual.
 */
export function createWakeLock() {
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;
  let wanted = false;

  const acquire = () => {
    if (!wanted || sentinel || !('wakeLock' in navigator)) return;
    navigator.wakeLock
      .request('screen')
      .then((s) => {
        sentinel = s;
        s.addEventListener('release', () => {
          sentinel = null;
        });
      })
      .catch(() => {
        // Denied (battery saver, unsupported context): play on without it.
        sentinel = null;
      });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
  });

  return {
    /** Call from a user gesture the first time. */
    enable() {
      wanted = true;
      acquire();
    },
    disable() {
      wanted = false;
      sentinel?.release().catch(() => {});
      sentinel = null;
    },
  };
}
