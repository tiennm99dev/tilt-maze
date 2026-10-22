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
 */

/** Starts the physics download early; safe to call more than once. */
export const preload = () => loadPhysics();

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
  const input = createInput({ sensors, surface: canvas, settings, savedNeutral });
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
    layout = buildLayout(level, BOARD);
    world = new PhysicsWorld(RAPIER, layout, { radius: BOARD.ballRadius, start: layout.start });
    meshes = createBoardMeshes(layout, BOARD.ballRadius, BOARD.goalRadius);
    stage.scene.add(meshes.group);
    stage.setBoardSize(Math.max(layout.width, layout.depth));
    timeMs = 0;
    falls = 0;
    input.reset();
    resetBall();
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

  const stepPhysics = () => {
    if (!world) return;
    const p = world.position();
    prevPos.set(p.x, p.y, p.z);
    const deltaV = world.step();
    if (deltaV > PHYSICS.wallHitMinDeltaV && fsm.state === 'playing') sfx.hit(deltaV);
    const q = world.position();
    currPos.set(q.x, q.y, q.z);
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
      alpha = stepper.advance(dt, stepPhysics).alpha;
      timeMs += dt * 1000;

      if (state === 'playing' && currPos.y < PHYSICS.fallingY) {
        fsm.go('falling');
        sfx.fall();
      } else if (state === 'falling' && currPos.y < PHYSICS.killY) {
        falls += 1;
        timeMs += RULES.fallPenaltyMs;
        resetBall();
        fsm.go('playing');
      } else if (state === 'playing' && reachedGoal()) {
        fsm.go('won');
        sfx.stopRoll();
        sfx.win();
        callbacks.onWin({ timeMs, falls });
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
      meshes.ball.position.lerpVectors(prevPos, currPos, alpha);
      const r = world.rotation();
      meshes.ball.quaternion.set(r.x, r.y, r.z, r.w);
      meshes.animate(now / 1000);
    }

    callbacks.onTick(timeMs, falls, board);
    stage.render();
  };

  rafId = requestAnimationFrame((now) => {
    lastFrame = now;
    frame(now);
  });

  return {
    load,
    /** Restarts the current level: ball at the start, timer and falls cleared. */
    retry() {
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
      input.dispose();
      world?.dispose();
      meshes?.dispose();
      stage.dispose();
    },
  };
}

/** @typedef {Awaited<ReturnType<typeof createGame>>} Game */
