/**
 * Bootstrap and menu flow. The title screen is plain DOM and paints at once;
 * the 3D engine (Three.js and the Rapier physics download) is fetched in the
 * background right after, and awaited on the first tap.
 */

import './styles.css';
import { createSfx } from './audio/sfx.js';
import { createStateMachine } from './game/state-machine.js';
import { isEditable } from './input/fallback.js';
import { createSensors, createWakeLock } from './input/sensors.js';
import { campaignLevel, endlessLevel } from './level/levels.js';
import { createStorage } from './storage.js';
import { RULES, TILT } from './tuning.js';
import { byId } from './ui/dom.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';

/** @typedef {import('./game/state-machine.js').GameState} GameState */
/** @typedef {number | 'endless'} LevelChoice */

const storage = createStorage();
const sfx = createSfx();
const sensors = createSensors();
const wakeLock = createWakeLock();
const fsm = createStateMachine('title');
/** @type {HTMLCanvasElement} */
const canvas = byId('stage');

sfx.setMuted(storage.get().muted);

/** @type {Promise<typeof import('./game/game.js')> | null} */
let gameModule = null;
const loadGameModule = () => {
  gameModule ??= import('./game/game.js').catch((error) => {
    gameModule = null;
    throw error;
  });
  return gameModule;
};
/**
 * The game chunk loads Rapier (its JS and .wasm) through `loadPhysics()`;
 * asking for it here starts that download alongside the chunk instead of
 * after it has run. The game's own call then reuses the same promise.
 */
const loadPhysicsEarly = () => import('./physics/world.js').then((m) => m.loadPhysics());
const loadEngine = () => Promise.all([loadGameModule(), loadPhysicsEarly()]).then(([mod]) => mod);

/** @type {import('./game/game.js').Game | null} */
let game = null;
/** @type {Promise<import('./game/game.js').Game> | null} */
let gamePromise = null;
/** @type {import('./level/levels.js').Level | null} */
let currentLevel = null;
let sensorsLive = false;
/** @type {GameState} */
let pausedFrom = 'playing';
/** @type {GameState} */
let settingsReturn = 'title';
/**
 * Counts page hides and screen rotations, so a calibration can tell the
 * phone was put away or turned mid-wait.
 */
let interruptions = 0;

/**
 * Endless shows its seed, so a maze someone reports can be rebuilt with
 * `endlessLevel(seed)`.
 * @param {import('./level/levels.js').Level} level
 */
const levelLabel = (level) =>
  level.id === 'endless' ? `Endless #${(level.seed >>> 0).toString(16)}` : `Level ${level.id}`;

const ensureGame = () => {
  gamePromise ??= loadEngine()
    .then(({ createGame }) =>
      createGame({
        canvas,
        sensors,
        fsm,
        sfx,
        settings: () => {
          const s = storage.get();
          return { sensitivity: s.sensitivity, invert: s.invert };
        },
        savedNeutral: storage.get().calibration,
        callbacks: { onWin, onTick, onStart, onFall },
      }),
    )
    .then((g) => (game = g))
    .catch((error) => {
      gamePromise = null;
      throw error;
    });
  return gamePromise;
};

/**
 * @param {number} timeMs
 * @param {number} falls
 * @param {{pitch: number, roll: number}} tilt
 */
function onTick(timeMs, falls, tilt) {
  hud.update(timeMs, falls, tilt);
}

/** The first input of a level hides the start hint. */
function onStart() {
  hud.setHint(null);
}

/** A fall: show what it cost, since the ball is already back at the start. */
function onFall() {
  hud.flashPenalty(`+${RULES.fallPenaltyMs / 1000}s`);
}

/**
 * Called after the goal flash; the 'won' state began when the ball reached
 * the goal, so the screen opens here rather than on the state change.
 * @param {{timeMs: number, falls: number}} result
 */
function onWin({ timeMs, falls }) {
  if (!currentLevel) return;
  const id = currentLevel.id;
  const { newBest, best } = storage.recordWin(id, Math.round(timeMs));
  screens.showWin({
    title: id === 'endless' ? 'Maze cleared' : `Level ${id} complete`,
    timeMs,
    falls,
    bestMs: best ?? null,
    newBest,
    hasNext: id === 'endless' || id < RULES.levelCount,
    nextLabel: id === 'endless' ? 'New maze' : 'Next level',
  });
  screens.show('won');
  hud.setInert(true);
}

/**
 * Starts a level from a menu tap. Everything that needs the gesture
 * (iOS motion permission, audio, wake lock) runs before the first await.
 * @param {LevelChoice} choice
 */
function startFromTap(choice) {
  if (!fsm.can('permission')) return;
  const access = sensors.requestAccess();
  sfx.unlock();
  screens.titleError(null);
  fsm.go('permission');
  run(choice, access).catch((error) => {
    console.error(error);
    if (fsm.can('title')) fsm.go('title');
    screens.titleError(
      error instanceof Error && /webgl/i.test(error.message)
        ? 'This browser cannot show 3D graphics (WebGL is unavailable).'
        : 'Could not start the game. Check your connection and try again.',
    );
  });
}

/**
 * @param {LevelChoice} choice
 * @param {Promise<boolean>} access
 */
async function run(choice, access) {
  screens.loading('Loading…');
  const [granted, g] = await Promise.all([access, ensureGame()]);
  if (!sensorsLive) {
    screens.loading('Checking motion sensors…');
    sensorsLive = granted && (await sensors.probe(TILT.sensorProbeMs));
    if (!sensorsLive) {
      screens.toast(
        granted
          ? 'No motion sensors here. Drag the board, or use the arrow keys or WASD and Space to jump.'
          : 'Motion access was denied. Drag the board to play instead.',
        6000,
      );
    }
  }
  g.setSensorMode(sensorsLive);
  currentLevel = choice === 'endless' ? endlessLevel() : campaignLevel(choice);
  g.load(currentLevel);
  hud.setLevel(levelLabel(currentLevel));
  fsm.go('calibrating');
  const ok = await calibrate(g);
  g.resetClock();
  // Read the state afresh: it may have moved during the await.
  if (/** @type {GameState} */ (fsm.state) !== 'calibrating') return;
  if (ok) {
    fsm.go('ready');
  } else {
    pausedFrom = 'ready';
    fsm.go('paused');
  }
}

/**
 * @param {import('./game/game.js').Game} g
 * @returns {Promise<boolean>} False when the page was hidden or the screen
 *   rotated during the wait: the readings are not a pose the player chose,
 *   so it is not saved and the caller pauses instead of handing back a live
 *   board.
 */
async function calibrate(g) {
  if (!sensorsLive) return true;
  screens.loading('Hold your phone the way you want to play…');
  const before = interruptions;
  // Sample once the prompt can be read and the tapping thumb has lifted, so
  // the phone is steady in the pose the player chose.
  await new Promise((resolve) => setTimeout(resolve, TILT.calibrationLeadMs));
  const neutral = await g.calibrate();
  if (interruptions !== before || document.visibilityState === 'hidden') return false;
  storage.update({ calibration: neutral });
  return true;
}

/** Recalibrate from the HUD. */
async function recalibrate() {
  const from = fsm.state;
  if (!game || !sensorsLive || (from !== 'ready' && from !== 'playing')) {
    if (!sensorsLive && game) screens.toast('Recalibrate needs motion sensors.');
    return;
  }
  fsm.go('calibrating');
  const ok = await calibrate(game);
  game.resetClock();
  if (fsm.state !== 'calibrating') return;
  const to = from === 'playing' ? 'playing' : 'ready';
  if (ok) {
    fsm.go(to);
  } else {
    pausedFrom = to;
    fsm.go('paused');
  }
}

/** Pauses from any in-play state. */
function pause() {
  const s = fsm.state;
  if (s !== 'ready' && s !== 'playing' && s !== 'falling') return;
  pausedFrom = s;
  sfx.stopRoll();
  fsm.go('paused');
}

/** Resumes, recalibrating first when sensors steer. */
async function resume() {
  if (fsm.state !== 'paused' || !game) return;
  sfx.resume();
  if (sensorsLive) {
    fsm.go('calibrating');
    const ok = await calibrate(game);
    // Read the state afresh: it may have moved during the await.
    if (/** @type {GameState} */ (fsm.state) !== 'calibrating') return;
    if (!ok) {
      fsm.go('paused');
      return;
    }
  }
  game.resetClock();
  fsm.go(pausedFrom);
}

/** @param {LevelChoice} choice */
function loadAndReady(choice) {
  if (!game) return;
  currentLevel = choice === 'endless' ? endlessLevel() : campaignLevel(choice);
  game.load(currentLevel);
  game.resetClock();
  hud.setLevel(levelLabel(currentLevel));
  fsm.go('ready');
}

/** Leaves the level list for the title. */
function closeLevels() {
  if (fsm.can('title')) fsm.go('title');
}

/** Leaves settings for the screen that opened them. */
function closeSettings() {
  fsm.go(settingsReturn);
}

const screens = createScreens({
  play: () => startFromTap(Math.min(storage.get().unlocked, RULES.levelCount)),
  openLevels: () => {
    sfx.unlock();
    fsm.go('levelSelect');
  },
  endless: () => startFromTap('endless'),
  openSettings: () => {
    settingsReturn = 'title';
    fsm.go('settings');
  },
  closeLevels,
  closeSettings,
  pickLevel: (level) => startFromTap(level),
  changeSettings: (sensitivity, invert) => storage.update({ sensitivity, invert }),
  resume: () => {
    resume().catch((error) => console.error(error));
  },
  retry: () => {
    if (fsm.state !== 'paused' || !game) return;
    game.retry();
    game.resetClock();
    fsm.go('ready');
  },
  pauseSettings: () => {
    settingsReturn = 'paused';
    fsm.go('settings');
  },
  pauseLevels: () => fsm.go('levelSelect'),
  next: () => {
    const id = currentLevel?.id;
    if (fsm.state !== 'won' || id === undefined) return;
    loadAndReady(id === 'endless' ? 'endless' : Math.min(id + 1, RULES.levelCount));
  },
  winRetry: () => {
    if (fsm.state !== 'won' || !game) return;
    game.retry();
    game.resetClock();
    fsm.go('ready');
  },
  winLevels: () => fsm.go('levelSelect'),
});

const hud = createHud({
  pause,
  recalibrate: () => {
    recalibrate().catch((error) => console.error(error));
  },
  toggleMute: () => {
    const muted = !storage.get().muted;
    storage.update({ muted });
    sfx.setMuted(muted);
    hud.setMuted(muted);
  },
});
hud.setMuted(storage.get().muted);

/** States that keep the screen awake; everywhere else the phone may dim. */
const AWAKE_STATES = new Set(['permission', 'calibrating', 'ready', 'playing', 'falling']);

/** @type {Partial<Record<GameState, import('./ui/screens.js').ScreenName>>} */
const SCREEN_FOR_STATE = {
  title: 'title',
  levelSelect: 'levelSelect',
  settings: 'settings',
  permission: 'loading',
  calibrating: 'loading',
  paused: 'paused',
};

fsm.onChange((to) => {
  // The tap into 'permission' runs synchronously inside the click, so the
  // first wake lock request still has its user gesture.
  if (AWAKE_STATES.has(to)) wakeLock.enable();
  else wakeLock.disable();
  const screen = SCREEN_FOR_STATE[to] ?? null;
  screens.show(screen);
  // Keep Tab inside the open screen; the HUD stays visible behind pause.
  hud.setInert(screen !== null);
  hud.setVisible(['ready', 'playing', 'falling', 'paused', 'calibrating'].includes(to));
  if (to === 'ready') {
    hud.setHint(sensorsLive ? 'Tilt your phone to start' : 'Drag or press an arrow key to start');
  } else if (to !== 'playing' && to !== 'falling') {
    hud.setHint(null);
  }
  if (to === 'levelSelect') {
    const save = storage.get();
    screens.renderLevels(save.unlocked, save.best);
  }
  if (to === 'settings') {
    const save = storage.get();
    screens.setSettings(save.sensitivity, save.invert);
  }
  if (to === 'calibrating' && game) {
    screens.loading('Hold your phone the way you want to play…');
  }
});

// Desktop: Escape or P pauses and resumes; Escape also closes the levels
// and settings dialogs, like their Back buttons.
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const s = fsm.state;
  // Checked before the form-field guard: settings holds only a slider and a
  // checkbox, where Escape does nothing, so it closes even with one focused.
  if (e.code === 'Escape' && (s === 'levelSelect' || s === 'settings')) {
    e.preventDefault();
    if (s === 'levelSelect') closeLevels();
    else closeSettings();
    return;
  }
  if (isEditable(e.target) || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
  if (s === 'ready' || s === 'playing' || s === 'falling') {
    e.preventDefault();
    pause();
  } else if (s === 'paused') {
    e.preventDefault();
    resume().catch((error) => console.error(error));
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    interruptions += 1;
    pause();
  }
});

/**
 * The neutral pose is stored in the screen frame, so it stays valid when the
 * screen rotates: people hold the phone the same way relative to the screen
 * in either orientation. A rotation during play is usually the OS reacting
 * to a hard tilt, which also reframes the board under the ball, so pause and
 * let the resume tap recalibrate from a pose the player chose.
 */
const onRotate = () => {
  if (fsm.state === 'calibrating') interruptions += 1;
  if (fsm.state === 'playing' || fsm.state === 'falling') pause();
};
if (screen.orientation) {
  screen.orientation.addEventListener('change', onRotate);
} else {
  // Safari before 16.4 has no screen.orientation.
  window.addEventListener('orientationchange', onRotate);
}

screens.show('title');

// Fetch the engine once the title has painted, so the first tap is quick.
requestAnimationFrame(() => {
  setTimeout(() => {
    loadEngine()
      .catch(() => {
        // Retried on the first tap, which reports the error.
      });
  }, 0);
});
