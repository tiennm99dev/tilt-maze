import { describe, expect, it } from 'vitest';
import { holeLeavesLane, placeHoleInCell, placeHoles } from '../../src/level/holes.js';
import { E, N, S, W, generateMaze, solve } from '../../src/level/maze.js';
import { createRng } from '../../src/level/rng.js';
import { BOARD } from '../../src/tuning.js';

const geo = {
  cellSize: BOARD.cellSize,
  wallThickness: BOARD.wallThickness,
  holeSize: BOARD.holeSize,
  minLaneWidth: BOARD.minLaneWidth,
};

describe('placeHoleInCell', () => {
  it('leaves a lane for every open-side combination except a crossroads', () => {
    const rng = createRng(3);
    for (let mask = 0; mask < 16; mask += 1) {
      for (let i = 0; i < 10; i += 1) {
        const hole = placeHoleInCell(mask, 0, geo, rng.next);
        if (mask === (N | E | S | W)) {
          expect(hole).toBeNull();
          continue;
        }
        expect(hole).not.toBeNull();
        expect(holeLeavesLane(/** @type {import('../../src/level/holes.js').Hole} */ (hole), mask, geo)).toBe(true);
      }
    }
  });

  it('is large enough for the ball to drop through', () => {
    const hole = placeHoleInCell(N | S, 0, geo, () => 0.1);
    expect(hole).not.toBeNull();
    const h = /** @type {import('../../src/level/holes.js').Hole} */ (hole);
    expect(h.x1 - h.x0).toBeGreaterThan(BOARD.ballRadius * 2);
    expect(h.z1 - h.z0).toBeGreaterThan(BOARD.ballRadius * 2);
  });
});

describe('holeLeavesLane', () => {
  it('rejects a hole in the middle of a corridor', () => {
    const centred = { cell: 0, x0: -0.31, x1: 0.31, z0: -0.31, z1: 0.31 };
    expect(holeLeavesLane(centred, N | S, geo)).toBe(false);
  });
});

describe('placeHoles', () => {
  it('never uses the start, the cell after it, or the goal, and keeps lanes open', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const maze = generateMaze({ cols: 11, rows: 11, seed, braid: 0.15 });
      const path = solve(maze);
      const holes = placeHoles(maze, path, 0.12, geo, createRng(seed));
      expect(holes.length).toBeGreaterThan(0);
      for (const hole of holes) {
        expect(hole.cell).not.toBe(maze.start);
        expect(hole.cell).not.toBe(path[1]);
        expect(hole.cell).not.toBe(maze.goal);
        expect(path).toContain(hole.cell);
        expect(holeLeavesLane(hole, maze.open[hole.cell], geo)).toBe(true);
      }
      const indices = holes.map((h) => path.indexOf(h.cell)).sort((a, b) => a - b);
      for (let i = 1; i < indices.length; i += 1) expect(indices[i] - indices[i - 1]).toBeGreaterThan(1);
    }
  });

  it('places nothing at zero density', () => {
    const maze = generateMaze({ cols: 5, rows: 5, seed: 1 });
    expect(placeHoles(maze, solve(maze), 0, geo, createRng(1))).toEqual([]);
  });

  it('refuses geometry with no room for a lane', () => {
    const maze = generateMaze({ cols: 5, rows: 5, seed: 1 });
    expect(() => placeHoles(maze, solve(maze), 0.1, { ...geo, holeSize: 1.2 }, createRng(1))).toThrow(RangeError);
  });
});
