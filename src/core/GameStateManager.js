export const GAME_STATES = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVEL_UP: 'LEVEL_UP',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [GAME_STATES.MENU]: new Set([GAME_STATES.PLAYING]),
  [GAME_STATES.PLAYING]: new Set([GAME_STATES.PAUSED, GAME_STATES.LEVEL_UP, GAME_STATES.VICTORY, GAME_STATES.DEFEAT]),
  [GAME_STATES.PAUSED]: new Set([GAME_STATES.PLAYING, GAME_STATES.MENU]),
  [GAME_STATES.LEVEL_UP]: new Set([GAME_STATES.PLAYING]),
  [GAME_STATES.VICTORY]: new Set([GAME_STATES.MENU, GAME_STATES.PLAYING]),
  [GAME_STATES.DEFEAT]: new Set([GAME_STATES.MENU, GAME_STATES.PLAYING]),
});

export class GameStateManager {
  #currentState;
  #listeners = new Set();

  constructor(initialState = GAME_STATES.MENU) {
    if (!Object.hasOwn(ALLOWED_TRANSITIONS, initialState)) {
      throw new RangeError(`Unsupported game state: ${initialState}`);
    }

    this.#currentState = initialState;
  }

  get currentState() {
    return this.#currentState;
  }

  isPlaying() {
    return this.#currentState === GAME_STATES.PLAYING;
  }

  startGame() {
    if (this.#currentState !== GAME_STATES.MENU) return false;
    return this.transitionTo(GAME_STATES.PLAYING);
  }

  pause() {
    return this.transitionTo(GAME_STATES.PAUSED);
  }

  resume() {
    if (this.#currentState !== GAME_STATES.PAUSED) return false;
    return this.transitionTo(GAME_STATES.PLAYING);
  }

  returnToMenu() {
    if (this.#currentState !== GAME_STATES.PAUSED
      && this.#currentState !== GAME_STATES.VICTORY
      && this.#currentState !== GAME_STATES.DEFEAT) return false;
    return this.transitionTo(GAME_STATES.MENU);
  }

  finishRun(outcome) {
    if (outcome !== GAME_STATES.VICTORY && outcome !== GAME_STATES.DEFEAT) return false;
    if (this.#currentState !== GAME_STATES.PLAYING) return false;
    return this.#transitionTo(outcome);
  }

  restartRun() {
    if (this.#currentState !== GAME_STATES.VICTORY && this.#currentState !== GAME_STATES.DEFEAT) return false;
    return this.#transitionTo(GAME_STATES.PLAYING);
  }

  beginLevelUp() {
    if (this.#currentState !== GAME_STATES.PLAYING) return false;
    return this.#transitionTo(GAME_STATES.LEVEL_UP);
  }

  completeLevelUp() {
    if (this.#currentState !== GAME_STATES.LEVEL_UP) return false;
    return this.#transitionTo(GAME_STATES.PLAYING);
  }

  transitionTo(nextState) {
    if (nextState === GAME_STATES.LEVEL_UP || this.#currentState === GAME_STATES.LEVEL_UP) return false;
    if (nextState === GAME_STATES.VICTORY || nextState === GAME_STATES.DEFEAT) return false;
    if ((this.#currentState === GAME_STATES.VICTORY || this.#currentState === GAME_STATES.DEFEAT)
      && nextState === GAME_STATES.PLAYING) return false;
    return this.#transitionTo(nextState);
  }

  #transitionTo(nextState) {
    if (!Object.hasOwn(ALLOWED_TRANSITIONS, nextState)) return false;
    if (!ALLOWED_TRANSITIONS[this.#currentState].has(nextState)) return false;

    const previousState = this.#currentState;
    this.#currentState = nextState;
    for (const listener of this.#listeners) listener(nextState, previousState);
    return true;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('State change listener must be a function');
    }

    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
