import { describe, expect, it } from 'vitest';
import { createFixedStepper } from '../../src/game/loop.js';

const options = { stepSeconds: 1 / 60, maxSteps: 5, maxFrameSeconds: 0.1 };

describe('createFixedStepper', () => {
  it('runs one step per 60 Hz frame and two steps per 30 Hz frame', () => {
    const s = createFixedStepper(options);
    let count = 0;
    const step = () => {
      count += 1;
    };
    for (let i = 0; i < 60; i += 1) s.advance(1 / 60 + 1e-9, step);
    expect(count).toBe(60);
    count = 0;
    s.advance(1 / 30 + 1e-9, step);
    expect(count).toBe(2);
  });

  it('carries leftover time and reports it as alpha', () => {
    const s = createFixedStepper(options);
    const r1 = s.advance(1 / 120, () => {});
    expect(r1.steps).toBe(0);
    expect(r1.alpha).toBeCloseTo(0.5);
    const r2 = s.advance(1 / 120 + 1e-9, () => {});
    expect(r2.steps).toBe(1);
  });

  it('clamps long frames and caps steps', () => {
    const s = createFixedStepper(options);
    let count = 0;
    const r = s.advance(5, () => {
      count += 1;
    });
    expect(count).toBe(5);
    expect(r.steps).toBe(5);
    expect(s.advance(0, () => {}).steps).toBe(0);
  });

  it('ignores negative frame times and rejects bad options', () => {
    const s = createFixedStepper(options);
    expect(s.advance(-1, () => {}).steps).toBe(0);
    expect(() => createFixedStepper({ ...options, stepSeconds: 0 })).toThrow(RangeError);
  });
});
