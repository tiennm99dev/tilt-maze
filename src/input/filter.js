/**
 * Tilt filter chain, applied once per frame in this order: smoothing,
 * radial dead zone, phone-to-board mapping with a cap, sensitivity, invert.
 */

/** @typedef {import('./tilt-math.js').Tilt} Tilt */

/**
 * Frame-rate-independent exponential moving average on both tilt axes.
 * @param {number} tauMs Time constant.
 */
export function createSmoother(tauMs) {
  let pitch = 0;
  let roll = 0;
  return {
    /**
     * @param {Tilt} target
     * @param {number} dtMs Time since the previous update.
     * @returns {Tilt}
     */
    update(target, dtMs) {
      const a = tauMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
      pitch += (target.pitch - pitch) * a;
      roll += (target.roll - roll) * a;
      return { pitch, roll };
    },
    /** @param {Tilt} [value] */
    reset(value = { pitch: 0, roll: 0 }) {
      pitch = value.pitch;
      roll = value.roll;
    },
  };
}

/**
 * @typedef {object} ShapeOptions
 * @property {number} deadZoneDeg
 * @property {number} phoneMaxDeg Phone tilt that gives the full board tilt.
 * @property {number} boardMaxDeg
 * @property {number} sensitivity Multiplier, applied before the cap.
 * @property {boolean} invert Flips both axes.
 */

/**
 * Maps a smoothed phone tilt to a board tilt. The dead zone is radial and
 * rescaled, so the output starts from zero at its edge instead of jumping.
 * @param {Tilt} phone Degrees.
 * @param {ShapeOptions} o
 * @returns {Tilt} Board tilt in degrees, magnitude at most boardMaxDeg.
 */
export function shapeTilt(phone, o) {
  const mag = Math.hypot(phone.pitch, phone.roll);
  if (mag <= o.deadZoneDeg || mag === 0) return { pitch: 0, roll: 0 };
  const span = Math.max(1e-6, o.phoneMaxDeg - o.deadZoneDeg);
  const unit = Math.min(1, ((mag - o.deadZoneDeg) * o.sensitivity) / span);
  const scale = (unit * o.boardMaxDeg) / mag;
  const sign = o.invert ? -1 : 1;
  return { pitch: phone.pitch * scale * sign, roll: phone.roll * scale * sign };
}
