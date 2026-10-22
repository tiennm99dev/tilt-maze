/**
 * Level table: ten curated campaign seeds plus an endless mode, all driven by
 * one difficulty parameter so size and hole density only ever grow.
 */

import { BOARD, RULES } from '../tuning.js';
import { placeHoles } from './holes.js';
import { generateMaze, solve } from './maze.js';
import { createRng, randomSeed } from './rng.js';

/**
 * @typedef {object} Difficulty
 * @property {number} size Grid is size x size.
 * @property {number} holeDensity Holes per route cell.
 * @property {number} braid Fraction of inner walls removed.
 */

/**
 * @typedef {object} Level
 * @property {number | 'endless'} id
 * @property {number} seed
 * @property {Difficulty} difficulty
 * @property {import('./maze.js').Maze} maze
 * @property {number[]} path
 * @property {import('./holes.js').Hole[]} holes
 */

/** Campaign seeds, play-tested so each level has a fair, varied layout. */
export const CAMPAIGN_SEEDS = Object.freeze([
  1021, 2207, 3313, 4099, 5153, 6271, 7039, 8191, 9277, 10007,
]);

/** @type {ReadonlyArray<number>} */
const HOLE_DENSITY = Object.freeze([0, 0.03, 0.05, 0.06, 0.08, 0.09, 0.1, 0.11, 0.12, 0.12]);
/** @type {ReadonlyArray<number>} */
const BRAID = Object.freeze([0, 0, 0, 0.05, 0.05, 0.08, 0.1, 0.12, 0.15, 0.15]);

/**
 * @param {number} difficulty 1 to 10.
 * @returns {Difficulty}
 */
export function difficultyFor(difficulty) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > RULES.levelCount) {
    throw new RangeError(`Difficulty must be 1..${RULES.levelCount}, got ${difficulty}`);
  }
  const i = difficulty - 1;
  return {
    size: 5 + Math.round((i * 6) / (RULES.levelCount - 1)),
    holeDensity: HOLE_DENSITY[i],
    braid: BRAID[i],
  };
}

/** @type {import('./holes.js').HoleGeometry} */
const HOLE_GEOMETRY = {
  cellSize: BOARD.cellSize,
  wallThickness: BOARD.wallThickness,
  holeSize: BOARD.holeSize,
  minLaneWidth: BOARD.minLaneWidth,
};

/**
 * @param {number | 'endless'} id
 * @param {number} seed
 * @param {number} difficultyLevel
 * @returns {Level}
 */
export function buildLevel(id, seed, difficultyLevel) {
  const difficulty = difficultyFor(difficultyLevel);
  const maze = generateMaze({
    cols: difficulty.size,
    rows: difficulty.size,
    seed,
    braid: difficulty.braid,
  });
  const path = solve(maze);
  // A separate stream so hole layout does not shift the maze layout.
  const holes = placeHoles(maze, path, difficulty.holeDensity, HOLE_GEOMETRY, createRng(seed ^ 0x9e3779b9));
  return { id, seed, difficulty, maze, path, holes };
}

/**
 * @param {number} levelNumber 1-based campaign level.
 * @returns {Level}
 */
export function campaignLevel(levelNumber) {
  const seed = CAMPAIGN_SEEDS[levelNumber - 1];
  if (seed === undefined) throw new RangeError(`No campaign level ${levelNumber}`);
  return buildLevel(levelNumber, seed, levelNumber);
}

/**
 * @param {number} [seed]
 * @returns {Level}
 */
export function endlessLevel(seed = randomSeed()) {
  return buildLevel('endless', seed, RULES.endlessDifficulty);
}
