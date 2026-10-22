/**
 * Board meshes built from the shared layout: the floor pieces and every wall
 * are merged into one mesh each to keep draw calls low on phones.
 */

import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RENDER } from '../tuning.js';

/**
 * @param {import('../level/layout.js').Box[]} boxes
 * @returns {import('three').BufferGeometry}
 */
function mergeBoxes(boxes) {
  const parts = boxes.map((b) => new BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2).translate(b.cx, b.cy, b.cz));
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('Could not merge board geometry');
  return merged;
}

/**
 * @param {import('../level/layout.js').Layout} layout
 * @param {number} ballRadius
 * @param {number} goalRadius
 */
export function createBoardMeshes(layout, ballRadius, goalRadius) {
  const group = new Group();
  /** @type {Array<{dispose: () => void}>} */
  const owned = [];
  /**
   * @template {{dispose: () => void}} T
   * @param {T} resource
   * @returns {T}
   */
  const own = (resource) => {
    owned.push(resource);
    return resource;
  };

  const floor = new Mesh(
    own(mergeBoxes(layout.floor)),
    own(new MeshStandardMaterial({ color: RENDER.colors.floor, roughness: 0.75 })),
  );
  floor.receiveShadow = true;
  group.add(floor);

  const walls = new Mesh(
    own(mergeBoxes(layout.walls)),
    own(new MeshStandardMaterial({ color: RENDER.colors.wall, roughness: 0.6 })),
  );
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Dark wells under the holes so they read as pits, not gaps. Drawn back
  // side only, so from above you see the inside walls and bottom.
  if (layout.holes.length > 0) {
    const depth = 0.8;
    const wells = layout.holes.map((h) => ({ ...h, cy: -depth / 2 - 0.001, hy: depth / 2 }));
    const wellMesh = new Mesh(
      own(mergeBoxes(wells)),
      own(new MeshBasicMaterial({ color: RENDER.colors.hole, side: BackSide })),
    );
    group.add(wellMesh);
  }

  const marker = (/** @type {number} */ color, /** @type {{x: number, z: number}} */ at, /** @type {number} */ r) => {
    const ring = new Mesh(
      own(new RingGeometry(r * 0.72, r, 40)),
      own(new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 })),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.005, at.z);
    ring.receiveShadow = true;
    group.add(ring);
    return ring;
  };
  marker(RENDER.colors.start, layout.start, goalRadius * 0.8);
  const goalRing = marker(RENDER.colors.goal, layout.goal, goalRadius);
  const goalGlow = new Mesh(
    own(new CylinderGeometry(goalRadius * 0.7, goalRadius * 0.7, 0.01, 32)),
    own(new MeshBasicMaterial({ color: RENDER.colors.goal, transparent: true, opacity: 0.35 })),
  );
  goalGlow.position.set(layout.goal.x, 0.004, layout.goal.z);
  group.add(goalGlow);

  const ball = new Mesh(
    own(new SphereGeometry(ballRadius, 32, 20)),
    own(new MeshStandardMaterial({ color: RENDER.colors.ball, metalness: 0.85, roughness: 0.18 })),
  );
  ball.castShadow = true;
  group.add(ball);

  return {
    group,
    ball,
    /** @param {number} timeSeconds */
    animate(timeSeconds) {
      const pulse = 0.6 + 0.4 * Math.sin(timeSeconds * 4);
      /** @type {MeshStandardMaterial} */ (goalRing.material).emissiveIntensity = 0.5 + pulse;
      goalGlow.scale.setScalar(0.85 + 0.15 * pulse);
    },
    dispose() {
      group.removeFromParent();
      for (const r of owned) r.dispose();
    },
  };
}

/** @typedef {ReturnType<typeof createBoardMeshes>} BoardMeshes */
