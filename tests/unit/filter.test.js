import { describe, expect, it } from 'vitest';
import { createSmoother, shapeTilt } from '../../src/input/filter.js';
import { TILT } from '../../src/tuning.js';

const base = {
  deadZoneDeg: TILT.deadZoneDeg,
  phoneMaxDeg: TILT.phoneMaxDeg,
  boardMaxDeg: TILT.boardMaxDeg,
  sensitivity: 1,
  invert: false,
};

describe('shapeTilt', () => {
  it('ignores tilt inside the dead zone', () => {
    expect(shapeTilt({ pitch: TILT.deadZoneDeg * 0.9, roll: 0 }, base)).toEqual({ pitch: 0, roll: 0 });
    expect(shapeTilt({ pitch: 1.2, roll: 1.2 }, base)).toEqual({ pitch: 0, roll: 0 });
  });

  it('rises from zero at the dead-zone edge without a jump', () => {
    const just = shapeTilt({ pitch: TILT.deadZoneDeg + 0.01, roll: 0 }, base);
    expect(just.pitch).toBeGreaterThan(0);
    expect(just.pitch).toBeLessThan(0.05);
  });

  it('maps the phone cap to the board cap and clamps beyond it', () => {
    expect(shapeTilt({ pitch: TILT.phoneMaxDeg, roll: 0 }, base).pitch).toBeCloseTo(TILT.boardMaxDeg);
    expect(shapeTilt({ pitch: 0, roll: -60 }, base).roll).toBeCloseTo(-TILT.boardMaxDeg);
    const diag = shapeTilt({ pitch: 40, roll: 40 }, base);
    expect(Math.hypot(diag.pitch, diag.roll)).toBeCloseTo(TILT.boardMaxDeg);
    expect(diag.pitch).toBeCloseTo(diag.roll);
  });

  it('is linear between dead zone and cap', () => {
    const mid = (TILT.deadZoneDeg + TILT.phoneMaxDeg) / 2;
    expect(shapeTilt({ pitch: mid, roll: 0 }, base).pitch).toBeCloseTo(TILT.boardMaxDeg / 2);
  });

  it('applies sensitivity before the cap', () => {
    const mid = (TILT.deadZoneDeg + TILT.phoneMaxDeg) / 2;
    expect(shapeTilt({ pitch: mid, roll: 0 }, { ...base, sensitivity: 2 }).pitch).toBeCloseTo(TILT.boardMaxDeg);
    expect(shapeTilt({ pitch: TILT.phoneMaxDeg, roll: 0 }, { ...base, sensitivity: 0.5 }).pitch).toBeCloseTo(
      TILT.boardMaxDeg / 2,
    );
    expect(shapeTilt({ pitch: TILT.phoneMaxDeg, roll: 0 }, { ...base, sensitivity: 2 }).pitch).toBeCloseTo(
      TILT.boardMaxDeg,
    );
  });

  it('inverts both axes', () => {
    const normal = shapeTilt({ pitch: 10, roll: -6 }, base);
    const inverted = shapeTilt({ pitch: 10, roll: -6 }, { ...base, invert: true });
    expect(inverted.pitch).toBeCloseTo(-normal.pitch);
    expect(inverted.roll).toBeCloseTo(-normal.roll);
  });
});

describe('createSmoother', () => {
  it('converges the same way whatever the frame rate', () => {
    const at60 = createSmoother(80);
    const at120 = createSmoother(80);
    const target = { pitch: 10, roll: -10 };
    let a = { pitch: 0, roll: 0 };
    let b = { pitch: 0, roll: 0 };
    for (let i = 0; i < 6; i += 1) a = at60.update(target, 1000 / 60);
    for (let i = 0; i < 12; i += 1) b = at120.update(target, 1000 / 120);
    expect(a.pitch).toBeCloseTo(b.pitch, 6);
    expect(a.roll).toBeCloseTo(b.roll, 6);
    expect(a.pitch).toBeGreaterThan(5);
    expect(a.pitch).toBeLessThan(10);
  });

  it('reaches about 63% of a step after one time constant', () => {
    const s = createSmoother(80);
    expect(s.update({ pitch: 1, roll: 0 }, 80).pitch).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});
