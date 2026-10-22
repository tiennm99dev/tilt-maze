/**
 * Level table: ten curated campaign seeds plus an endless mode, all driven by
 * one difficulty parameter so size, holes and loops only ever grow.
 */

import { BOARD, LEVELS, RULES } from '../tuning.js';
import { placeHoles } from './holes.js';
import { generateMaze, solve } from './maze.js';
import { createRng, randomSeed } from './rng.js';

/**
 * @typedef {object} Difficulty
 * @property {number} size Grid is size x size.
 * @property {number} holes Holes wanted on the route.
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

/**
 * Campaign seeds, picked so the route length and the hole count never drop
 * from one level to the next and no hole has an equally short way round.
 * Changing the generator changes every layout; the fingerprint test in
 * tests/unit/levels.test.js makes that a deliberate step.
 */
export const CAMPAIGN_SEEDS = Object.freeze([
  70, 11, 243, 3, 25, 48, 176, 220, 10, 24,
]);

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
    size: LEVELS.minSize + Math.round((i * (LEVELS.maxSize - LEVELS.minSize)) / (RULES.levelCount - 1)),
    holes: LEVELS.holes[i],
    braid: LEVELS.braid[i],
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
  const holes = placeHoles(maze, path, difficulty.holes, HOLE_GEOMETRY, createRng(seed ^ 0x9e3779b9));
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
