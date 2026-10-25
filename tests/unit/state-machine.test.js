import { describe, expect, it, vi } from 'vitest';
import { TRANSITIONS, createStateMachine } from '../../src/game/state-machine.js';

describe('createStateMachine', () => {
  it('walks the normal play path', () => {
    const fsm = createStateMachine();
    for (const s of /** @type {const} */ (['permission', 'calibrating', 'ready', 'playing', 'falling', 'playing', 'won', 'ready'])) {
      fsm.go(s);
      expect(fsm.state).toBe(s);
    }
  });

  it('pauses during a fall and resumes into the same fall', () => {
    const fsm = createStateMachine();
    for (const s of /** @type {const} */ (['permission', 'calibrating', 'ready', 'playing', 'falling', 'paused', 'calibrating', 'falling', 'paused', 'falling', 'playing'])) {
      fsm.go(s);
    }
    expect(fsm.state).toBe('playing');
  });

  it('pauses out of a calibration the page was hidden during', () => {
    const fsm = createStateMachine();
    for (const s of /** @type {const} */ (['permission', 'calibrating', 'ready', 'playing', 'calibrating', 'paused', 'calibrating', 'playing'])) {
      fsm.go(s);
    }
    expect(fsm.state).toBe('playing');
  });

  it('returns from the level list to a paused run or a win', () => {
    expect(TRANSITIONS.levelSelect).toContain('paused');
    expect(TRANSITIONS.levelSelect).toContain('won');
    const fsm = createStateMachine();
    for (const s of /** @type {const} */ (['permission', 'calibrating', 'ready', 'playing', 'paused', 'levelSelect', 'paused', 'calibrating', 'playing', 'won', 'levelSelect', 'won'])) {
      fsm.go(s);
      expect(fsm.state).toBe(s);
    }
  });

  it('rejects transitions that are not allowed', () => {
    const fsm = createStateMachine();
    expect(fsm.can('playing')).toBe(false);
    expect(() => fsm.go('playing')).toThrow(/Illegal transition title -> playing/);
    expect(fsm.state).toBe('title');
    fsm.go('permission');
    expect(() => fsm.go('won')).toThrow();
    expect(() => fsm.go('ready')).toThrow();
  });

  it('notifies listeners with the new and old state', () => {
    const fsm = createStateMachine();
    const fn = vi.fn();
    const off = fsm.onChange(fn);
    fsm.go('levelSelect');
    expect(fn).toHaveBeenCalledWith('levelSelect', 'title');
    off();
    fsm.go('title');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only lists known states as targets', () => {
    const states = new Set(Object.keys(TRANSITIONS));
    for (const targets of Object.values(TRANSITIONS)) {
      for (const t of targets) expect(states.has(t)).toBe(true);
    }
  });
});
