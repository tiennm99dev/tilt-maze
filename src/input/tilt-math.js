/**
 * Phone pose maths. Orientation angles become a gravity ("up") vector in the
 * device frame, which is rotated into the screen frame, re-zeroed against a
 * calibrated neutral pose, and finally read out as pitch and roll.
 *
 * Working with the vector instead of beta/gamma angles avoids the jump at
 * gamma ±90° and keeps calibration correct at any hold angle.
 *
 * Sign conventions of the output, chosen so input maps straight to the board:
 * - roll > 0: the right side of the screen is lower, the ball rolls right;
 * - pitch > 0: the top of the screen is lower, the ball rolls up the screen.
 */

import { MathUtils, Quaternion, Vector3 } from 'three';

const DEG = Math.PI / 180;
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * World "up" in device coordinates for the W3C Z-X'-Y'' rotation order.
 * Alpha (compass heading) does not affect it.
 * @param {number} betaDeg
 * @param {number} gammaDeg
 * @param {Vector3} [out]
 * @returns {Vector3} Unit vector.
 */
export function upFromOrientation(betaDeg, gammaDeg, out = new Vector3()) {
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  return out.set(-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g));
}

/**
 * Rotates a device-frame vector into the screen frame for the current
 * `screen.orientation.angle`.
 * @param {Vector3} up Device-frame vector (not modified).
 * @param {number} angleDeg Screen orientation angle.
 * @param {number} [sign] 1 or -1, see TILT.screenAngleSign.
 * @param {Vector3} [out]
 * @returns {Vector3}
 */
export function toScreenFrame(up, angleDeg, sign = 1, out = new Vector3()) {
  const t = angleDeg * sign * DEG;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return out.set(up.x * c - up.y * s, up.x * s + up.y * c, up.z);
}

/**
 * Rotation that maps the neutral up vector onto +Z, so the neutral pose
 * reads as zero tilt.
 * @param {Vector3} neutral Need not be normalised.
 * @returns {Quaternion}
 */
export function calibrationFor(neutral) {
  const n = neutral.clone();
  if (n.lengthSq() < 1e-12) return new Quaternion();
  return new Quaternion().setFromUnitVectors(n.normalize(), Z_AXIS);
}

/**
 * @typedef {object} Tilt
 * @property {number} pitch Degrees.
 * @property {number} roll Degrees.
 */

/**
 * @param {Vector3} upScreen Screen-frame up vector.
 * @param {Quaternion} calibration From calibrationFor().
 * @returns {Tilt} Phone tilt relative to the neutral pose, in degrees.
 */
export function tiltFromUp(upScreen, calibration) {
  const rel = upScreen.clone().normalize().applyQuaternion(calibration);
  return {
    pitch: Math.asin(MathUtils.clamp(-rel.y, -1, 1)) / DEG,
    roll: Math.asin(MathUtils.clamp(-rel.x, -1, 1)) / DEG,
  };
}
