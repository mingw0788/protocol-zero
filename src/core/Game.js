import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { GameStateManager } from './GameStateManager.js';
import { GameWorld } from './GameWorld.js';

export class Game {
  constructor(loopOptions = {}) {
    this.stateManager = new GameStateManager();
    this.clock = new GameClock();
    this.world = new GameWorld({ stateManager: this.stateManager, clock: this.clock });
    this.loop = new GameLoop({ ...loopOptions, stateManager: this.stateManager, world: this.world });
  }

  start() {
    this.loop.start();
  }

  startGame() {
    return this.stateManager.startGame();
  }

  pause() {
    return this.stateManager.pause();
  }

  resume() {
    return this.stateManager.resume();
  }

  stop() {
    this.loop.stop();
  }
}
