/**
 * In-game HUD: level, time, falls, a bubble-level tilt indicator, and the
 * recalibrate, mute and pause buttons. Text is written only when it changes.
 */

import { TILT } from '../tuning.js';
import { byId, formatTime } from './dom.js';

/**
 * @param {object} actions
 * @param {() => void} actions.pause
 * @param {() => void} actions.recalibrate
 * @param {() => void} actions.toggleMute
 */
export function createHud(actions) {
  const root = byId('hud');
  const level = byId('hud-level');
  const levelShort = byId('hud-level-short');
  const time = byId('hud-time');
  const falls = byId('hud-falls');
  const fallsGroup = byId('hud-falls-group');
  const penalty = byId('hud-penalty');
  const indicator = byId('tilt-indicator');
  const dot = /** @type {HTMLElement} */ (indicator.querySelector('.tilt-dot'));
  const mute = byId('btn-mute');
  const hint = byId('hint');
  byId('btn-pause').addEventListener('click', actions.pause);
  byId('btn-recalibrate').addEventListener('click', actions.recalibrate);
  mute.addEventListener('click', actions.toggleMute);

  let lastTime = '';
  let lastFalls = '';
  let lastTilt = '';

  return {
    /** @param {boolean} visible */
    setVisible(visible) {
      root.hidden = !visible;
    },
    /** @param {boolean} inert True while a screen covers the HUD. */
    setInert(inert) {
      root.inert = inert;
    },
    /**
     * Floats the fall penalty by the time and highlights the falls count.
     * @param {string} text
     */
    flashPenalty(text) {
      penalty.textContent = text;
      for (const el of [penalty, fallsGroup]) {
        el.classList.remove('flash');
        // Reading layout restarts the CSS animation on a quick second fall.
        void el.offsetWidth;
        el.classList.add('flash');
      }
    },
    /** @param {string} label */
    setLevel(label) {
      level.textContent = label;
      // Narrow screens show the short form; screen readers get the full one.
      // Endless drops its seed there, which the pause and win screens show.
      levelShort.textContent = label.replace(/^Level /, 'Lv ').replace(/^Endless .*/, '∞');
    },
    /** @param {boolean} muted */
    setMuted(muted) {
      // A toggle keeps its label; only the pressed state says whether it is muted.
      mute.setAttribute('aria-pressed', String(muted));
    },
    /** @param {string | null} text */
    setHint(text) {
      hint.textContent = text ?? '';
      hint.hidden = !text;
    },
    /**
     * @param {number} timeMs
     * @param {number} fallCount
     * @param {{pitch: number, roll: number}} tilt Board tilt in degrees.
     */
    update(timeMs, fallCount, tilt) {
      const t = formatTime(timeMs);
      if (t !== lastTime) time.textContent = lastTime = t;
      const f = String(fallCount);
      if (f !== lastFalls) falls.textContent = lastFalls = f;
      const pitch = tilt.pitch.toFixed(1);
      const roll = tilt.roll.toFixed(1);
      const key = `${pitch},${roll}`;
      if (key !== lastTilt) {
        lastTilt = key;
        indicator.dataset.pitch = pitch;
        indicator.dataset.roll = roll;
        const r = 14 / TILT.boardMaxDeg;
        dot.style.setProperty('--tx', `${(tilt.roll * r).toFixed(1)}px`);
        dot.style.setProperty('--ty', `${(-tilt.pitch * r).toFixed(1)}px`);
      }
    },
  };
}

/** @typedef {ReturnType<typeof createHud>} Hud */
