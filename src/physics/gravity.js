/**
 * The board never moves in the physics world; tilting rotates gravity
 * instead. The same quaternion turns the drawn board, so the picture and the
 * physics agree.
 */

import { Euler, Quaternion, Vector3 } from 'three';

const DEG = Math.PI / 180;

/**
 * @param {{pitch: number, roll: number}} tiltDeg Board tilt in degrees;
 *   pitch > 0 lowers the far edge, roll > 0 lowers the right edge.
 * @param {Quaternion} [out]
 * @returns {Quaternion} Rotation from board space to the world.
 */
export function boardQuaternion(tiltDeg, out = new Quaternion()) {
  return out.setFromEuler(new Euler(-tiltDeg.pitch * DEG, 0, -tiltDeg.roll * DEG, 'XYZ'));
}

/**
 * @param {{pitch: number, roll: number}} tiltDeg
 * @param {number} magnitude
 * @param {Vector3} [out]
 * @returns {Vector3} Gravity expressed in board space.
 */
export function boardGravity(tiltDeg, magnitude, out = new Vector3()) {
  const q = boardQuaternion(tiltDeg).invert();
  return out.set(0, -magnitude, 0).applyQuaternion(q);
}
