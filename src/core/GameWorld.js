import { GameClock } from './GameClock.js';
import { GameStateManager } from './GameStateManager.js';

export class GameWorld {
  #simulationSteps = 0;

  constructor({ stateManager = new GameStateManager(), clock = new GameClock() } = {}) {
    this.stateManager = stateManager;
    this.clock = clock;
  }

  get simulationSteps() {
    return this.#simulationSteps;
  }

  update(deltaSeconds) {
    if (!this.stateManager.isPlaying()) return false;

    this.clock.advance(deltaSeconds);
    this.#simulationSteps += 1;
    return true;
  }

  reset() {
    this.clock.reset();
    this.#simulationSteps = 0;
  }
}
