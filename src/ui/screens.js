/**
 * Menu screens as a plain DOM overlay: title, level select, settings,
 * loading, pause and win. Only one is visible at a time.
 */

import { RULES, TILT } from '../tuning.js';
import { byId, formatTime } from './dom.js';

/** @typedef {'title' | 'levelSelect' | 'settings' | 'loading' | 'paused' | 'won'} ScreenName */

const SCREENS = /** @type {const} */ (['title', 'levelSelect', 'settings', 'loading', 'paused', 'won']);

/**
 * @typedef {object} ScreenActions
 * @property {() => void} play
 * @property {() => void} openLevels
 * @property {() => void} endless
 * @property {() => void} openSettings
 * @property {() => void} closeLevels
 * @property {() => void} closeSettings
 * @property {(level: number) => void} pickLevel
 * @property {(sensitivity: number, invert: boolean) => void} changeSettings
 * @property {() => void} resume
 * @property {() => void} retry
 * @property {() => void} pauseSettings
 * @property {() => void} pauseLevels
 * @property {() => void} next
 * @property {() => void} winRetry
 * @property {() => void} winLevels
 */

/**
 * @param {ScreenActions} actions
 */
export function createScreens(actions) {
  /** @type {Record<ScreenName, HTMLElement>} */
  const screens = /** @type {Record<ScreenName, HTMLElement>} */ (
    Object.fromEntries(SCREENS.map((name) => [name, byId(`screen-${name}`)]))
  );
  /** @type {Array<[string, () => void]>} */
  const clicks = [
    ['btn-play', actions.play],
    ['btn-levels', actions.openLevels],
    ['btn-endless', actions.endless],
    ['btn-settings', actions.openSettings],
    ['btn-levels-back', actions.closeLevels],
    ['btn-settings-back', actions.closeSettings],
    ['btn-resume', actions.resume],
    ['btn-retry', actions.retry],
    ['btn-pause-settings', actions.pauseSettings],
    ['btn-pause-levels', actions.pauseLevels],
    ['btn-next', actions.next],
    ['btn-win-retry', actions.winRetry],
    ['btn-win-levels', actions.winLevels],
  ];
  for (const [id, fn] of clicks) byId(id).addEventListener('click', fn);

  const grid = byId('level-grid');
  grid.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const button = target.closest('button');
    const level = Number(button?.dataset.level);
    if (button && !button.disabled && Number.isInteger(level)) actions.pickLevel(level);
  });

  /** @type {HTMLInputElement} */
  const sensitivity = byId('sensitivity');
  /** @type {HTMLInputElement} */
  const invert = byId('invert');
  sensitivity.min = String(TILT.sensitivityMin);
  sensitivity.max = String(TILT.sensitivityMax);
  const sensitivityValue = byId('sensitivity-value');
  const emitSettings = () => {
    const value = Number(sensitivity.value);
    sensitivityValue.textContent = `${value.toFixed(1)}×`;
    actions.changeSettings(value, invert.checked);
  };
  sensitivity.addEventListener('input', emitSettings);
  invert.addEventListener('change', emitSettings);

  const titleError = byId('title-error');
  const loadingText = byId('loading-text');
  const toast = byId('toast');
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;

  return {
    /** @param {ScreenName | null} name */
    show(name) {
      for (const key of SCREENS) screens[key].hidden = key !== name;
      const focusTarget = name ? screens[name].querySelector('button:not([disabled])') : null;
      if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
    },
    /** @param {string} text */
    loading(text) {
      loadingText.textContent = text;
    },
    /** @param {string | null} text */
    titleError(text) {
      titleError.textContent = text ?? '';
      titleError.hidden = !text;
    },
    /**
     * @param {string} text
     * @param {number} [ms]
     */
    toast(text, ms = 4000) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.hidden = true;
      }, ms);
    },
    /**
     * @param {number} unlocked
     * @param {Readonly<Record<string, number>>} best
     */
    renderLevels(unlocked, best) {
      grid.replaceChildren(
        ...Array.from({ length: RULES.levelCount }, (_, i) => {
          const level = i + 1;
          const button = document.createElement('button');
          button.type = 'button';
          const cleared = Boolean(best[String(level)]);
          // The highest unlocked level not yet cleared is the one to play next.
          button.className = level === unlocked && !cleared ? 'level-btn next' : 'level-btn';
          button.dataset.level = String(level);
          button.disabled = level > unlocked;
          const label = document.createElement('span');
          label.textContent = String(level);
          const sub = document.createElement('small');
          sub.textContent = level > unlocked ? 'locked' : cleared ? formatTime(best[String(level)]) : '—';
          button.append(label, sub);
          button.setAttribute('aria-label', `Level ${level}${level > unlocked ? ' (locked)' : ''}`);
          return button;
        }),
      );
    },
    /**
     * @param {number} value
     * @param {boolean} inverted
     */
    setSettings(value, inverted) {
      sensitivity.value = String(value);
      sensitivityValue.textContent = `${value.toFixed(1)}×`;
      invert.checked = inverted;
    },
    /**
     * @param {object} result
     * @param {string} result.title
     * @param {number} result.timeMs
     * @param {number} result.falls
     * @param {number | null} result.bestMs
     * @param {boolean} result.newBest
     * @param {boolean} result.hasNext
     * @param {string} result.nextLabel Text of the next button.
     */
    showWin({ title, timeMs, falls, bestMs, newBest, hasNext, nextLabel }) {
      byId('win-title').textContent = title;
      byId('win-time').textContent = formatTime(timeMs);
      const parts = [`${falls} ${falls === 1 ? 'fall' : 'falls'}`];
      if (bestMs !== null && !newBest) parts.push(`best ${formatTime(bestMs)}`);
      byId('win-details').textContent = parts.join(' · ');
      byId('win-best').hidden = !newBest;
      const next = /** @type {HTMLButtonElement} */ (byId('btn-next'));
      next.hidden = !hasNext;
      next.textContent = nextLabel;
      byId('btn-win-retry').classList.toggle('primary', !hasNext);
    },
  };
}

/** @typedef {ReturnType<typeof createScreens>} Screens */
