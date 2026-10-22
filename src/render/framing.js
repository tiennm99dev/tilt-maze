/**
 * Camera framing as a pure function, so the fit can be tested without a
 * renderer: the camera distance at which the whole board, tilted as far as
 * the game ever tilts it, stays inside a given part of the view.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { boardQuaternion } from '../physics/gravity.js';

const DEG = Math.PI / 180;
/** Tilt directions checked; the worst corners sit on the diagonals. */
const DIRECTIONS = 16;

/**
 * @typedef {object} FitOptions
 * @property {number} size Larger of the board's width and depth, rim included.
 * @property {number} top Highest point above the floor (the tallest wall).
 * @property {number} bottom Lowest point below the floor (its underside), as a positive depth.
 * @property {number} aspect Viewport width / height.
 * @property {number} fovDeg Vertical field of view.
 * @property {number} leanDeg Camera lean from vertical toward the player.
 * @property {number} tiltDeg Largest board tilt.
 * @property {number} maxX Largest allowed |x| in normalised device coordinates.
 * @property {number} maxY Largest allowed |y| in normalised device coordinates.
 */

/**
 * Largest |x| and |y|, in normalised device coordinates, of the board's
 * corners over every tilt direction at full tilt.
 * @param {FitOptions} options
 * @param {number} distance Camera distance from the board centre.
 * @returns {{x: number, y: number}}
 */
export function boardExtent({ size, top, bottom, aspect, fovDeg, leanDeg, tiltDeg }, distance) {
  const camera = new PerspectiveCamera(fovDeg, aspect, 0.01, distance * 4);
  const lean = leanDeg * DEG;
  camera.position.set(0, distance * Math.cos(lean), distance * Math.sin(lean));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const half = size / 2;
  const p = new Vector3();
  let x = 0;
  let y = 0;
  for (let i = 0; i < DIRECTIONS; i += 1) {
    const a = (i / DIRECTIONS) * Math.PI * 2;
    const q = boardQuaternion({ pitch: tiltDeg * Math.cos(a), roll: tiltDeg * Math.sin(a) });
    for (const cx of [-half, half]) {
      for (const cz of [-half, half]) {
        for (const cy of [top, -bottom]) {
          p.set(cx, cy, cz).applyQuaternion(q).project(camera);
          x = Math.max(x, Math.abs(p.x));
          y = Math.max(y, Math.abs(p.y));
        }
      }
    }
  }
  return { x, y };
}

/**
 * Smallest camera distance at which the fully tilted board fits inside
 * `maxX` by `maxY`, found by bisection.
 * @param {FitOptions} options
 * @returns {number}
 */
export function fitDistance(options) {
  const fits = (/** @type {number} */ d) => {
    const e = boardExtent(options, d);
    return e.x <= options.maxX && e.y <= options.maxY;
  };
  let near = options.size * 0.5;
  let far = options.size * 2;
  while (!fits(far)) far *= 2;
  for (let i = 0; i < 30; i += 1) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  return far;
}
