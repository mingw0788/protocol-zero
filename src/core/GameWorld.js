import { GameClock } from './GameClock.js';
import { GameStateManager } from './GameStateManager.js';
import { Player } from '../entities/Player.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';

export class GameWorld {
  #simulationSteps = 0;

  constructor({
    stateManager = new GameStateManager(),
    clock = new GameClock(),
    player = new Player(),
    inputController = null,
  } = {}) {
    this.stateManager = stateManager;
    this.clock = clock;
    this.player = player;
    this.playerSystem = new PlayerSystem({ player, inputController });
  }

  get simulationSteps() {
    return this.#simulationSteps;
  }

  update(deltaSeconds) {
    if (!this.stateManager.isPlaying()) return false;

    this.playerSystem.update(deltaSeconds);
    this.clock.advance(deltaSeconds);
    this.#simulationSteps += 1;
    return true;
  }

  reset() {
    this.clock.reset();
    this.playerSystem.reset();
    this.#simulationSteps = 0;
  }
}
