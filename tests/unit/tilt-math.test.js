import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { calibrationFor, tiltFromUp, toScreenFrame, upFromOrientation } from '../../src/input/tilt-math.js';

const DEG = Math.PI / 180;
const identity = calibrationFor(new Vector3(0, 0, 1));

/**
 * Browser-style beta/gamma for a device-frame up vector, with gamma limited
 * to [-90, 90) as the spec requires.
 * @param {Vector3} up
 */
function anglesFor(up) {
  // cos(gamma) >= 0 inside [-90, 90), so cos(beta) carries the sign of z.
  const g = Math.atan(-up.x / (Math.abs(up.z) < 1e-12 ? 1e-12 : up.z));
  const cosB = Math.abs(Math.cos(g)) < 1e-9 ? Math.hypot(up.x, up.z) : up.z / Math.cos(g);
  return { beta: Math.atan2(up.y, cosB) / DEG, gamma: g / DEG };
}

describe('upFromOrientation', () => {
  it('points out of the screen when flat and up the phone when upright', () => {
    const flat = upFromOrientation(0, 0);
    expect(flat.x).toBeCloseTo(0);
    expect(flat.y).toBeCloseTo(0);
    expect(flat.z).toBeCloseTo(1);
    const upright = upFromOrientation(90, 0);
    expect(upright.y).toBeCloseTo(1);
    expect(upright.z).toBeCloseTo(0);
  });

  it('has no jump when gamma wraps at ±90°', () => {
    // Roll the phone smoothly from lying flat over onto its right edge and
    // past it, so gamma crosses its ±90° wrap.
    let prev = null;
    for (let deg = 0; deg <= 160; deg += 1) {
      const a = deg * DEG;
      const truth = new Vector3(-Math.sin(a), 0.2, Math.cos(a)).normalize();
      const { beta, gamma } = anglesFor(truth);
      expect(gamma).toBeGreaterThanOrEqual(-90);
      expect(gamma).toBeLessThan(90);
      const up = upFromOrientation(beta, gamma);
      expect(up.distanceTo(truth)).toBeLessThan(1e-6);
      const tilt = tiltFromUp(up, identity);
      if (prev) {
        expect(Math.abs(tilt.roll - prev.roll)).toBeLessThan(2);
        expect(Math.abs(tilt.pitch - prev.pitch)).toBeLessThan(2);
      }
      prev = tilt;
    }
  });
});

describe('tiltFromUp', () => {
  it('reads roll right and pitch away with the documented signs', () => {
    // Right edge lowered: gamma > 0.
    expect(tiltFromUp(upFromOrientation(0, 10), identity).roll).toBeCloseTo(10);
    // Top edge lowered: beta < 0.
    expect(tiltFromUp(upFromOrientation(-10, 0), identity).pitch).toBeCloseTo(10);
  });

  it('gives zero tilt at the calibrated neutral pose', () => {
    for (const [beta, gamma] of [[40, 0], [35, -12], [-20, 30], [70, 5]]) {
      const neutral = upFromOrientation(beta, gamma);
      const tilt = tiltFromUp(neutral, calibrationFor(neutral));
      expect(tilt.pitch).toBeCloseTo(0, 6);
      expect(tilt.roll).toBeCloseTo(0, 6);
    }
  });

  it('measures tilt relative to a steep neutral pose', () => {
    const neutral = upFromOrientation(45, 0);
    const tilted = upFromOrientation(35, 0);
    expect(tiltFromUp(tilted, calibrationFor(neutral)).pitch).toBeCloseTo(10, 4);
  });
});

describe('toScreenFrame', () => {
  it('maps a right-edge-down roll in portrait to roll right', () => {
    const up = upFromOrientation(0, 10);
    expect(tiltFromUp(toScreenFrame(up, 0), identity).roll).toBeCloseTo(10);
  });

  it('rotates device axes into landscape screen axes', () => {
    // Landscape, angle 90: the device's top points left on screen, so
    // lowering the device top lowers the screen's left side.
    const topDown = upFromOrientation(-10, 0);
    expect(tiltFromUp(toScreenFrame(topDown, 90), identity).roll).toBeCloseTo(-10);
    expect(tiltFromUp(toScreenFrame(topDown, 270), identity).roll).toBeCloseTo(10);
    expect(tiltFromUp(toScreenFrame(topDown, -90), identity).roll).toBeCloseTo(10);
    // The device's right edge points up the screen at angle 90.
    const rightDown = upFromOrientation(0, 10);
    expect(tiltFromUp(toScreenFrame(rightDown, 90), identity).pitch).toBeCloseTo(10);
    expect(tiltFromUp(toScreenFrame(rightDown, 180), identity).roll).toBeCloseTo(-10);
  });

  it('honours the sign constant', () => {
    const topDown = upFromOrientation(-10, 0);
    expect(tiltFromUp(toScreenFrame(topDown, 90, -1), identity).roll).toBeCloseTo(10);
  });
});

describe('calibrationFor', () => {
  it('falls back to identity for a zero vector', () => {
    const q = calibrationFor(new Vector3());
    expect([q.x, q.y, q.z, q.w]).toEqual([0, 0, 0, 1]);
  });
});
