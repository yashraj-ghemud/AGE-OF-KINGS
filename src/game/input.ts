// Keyboard + mouse state for the battle. Pointer lock when available, drag-to-look otherwise.

export const input = {
  keys: new Set<string>(),
  pressed: new Set<string>(),
  mouseDX: 0,
  mouseDY: 0,
  wheel: 0,
  lmb: false,
  rmb: false,
  lmbPressed: false,
  lmbReleased: false,
  locked: false,
  enabled: false,
};

export function consumeFrame() {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.wheel = 0;
  input.lmbPressed = false;
  input.lmbReleased = false;
}

const GAME_KEYS = new Set(['Space', 'Tab', 'AltLeft', 'AltRight', 'ControlLeft', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function attachInput(target: HTMLElement) {
  const down = (e: KeyboardEvent) => {
    if (!input.enabled) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => {
    input.keys.delete(e.code);
  };
  const move = (e: MouseEvent) => {
    if (!input.enabled) return;
    if (document.pointerLockElement || input.lmb || input.rmb) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  };
  const md = (e: MouseEvent) => {
    if (!input.enabled) return;
    if (e.button === 0) {
      input.lmb = true;
      input.lmbPressed = true;
    }
    if (e.button === 2) input.rmb = true;
  };
  const mu = (e: MouseEvent) => {
    if (e.button === 0) {
      if (input.lmb) input.lmbReleased = true;
      input.lmb = false;
    }
    if (e.button === 2) input.rmb = false;
  };
  const wheel = (e: WheelEvent) => {
    if (input.enabled) input.wheel += Math.sign(e.deltaY);
  };
  const ctx = (e: Event) => e.preventDefault();
  const blur = () => {
    input.keys.clear();
    input.lmb = false;
    input.rmb = false;
  };
  const lock = () => (input.locked = document.pointerLockElement === target);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousemove', move);
  target.addEventListener('mousedown', md);
  window.addEventListener('mouseup', mu);
  window.addEventListener('wheel', wheel, { passive: true });
  target.addEventListener('contextmenu', ctx);
  window.addEventListener('blur', blur);
  document.addEventListener('pointerlockchange', lock);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('mousemove', move);
    target.removeEventListener('mousedown', md);
    window.removeEventListener('mouseup', mu);
    window.removeEventListener('wheel', wheel);
    target.removeEventListener('contextmenu', ctx);
    window.removeEventListener('blur', blur);
    document.removeEventListener('pointerlockchange', lock);
  };
}

export function requestLock(el: HTMLElement) {
  try {
    const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    /* drag-to-look fallback */
  }
}
