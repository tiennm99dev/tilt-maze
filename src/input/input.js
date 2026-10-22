/**
 * Merges every input source into one board tilt and a queue of shakes.
 * Priority each frame: pointer drag, then keys, then sensors.
 */

import { Vector3 } from 'three';
import { SHAKE, TILT } from '../tuning.js';
import { createFallbackControls } from './fallback.js';
import { createSmoother, shapeTilt } from './filter.js';
import { createShakeDetector } from './shake-detector.js';
import { calibrationFor, tiltFromUp, toScreenFrame, upFromOrientation } from './tilt-math.js';

/** @typedef {import('./tilt-math.js').Tilt} Tilt */

/**
 * @typedef {object} InputSettings
 * @property {number} sensitivity
 * @property {boolean} invert
 */

/**
 * @typedef {object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @param {object} options
 * @param {import('./sensors.js').Sensors} options.sensors
 * @param {HTMLElement} options.surface
 * @param {() => InputSettings} options.settings
 * @param {Vec3Like | null} [options.savedNeutral] Neutral up vector from a previous session.
 */
export function createInput({ sensors, surface, settings, savedNeutral = null }) {
  const smoother = createSmoother(TILT.smoothingTauMs);
  const shakeDetector = createShakeDetector(SHAKE);
  const device = new Vector3();
  const screenUp = new Vector3();
  let neutral = savedNeutral ? new Vector3(savedNeutral.x, savedNeutral.y, savedNeutral.z) : new Vector3(0, 0, 1);
  let calibration = calibrationFor(neutral);
  let pendingShake = 0;
  /** @type {{sum: Vector3, count: number} | null} */
  let collecting = null;

  const fallback = createFallbackControls({
    surface,
    phoneMaxDeg: TILT.phoneMaxDeg,
    dragFullTiltFraction: TILT.dragFullTiltFraction,
    onShake: () => {
      pendingShake = Math.max(pendingShake, SHAKE.keyboardStrength);
    },
  });

  /** @returns {Vector3 | null} Latest screen-frame up vector. */
  const currentUp = () => {
    const reading = sensors.latest();
    if (!reading) return null;
    upFromOrientation(reading.beta, reading.gamma, device);
    return toScreenFrame(device, reading.screenAngle, TILT.screenAngleSign, screenUp);
  };

  const offOrientation = sensors.onOrientation(() => {
    if (!collecting) return;
    const up = currentUp();
    if (up) {
      collecting.sum.add(up);
      collecting.count += 1;
    }
  });
  const offMotion = sensors.onMotion((event) => {
    const strength = shakeDetector.update(event.acceleration, event.accelerationIncludingGravity, performance.now());
    if (strength > 0) pendingShake = Math.max(pendingShake, strength);
  });

  let lastBoard = { pitch: 0, roll: 0 };

  return {
    /**
     * Averages the phone pose for TILT.calibrationMs and makes it neutral.
     * Keeps the previous neutral when no reading arrives.
     * @returns {Promise<Vec3Like>} The neutral up vector now in use.
     */
    calibrate() {
      collecting = { sum: new Vector3(), count: 0 };
      const first = currentUp();
      if (first) {
        collecting.sum.add(first);
        collecting.count += 1;
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          const c = collecting;
          collecting = null;
          if (c && c.count > 0 && c.sum.lengthSq() > 1e-9) {
            neutral = c.sum.divideScalar(c.count).normalize();
            calibration = calibrationFor(neutral);
          }
          smoother.reset();
          resolve({ x: neutral.x, y: neutral.y, z: neutral.z });
        }, TILT.calibrationMs);
      });
    },

    /**
     * @param {number} dtMs
     * @returns {{board: Tilt, active: boolean}} Board tilt in degrees and
     *   whether any source is pushing it.
     */
    sample(dtMs) {
      let target = fallback.target();
      if (!target && sensors.isLive()) {
        const up = currentUp();
        if (up) target = tiltFromUp(up, calibration);
      }
      const smoothed = smoother.update(target ?? { pitch: 0, roll: 0 }, dtMs);
      const { sensitivity, invert } = settings();
      lastBoard = shapeTilt(smoothed, {
        deadZoneDeg: TILT.deadZoneDeg,
        phoneMaxDeg: TILT.phoneMaxDeg,
        boardMaxDeg: TILT.boardMaxDeg,
        sensitivity,
        invert,
      });
      return { board: lastBoard, active: lastBoard.pitch !== 0 || lastBoard.roll !== 0 };
    },

    /** @returns {Tilt} Board tilt from the latest sample, in degrees. */
    board: () => lastBoard,

    /** @returns {number} Pending shake strength (0 when none); clears it. */
    consumeShake() {
      const s = pendingShake;
      pendingShake = 0;
      return s;
    },

    /** @param {boolean} enabled */
    setDragEnabled: (enabled) => fallback.setDragEnabled(enabled),

    reset() {
      smoother.reset();
      pendingShake = 0;
      lastBoard = { pitch: 0, roll: 0 };
    },

    dispose() {
      offOrientation();
      offMotion();
      fallback.dispose();
    },
  };
}

/** @typedef {ReturnType<typeof createInput>} Input */
