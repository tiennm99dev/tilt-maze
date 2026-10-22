import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/level/layout.js';
import { CAMPAIGN_SEEDS, campaignLevel, difficultyFor, endlessLevel } from '../../src/level/levels.js';
import { E, N, S, W, neighbours, solve } from '../../src/level/maze.js';
import { BOARD, RULES } from '../../src/tuning.js';

describe('difficulty table', () => {
  it('never shrinks the grid, the hole count or the loops', () => {
    let prev = difficultyFor(1);
    expect(prev.size).toBe(5);
    expect(prev.holes).toBe(0);
    for (let d = 2; d <= RULES.levelCount; d += 1) {
      const cur = difficultyFor(d);
      expect(cur.size).toBeGreaterThanOrEqual(prev.size);
      expect(cur.holes).toBeGreaterThanOrEqual(prev.holes);
      expect(cur.braid).toBeGreaterThanOrEqual(prev.braid);
      prev = cur;
    }
    expect(prev.size).toBe(11);
    expect(difficultyFor(2).holes).toBeGreaterThan(0);
  });

  it('rejects out-of-range difficulty', () => {
    expect(() => difficultyFor(0)).toThrow(RangeError);
    expect(() => difficultyFor(11)).toThrow(RangeError);
  });
});

describe('levels', () => {
  it('has one seed per campaign level and every level is solvable', () => {
    expect(CAMPAIGN_SEEDS).toHaveLength(RULES.levelCount);
    for (let n = 1; n <= RULES.levelCount; n += 1) {
      const level = campaignLevel(n);
      expect(level.path.length).toBeGreaterThan(1);
      expect(solve(level.maze)).toEqual(level.path);
    }
    expect(() => campaignLevel(RULES.levelCount + 1)).toThrow(RangeError);
  });

  it('gets longer and holier from each campaign level to the next', () => {
    let prev = campaignLevel(1);
    for (let n = 2; n <= RULES.levelCount; n += 1) {
      const cur = campaignLevel(n);
      expect(cur.path.length).toBeGreaterThanOrEqual(prev.path.length);
      expect(cur.holes.length).toBeGreaterThanOrEqual(prev.holes.length);
      expect(cur.holes).toHaveLength(cur.difficulty.holes);
      prev = cur;
    }
  });

  it('puts no campaign hole where an equally short route goes round it', () => {
    for (let n = 1; n <= RULES.levelCount; n += 1) {
      const { maze, path, holes } = campaignLevel(n);
      for (const hole of holes) {
        const open = maze.open.slice();
        for (const nb of neighbours(maze, hole.cell)) {
          const d = nb - hole.cell;
          open[nb] &= ~(d === -maze.cols ? S : d === maze.cols ? N : d === 1 ? W : E);
        }
        open[hole.cell] = 0;
        const detour = solve({ ...maze, open });
        if (detour.length > 0) expect(detour.length).toBeGreaterThan(path.length);
      }
    }
  });

  it('keeps the curated campaign layouts unless they are changed on purpose', () => {
    // Update these only together with a deliberate generator or seed change.
    /** @param {Uint8Array} bytes */
    const fnv = (bytes) => {
      let h = 0x811c9dc5;
      for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
      return h.toString(16).padStart(8, '0');
    };
    const fingerprints = [];
    for (let n = 1; n <= RULES.levelCount; n += 1) {
      const level = campaignLevel(n);
      fingerprints.push({ open: fnv(level.maze.open), route: level.path.length, holes: level.holes.map((h) => h.cell) });
    }
    expect(fingerprints).toEqual([
      { open: '774c7734', route: 15, holes: [] },
      { open: 'e7577e5a', route: 19, holes: [27] },
      { open: '29b5cb28', route: 23, holes: [2] },
      { open: 'c47f4578', route: 27, holes: [13, 27] },
      { open: '52d014d4', route: 31, holes: [28, 51] },
      { open: 'cfdb696c', route: 35, holes: [10, 36, 12] },
      { open: 'bec4cdcb', route: 39, holes: [3, 14, 36] },
      { open: '94cdbc31', route: 43, holes: [74, 47, 38, 46] },
      { open: '97515054', route: 45, holes: [8, 45, 16, 32, 11] },
      { open: '8ac7a1fc', route: 49, holes: [106, 102, 100, 82, 91, 90] },
    ]);
  });

  it('builds the same campaign level every time', () => {
    const a = campaignLevel(7);
    const b = campaignLevel(7);
    expect(Array.from(a.maze.open)).toEqual(Array.from(b.maze.open));
    expect(a.holes).toEqual(b.holes);
  });

  it('endless mode builds a solvable maze at the top difficulty', () => {
    const level = endlessLevel(987654);
    expect(level.id).toBe('endless');
    expect(level.difficulty).toEqual(difficultyFor(RULES.endlessDifficulty));
    expect(level.path[level.path.length - 1]).toBe(level.maze.goal);
  });
});

describe('buildLayout', () => {
  it('cuts a floor opening for each hole and centres the board', () => {
    const level = campaignLevel(10);
    const layout = buildLayout(level, BOARD);
    expect(layout.holes).toHaveLength(level.holes.length);
    const floorArea = layout.floor.reduce((sum, b) => sum + 4 * b.hx * b.hz, 0);
    const holeArea = layout.holes.reduce((sum, b) => sum + 4 * b.hx * b.hz, 0);
    const gridArea = (level.maze.cols * BOARD.cellSize) ** 2;
    expect(floorArea + holeArea).toBeCloseTo(gridArea, 6);
    expect(layout.start.x).toBeCloseTo(-layout.goal.x, 6);
    expect(layout.start.z).toBeCloseTo(-layout.goal.z, 6);
  });

  it('keeps the rim lower than the inner walls', () => {
    const layout = buildLayout(campaignLevel(3), BOARD);
    const tops = layout.walls.map((b) => b.cy + b.hy);
    expect(Math.min(...tops)).toBeCloseTo(BOARD.rimWallHeight, 6);
    expect(Math.max(...tops)).toBeCloseTo(BOARD.innerWallHeight, 6);
    expect(BOARD.rimWallHeight).toBeGreaterThan(BOARD.ballRadius);
  });
});
