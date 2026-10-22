import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildLayout, floorMesh } from '../../src/level/layout.js';
import { campaignLevel } from '../../src/level/levels.js';
import { N, S } from '../../src/level/maze.js';
import { boardGravity } from '../../src/physics/gravity.js';
import { loadPhysics, PhysicsWorld } from '../../src/physics/world.js';
import { BOARD, PHYSICS, SHAKE } from '../../src/tuning.js';

/** @type {Awaited<ReturnType<typeof loadPhysics>>} */
let RAPIER;
/** @type {PhysicsWorld[]} */
const worlds = [];

beforeAll(async () => {
  RAPIER = await loadPhysics();
});

afterEach(() => {
  for (const w of worlds.splice(0)) w.dispose();
});

const ROWS = 8;

/**
 * A 2-column board whose left column is one straight corridor from the
 * start (bottom row) to the far edge; the right column is walled off.
 * @param {import('../../src/level/holes.js').Hole[]} [holes]
 * @returns {import('../../src/level/levels.js').Level}
 */
function corridor(holes = []) {
  const cols = 2;
  const open = new Uint8Array(cols * ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    const cell = r * cols;
    if (r > 0) open[cell] |= N;
    if (r < ROWS - 1) open[cell] |= S;
  }
  const maze = { cols, rows: ROWS, open, start: (ROWS - 1) * cols, goal: 0 };
  const path = Array.from({ length: ROWS }, (_, i) => (ROWS - 1 - i) * cols);
  return { id: 1, seed: 0, difficulty: { size: ROWS, holes: holes.length, braid: 0 }, maze, path, holes };
}

/**
 * @param {import('../../src/level/layout.js').Layout} layout
 * @param {{x: number, z: number}} [start]
 */
function makeWorld(layout, start = layout.start) {
  const world = new PhysicsWorld(RAPIER, layout, { radius: BOARD.ballRadius, start });
  worlds.push(world);
  return world;
}

/**
 * @param {PhysicsWorld} world
 * @param {number} steps
 * @param {{pitch: number, roll: number}} tilt
 * @param {(p: {x: number, y: number, z: number}) => void} [each]
 */
function run(world, steps, tilt, each) {
  world.setGravity(boardGravity(tilt, PHYSICS.gravity));
  for (let i = 0; i < steps; i += 1) {
    world.step();
    each?.(world.position());
  }
}

describe('floorMesh', () => {
  it('covers exactly the floor boxes, with upward-facing triangles', () => {
    const layout = buildLayout(campaignLevel(10), BOARD);
    const { vertices, indices } = floorMesh(layout);
    let area = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map((i) => i * 3);
      const ux = vertices[b] - vertices[a];
      const uz = vertices[b + 2] - vertices[a + 2];
      const vx = vertices[c] - vertices[a];
      const vz = vertices[c + 2] - vertices[a + 2];
      // y of (b - a) x (c - a): positive means the normal points up.
      const ny = uz * vx - ux * vz;
      expect(ny).toBeGreaterThan(0);
      area += ny / 2;
    }
    const floorArea = layout.floor.reduce((sum, b) => sum + 4 * b.hx * b.hz, 0);
    expect(area).toBeCloseTo(floorArea, 3);
  });
});

describe('PhysicsWorld', () => {
  it('rests grounded on the floor at its radius', () => {
    const world = makeWorld(buildLayout(corridor(), BOARD));
    run(world, 60, { pitch: 0, roll: 0 });
    expect(world.position().y).toBeCloseTo(BOARD.ballRadius, 2);
    expect(world.isGrounded()).toBe(true);
  });

  it('rolls across many cells at full tilt without hopping', () => {
    const layout = buildLayout(corridor(), BOARD);
    const world = makeWorld(layout);
    run(world, 30, { pitch: 0, roll: 0 });
    let maxVy = 0;
    let maxY = 0;
    let airborne = 0;
    run(world, 120, { pitch: 15, roll: 0 }, (p) => {
      maxVy = Math.max(maxVy, Math.abs(world.velocity().y));
      maxY = Math.max(maxY, p.y);
      if (!world.isGrounded()) airborne += 1;
    });
    // It really travelled: from the bottom row past the middle of the board.
    expect(world.position().z).toBeLessThan(0);
    expect(maxVy).toBeLessThan(0.5);
    expect(maxY).toBeLessThan(BOARD.ballRadius + 0.02);
    expect(airborne).toBe(0);
  });

  it('does not tunnel through a wall or the rim on a hard fling', () => {
    const layout = buildLayout(corridor(), BOARD);
    const wallX = -BOARD.wallThickness / 2;
    const rimX = layout.start.x - BOARD.cellSize / 2 + BOARD.wallThickness / 2;

    const east = makeWorld(layout);
    run(east, 10, { pitch: 0, roll: 0 });
    east.kick({ x: 25, y: 0, z: 0 });
    run(east, 60, { pitch: 0, roll: 0 }, (p) => expect(p.x).toBeLessThan(wallX));

    const west = makeWorld(layout);
    run(west, 10, { pitch: 0, roll: 0 });
    west.kick({ x: -25, y: 0, z: 0 });
    run(west, 60, { pitch: 0, roll: 0 }, (p) => expect(p.x).toBeGreaterThan(rimX));
  });

  /**
   * Peak height of the ball centre after a straight-up shake kick on a level board.
   * @param {number} strength Shake strength (1 is right at the threshold).
   */
  function shakePeak(strength) {
    const world = makeWorld(buildLayout(corridor(), BOARD));
    run(world, 30, { pitch: 0, roll: 0 });
    world.kick({ x: 0, y: PHYSICS.shakeUpSpeed * strength, z: 0 });
    let peak = 0;
    run(world, 90, { pitch: 0, roll: 0 }, (p) => {
      peak = Math.max(peak, p.y);
    });
    return peak;
  }

  // The ball clears a wall once its centre rises above the wall top plus its radius.
  it('keeps the ball inside the rim on a shake at the threshold', () => {
    expect(shakePeak(1)).toBeLessThan(BOARD.rimWallHeight + BOARD.ballRadius);
  });

  it('lifts the ball over the rim on a shake at full strength', () => {
    expect(shakePeak(SHAKE.maxStrength)).toBeGreaterThan(BOARD.rimWallHeight + BOARD.ballRadius);
  });

  it('drops a ball over a hole below the falling height', () => {
    const cell = 3 * 2;
    const inner = BOARD.cellSize / 2 - BOARD.wallThickness / 2;
    // Against the west rim, leaving the lane to the east.
    const hole = { cell, x0: -inner, x1: -inner + BOARD.holeSize, z0: -BOARD.holeSize / 2, z1: BOARD.holeSize / 2 };
    const layout = buildLayout(corridor([hole]), BOARD);
    const h = layout.holes[0];
    const world = makeWorld(layout, { x: h.cx, z: h.cz });
    let lowest = Infinity;
    run(world, 60, { pitch: 0, roll: 0 }, (p) => {
      lowest = Math.min(lowest, p.y);
    });
    expect(lowest).toBeLessThan(PHYSICS.fallingY);
  });

  it('respawns on the start cell at rest', () => {
    const layout = buildLayout(corridor(), BOARD);
    const world = makeWorld(layout);
    run(world, 60, { pitch: 15, roll: 0 });
    world.respawn();
    const p = world.position();
    expect(p.x).toBeCloseTo(layout.start.x, 6);
    expect(p.z).toBeCloseTo(layout.start.z, 6);
    const v = world.velocity();
    expect(Math.hypot(v.x, v.y, v.z)).toBe(0);
  });
});
