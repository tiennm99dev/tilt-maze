/**
 * Maze generation on a rectangular grid: Growing Tree carving (biased toward
 * the newest cell, which gives long winding corridors), optional braiding
 * that removes some inner walls, and a breadth-first shortest route.
 *
 * Cells are indexed `row * cols + col`. Row 0 is the far edge of the board
 * (top of the screen), column 0 the left edge. Each cell stores a bit mask of
 * its open sides.
 */

import { LEVELS } from '../tuning.js';
import { createRng } from './rng.js';

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

/** @type {ReadonlyArray<{bit: number, opposite: number, dr: number, dc: number}>} */
export const SIDES = Object.freeze([
  { bit: N, opposite: S, dr: -1, dc: 0 },
  { bit: E, opposite: W, dr: 0, dc: 1 },
  { bit: S, opposite: N, dr: 1, dc: 0 },
  { bit: W, opposite: E, dr: 0, dc: -1 },
]);

/**
 * @typedef {object} Maze
 * @property {number} cols
 * @property {number} rows
 * @property {Uint8Array} open Open-side bit mask per cell.
 * @property {number} start Start cell index (near-left corner).
 * @property {number} goal Goal cell index (far-right corner).
 */

/**
 * @typedef {object} MazeOptions
 * @property {number} cols
 * @property {number} rows
 * @property {number} seed
 * @property {number} [newestBias] Probability of growing from the newest cell.
 * @property {number} [braid] Fraction of remaining inner walls to remove.
 * @property {number} [keepRatio] A removed wall may not shorten the start-to-goal
 *   route below this share of its length before braiding.
 */

/**
 * @param {MazeOptions} options
 * @returns {Maze}
 */
export function generateMaze({
  cols,
  rows,
  seed,
  newestBias = LEVELS.newestBias,
  braid = 0,
  keepRatio = LEVELS.braidKeepRatio,
}) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2) {
    throw new RangeError(`Maze needs integer size >= 2x2, got ${cols}x${rows}`);
  }
  const rng = createRng(seed);
  const open = new Uint8Array(cols * rows);
  const visited = new Uint8Array(cols * rows);
  const start = (rows - 1) * cols;
  const active = [start];
  visited[start] = 1;

  while (active.length > 0) {
    const pickIndex = rng.next() < newestBias ? active.length - 1 : rng.int(active.length);
    const cell = active[pickIndex];
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    const options = SIDES.filter(({ dr, dc }) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr * cols + nc];
    });
    if (options.length === 0) {
      active.splice(pickIndex, 1);
      continue;
    }
    const side = rng.pick(options);
    const next = (r + side.dr) * cols + (c + side.dc);
    open[cell] |= side.bit;
    open[next] |= side.opposite;
    visited[next] = 1;
    active.push(next);
  }

  const maze = { cols, rows, open, start, goal: cols - 1 };
  if (braid > 0) removeWalls(maze, braid, keepRatio, rng);
  return maze;
}

/**
 * Opens a fraction of the inner walls that are still closed, adding loops.
 * A wall whose opening would cut the start-to-goal route below `keepRatio`
 * of its unbraided length stays closed, so loops add choices instead of a
 * near-straight shortcut. When too few walls qualify, fewer are opened.
 * @param {Maze} maze
 * @param {number} fraction
 * @param {number} keepRatio
 * @param {import('./rng.js').Rng} rng
 */
function removeWalls(maze, fraction, keepRatio, rng) {
  /** @type {Array<[number, number]>} */
  const closed = [];
  for (let r = 0; r < maze.rows; r += 1) {
    for (let c = 0; c < maze.cols; c += 1) {
      const cell = r * maze.cols + c;
      if (c < maze.cols - 1 && !(maze.open[cell] & E)) closed.push([cell, E]);
      if (r < maze.rows - 1 && !(maze.open[cell] & S)) closed.push([cell, S]);
    }
  }
  rng.shuffle(closed);
  const count = Math.round(closed.length * fraction);
  const minRoute = solve(maze).length * keepRatio;
  let opened = 0;
  for (const [cell, bit] of closed) {
    if (opened >= count) break;
    const other = bit === E ? cell + 1 : cell + maze.cols;
    const back = bit === E ? W : N;
    maze.open[cell] |= bit;
    maze.open[other] |= back;
    if (solve(maze).length < minRoute) {
      maze.open[cell] &= ~bit;
      maze.open[other] &= ~back;
    } else {
      opened += 1;
    }
  }
}

/**
 * @param {Maze} maze
 * @param {number} cell
 * @returns {number[]} Indices of cells reachable through an open side.
 */
export function neighbours(maze, cell) {
  const r = Math.floor(cell / maze.cols);
  const c = cell % maze.cols;
  /** @type {number[]} */
  const out = [];
  for (const { bit, dr, dc } of SIDES) {
    if (maze.open[cell] & bit) out.push((r + dr) * maze.cols + (c + dc));
  }
  return out;
}

/**
 * @param {Maze} maze
 * @returns {number} Number of open inner passages.
 */
export function countPassages(maze) {
  let count = 0;
  for (let cell = 0; cell < maze.open.length; cell += 1) {
    if (maze.open[cell] & E) count += 1;
    if (maze.open[cell] & S) count += 1;
  }
  return count;
}

/**
 * Breadth-first shortest route between two cells.
 * @param {Maze} maze
 * @param {number} [from]
 * @param {number} [to]
 * @returns {number[]} Cells from `from` to `to` inclusive, or [] if unreachable.
 */
export function solve(maze, from = maze.start, to = maze.goal) {
  const prev = new Int32Array(maze.open.length).fill(-1);
  prev[from] = from;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === to) break;
    for (const next of neighbours(maze, cell)) {
      if (prev[next] === -1) {
        prev[next] = cell;
        queue.push(next);
      }
    }
  }
  if (prev[to] === -1) return [];
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev[path[path.length - 1]]);
  return path.reverse();
}
