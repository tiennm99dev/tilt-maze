/**
 * Every tunable constant in one place. Units: lengths in board units
 * (one maze cell is `board.cellSize`), angles in degrees unless the name
 * says otherwise, times in milliseconds unless the name says seconds.
 * The reasoning behind the values lives in docs/game-design.md.
 */

/** Tilt input: phone pose to board tilt. */
export const TILT = Object.freeze({
  /** Time constant of the frame-rate-independent moving average. */
  smoothingTauMs: 80,
  /** Radial dead zone on the phone tilt; output is rescaled past it. */
  deadZoneDeg: 2,
  /** Phone tilt that maps to the full board tilt. */
  phoneMaxDeg: 25,
  /** Largest board tilt the game ever applies. */
  boardMaxDeg: 15,
  /** User sensitivity multiplier range. */
  sensitivityMin: 0.5,
  sensitivityMax: 2,
  /** How long the neutral pose is averaged when calibrating. */
  calibrationMs: 250,
  /**
   * Wait between the tap that starts a calibration and its sampling, so the
   * prompt can be read and the thumb has left the screen.
   */
  calibrationLeadMs: 600,
  /** Sensors count as live only if a real reading arrives this soon. */
  sensorProbeMs: 1000,
  /**
   * Sign applied to `screen.orientation.angle`. Flip to -1 if a device
   * reports landscape angles the other way round.
   */
  screenAngleSign: 1,
  /** Pointer drag: this fraction of the shorter viewport side is full tilt. */
  dragFullTiltFraction: 0.25,
});

/** Shake detection from `devicemotion`. */
export const SHAKE = Object.freeze({
  /** Acceleration magnitude (m/s², gravity excluded) that counts as a shake. */
  thresholdMs2: 15,
  /** No second shake within this window. */
  cooldownMs: 500,
  /** High-pass time constant used when `acceleration` is null. */
  highPassTauMs: 300,
  /** Strength is magnitude / threshold, capped here. */
  maxStrength: 2,
  /** Strength used by the keyboard shake (Space). */
  keyboardStrength: 1.8,
});

/** Board geometry. */
export const BOARD = Object.freeze({
  cellSize: 1.5,
  wallThickness: 0.12,
  floorThickness: 0.3,
  ballRadius: 0.25,
  /** Inner walls: 1.2 ball diameters high. */
  innerWallHeight: 1.2 * 0.5,
  /** Outer rim: 0.7 ball diameters high. */
  rimWallHeight: 0.7 * 0.5,
  /** Side of the square floor opening of a hole. */
  holeSize: 0.62,
  /** A hole always leaves a free lane this wide (1.5 ball diameters). */
  minLaneWidth: 1.5 * 0.5,
  /** Ball centre within this distance of the goal centre wins. */
  goalRadius: 0.45,
});

/** Physics. */
export const PHYSICS = Object.freeze({
  /** Gravity magnitude in board units per second squared (9.81 · k). */
  gravity: 9.81 * 1.8,
  stepSeconds: 1 / 60,
  maxStepsPerFrame: 5,
  maxFrameSeconds: 0.1,
  ballDensity: 1,
  ballFriction: 0.6,
  ballRestitution: 0.25,
  ballAngularDamping: 0.25,
  ballLinearDamping: 0.05,
  wallFriction: 0.3,
  wallRestitution: 0.2,
  /** Grounded test: ray down from the ball centre, this far past the radius. */
  groundedSlack: 0.08,
  /** Shake impulse, as a velocity change per unit of shake strength. */
  shakeUpSpeed: 2.8,
  shakeSideSpeed: 1.8,
  /** Below this height (board-local) the ball counts as falling. */
  fallingY: -0.3,
  /** Below this height the fall ends and the ball respawns. */
  killY: -6,
  /** Horizontal speed change in one step that counts as a wall hit. */
  wallHitMinDeltaV: 1.2,
});

/** Level generation. Index i of a table is difficulty i + 1. */
export const LEVELS = Object.freeze({
  /** Grid side on the first and the last difficulty; sizes between are interpolated. */
  minSize: 5,
  maxSize: 11,
  /** Holes per level, capped by the route cells that can take one. */
  holes: Object.freeze([0, 1, 1, 2, 2, 3, 3, 4, 5, 6]),
  /** Fraction of the remaining inner walls opened to add loops. */
  braid: Object.freeze([0, 0, 0, 0.05, 0.05, 0.08, 0.1, 0.12, 0.15, 0.15]),
  /** A loop may shorten the start-to-goal route to no less than this share of it. */
  braidKeepRatio: 0.8,
  /** Growing Tree: probability of growing from the newest cell. */
  newestBias: 0.9,
});

/** Game rules. */
export const RULES = Object.freeze({
  fallPenaltyMs: 5000,
  /** Time between reaching the goal and the win screen, for the goal flash. */
  winDelayMs: 500,
  levelCount: 10,
  endlessDifficulty: 10,
});

/** Rendering. */
export const RENDER = Object.freeze({
  fovDeg: 45,
  /** Camera leans this far from vertical toward the player. */
  cameraLeanDeg: 20,
  /** Extra room around the board when framing a landscape view. */
  framingMargin: 1.15,
  /**
   * Portrait: the fully tilted board fits within this share of the half
   * width (normalised device coordinates).
   */
  portraitFitNdc: 0.97,
  /** Portrait: CSS pixels kept clear at the top and bottom for the HUD and hint. */
  hudReservePx: 64,
  maxPixelRatio: 2,
  shadowMapSize: 1024,
  colors: Object.freeze({
    background: 0x1d2433,
    floor: 0xc89a63,
    wall: 0x7a4f2c,
    ball: 0xd8dde6,
    goal: 0x3ddc84,
    start: 0x5b8def,
    hole: 0x0b0e14,
  }),
});
