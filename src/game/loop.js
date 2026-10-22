/**
 * Fixed-step accumulator: physics advances in equal steps whatever the
 * display refresh rate, with a cap on steps per frame so a long stall cannot
 * spiral into ever-longer frames.
 */

/**
 * @typedef {object} StepperOptions
 * @property {number} stepSeconds
 * @property {number} maxSteps
 * @property {number} maxFrameSeconds
 */

/** @param {StepperOptions} options */
export function createFixedStepper({ stepSeconds, maxSteps, maxFrameSeconds }) {
  if (!(stepSeconds > 0) || !(maxSteps >= 1)) throw new RangeError('Invalid stepper options');
  let accumulator = 0;
  return {
    /**
     * @param {number} frameSeconds Time since the previous frame.
     * @param {() => void} step Runs once per fixed step.
     * @returns {{steps: number, alpha: number}} Steps run, and how far the
     *   leftover time reaches into the next step (0..1) for interpolation.
     */
    advance(frameSeconds, step) {
      accumulator += Math.min(Math.max(0, frameSeconds), maxFrameSeconds);
      let steps = 0;
      while (accumulator >= stepSeconds && steps < maxSteps) {
        step();
        accumulator -= stepSeconds;
        steps += 1;
      }
      // Drop time the step cap could not absorb.
      if (steps === maxSteps && accumulator >= stepSeconds) accumulator = 0;
      return { steps, alpha: accumulator / stepSeconds };
    },
    reset() {
      accumulator = 0;
    },
  };
}
