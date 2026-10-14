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
  #itemUsePending = null;
  #itemKeys = new Set();
  #itemExchangePending = false;
  #exchangeHeld = false;
  #itemSelectPending = false;
  #selectHeld = false;
  #objectivePending = false;
  #objectiveHeld = false;
  #dashPending = false;
  #dashKeys = new Set();
  #skillPending = false;
  #skillHeld = false;
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
    this.#skillPending = false; this.#skillHeld = false;
    this.#pressedKeys.clear();
    this.#itemUsePending = null;
    this.#itemKeys.clear();
    this.#itemExchangePending = false;
    this.#exchangeHeld = false;
    this.#itemSelectPending = false;
    this.#selectHeld = false;
    this.#objectivePending = false;
    this.#objectiveHeld = false;
    this.#dashPending = false;
    this.#dashKeys.clear();
  }

  consumeDashPress() {
    const pending = this.#dashPending;
    this.#dashPending = false;
    return pending;
  }
  consumeSkillPress() { const pending = this.#skillPending; this.#skillPending = false; return pending; }

  consumeItemUsePress() {
    const pending = this.#itemUsePending;
    this.#itemUsePending = null;
    return pending;
  }

  consumeItemExchangePress() {
    const pending = this.#itemExchangePending;
    this.#itemExchangePending = false;
    return pending;
  }

  consumeItemSelectPress() {
    const pending = this.#itemSelectPending;
    this.#itemSelectPending = false;
    return pending;
  }

  consumeObjectivePress() {
    const pending = this.#objectivePending;
    this.#objectivePending = false;
    return pending;
  }

  #handleKeyDown = (event) => {
    if (event.code === 'Space') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#skillHeld) this.#skillPending = true;
      this.#skillHeld = true; return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && this.#dashKeys.size === 0) this.#dashPending = true;
      this.#dashKeys.add(event.code);
      return;
    }
    if (event.code === 'KeyE' || event.code === 'KeyQ') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#itemKeys.has(event.code) && this.#itemUsePending === null) {
        this.#itemUsePending = { slot: event.code === 'KeyE' ? 0 : 1 };
      }
      this.#itemKeys.add(event.code);
      return;
    }
    if (event.code === 'KeyF') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#exchangeHeld) this.#itemExchangePending = true;
      this.#exchangeHeld = true;
      return;
    }
    if (event.code === 'KeyC') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#selectHeld) this.#itemSelectPending = true;
      this.#selectHeld = true;
      return;
    }
    if (event.code === 'KeyG') {
      if (!this.#stateManager.isPlaying()) return;
      event.preventDefault?.();
      if (!event.repeat && !this.#objectiveHeld) this.#objectivePending = true;
      this.#objectiveHeld = true;
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
    if (event.code === 'Space') { this.#skillHeld = false; return; }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { this.#dashKeys.delete(event.code); return; }
    if (event.code === 'KeyE' || event.code === 'KeyQ') { this.#itemKeys.delete(event.code); return; }
    if (event.code === 'KeyF') { this.#exchangeHeld = false; return; }
    if (event.code === 'KeyC') { this.#selectHeld = false; return; }
    if (event.code === 'KeyG') { this.#objectiveHeld = false; return; }
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
