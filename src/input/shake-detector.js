/**
 * Shake detection on `devicemotion` samples. It reads the acceleration
 * magnitude, not the sign of single axes, because axis signs differ between
 * browsers. When `acceleration` (gravity removed) is missing, gravity is
 * removed with a high-pass filter on `accelerationIncludingGravity`.
 */

/**
 * @typedef {{x: number | null, y: number | null, z: number | null}} AxisSample
 */

/**
 * @typedef {object} ShakeOptions
 * @property {number} thresholdMs2
 * @property {number} cooldownMs
 * @property {number} highPassTauMs
 * @property {number} maxStrength
 */

/**
 * @param {AxisSample | null | undefined} v
 * @returns {[number, number, number] | null}
 */
function toTriple(v) {
  if (!v || v.x === null || v.y === null || v.z === null) return null;
  return [v.x, v.y, v.z];
}

/**
 * @param {ShakeOptions} options
 */
export function createShakeDetector(options) {
  /** @type {[number, number, number] | null} */
  let gravityEstimate = null;
  let lastSampleMs = -Infinity;
  let lastShakeMs = -Infinity;

  return {
    /**
     * @param {AxisSample | null | undefined} acceleration Gravity excluded.
     * @param {AxisSample | null | undefined} withGravity Gravity included.
     * @param {number} nowMs
     * @returns {number} Shake strength (>= 1) or 0 when there is no shake.
     */
    update(acceleration, withGravity, nowMs) {
      let linear = toTriple(acceleration);
      if (!linear) {
        const raw = toTriple(withGravity);
        if (!raw) return 0;
        const dt = Math.min(1000, Math.max(0, nowMs - lastSampleMs));
        if (!gravityEstimate) {
          gravityEstimate = [...raw];
        } else {
          const a = 1 - Math.exp(-dt / options.highPassTauMs);
          gravityEstimate = /** @type {[number, number, number]} */ (
            gravityEstimate.map((g, i) => g + (raw[i] - g) * a)
          );
        }
        linear = [raw[0] - gravityEstimate[0], raw[1] - gravityEstimate[1], raw[2] - gravityEstimate[2]];
      }
      lastSampleMs = nowMs;
      const magnitude = Math.hypot(linear[0], linear[1], linear[2]);
      if (magnitude < options.thresholdMs2) return 0;
      if (nowMs - lastShakeMs < options.cooldownMs) return 0;
      lastShakeMs = nowMs;
      return Math.min(options.maxStrength, magnitude / options.thresholdMs2);
    },
    reset() {
      gravityEstimate = null;
      lastSampleMs = -Infinity;
      lastShakeMs = -Infinity;
    },
  };
}
