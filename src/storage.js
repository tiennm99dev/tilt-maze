/**
 * Saved progress and settings under one versioned localStorage key. Every
 * access is guarded: private modes and blocked storage throw or drop writes,
 * and the game must still run with defaults.
 */

import { RULES, TILT } from './tuning.js';

export const STORAGE_KEY = 'tilt-maze:v1';
const VERSION = 1;

/**
 * @typedef {object} SaveData
 * @property {1} v
 * @property {Record<string, number>} best Best time in ms per level id.
 * @property {number} unlocked Highest playable campaign level.
 * @property {{x: number, y: number, z: number} | null} calibration Neutral up vector.
 * @property {number} sensitivity
 * @property {boolean} invert
 * @property {boolean} muted
 */

/** @returns {SaveData} */
export function defaultSave() {
  return { v: VERSION, best: {}, unlocked: 1, calibration: null, sensitivity: 1, invert: false, muted: false };
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Validates parsed JSON field by field; anything unexpected falls back to
 * the default for that field.
 * @param {unknown} raw
 * @returns {SaveData}
 */
export function sanitize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== 'object') return out;
  const r = /** @type {Record<string, unknown>} */ (raw);
  if (r.v !== VERSION) return out;
  if (r.best && typeof r.best === 'object') {
    for (const [k, v] of Object.entries(r.best)) {
      if (isFiniteNumber(v) && v > 0) out.best[k] = v;
    }
  }
  if (isFiniteNumber(r.unlocked)) {
    out.unlocked = Math.min(RULES.levelCount, Math.max(1, Math.floor(r.unlocked)));
  }
  const c = /** @type {Record<string, unknown> | null} */ (r.calibration && typeof r.calibration === 'object' ? r.calibration : null);
  if (c && isFiniteNumber(c.x) && isFiniteNumber(c.y) && isFiniteNumber(c.z) && Math.hypot(c.x, c.y, c.z) > 0.5) {
    out.calibration = { x: c.x, y: c.y, z: c.z };
  }
  if (isFiniteNumber(r.sensitivity)) {
    out.sensitivity = Math.min(TILT.sensitivityMax, Math.max(TILT.sensitivityMin, r.sensitivity));
  }
  if (typeof r.invert === 'boolean') out.invert = r.invert;
  if (typeof r.muted === 'boolean') out.muted = r.muted;
  return out;
}

/** @returns {Storage | null} */
function defaultBackend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage itself throws when storage is blocked.
    return null;
  }
}

/**
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} [backend]
 */
export function createStorage(backend = defaultBackend()) {
  /** @type {SaveData} */
  let data = defaultSave();
  try {
    const text = backend?.getItem(STORAGE_KEY);
    if (text) data = sanitize(JSON.parse(text));
  } catch {
    data = defaultSave();
  }

  const persist = () => {
    try {
      backend?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota or blocked storage: keep playing with in-memory state.
    }
  };

  return {
    /** @returns {Readonly<SaveData>} */
    get: () => data,
    /**
     * @param {Partial<Omit<SaveData, 'v'>>} patch
     */
    update(patch) {
      data = sanitize({ ...data, ...patch, v: VERSION });
      persist();
    },
    /**
     * Records a finished campaign level.
     * @param {number | 'endless'} levelId
     * @param {number} timeMs
     * @returns {{newBest: boolean, best: number}}
     */
    recordWin(levelId, timeMs) {
      const key = String(levelId);
      const previous = data.best[key];
      const newBest = previous === undefined || timeMs < previous;
      const best = { ...data.best };
      if (newBest) best[key] = timeMs;
      const unlocked = typeof levelId === 'number' ? Math.max(data.unlocked, levelId + 1) : data.unlocked;
      this.update({ best, unlocked });
      return { newBest, best: newBest ? timeMs : previous };
    },
  };
}

/** @typedef {ReturnType<typeof createStorage>} GameStorage */
