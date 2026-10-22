/**
 * Fallback controls for desktops and phones without usable sensors:
 * WASD or arrow keys, pointer drag with spring-back, and Space for a shake.
 * Both produce a target phone tilt in degrees that goes through the same
 * filter chain as the sensors.
 */

/** @typedef {import('./tilt-math.js').Tilt} Tilt */

const KEY_AXES = /** @type {const} */ ({
  ArrowUp: ['pitch', 1],
  KeyW: ['pitch', 1],
  ArrowDown: ['pitch', -1],
  KeyS: ['pitch', -1],
  ArrowRight: ['roll', 1],
  KeyD: ['roll', 1],
  ArrowLeft: ['roll', -1],
  KeyA: ['roll', -1],
});

/**
 * Maps `key` to the matching `code` for events that carry no code
 * (some automation tools and virtual keyboards).
 * @type {Readonly<Record<string, keyof typeof KEY_AXES>>}
 */
const KEY_FALLBACK = Object.freeze({
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  w: 'KeyW',
  a: 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  W: 'KeyW',
  A: 'KeyA',
  S: 'KeyS',
  D: 'KeyD',
});

/**
 * @param {KeyboardEvent} e
 * @returns {keyof typeof KEY_AXES | undefined}
 */
function axisKey(e) {
  if (e.code in KEY_AXES) return /** @type {keyof typeof KEY_AXES} */ (e.code);
  return KEY_FALLBACK[e.key];
}

/**
 * Keys typed into a form field are not game keys.
 * @param {EventTarget | null} target
 */
export function isEditable(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

/**
 * @param {object} options
 * @param {HTMLElement} options.surface Element that receives pointer drags.
 * @param {number} options.phoneMaxDeg Tilt produced by a full key press or drag.
 * @param {number} options.dragFullTiltFraction
 * @param {() => void} options.onShake
 */
export function createFallbackControls({ surface, phoneMaxDeg, dragFullTiltFraction, onShake }) {
  /** @type {Set<keyof typeof KEY_AXES>} */
  const keys = new Set();
  /** @type {{id: number, x: number, y: number, dx: number, dy: number} | null} */
  let drag = null;
  let dragEnabled = true;
  let keysEnabled = true;

  /** @param {KeyboardEvent} e */
  const onKeyDown = (e) => {
    // Menus keep the browser's own keys (Space presses the focused button),
    // and modifier chords stay browser shortcuts such as Ctrl+S or Cmd+D.
    if (!keysEnabled || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) onShake();
      return;
    }
    const key = axisKey(e);
    if (key) {
      e.preventDefault();
      keys.add(key);
    }
  };
  /** @param {KeyboardEvent} e */
  const onKeyUp = (e) => {
    // macOS sends no keyup for keys released while Cmd is held.
    if (e.key === 'Meta') {
      keys.clear();
      return;
    }
    const key = axisKey(e);
    if (key) keys.delete(key);
  };
  const onBlur = () => {
    keys.clear();
    drag = null;
  };
  /** @param {PointerEvent} e */
  const onPointerDown = (e) => {
    if (!dragEnabled || drag) return;
    // Only a primary left-button press drags; a right click would open the
    // context menu, which swallows the pointerup and latches the tilt.
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    surface.setPointerCapture?.(e.pointerId);
  };
  /** @param {PointerEvent} e */
  const onPointerMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
  };
  /** @param {PointerEvent} e */
  const onPointerUp = (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  /** @param {Event} e */
  const onContextMenu = (e) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerUp);
  surface.addEventListener('lostpointercapture', onPointerUp);
  surface.addEventListener('contextmenu', onContextMenu);

  return {
    /** @returns {Tilt | null} Target phone tilt, or null when idle. */
    target() {
      if (drag) {
        const full = Math.max(1, Math.min(window.innerWidth, window.innerHeight) * dragFullTiltFraction);
        // Dragging up the screen rolls the ball up the screen.
        let pitch = (-drag.dy / full) * phoneMaxDeg;
        let roll = (drag.dx / full) * phoneMaxDeg;
        const mag = Math.hypot(pitch, roll);
        if (mag > phoneMaxDeg) {
          pitch *= phoneMaxDeg / mag;
          roll *= phoneMaxDeg / mag;
        }
        return { pitch, roll };
      }
      if (keys.size === 0) return null;
      const out = { pitch: 0, roll: 0 };
      for (const code of keys) {
        const [axis, sign] = KEY_AXES[code];
        out[axis] += sign * phoneMaxDeg;
      }
      return out;
    },
    /** @param {boolean} enabled Drag is off while sensors steer, so stray touches do not override tilt. */
    setDragEnabled(enabled) {
      dragEnabled = enabled;
      if (!enabled) drag = null;
    },
    /** @param {boolean} enabled Keys steer only in play; menus get the browser's keys back. */
    setKeysEnabled(enabled) {
      keysEnabled = enabled;
      if (!enabled) keys.clear();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerUp);
      surface.removeEventListener('pointercancel', onPointerUp);
      surface.removeEventListener('lostpointercapture', onPointerUp);
      surface.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
