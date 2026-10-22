/**
 * Sound effects synthesised with WebAudio (no audio files), plus short
 * vibrations where `navigator.vibrate` exists (Android; iOS ignores it).
 * The AudioContext is created and resumed inside the first tap, because
 * browsers block audio until a user gesture.
 */

const VIBRATE_GAP_MS = 100;

/** Creates the sound and vibration player. */
export function createSfx() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let master = null;
  /** @type {GainNode | null} */
  let rollGain = null;
  /** @type {BiquadFilterNode | null} */
  let rollFilter = null;
  let muted = false;
  let lastVibrate = 0;

  /** @returns {AudioContext | null} */
  const create = () => {
    const Ctor = globalThis.AudioContext ?? /** @type {{webkitAudioContext?: typeof AudioContext}} */ (globalThis).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const c = new Ctor();
      master = c.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(c.destination);

      // Rolling: looped noise through a band-pass, gain follows ball speed.
      const noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      rollFilter = c.createBiquadFilter();
      rollFilter.type = 'bandpass';
      rollFilter.frequency.value = 220;
      rollFilter.Q.value = 0.8;
      rollGain = c.createGain();
      rollGain.gain.value = 0;
      src.connect(rollFilter).connect(rollGain).connect(master);
      src.start();
      return c;
    } catch {
      return null;
    }
  };

  /**
   * @param {number} pattern
   */
  const vibrate = (pattern) => {
    if (muted || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const now = performance.now();
    if (now - lastVibrate < VIBRATE_GAP_MS) return;
    lastVibrate = now;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw without a recent gesture; vibration is optional.
    }
  };

  /**
   * @param {number} freq
   * @param {number} endFreq
   * @param {number} duration Seconds.
   * @param {number} volume
   * @param {OscillatorType} type
   * @param {number} [delay] Seconds.
   */
  const tone = (freq, endFreq, duration, volume, type, delay = 0) => {
    if (!ctx || !master || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  return {
    /** Call synchronously inside a user gesture. */
    unlock() {
      if (!ctx) ctx = create();
      ctx?.resume().catch(() => {});
    },
    /** Call from a gesture too: some browsers suspend audio on hide. */
    resume() {
      ctx?.resume().catch(() => {});
    },
    /** @param {boolean} value */
    setMuted(value) {
      muted = value;
      if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.02);
    },
    /**
     * @param {number} speed Ball speed in board units per second.
     * @param {boolean} grounded
     */
    roll(speed, grounded) {
      if (!ctx || !rollGain || !rollFilter) return;
      const level = grounded ? Math.min(1, speed / 6) : 0;
      rollGain.gain.setTargetAtTime(level * 0.35, ctx.currentTime, 0.05);
      rollFilter.frequency.setTargetAtTime(160 + speed * 70, ctx.currentTime, 0.05);
    },
    /** @param {number} strength Speed change of the impact. */
    hit(strength) {
      const v = Math.min(1, strength / 6);
      tone(320 + 300 * v, 120, 0.08, 0.25 * v + 0.05, 'triangle');
      if (strength > 2.5) vibrate(15);
    },
    fall() {
      tone(520, 70, 0.7, 0.3, 'sine');
      vibrate(80);
    },
    shake() {
      tone(180, 420, 0.15, 0.15, 'square');
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.22, 0.22, 'triangle', i * 0.11));
      vibrate(40);
    },
    stopRoll() {
      if (ctx && rollGain) rollGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    },
  };
}

/** @typedef {ReturnType<typeof createSfx>} Sfx */
