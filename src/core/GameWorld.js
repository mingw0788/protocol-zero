import { GameClock } from './GameClock.js';
import { GameStateManager } from './GameStateManager.js';
import { Player } from '../entities/Player.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';

export class GameWorld {
  #simulationSteps = 0;
  #killCount = 0;

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

  get killCount() {
    return this.#killCount;
  }

  recordKill() {
    this.#killCount += 1;
    return this.#killCount;
  }

  getHudSnapshot() {
    return Object.freeze({
      health: Object.freeze({ current: this.player.hp, max: this.player.maxHp }),
      experience: this.player.exp,
      level: this.player.level,
      weaponIds: Object.freeze(this.player.weaponStates.map((weapon) => weapon.id)),
      killCount: this.#killCount,
      elapsedSeconds: this.clock.elapsedSeconds,
    });
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
    this.#killCount = 0;
  }
}
