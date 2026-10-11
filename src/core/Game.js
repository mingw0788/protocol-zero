import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { GameStateManager } from './GameStateManager.js';
import { GameWorld } from './GameWorld.js';
import { Camera } from '../rendering/Camera.js';
import { CanvasRenderer } from '../rendering/CanvasRenderer.js';
import { MapRenderer } from '../rendering/MapRenderer.js';

export class Game {
  constructor({ canvas = null, loopOptions = {} } = {}) {
    this.stateManager = new GameStateManager();
    this.clock = new GameClock();
    this.world = new GameWorld({ stateManager: this.stateManager, clock: this.clock });
    this.camera = new Camera();
    this.renderer = canvas
      ? new CanvasRenderer({ canvas, camera: this.camera, mapRenderer: new MapRenderer() })
      : null;
    this.loop = new GameLoop({
      ...loopOptions,
      stateManager: this.stateManager,
      world: this.world,
      render: () => this.renderer?.render(),
    });
  }

  start() {
    this.renderer?.start();
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
    this.renderer?.stop();
  }
}
