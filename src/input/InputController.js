import { GAME_STATES } from '../core/GameStateManager.js';

const KEY_DIRECTIONS = Object.freeze({
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
});

export class InputController {
  #stateManager;
  #windowTarget;
  #documentTarget;
  #pressedKeys = new Set();
  #started = false;
  #itemUsePending = false;
  #itemHeld = false;
  #unsubscribeState = null;

  constructor({
    stateManager,
    windowTarget = globalThis.window ?? null,
    documentTarget = globalThis.document ?? null,
  } = {}) {
    if (!stateManager || typeof stateManager.isPlaying !== 'function' || typeof stateManager.subscribe !== 'function') {
      throw new TypeError('InputController requires a game state manager');
    }
    this.#stateManager = stateManager;
    this.#windowTarget = windowTarget;
    this.#documentTarget = documentTarget;
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#windowTarget?.addEventListener('keydown', this.#handleKeyDown);
    this.#windowTarget?.addEventListener('keyup', this.#handleKeyUp);
    this.#windowTarget?.addEventListener('blur', this.#handleBlur);
    this.#documentTarget?.addEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#unsubscribeState = this.#stateManager.subscribe((nextState) => {
      if (nextState !== GAME_STATES.PLAYING) this.clear();
    });
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    this.#windowTarget?.removeEventListener('keydown', this.#handleKeyDown);
    this.#windowTarget?.removeEventListener('keyup', this.#handleKeyUp);
    this.#windowTarget?.removeEventListener('blur', this.#handleBlur);
    this.#documentTarget?.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#unsubscribeState?.();
    this.#unsubscribeState = null;
    this.clear();
  }

  getMovementVector() {
    let x = 0;
    let y = 0;

    for (const code of this.#pressedKeys) {
      const direction = KEY_DIRECTIONS[code];
      x += direction.x;
      y += direction.y;
    }

    return { x: Math.sign(x), y: Math.sign(y) };
  }

  clear() {
    this.#pressedKeys.clear();
    this.#itemUsePending = false;
    this.#itemHeld = false;
  }

  consumeItemUsePress() {
    const pending = this.#itemUsePending;
    this.#itemUsePending = false;
    return pending;
  }

  #handleKeyDown = (event) => {
    if (event.code === 'KeyE') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#itemHeld) this.#itemUsePending = true;
      this.#itemHeld = true;
      return;
    }
    if (!Object.hasOwn(KEY_DIRECTIONS, event.code)) return;
    if (!this.#stateManager.isPlaying()) {
      this.clear();
      return;
    }

    event.preventDefault?.();
    this.#pressedKeys.add(event.code);
  };

  #handleKeyUp = (event) => {
    if (event.code === 'KeyE') { this.#itemHeld = false; return; }
    if (!Object.hasOwn(KEY_DIRECTIONS, event.code)) return;
    event.preventDefault?.();
    this.#pressedKeys.delete(event.code);
  };

  #handleVisibilityChange = () => {
    if (this.#documentTarget?.hidden) this.clear();
  };

  #handleBlur = () => {
    this.clear();
  };
}
