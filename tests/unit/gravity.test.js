import { describe, expect, it } from 'vitest';
import { boardGravity } from '../../src/physics/gravity.js';

describe('boardGravity', () => {
  it('points straight down on a level board', () => {
    const g = boardGravity({ pitch: 0, roll: 0 }, 10);
    expect(g.x).toBeCloseTo(0);
    expect(g.y).toBeCloseTo(-10);
    expect(g.z).toBeCloseTo(0);
  });

  it('pulls the ball right for positive roll and up the screen for positive pitch', () => {
    const roll = boardGravity({ pitch: 0, roll: 15 }, 10);
    expect(roll.x).toBeCloseTo(10 * Math.sin((15 * Math.PI) / 180));
    const pitch = boardGravity({ pitch: 15, roll: 0 }, 10);
    expect(pitch.z).toBeCloseTo(-10 * Math.sin((15 * Math.PI) / 180));
    expect(pitch.length()).toBeCloseTo(10);
  });
});
