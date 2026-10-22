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
  const time = byId('hud-time');
  const falls = byId('hud-falls');
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
    /** @param {string} label */
    setLevel(label) {
      level.textContent = label;
    },
    /** @param {boolean} muted */
    setMuted(muted) {
      mute.setAttribute('aria-pressed', String(muted));
      mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
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
