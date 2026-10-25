/**
 * Game states and the transitions allowed between them. Anything not listed
 * is rejected, which keeps UI buttons and async callbacks from pushing the
 * game into a state that makes no sense.
 */

/**
 * @typedef {'title' | 'levelSelect' | 'settings' | 'permission' | 'calibrating'
 *   | 'ready' | 'playing' | 'paused' | 'falling' | 'won'} GameState
 */

/** @type {Readonly<Record<GameState, readonly GameState[]>>} */
export const TRANSITIONS = Object.freeze({
  title: ['levelSelect', 'settings', 'permission'],
  levelSelect: ['title', 'permission', 'paused', 'won'],
  settings: ['title', 'paused'],
  permission: ['calibrating', 'title'],
  calibrating: ['ready', 'playing', 'falling', 'paused'],
  ready: ['playing', 'paused', 'calibrating'],
  playing: ['paused', 'falling', 'won', 'calibrating'],
  falling: ['playing', 'paused'],
  paused: ['playing', 'falling', 'ready', 'calibrating', 'settings', 'levelSelect', 'title'],
  won: ['ready', 'levelSelect', 'title'],
});

/**
 * @param {GameState} [initial]
 */
export function createStateMachine(initial = 'title') {
  /** @type {GameState} */
  let current = initial;
  /** @type {Set<(to: GameState, from: GameState) => void>} */
  const listeners = new Set();

  return {
    /** @returns {GameState} */
    get state() {
      return current;
    },
    /**
     * @param {GameState} to
     * @returns {boolean}
     */
    can(to) {
      return TRANSITIONS[current].includes(to);
    },
    /**
     * @param {GameState} to
     * @throws {Error} When the transition is not allowed.
     */
    go(to) {
      if (!TRANSITIONS[current].includes(to)) {
        throw new Error(`Illegal transition ${current} -> ${to}`);
      }
      const from = current;
      current = to;
      for (const fn of listeners) fn(to, from);
    },
    /**
     * @param {(to: GameState, from: GameState) => void} fn
     * @returns {() => void} Unsubscribe.
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** @typedef {ReturnType<typeof createStateMachine>} StateMachine */
