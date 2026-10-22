/**
 * Bootstrap and menu flow. The title screen is plain DOM and paints at once;
 * the 3D engine (Three.js and the Rapier physics download) is fetched in the
 * background right after, and awaited on the first tap.
 */

import './styles.css';
import { createSfx } from './audio/sfx.js';
import { createStateMachine } from './game/state-machine.js';
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

/** @param {LevelChoice} choice */
const levelLabel = (choice) => (choice === 'endless' ? 'Endless' : `Level ${choice}`);

const ensureGame = () => {
  gamePromise ??= loadGameModule()
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
        callbacks: { onWin, onTick, onStart },
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

/** @param {{timeMs: number, falls: number}} result */
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
  });
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
  hud.setLevel(levelLabel(choice));
  fsm.go('calibrating');
  await calibrate(g);
  g.resetClock();
  fsm.go('ready');
}

/** @param {import('./game/game.js').Game} g */
async function calibrate(g) {
  if (!sensorsLive) return;
  screens.loading('Hold your phone the way you want to play…');
  const neutral = await g.calibrate();
  storage.update({ calibration: neutral });
}

/** Recalibrate from the HUD. */
async function recalibrate() {
  const from = fsm.state;
  if (!game || !sensorsLive || (from !== 'ready' && from !== 'playing')) {
    if (!sensorsLive && game) screens.toast('Recalibrate needs motion sensors.');
    return;
  }
  fsm.go('calibrating');
  await calibrate(game);
  game.resetClock();
  if (fsm.state === 'calibrating') fsm.go(from === 'playing' ? 'playing' : 'ready');
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
    await calibrate(game);
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
  hud.setLevel(levelLabel(choice));
  fsm.go('ready');
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
  closeLevels: () => {
    if (fsm.can('title')) fsm.go('title');
  },
  closeSettings: () => fsm.go(settingsReturn),
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
  won: 'won',
};

fsm.onChange((to) => {
  // The tap into 'permission' runs synchronously inside the click, so the
  // first wake lock request still has its user gesture.
  if (AWAKE_STATES.has(to)) wakeLock.enable();
  else wakeLock.disable();
  screens.show(SCREEN_FOR_STATE[to] ?? null);
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pause();
});

/**
 * The neutral pose is stored in the screen frame, so it stays valid when the
 * screen rotates: people hold the phone the same way relative to the screen
 * in either orientation. A rotation during play is usually the OS reacting
 * to a hard tilt, which also reframes the board under the ball, so pause and
 * let the resume tap recalibrate from a pose the player chose.
 */
const onRotate = () => {
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
    loadGameModule()
      .then((mod) => mod.preload())
      .catch(() => {
        // Retried on the first tap, which reports the error.
      });
  }, 0);
});
