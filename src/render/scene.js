/**
 * Renderer, camera framing and lights. The camera stays fixed above the
 * board, leaned toward the player, and reframes the whole board on resize.
 */

import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOARD, RENDER, TILT } from '../tuning.js';
import { fitDistance } from './framing.js';

const DEG = Math.PI / 180;

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createStage(canvas) {
  // Browser default power preference: a few draw calls do not need the
  // discrete GPU of a dual-GPU laptop.
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(RENDER.colors.background);

  /**
   * A small generated room gives the metal ball something to reflect. The
   * room and the generator are freed at once; only the target is kept.
   */
  const buildEnv = () => {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    return target;
  };
  let envTarget = buildEnv();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.35;

  const camera = new PerspectiveCamera(RENDER.fovDeg, 1, 0.1, 200);

  const hemi = new HemisphereLight(0xdfe8ff, 0x3a2a1c, 1.1);
  scene.add(hemi);

  const sun = new DirectionalLight(0xfff2dd, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  let boardSize = 10;

  const frame = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    let distance;
    if (camera.aspect < 1) {
      // Portrait: the width limits the board, so fit the fully tilted board
      // to the width exactly and keep it clear of the HUD and hint rows.
      distance = fitDistance({
        size: boardSize,
        top: BOARD.innerWallHeight,
        bottom: BOARD.floorThickness,
        aspect: camera.aspect,
        fovDeg: RENDER.fovDeg,
        leanDeg: RENDER.cameraLeanDeg,
        tiltDeg: TILT.boardMaxDeg,
        maxX: RENDER.portraitFitNdc,
        maxY: Math.min(RENDER.portraitFitNdc, 1 - (2 * RENDER.hudReservePx) / h),
      });
    } else {
      const half = (boardSize / 2) * RENDER.framingMargin;
      const tanV = Math.tan((RENDER.fovDeg * DEG) / 2);
      const tanH = tanV * camera.aspect;
      distance = Math.max(half / tanV, half / tanH) + half * 0.35;
    }
    const lean = RENDER.cameraLeanDeg * DEG;
    camera.position.set(0, distance * Math.cos(lean), distance * Math.sin(lean));
    camera.lookAt(0, 0, 0);
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
  };

  /** @param {number} size Larger of the board's width and depth. */
  const setBoardSize = (size) => {
    boardSize = size;
    const s = size * 0.75;
    sun.position.set(-s * 0.6, s * 1.6, s * 0.9);
    const cam = sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = s * 5;
    cam.updateProjectionMatrix();
    frame();
  };

  const render = () => {
    // Zoom or a move to another monitor changes the ratio without a resize.
    if (renderer.getPixelRatio() !== pixelRatio()) {
      renderer.setPixelRatio(pixelRatio());
      frame();
    }
    renderer.render(scene, camera);
  };

  // Resizing clears the canvas, so redraw even when the game loop is idle.
  const observer = new ResizeObserver(() => {
    frame();
    render();
  });
  observer.observe(canvas);
  setBoardSize(boardSize);

  // Phones drop the WebGL context of a backgrounded tab. three rebuilds its
  // own state on restore but not the contents of render targets, so the
  // reflections are rebuilt here, and the canvas is redrawn because the
  // game loop is idle behind menus and the pause screen.
  const onRestored = () => {
    envTarget.dispose();
    envTarget = buildEnv();
    scene.environment = envTarget.texture;
    render();
  };
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    renderer,
    scene,
    camera,
    setBoardSize,
    render,
    dispose() {
      observer.disconnect();
      canvas.removeEventListener('webglcontextrestored', onRestored);
      envTarget.dispose();
      renderer.dispose();
    },
  };
}

/** @typedef {ReturnType<typeof createStage>} Stage */
