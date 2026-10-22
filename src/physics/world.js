/**
 * Physics world. Every Rapier call lives in this file, so an API change in
 * the 0.x engine touches one module.
 *
 * Walls and floor are fixed colliders in board space; tilt is applied by
 * rotating gravity (see gravity.js). The ball is a dynamic sphere with
 * continuous collision detection so a hard fling cannot tunnel through a
 * thin wall, and sleeping is off because Rapier does not wake a body when
 * gravity changes.
 */

import { PHYSICS } from '../tuning.js';

/** @typedef {typeof import('@dimforge/rapier3d-compat').default} Rapier */

/** @type {Promise<Rapier> | null} */
let rapierPromise = null;

/**
 * Downloads and initialises Rapier once. The compat build inlines its
 * WebAssembly, so this is one large lazy chunk.
 * @returns {Promise<Rapier>}
 */
export function loadPhysics() {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat')
      .then(async (mod) => {
        const RAPIER = mod.default;
        await RAPIER.init();
        return RAPIER;
      })
      .catch((error) => {
        rapierPromise = null;
        throw error;
      });
  }
  return rapierPromise;
}

/**
 * @typedef {object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} BallOptions
 * @property {number} radius
 * @property {{x: number, z: number}} start
 */

export class PhysicsWorld {
  /**
   * @param {Rapier} RAPIER
   * @param {import('../level/layout.js').Layout} layout
   * @param {BallOptions} ball
   */
  constructor(RAPIER, layout, ball) {
    this.RAPIER = RAPIER;
    this.radius = ball.radius;
    this.start = { x: ball.start.x, y: ball.radius + 0.02, z: ball.start.z };
    this.world = new RAPIER.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.stepSeconds;

    const fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const b of [...layout.floor, ...layout.walls]) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz)
          .setTranslation(b.cx, b.cy, b.cz)
          .setFriction(PHYSICS.wallFriction)
          .setRestitution(PHYSICS.wallRestitution),
        fixed,
      );
    }

    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.start.x, this.start.y, this.start.z)
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setAngularDamping(PHYSICS.ballAngularDamping)
        .setLinearDamping(PHYSICS.ballLinearDamping),
    );
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(ball.radius)
        .setDensity(PHYSICS.ballDensity)
        .setFriction(PHYSICS.ballFriction)
        .setRestitution(PHYSICS.ballRestitution),
      this.ball,
    );
    this.downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  /** @param {Vec3} g Gravity in board space. */
  setGravity(g) {
    this.world.gravity = { x: g.x, y: g.y, z: g.z };
  }

  /**
   * Advances one fixed step.
   * @returns {number} Horizontal speed change during the step (wall-hit cue).
   */
  step() {
    const before = this.ball.linvel();
    this.world.step();
    const after = this.ball.linvel();
    return Math.hypot(after.x - before.x, after.z - before.z);
  }

  /** @returns {Vec3} */
  position() {
    return this.ball.translation();
  }

  /** @returns {{x: number, y: number, z: number, w: number}} */
  rotation() {
    return this.ball.rotation();
  }

  /** @returns {Vec3} */
  velocity() {
    return this.ball.linvel();
  }

  /** @returns {boolean} True when the floor or a wall top is just below the ball. */
  isGrounded() {
    const p = this.ball.translation();
    this.downRay.origin = { x: p.x, y: p.y, z: p.z };
    const hit = this.world.castRay(
      this.downRay,
      this.radius + PHYSICS.groundedSlack,
      true,
      undefined,
      undefined,
      this.ballCollider,
    );
    return hit !== null;
  }

  /**
   * Adds a velocity change to the ball (applied as an impulse).
   * @param {Vec3} deltaV
   */
  kick(deltaV) {
    const m = this.ball.mass();
    this.ball.applyImpulse({ x: deltaV.x * m, y: deltaV.y * m, z: deltaV.z * m }, true);
  }

  /** Puts the ball back on the start cell, at rest. */
  respawn() {
    this.ball.setTranslation(this.start, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }

  dispose() {
    this.world.free();
  }
}
