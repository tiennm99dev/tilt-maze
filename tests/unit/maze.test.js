import { describe, expect, it } from 'vitest';
import { countPassages, generateMaze, neighbours, solve } from '../../src/level/maze.js';

/** @param {import('../../src/level/maze.js').Maze} maze */
function reachableCount(maze) {
  const seen = new Set([maze.start]);
  const stack = [maze.start];
  while (stack.length) {
    const cell = /** @type {number} */ (stack.pop());
    for (const n of neighbours(maze, cell)) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size;
}

describe('generateMaze', () => {
  it('is deterministic for a seed', () => {
    const a = generateMaze({ cols: 9, rows: 9, seed: 123 });
    const b = generateMaze({ cols: 9, rows: 9, seed: 123 });
    const c = generateMaze({ cols: 9, rows: 9, seed: 124 });
    expect(Array.from(a.open)).toEqual(Array.from(b.open));
    expect(Array.from(a.open)).not.toEqual(Array.from(c.open));
  });

  it('is a spanning tree before walls are removed', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const size of [5, 8, 11]) {
        const maze = generateMaze({ cols: size, rows: size, seed });
        expect(countPassages(maze)).toBe(size * size - 1);
        expect(reachableCount(maze)).toBe(size * size);
      }
    }
  });

  it('keeps open sides symmetric and never opens the border', () => {
    const maze = generateMaze({ cols: 7, rows: 6, seed: 9, braid: 0.15 });
    for (let cell = 0; cell < maze.open.length; cell += 1) {
      for (const n of neighbours(maze, cell)) {
        expect(neighbours(maze, n)).toContain(cell);
      }
      const r = Math.floor(cell / maze.cols);
      const c = cell % maze.cols;
      if (r === 0) expect(maze.open[cell] & 1).toBe(0);
      if (c === maze.cols - 1) expect(maze.open[cell] & 2).toBe(0);
      if (r === maze.rows - 1) expect(maze.open[cell] & 4).toBe(0);
      if (c === 0) expect(maze.open[cell] & 8).toBe(0);
    }
  });

  it('braiding removes the requested share of inner walls', () => {
    const size = 10;
    const tree = generateMaze({ cols: size, rows: size, seed: 5 });
    const braided = generateMaze({ cols: size, rows: size, seed: 5, braid: 0.1 });
    const innerEdges = 2 * size * (size - 1);
    const wallsBefore = innerEdges - countPassages(tree);
    expect(countPassages(braided) - countPassages(tree)).toBe(Math.round(wallsBefore * 0.1));
  });

  it('rejects invalid sizes', () => {
    expect(() => generateMaze({ cols: 1, rows: 5, seed: 1 })).toThrow(RangeError);
    expect(() => generateMaze({ cols: 4.5, rows: 5, seed: 1 })).toThrow(RangeError);
  });
});

describe('solve', () => {
  it('finds a connected route from start to goal', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const maze = generateMaze({ cols: 11, rows: 11, seed, braid: seed % 2 ? 0.1 : 0 });
      const path = solve(maze);
      expect(path[0]).toBe(maze.start);
      expect(path[path.length - 1]).toBe(maze.goal);
      for (let i = 1; i < path.length; i += 1) {
        expect(neighbours(maze, path[i - 1])).toContain(path[i]);
      }
      expect(new Set(path).size).toBe(path.length);
    }
  });
});
