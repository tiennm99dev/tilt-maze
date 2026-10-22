import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFallbackControls } from '../../src/input/fallback.js';

const MAX = 25;

/**
 * @param {string} type
 * @param {Record<string, unknown>} props
 */
const event = (type, props) => Object.assign(new Event(type, { cancelable: true }), props);

/** @param {Record<string, unknown>} props */
const key = (props) => event('keydown', { repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...props });

/**
 * @param {string} type
 * @param {Record<string, unknown>} props
 */
const pointer = (type, props) => event(type, { pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, ...props });

/** @type {EventTarget} */
let win;
/** @type {EventTarget} */
let surface;
/** @type {import('vitest').Mock<() => void>} */
let onShake;
/** @type {ReturnType<typeof createFallbackControls>} */
let controls;

beforeEach(() => {
  win = new EventTarget();
  vi.stubGlobal('window', Object.assign(win, { innerWidth: 1000, innerHeight: 800 }));
  vi.stubGlobal('HTMLElement', class {});
  surface = new EventTarget();
  onShake = vi.fn();
  controls = createFallbackControls({
    surface: /** @type {HTMLElement} */ (/** @type {unknown} */ (surface)),
    phoneMaxDeg: MAX,
    dragFullTiltFraction: 0.25,
    onShake,
  });
});

afterEach(() => {
  controls.dispose();
  vi.unstubAllGlobals();
});

describe('keys', () => {
  it('maps codes, and keys without a code, to a full tilt', () => {
    expect(controls.target()).toBeNull();
    const down = key({ code: 'KeyD', key: 'd' });
    win.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(controls.target()).toEqual({ pitch: 0, roll: MAX });
    win.dispatchEvent(key({ code: '', key: 'W' }));
    expect(controls.target()).toEqual({ pitch: MAX, roll: MAX });
    win.dispatchEvent(event('keyup', { code: 'KeyD', key: 'd' }));
    win.dispatchEvent(event('keyup', { code: '', key: 'W' }));
    expect(controls.target()).toBeNull();
  });

  it('shakes on Space once per press', () => {
    const down = key({ code: 'Space', key: ' ' });
    win.dispatchEvent(down);
    win.dispatchEvent(key({ code: 'Space', key: ' ', repeat: true }));
    expect(down.defaultPrevented).toBe(true);
    expect(onShake).toHaveBeenCalledTimes(1);
  });

  it('leaves modifier chords to the browser', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      const down = key({ code: 'KeyS', key: 's', [mod]: true });
      win.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(false);
    }
    win.dispatchEvent(key({ code: 'Space', key: ' ', ctrlKey: true }));
    expect(onShake).not.toHaveBeenCalled();
    expect(controls.target()).toBeNull();
  });

  it('drops held keys when Meta is released, since macOS skips their keyup', () => {
    win.dispatchEvent(key({ code: 'KeyD', key: 'd' }));
    win.dispatchEvent(event('keyup', { code: 'MetaLeft', key: 'Meta' }));
    expect(controls.target()).toBeNull();
  });

  it('ignores keys and clears held ones while disabled', () => {
    win.dispatchEvent(key({ code: 'ArrowLeft', key: 'ArrowLeft' }));
    controls.setKeysEnabled(false);
    expect(controls.target()).toBeNull();
    const space = key({ code: 'Space', key: ' ' });
    const arrow = key({ code: 'ArrowUp', key: 'ArrowUp' });
    win.dispatchEvent(space);
    win.dispatchEvent(arrow);
    expect(space.defaultPrevented).toBe(false);
    expect(arrow.defaultPrevented).toBe(false);
    expect(onShake).not.toHaveBeenCalled();
    expect(controls.target()).toBeNull();
    controls.setKeysEnabled(true);
    win.dispatchEvent(key({ code: 'ArrowUp', key: 'ArrowUp' }));
    expect(controls.target()).toEqual({ pitch: MAX, roll: 0 });
  });

  it('releases keys and drag on window blur', () => {
    win.dispatchEvent(key({ code: 'KeyA', key: 'a' }));
    surface.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    win.dispatchEvent(new Event('blur'));
    expect(controls.target()).toBeNull();
  });
});

describe('drag', () => {
  it('clamps the tilt to the maximum radius', () => {
    // Full tilt at min(1000, 800) * 0.25 = 200 px.
    surface.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    surface.dispatchEvent(pointer('pointermove', { clientX: 200, clientY: 100 }));
    expect(controls.target()).toEqual({ pitch: -0, roll: MAX / 2 });
    surface.dispatchEvent(pointer('pointermove', { clientX: 1000, clientY: -800 }));
    const t = /** @type {{pitch: number, roll: number}} */ (controls.target());
    expect(Math.hypot(t.pitch, t.roll)).toBeCloseTo(MAX);
    expect(t.pitch).toBeGreaterThan(0);
    surface.dispatchEvent(pointer('pointerup', {}));
    expect(controls.target()).toBeNull();
  });

  it('ignores right clicks and non-primary pointers', () => {
    surface.dispatchEvent(pointer('pointerdown', { button: 2, clientX: 0, clientY: 0 }));
    surface.dispatchEvent(pointer('pointerdown', { isPrimary: false, pointerType: 'touch', clientX: 0, clientY: 0 }));
    expect(controls.target()).toBeNull();
    const menu = event('contextmenu', {});
    surface.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('ends the drag when pointer capture is lost', () => {
    surface.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(controls.target()).not.toBeNull();
    surface.dispatchEvent(pointer('lostpointercapture', {}));
    expect(controls.target()).toBeNull();
  });

  it('drops an active drag when drag is disabled', () => {
    surface.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    controls.setDragEnabled(false);
    expect(controls.target()).toBeNull();
    surface.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(controls.target()).toBeNull();
  });
});
