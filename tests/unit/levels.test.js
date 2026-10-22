import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/level/layout.js';
import { CAMPAIGN_SEEDS, campaignLevel, difficultyFor, endlessLevel } from '../../src/level/levels.js';
import { solve } from '../../src/level/maze.js';
import { BOARD, RULES } from '../../src/tuning.js';

describe('difficulty table', () => {
  it('never shrinks the grid or the hole density', () => {
    let prev = difficultyFor(1);
    expect(prev.size).toBe(5);
    expect(prev.holeDensity).toBe(0);
    for (let d = 2; d <= RULES.levelCount; d += 1) {
      const cur = difficultyFor(d);
      expect(cur.size).toBeGreaterThanOrEqual(prev.size);
      expect(cur.holeDensity).toBeGreaterThanOrEqual(prev.holeDensity);
      expect(cur.braid).toBeGreaterThanOrEqual(prev.braid);
      prev = cur;
    }
    expect(prev.size).toBe(11);
    expect(prev.holeDensity).toBeCloseTo(0.12);
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
