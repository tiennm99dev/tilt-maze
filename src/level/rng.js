/**
 * Seeded pseudo-random numbers (mulberry32). The same seed always yields the
 * same sequence, which makes every level reproducible.
 */

/**
 * @typedef {object} Rng
 * @property {() => number} next Float in [0, 1).
 * @property {(n: number) => number} int Integer in [0, n).
 * @property {<T>(items: readonly T[]) => T} pick One random element.
 * @property {<T>(items: T[]) => T[]} shuffle Shuffles in place and returns the array.
 */

/**
 * @param {number} seed Any integer; only the low 32 bits matter.
 * @returns {Rng}
 */
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** @param {number} n */
  const int = (n) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new RangeError('pick() needs a non-empty array');
      return items[int(items.length)];
    },
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
}

/** @returns {number} A fresh random 32-bit seed. */
export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
