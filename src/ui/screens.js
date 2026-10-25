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
 * @property {() => void} quit
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
    ['btn-pause-menu', actions.quit],
    ['btn-win-menu', actions.quit],
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

  // The HUD holds the full name of the level in play, Endless seed included.
  const hudLevel = byId('hud-level');
  const pausedLevel = byId('paused-level');
  const titleError = byId('title-error');
  const loadingText = byId('loading-text');
  const toast = byId('toast');
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;

  return {
    /** @param {ScreenName | null} name */
    show(name) {
      if (name === 'paused') pausedLevel.textContent = hudLevel.textContent;
      for (const key of SCREENS) screens[key].hidden = key !== name;
      // Skip hidden buttons too: the last level's win screen hides Next. A screen
      // with no button (loading) focuses its panel, so focus stays in the dialog.
      const focusTarget = name
        ? (screens[name].querySelector('button:not([disabled]):not([hidden])') ??
          screens[name].querySelector('.panel[tabindex]'))
        : null;
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
          const isNext = level === unlocked && !cleared;
          button.className = isNext ? 'level-btn next' : 'level-btn';
          button.dataset.level = String(level);
          button.disabled = level > unlocked;
          const label = document.createElement('span');
          label.textContent = String(level);
          const sub = document.createElement('small');
          sub.textContent = level > unlocked ? 'locked' : cleared ? formatTime(best[String(level)]) : '—';
          button.append(label, sub);
          // The label replaces the content, so it carries the best time and the
          // next marker, which is shown only as an outline.
          const parts = [`Level ${level}`];
          if (level > unlocked) parts.push('locked');
          else if (cleared) parts.push(`best ${formatTime(best[String(level)])}`);
          if (isNext) parts.push('next');
          button.setAttribute('aria-label', parts.join(', '));
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
      // The seed lets a reported Endless maze be rebuilt.
      const seed = /^Endless (#\w+)/.exec(hudLevel.textContent ?? '');
      if (seed) parts.unshift(`seed ${seed[1]}`);
      if (bestMs !== null && !newBest) parts.push(`best ${formatTime(bestMs)}`);
      byId('win-details').textContent = parts.join(' · ');
      // aria-describedby reads #win-best even when hidden, so clear its text too.
      const best = byId('win-best');
      best.hidden = !newBest;
      best.textContent = newBest ? 'New best!' : '';
      const next = /** @type {HTMLButtonElement} */ (byId('btn-next'));
      next.hidden = !hasNext;
      next.textContent = nextLabel;
      byId('btn-win-retry').classList.toggle('primary', !hasNext);
    },
  };
}

/** @typedef {ReturnType<typeof createScreens>} Screens */
