// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (enter/exit a car, shoot, pause, save, restart, mute) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse aims the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_SAVE = 16;
export const ACTION_RESTART = 32;
export const ACTION_MUTE = 64;
export const ACTION_QUIT = 128;
export const ACTION_LOAD = 256;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const SAVE = new Set(['KeyF']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const QUIT = new Set(['KeyQ']);
const LOAD = new Set(['KeyL']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let mouseDown = false;
  let spaceDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER_CAR.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (SAVE.has(event.code)) { if (!event.repeat) actions |= ACTION_SAVE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (QUIT.has(event.code)) { if (!event.repeat) actions |= ACTION_QUIT; }
    else if (LOAD.has(event.code)) { if (!event.repeat) actions |= ACTION_LOAD; }
    else if (event.code === 'Space') {
      spaceDown = true;
      if (!event.repeat) actions |= ACTION_SHOOT;
    }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'Space') spaceDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    mouseDown = false;
    spaceDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** -1/0/1 on each axis, from the held keys. */
    moveX() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    moveY() {
      return (held.down ? 1 : 0) - (held.up ? 1 : 0);
    },
    /** True while the mouse button is held: hold to keep shooting. */
    firing() {
      return mouseDown;
    },
    /** True while Space is held: hold to keep shooting. */
    spaceHeld() {
      return spaceDown;
    },
    /** The mouse position in canvas pixels, for aiming. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queue a press from scripted play (screenshot staging, tests). */
    press(flag) {
      actions |= flag;
    },
    /** Hold a key from scripted play. */
    setHeld(name, value) {
      held[name] = value;
    },
  };
}
