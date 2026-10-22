/**
 * Turns a level into axis-aligned boxes in board space. Physics and
 * rendering both build from this one layout, so what you see is exactly
 * what the ball collides with.
 *
 * Board space: x grows to the right, z toward the player (down the screen),
 * y up; the floor top is y = 0 and the board is centred on the origin.
 */

import { E, S } from './maze.js';

/**
 * @typedef {object} Box
 * @property {number} cx
 * @property {number} cy
 * @property {number} cz
 * @property {number} hx Half extents.
 * @property {number} hy
 * @property {number} hz
 */

/**
 * @typedef {object} LayoutGeometry
 * @property {number} cellSize
 * @property {number} wallThickness
 * @property {number} floorThickness
 * @property {number} innerWallHeight
 * @property {number} rimWallHeight
 */

/**
 * @typedef {object} Layout
 * @property {number} width Board extent along x, rim included.
 * @property {number} depth Board extent along z, rim included.
 * @property {Box[]} floor
 * @property {Box[]} walls
 * @property {Box[]} holes Openings in the floor (for drawing their wells).
 * @property {{x: number, z: number}} start
 * @property {{x: number, z: number}} goal
 */

/**
 * @param {number} x0
 * @param {number} x1
 * @param {number} y0
 * @param {number} y1
 * @param {number} z0
 * @param {number} z1
 * @returns {Box}
 */
function box(x0, x1, y0, y1, z0, z1) {
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    cz: (z0 + z1) / 2,
    hx: Math.abs(x1 - x0) / 2,
    hy: Math.abs(y1 - y0) / 2,
    hz: Math.abs(z1 - z0) / 2,
  };
}

/**
 * @param {import('./levels.js').Level} level
 * @param {LayoutGeometry} geo
 * @returns {Layout}
 */
export function buildLayout(level, geo) {
  const { maze, holes } = level;
  const { cols, rows } = maze;
  const cs = geo.cellSize;
  const t = geo.wallThickness;
  const ft = geo.floorThickness;
  const left = (-cols * cs) / 2;
  const top = (-rows * cs) / 2;
  /** @param {number} c */
  const cellX = (c) => left + (c + 0.5) * cs;
  /** @param {number} r */
  const cellZ = (r) => top + (r + 0.5) * cs;

  const holeByCell = new Map(holes.map((h) => [h.cell, h]));
  /** @type {Box[]} */
  const floor = [];
  /** @type {Box[]} */
  const holeBoxes = [];
  const addFloor = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ z0, /** @type {number} */ z1) => {
    if (x1 - x0 > 1e-6 && z1 - z0 > 1e-6) floor.push(box(x0, x1, -ft, 0, z0, z1));
  };

  for (let r = 0; r < rows; r += 1) {
    const z0 = top + r * cs;
    const z1 = z0 + cs;
    let runStart = -1;
    for (let c = 0; c <= cols; c += 1) {
      const hole = c < cols ? holeByCell.get(r * cols + c) : undefined;
      const solid = c < cols && !hole;
      if (solid && runStart < 0) runStart = c;
      if (!solid && runStart >= 0) {
        addFloor(left + runStart * cs, left + c * cs, z0, z1);
        runStart = -1;
      }
      if (hole) {
        const x0 = left + c * cs;
        const x1 = x0 + cs;
        const hx0 = cellX(c) + hole.x0;
        const hx1 = cellX(c) + hole.x1;
        const hz0 = cellZ(r) + hole.z0;
        const hz1 = cellZ(r) + hole.z1;
        addFloor(x0, x1, z0, hz0);
        addFloor(x0, x1, hz1, z1);
        addFloor(x0, hx0, hz0, hz1);
        addFloor(hx1, x1, hz0, hz1);
        holeBoxes.push(box(hx0, hx1, -ft, 0, hz0, hz1));
      }
    }
  }

  /** @type {Box[]} */
  const walls = [];
  const innerY0 = -ft;
  const innerY1 = geo.innerWallHeight;
  // Walls between columns c and c+1, merged along z.
  for (let c = 0; c < cols - 1; c += 1) {
    const x = left + (c + 1) * cs;
    let runStart = -1;
    for (let r = 0; r <= rows; r += 1) {
      const closed = r < rows && !(maze.open[r * cols + c] & E);
      if (closed && runStart < 0) runStart = r;
      if (!closed && runStart >= 0) {
        walls.push(box(x - t / 2, x + t / 2, innerY0, innerY1, top + runStart * cs - t / 2, top + r * cs + t / 2));
        runStart = -1;
      }
    }
  }
  // Walls between rows r and r+1, merged along x.
  for (let r = 0; r < rows - 1; r += 1) {
    const z = top + (r + 1) * cs;
    let runStart = -1;
    for (let c = 0; c <= cols; c += 1) {
      const closed = c < cols && !(maze.open[r * cols + c] & S);
      if (closed && runStart < 0) runStart = c;
      if (!closed && runStart >= 0) {
        walls.push(box(left + runStart * cs - t / 2, left + c * cs + t / 2, innerY0, innerY1, z - t / 2, z + t / 2));
        runStart = -1;
      }
    }
  }
  // Low outer rim, covering the corners.
  const right = -left;
  const bottom = -top;
  const rimY1 = geo.rimWallHeight;
  walls.push(box(left - t / 2, right + t / 2, innerY0, rimY1, top - t / 2, top + t / 2));
  walls.push(box(left - t / 2, right + t / 2, innerY0, rimY1, bottom - t / 2, bottom + t / 2));
  walls.push(box(left - t / 2, left + t / 2, innerY0, rimY1, top + t / 2, bottom - t / 2));
  walls.push(box(right - t / 2, right + t / 2, innerY0, rimY1, top + t / 2, bottom - t / 2));

  const cellCentre = (/** @type {number} */ cell) => ({
    x: cellX(cell % cols),
    z: cellZ(Math.floor(cell / cols)),
  });

  return {
    width: cols * cs + t,
    depth: rows * cs + t,
    floor,
    walls,
    holes: holeBoxes,
    start: cellCentre(maze.start),
    goal: cellCentre(maze.goal),
  };
}

/**
 * @typedef {object} FloorMesh
 * @property {Float32Array} vertices x, y, z per vertex; every vertex has y = 0.
 * @property {Uint32Array} indices Three per triangle, wound so normals face +y.
 */

/**
 * The top face of the floor as one triangle mesh. Every floor and hole edge
 * becomes a grid line across the whole board, so neighbouring quads share
 * their vertices and no vertex sits on another triangle's edge. Quads inside
 * a hole are left out. A rolling ball then meets one continuous surface
 * instead of the seams between floor boxes, which it would bump over.
 * @param {Layout} layout
 * @returns {FloorMesh}
 */
export function floorMesh(layout) {
  /** @param {number[]} values */
  const breakpoints = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > 1e-6);
  };
  const boxes = [...layout.floor, ...layout.holes];
  const xs = breakpoints(boxes.flatMap((b) => [b.cx - b.hx, b.cx + b.hx]));
  const zs = breakpoints(boxes.flatMap((b) => [b.cz - b.hz, b.cz + b.hz]));
  /**
   * @param {number} x
   * @param {number} z
   */
  const inHole = (x, z) => layout.holes.some((h) => Math.abs(x - h.cx) < h.hx && Math.abs(z - h.cz) < h.hz);

  const vertices = new Float32Array(xs.length * zs.length * 3);
  xs.forEach((x, i) => {
    zs.forEach((z, j) => vertices.set([x, 0, z], (i * zs.length + j) * 3));
  });
  /** @type {number[]} */
  const indices = [];
  for (let i = 0; i + 1 < xs.length; i += 1) {
    for (let j = 0; j + 1 < zs.length; j += 1) {
      if (inHole((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) continue;
      const v00 = i * zs.length + j;
      const v01 = v00 + 1;
      const v10 = v00 + zs.length;
      const v11 = v10 + 1;
      indices.push(v00, v01, v10, v10, v01, v11);
    }
  }
  return { vertices, indices: new Uint32Array(indices) };
}
