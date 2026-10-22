import { describe, expect, it } from 'vitest';
import { createShakeDetector } from '../../src/input/shake-detector.js';
import { SHAKE } from '../../src/tuning.js';

const v = (/** @type {number} */ x, y = 0, z = 0) => ({ x, y, z });

describe('createShakeDetector', () => {
  it('fires once above the threshold and not again within the cooldown', () => {
    const d = createShakeDetector(SHAKE);
    expect(d.update(v(SHAKE.thresholdMs2 * 0.9), null, 0)).toBe(0);
    expect(d.update(v(SHAKE.thresholdMs2 * 1.2), null, 16)).toBeCloseTo(1.2);
    expect(d.update(v(SHAKE.thresholdMs2 * 1.5), null, 32)).toBe(0);
    expect(d.update(v(SHAKE.thresholdMs2 * 1.5), null, 16 + SHAKE.cooldownMs - 1)).toBe(0);
    expect(d.update(v(SHAKE.thresholdMs2 * 1.5), null, 16 + SHAKE.cooldownMs)).toBeCloseTo(1.5);
  });

  it('uses magnitude, not axis sign, and caps strength', () => {
    const d = createShakeDetector(SHAKE);
    expect(d.update(v(-12, 0, -12), null, 0)).toBeCloseTo(Math.hypot(12, 12) / SHAKE.thresholdMs2);
    const e = createShakeDetector(SHAKE);
    expect(e.update(v(500), null, 0)).toBe(SHAKE.maxStrength);
  });

  it('high-passes acceleration including gravity when acceleration is missing', () => {
    const d = createShakeDetector(SHAKE);
    const missing = { x: null, y: null, z: null };
    // Holding still under gravity never counts as a shake.
    for (let t = 0; t <= 2000; t += 16) expect(d.update(missing, v(0, 9.81, 0), t)).toBe(0);
    // A sudden jolt does.
    expect(d.update(missing, v(20, 9.81, 0), 2016)).toBeGreaterThan(1);
  });

  it('ignores samples with no data', () => {
    const d = createShakeDetector(SHAKE);
    expect(d.update(null, null, 0)).toBe(0);
    expect(d.update(undefined, { x: 1, y: null, z: 1 }, 10)).toBe(0);
  });
});
