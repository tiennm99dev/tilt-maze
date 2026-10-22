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
import { RENDER } from '../tuning.js';

const DEG = Math.PI / 180;

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createStage(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(RENDER.colors.background);

  // A small generated room gives the metal ball something to reflect.
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

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
    const half = (boardSize / 2) * RENDER.framingMargin;
    const tanV = Math.tan((RENDER.fovDeg * DEG) / 2);
    const tanH = tanV * camera.aspect;
    const distance = Math.max(half / tanV, half / tanH) + half * 0.35;
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

  const observer = new ResizeObserver(frame);
  observer.observe(canvas);
  setBoardSize(boardSize);

  return {
    renderer,
    scene,
    camera,
    setBoardSize,
    render: () => renderer.render(scene, camera),
    dispose() {
      observer.disconnect();
      envTarget.dispose();
      renderer.dispose();
    },
  };
}

/** @typedef {ReturnType<typeof createStage>} Stage */
