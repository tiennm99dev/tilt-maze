/**
 * Hole placement. Holes go on the shortest route so the player has to pass
 * them, sit against a closed wall so a lane at least `minLaneWidth` wide
 * stays open, and never appear in the start cell, the cell after it, or the
 * goal cell.
 */

import { E, N, S, W } from './maze.js';

/**
 * @typedef {object} HoleGeometry
 * @property {number} cellSize
 * @property {number} wallThickness
 * @property {number} holeSize
 * @property {number} minLaneWidth
 */

/**
 * A square floor opening, in cell-local coordinates: x grows east, z grows
 * south, and (0, 0) is the cell centre.
 * @typedef {object} Hole
 * @property {number} cell
 * @property {number} x0
 * @property {number} x1
 * @property {number} z0
 * @property {number} z1
 */

/**
 * Where a hole may sit in one axis of a cell.
 * @param {boolean} lowOpen Side toward negative coordinates is open.
 * @param {boolean} highOpen Side toward positive coordinates is open.
 * @param {() => number} random
 * @returns {-1 | 0 | 1} -1 hug the low side, 1 hug the high side, 0 centre.
 */
function axisPlacement(lowOpen, highOpen, random) {
  if (lowOpen && highOpen) return 0;
  if (lowOpen) return 1;
  if (highOpen) return -1;
  return random() < 0.5 ? -1 : 1;
}

/**
 * @param {-1 | 0 | 1} placement
 * @param {HoleGeometry} geo
 * @returns {[number, number]} Start and end of the hole along one axis.
 */
function axisSpan(placement, geo) {
  const inner = geo.cellSize / 2 - geo.wallThickness / 2;
  if (placement === -1) return [-inner, -inner + geo.holeSize];
  if (placement === 1) return [inner - geo.holeSize, inner];
  return [-geo.holeSize / 2, geo.holeSize / 2];
}

/**
 * Places a hole in one cell, or returns null when no placement leaves a lane
 * (a cell open on all four sides).
 * @param {number} openMask Open-side bit mask of the cell.
 * @param {number} cell
 * @param {HoleGeometry} geo
 * @param {() => number} random
 * @returns {Hole | null}
 */
export function placeHoleInCell(openMask, cell, geo, random) {
  const px = axisPlacement(Boolean(openMask & W), Boolean(openMask & E), random);
  const pz = axisPlacement(Boolean(openMask & N), Boolean(openMask & S), random);
  if (px === 0 && pz === 0) return null;
  const [x0, x1] = axisSpan(px, geo);
  const [z0, z1] = axisSpan(pz, geo);
  return { cell, x0, x1, z0, z1 };
}

/**
 * Checks that a hole leaves a lane of `minLaneWidth` between it and the side
 * it does not touch, and that it never reaches into an open side.
 * @param {Hole} hole
 * @param {number} openMask
 * @param {HoleGeometry} geo
 * @returns {boolean}
 */
export function holeLeavesLane(hole, openMask, geo) {
  const inner = geo.cellSize / 2 - geo.wallThickness / 2;
  const eps = 1e-9;
  /** @type {Record<number, number>} */
  const gaps = {
    [W]: hole.x0 + inner,
    [E]: inner - hole.x1,
    [N]: hole.z0 + inner,
    [S]: inner - hole.z1,
  };
  // The hole may touch only closed sides.
  for (const bit of [N, E, S, W]) {
    if (openMask & bit && gaps[bit] < eps) return false;
  }
  // Along at least one axis the hole hugs one side and leaves a full lane
  // on the other, and that lane joins every open side.
  const xLane = Math.max(gaps[W], gaps[E]);
  const zLane = Math.max(gaps[N], gaps[S]);
  return xLane >= geo.minLaneWidth - eps || zLane >= geo.minLaneWidth - eps;
}

/**
 * @param {import('./maze.js').Maze} maze
 * @param {number[]} path Shortest route from start to goal.
 * @param {number} density Holes per route cell.
 * @param {HoleGeometry} geo
 * @param {import('./rng.js').Rng} rng
 * @returns {Hole[]}
 */
export function placeHoles(maze, path, density, geo, rng) {
  const inner = geo.cellSize - geo.wallThickness;
  if (inner - geo.holeSize < geo.minLaneWidth) {
    throw new RangeError('Board geometry leaves no lane beside a hole');
  }
  const wanted = Math.round(path.length * density);
  if (wanted <= 0) return [];
  // Skip the start cell, the cell after it and the goal cell.
  const candidates = rng.shuffle(path.slice(2, -1).map((cell, i) => ({ cell, index: i + 2 })));
  /** @type {Set<number>} */
  const usedIndices = new Set();
  /** @type {Hole[]} */
  const holes = [];
  for (const { cell, index } of candidates) {
    if (holes.length >= wanted) break;
    // Never two holes in neighbouring route cells.
    if (usedIndices.has(index - 1) || usedIndices.has(index + 1)) continue;
    const hole = placeHoleInCell(maze.open[cell], cell, geo, rng.next);
    if (!hole) continue;
    usedIndices.add(index);
    holes.push(hole);
  }
  return holes;
}
