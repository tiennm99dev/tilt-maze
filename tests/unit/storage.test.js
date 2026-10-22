import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, createStorage, defaultSave } from '../../src/storage.js';

function memoryBackend(initial = /** @type {Record<string, string>} */ ({})) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (/** @type {string} */ k) => map.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => {
      map.set(k, v);
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('createStorage', () => {
  it('saves and reloads progress', () => {
    const backend = memoryBackend();
    const a = createStorage(backend);
    expect(a.recordWin(1, 12345)).toEqual({ newBest: true, best: 12345 });
    expect(a.recordWin(1, 20000)).toEqual({ newBest: false, best: 12345 });
    a.update({ muted: true, sensitivity: 1.5 });
    const b = createStorage(backend);
    expect(b.get().best['1']).toBe(12345);
    expect(b.get().unlocked).toBe(2);
    expect(b.get().muted).toBe(true);
    expect(b.get().sensitivity).toBe(1.5);
  });

  it('keeps working when localStorage throws', () => {
    const s = createStorage(throwing);
    expect(s.get()).toEqual(defaultSave());
    expect(() => s.update({ muted: true })).not.toThrow();
    expect(s.get().muted).toBe(true);
    expect(s.recordWin(3, 1000).newBest).toBe(true);
  });

  it('works with no storage at all', () => {
    const s = createStorage(null);
    s.update({ invert: true });
    expect(s.get().invert).toBe(true);
  });

  it('ignores an unknown version and corrupt JSON', () => {
    expect(createStorage(memoryBackend({ [STORAGE_KEY]: JSON.stringify({ v: 99, unlocked: 10 }) })).get()).toEqual(
      defaultSave(),
    );
    expect(createStorage(memoryBackend({ [STORAGE_KEY]: '{not json' })).get()).toEqual(defaultSave());
  });

  it('clamps and drops invalid fields', () => {
    const raw = {
      v: 1,
      best: { 1: 5000, 2: -4, 3: 'fast' },
      unlocked: 99,
      calibration: { x: 0, y: 0, z: 0 },
      sensitivity: 9,
      invert: 'yes',
      muted: true,
    };
    const s = createStorage(memoryBackend({ [STORAGE_KEY]: JSON.stringify(raw) })).get();
    expect(s.best).toEqual({ 1: 5000 });
    expect(s.unlocked).toBe(10);
    expect(s.calibration).toBeNull();
    expect(s.sensitivity).toBe(2);
    expect(s.invert).toBe(false);
    expect(s.muted).toBe(true);
  });

  it('records endless wins without unlocking campaign levels', () => {
    const s = createStorage(memoryBackend());
    s.recordWin('endless', 9000);
    expect(s.get().unlocked).toBe(1);
    expect(s.get().best.endless).toBe(9000);
  });
});
