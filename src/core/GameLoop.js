import { GAME_STATES } from './GameStateManager.js';

const FIXED_STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const STEP_EPSILON = 1e-12;

export class GameLoop {
  #world;
  #stateManager;
  #requestAnimationFrame;
  #cancelAnimationFrame;
  #windowTarget;
  #documentTarget;
  #render;
  #running = false;
  #frameHandle = null;
  #previousTimestamp = null;
  #accumulator = 0;
  #unsubscribeState = null;

  constructor({
    world,
    stateManager = world?.stateManager,
    requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
    windowTarget = globalThis.window ?? null,
    documentTarget = globalThis.document ?? null,
    render = () => {},
  } = {}) {
    if (!world || typeof world.update !== 'function') {
      throw new TypeError('GameLoop requires a world with an update method');
    }
    if (!stateManager || typeof stateManager.subscribe !== 'function') {
      throw new TypeError('GameLoop requires a subscribable state manager');
    }
    if (typeof requestAnimationFrame !== 'function') {
      throw new TypeError('GameLoop requires requestAnimationFrame');
    }
    if (typeof cancelAnimationFrame !== 'function') {
      throw new TypeError('GameLoop requires cancelAnimationFrame');
    }
    if (typeof render !== 'function') {
      throw new TypeError('GameLoop render callback must be a function');
    }

    this.#world = world;
    this.#stateManager = stateManager;
    this.#requestAnimationFrame = requestAnimationFrame;
    this.#cancelAnimationFrame = cancelAnimationFrame;
    this.#windowTarget = windowTarget;
    this.#documentTarget = documentTarget;
    this.#render = render;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#unsubscribeState = this.#stateManager.subscribe(() => this.#resetTiming());
    this.#windowTarget?.addEventListener('blur', this.#handleWindowBlur);
    this.#windowTarget?.addEventListener('focus', this.#handleFocus);
    this.#documentTarget?.addEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#frameHandle = this.#requestAnimationFrame(this.#handleAnimationFrame);
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    if (this.#frameHandle !== null) this.#cancelAnimationFrame(this.#frameHandle);
    this.#frameHandle = null;
    this.#windowTarget?.removeEventListener('blur', this.#handleWindowBlur);
    this.#windowTarget?.removeEventListener('focus', this.#handleFocus);
    this.#documentTarget?.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#unsubscribeState?.();
    this.#unsubscribeState = null;
    this.#resetTiming();
  }

  #handleWindowBlur = () => {
    this.#stateManager.pause();
    this.#resetTiming();
  };

  #handleFocus = () => {
    this.#resetTiming();
  };

  #handleVisibilityChange = () => {
    if (this.#documentTarget?.hidden) this.#stateManager.pause();
    this.#resetTiming();
  };

  #handleAnimationFrame = (timestamp) => {
    if (!this.#running) return;
    this.#advanceFrame(timestamp);
    if (this.#running) this.#frameHandle = this.#requestAnimationFrame(this.#handleAnimationFrame);
  };

  #advanceFrame(timestamp) {
    if (!Number.isFinite(timestamp)) {
      this.#resetTiming();
      this.#render(0);
      return;
    }

    if (this.#previousTimestamp === null) {
      this.#previousTimestamp = timestamp;
      this.#render(0);
      return;
    }

    const elapsedSeconds = (timestamp - this.#previousTimestamp) / 1000;
    this.#previousTimestamp = timestamp;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      this.#accumulator = 0;
      this.#render(0);
      return;
    }

    if (this.#stateManager.currentState !== GAME_STATES.PLAYING) {
      this.#accumulator = 0;
      this.#render(0);
      return;
    }

    this.#accumulator += elapsedSeconds;
    let steps = 0;
    while (
      this.#accumulator + STEP_EPSILON >= FIXED_STEP_SECONDS &&
      steps < MAX_STEPS_PER_FRAME &&
      this.#stateManager.currentState === GAME_STATES.PLAYING
    ) {
      this.#world.update(FIXED_STEP_SECONDS);
      this.#accumulator = Math.max(0, this.#accumulator - FIXED_STEP_SECONDS);
      steps += 1;
    }

    if (this.#stateManager.currentState !== GAME_STATES.PLAYING) {
      this.#accumulator = 0;
    } else if (this.#accumulator >= FIXED_STEP_SECONDS) {
      this.#accumulator %= FIXED_STEP_SECONDS;
    }

    this.#render(this.#accumulator / FIXED_STEP_SECONDS);
  }

  #resetTiming() {
    this.#previousTimestamp = null;
    this.#accumulator = 0;
  }
}
