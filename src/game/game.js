/**
 * The in-level engine: builds physics and meshes for a level, runs the
 * render loop, steps physics at a fixed rate, and reports falls and wins.
 * Menu flow lives in main.js; this module only moves between the in-play
 * states (ready, playing, falling, won).
 *
 * This module and everything it imports (Three.js, Rapier) are loaded lazily
 * after the title screen has painted.
 */

import { Quaternion, Vector3 } from 'three';
import { createInput } from '../input/input.js';
import { buildLayout } from '../level/layout.js';
import { boardGravity, boardQuaternion } from '../physics/gravity.js';
import { loadPhysics, PhysicsWorld } from '../physics/world.js';
import { createBoardMeshes } from '../render/board-mesh.js';
import { createStage } from '../render/scene.js';
import { BOARD, PHYSICS, RULES, TILT } from '../tuning.js';
import { createFixedStepper } from './loop.js';

/**
 * @typedef {object} GameCallbacks
 * @property {(result: {timeMs: number, falls: number}) => void} onWin
 * @property {(timeMs: number, falls: number, tilt: {pitch: number, roll: number}) => void} onTick
 * @property {() => void} onStart First input of a level: the timer starts.
 * @property {(falls: number) => void} onFall The ball fell off and is back at
 *   the start, with the fall penalty added to the time.
 */

/**
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {import('../input/sensors.js').Sensors} options.sensors
 * @param {import('./state-machine.js').StateMachine} options.fsm
 * @param {import('../audio/sfx.js').Sfx} options.sfx
 * @param {() => import('../input/input.js').InputSettings} options.settings
 * @param {{x: number, y: number, z: number} | null} options.savedNeutral
 * @param {GameCallbacks} options.callbacks
 */
export async function createGame({ canvas, sensors, fsm, sfx, settings, savedNeutral, callbacks }) {
  const RAPIER = await loadPhysics();
  const stage = createStage(canvas);
  try {
    return startGame({ RAPIER, stage, sensors, fsm, sfx, settings, savedNeutral, callbacks });
  } catch (error) {
    // A retry builds a new renderer on the same canvas; free this one first.
    stage.dispose();
    throw error;
  }
}

/** States in which the board changes from frame to frame. */
const LIVE_STATES = new Set(['ready', 'playing', 'falling']);

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * @param {object} options
 * @param {Awaited<ReturnType<typeof loadPhysics>>} options.RAPIER
 * @param {import('../render/scene.js').Stage} options.stage
 * @param {import('../input/sensors.js').Sensors} options.sensors
 * @param {import('./state-machine.js').StateMachine} options.fsm
 * @param {import('../audio/sfx.js').Sfx} options.sfx
 * @param {() => import('../input/input.js').InputSettings} options.settings
 * @param {{x: number, y: number, z: number} | null} options.savedNeutral
 * @param {GameCallbacks} options.callbacks
 */
function startGame({ RAPIER, stage, sensors, fsm, sfx, settings, savedNeutral, callbacks }) {
  const input = createInput({ sensors, surface: stage.renderer.domElement, settings, savedNeutral });
  // Game keys only while a level is on screen; menus keep Space and arrows
  // for focus and button presses.
  /** @param {import('./state-machine.js').GameState} state */
  const syncKeys = (state) => input.setKeysEnabled(state === 'ready' || state === 'playing' || state === 'falling');
  syncKeys(fsm.state);
  const offState = fsm.onChange(syncKeys);
  const stepper = createFixedStepper({
    stepSeconds: PHYSICS.stepSeconds,
    maxSteps: PHYSICS.maxStepsPerFrame,
    maxFrameSeconds: PHYSICS.maxFrameSeconds,
  });

  /** @type {PhysicsWorld | null} */
  let world = null;
  /** @type {import('../render/board-mesh.js').BoardMeshes | null} */
  let meshes = null;
  /** @type {import('../level/layout.js').Layout | null} */
  let layout = null;
  let timeMs = 0;
  let falls = 0;
  const prevPos = new Vector3();
  const currPos = new Vector3();
  const boardQ = new Quaternion();
  const gravity = new Vector3();
  let lastFrame = performance.now();
  let rafId = 0;
  /**
   * A win waiting for its screen: the result is frozen at the goal and the
   * board keeps drawing the goal flash until `at + RULES.winDelayMs`.
   * @type {{timeMs: number, falls: number, at: number, reducedMotion: boolean} | null}
   */
  let pendingWin = null;
  const goalPos = new Vector3();

  const resetBall = () => {
    if (!world) return;
    world.respawn();
    const p = world.position();
    prevPos.set(p.x, p.y, p.z);
    currPos.copy(prevPos);
    stepper.reset();
  };

  /** @param {import('../level/levels.js').Level} level */
  const load = (level) => {
    world?.dispose();
    meshes?.dispose();
    pendingWin = null;
    layout = buildLayout(level, BOARD);
    world = new PhysicsWorld(RAPIER, layout, { radius: BOARD.ballRadius, start: layout.start });
    meshes = createBoardMeshes(layout, BOARD.ballRadius, BOARD.goalRadius);
    stage.scene.add(meshes.group);
    stage.setBoardSize(Math.max(layout.width, layout.depth));
    timeMs = 0;
    falls = 0;
    input.reset();
    resetBall();
    meshes.ball.position.copy(currPos);
    // Draw once now, behind the loading screen: the first draw compiles the
    // shaders, which would otherwise stall the first frame of play.
    stage.render();
  };

  /** @returns {boolean} */
  const reachedGoal = () => {
    if (!layout) return false;
    const dx = currPos.x - layout.goal.x;
    const dz = currPos.z - layout.goal.z;
    return Math.hypot(dx, dz) < BOARD.goalRadius && currPos.y > 0 && currPos.y < BOARD.ballRadius * 2;
  };

  /** @param {{pitch: number, roll: number}} tilt */
  const applyShake = (tilt) => {
    const strength = input.consumeShake();
    if (strength <= 0 || !world || fsm.state !== 'playing' || !world.isGrounded()) return;
    // Up, plus sideways in the direction the board leans; axis signs from
    // the motion sensors differ between browsers, so they are not used.
    const lean = Math.hypot(gravity.x, gravity.z);
    const side = lean > 1e-6 ? Math.min(1, Math.hypot(tilt.pitch, tilt.roll) / TILT.boardMaxDeg) / lean : 0;
    world.kick({
      x: gravity.x * side * PHYSICS.shakeSideSpeed * strength,
      y: PHYSICS.shakeUpSpeed * strength,
      z: gravity.z * side * PHYSICS.shakeSideSpeed * strength,
    });
    sfx.shake();
  };

  /**
   * First fall or win seen in this frame's steps. Judging after every step,
   * not once per frame, keeps a fast ball on a slow frame from skipping
   * across the goal, and judges a win before a later fall.
   * @type {'falling' | 'won' | null}
   */
  let event = null;
  let stepsTaken = 0;

  const stepPhysics = () => {
    // After a win the rest of the frame's steps are dropped.
    if (!world || event === 'won') return;
    const p = world.position();
    prevPos.set(p.x, p.y, p.z);
    const deltaV = world.step();
    stepsTaken += 1;
    const playing = fsm.state === 'playing';
    if (deltaV > PHYSICS.wallHitMinDeltaV && playing) sfx.hit(deltaV);
    const q = world.position();
    currPos.set(q.x, q.y, q.z);
    if (playing && !event) {
      if (currPos.y < PHYSICS.fallingY) event = 'falling';
      else if (reachedGoal()) event = 'won';
    }
  };

  /** @param {number} now */
  const frame = (now) => {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const { board, active } = input.sample(dt * 1000);
    let state = fsm.state;

    if (state === 'ready' && (active || input.consumeShake() > 0)) {
      fsm.go('playing');
      callbacks.onStart();
      state = 'playing';
    }

    let alpha = 1;
    if (world && (state === 'playing' || state === 'falling')) {
      boardGravity(board, PHYSICS.gravity, gravity);
      world.setGravity(gravity);
      applyShake(board);
      event = null;
      stepsTaken = 0;
      alpha = stepper.advance(dt, stepPhysics).alpha;
      // Charge only simulated time, so a stalling device is not penalised
      // for frames the stepper had to drop.
      timeMs += stepsTaken * PHYSICS.stepSeconds * 1000;

      if (event === 'falling') {
        fsm.go('falling');
        sfx.fall();
      } else if (state === 'falling' && currPos.y < PHYSICS.killY) {
        falls += 1;
        timeMs += RULES.fallPenaltyMs;
        resetBall();
        fsm.go('playing');
        callbacks.onFall(falls);
      } else if (event === 'won') {
        fsm.go('won');
        sfx.stopRoll();
        sfx.win();
        pendingWin = { timeMs, falls, at: now, reducedMotion: reducedMotion() };
      }
      const v = world.velocity();
      sfx.roll(Math.hypot(v.x, v.z), state === 'playing' && currPos.y > -0.05 && currPos.y < BOARD.ballRadius * 1.5);
    } else {
      input.consumeShake();
    }

    if (meshes && world) {
      if (state === 'ready' || state === 'playing' || state === 'falling') {
        boardQuaternion(board, boardQ);
        meshes.group.quaternion.copy(boardQ);
      }
      if (pendingWin && layout) {
        // Roll the ball into the middle of the goal while it flashes.
        if (!pendingWin.reducedMotion) {
          goalPos.set(layout.goal.x, BOARD.ballRadius, layout.goal.z);
          meshes.ball.position.lerp(goalPos, 1 - Math.exp(-dt * 12));
        }
        meshes.celebrate(Math.min(1, (now - pendingWin.at) / RULES.winDelayMs), pendingWin.reducedMotion);
      } else {
        meshes.ball.position.lerpVectors(prevPos, currPos, alpha);
        const r = world.rotation();
        meshes.ball.quaternion.set(r.x, r.y, r.z, r.w);
        meshes.animate(now / 1000);
      }
    }

    callbacks.onTick(timeMs, falls, board);
    // Menus, pause and the win screen show a still board: the canvas keeps
    // the last frame, and the stage redraws itself on resize.
    if (LIVE_STATES.has(state) || pendingWin) stage.render();
    if (pendingWin && now - pendingWin.at >= RULES.winDelayMs) {
      const { timeMs: wonMs, falls: wonFalls } = pendingWin;
      pendingWin = null;
      // Something else (a level load or retry) may have left the win.
      if (fsm.state === 'won') callbacks.onWin({ timeMs: wonMs, falls: wonFalls });
    }
  };

  rafId = requestAnimationFrame((now) => {
    lastFrame = now;
    frame(now);
  });

  return {
    load,
    /** Restarts the current level: ball at the start, timer and falls cleared. */
    retry() {
      pendingWin = null;
      timeMs = 0;
      falls = 0;
      input.reset();
      resetBall();
      meshes?.group.quaternion.identity();
    },
    /** @returns {Promise<{x: number, y: number, z: number}>} */
    calibrate: () => input.calibrate(),
    /** @param {boolean} live Sensors steer; pointer drag only when they do not. */
    setSensorMode(live) {
      input.setDragEnabled(!live);
    },
    /** Avoids a huge frame step after a pause or a hidden tab. */
    resetClock() {
      lastFrame = performance.now();
      stepper.reset();
    },
    dispose() {
      cancelAnimationFrame(rafId);
      offState();
      input.dispose();
      world?.dispose();
      meshes?.dispose();
      stage.dispose();
    },
  };
}

/** @typedef {ReturnType<typeof startGame>} Game */
