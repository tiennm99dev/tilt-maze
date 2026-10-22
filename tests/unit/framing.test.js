import { describe, expect, it } from 'vitest';
import { boardExtent, fitDistance } from '../../src/render/framing.js';
import { BOARD, RENDER, TILT } from '../../src/tuning.js';

const DEG = Math.PI / 180;

/**
 * @param {number} cells Maze side in cells.
 * @param {number} aspect Viewport width / height.
 */
const options = (cells, aspect) => ({
  size: cells * BOARD.cellSize + BOARD.wallThickness,
  top: BOARD.innerWallHeight,
  bottom: BOARD.floorThickness,
  aspect,
  fovDeg: RENDER.fovDeg,
  leanDeg: RENDER.cameraLeanDeg,
  tiltDeg: TILT.boardMaxDeg,
  maxX: RENDER.portraitFitNdc,
  maxY: 1 - (2 * RENDER.hudReservePx) / 844,
});

/**
 * The landscape formula in scene.js, for comparison.
 * @param {number} size
 * @param {number} aspect
 */
const marginDistance = (size, aspect) => {
  const half = (size / 2) * RENDER.framingMargin;
  const tanV = Math.tan((RENDER.fovDeg * DEG) / 2);
  return Math.max(half / tanV, half / (tanV * aspect)) + half * 0.35;
};

describe('fitDistance', () => {
  for (const cells of [5, 8, 11]) {
    for (const aspect of [360 / 740, 390 / 844, 0.75, 0.99]) {
      it(`fits a fully tilted ${cells}x${cells} board at aspect ${aspect.toFixed(2)}`, () => {
        const o = options(cells, aspect);
        const d = fitDistance(o);
        const e = boardExtent(o, d);
        expect(e.x).toBeLessThanOrEqual(o.maxX);
        expect(e.y).toBeLessThanOrEqual(o.maxY);
        // Tight: 2% closer and a corner leaves the allowed area.
        const closer = boardExtent(o, d * 0.98);
        expect(closer.x > o.maxX || closer.y > o.maxY).toBe(true);
      });
    }
  }

  it('frames a phone in portrait closer than the fixed margins did', () => {
    const o = options(11, 390 / 844);
    expect(fitDistance(o)).toBeLessThan(marginDistance(o.size, o.aspect) * 0.97);
  });
});
