import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { GameStateManager, GAME_STATES } from './GameStateManager.js';
import { GameWorld } from './GameWorld.js';
import { InputController } from '../input/InputController.js';
import { Camera } from '../rendering/Camera.js';
import { CanvasRenderer } from '../rendering/CanvasRenderer.js';
import { MapRenderer } from '../rendering/MapRenderer.js';
import { PlayerRenderer } from '../rendering/PlayerRenderer.js';

export class Game {
  constructor({ canvas = null, loopOptions = {}, inputOptions = {} } = {}) {
    this.stateManager = new GameStateManager();
    this.clock = new GameClock();
    this.inputController = new InputController({ ...inputOptions, stateManager: this.stateManager });
    this.world = new GameWorld({
      stateManager: this.stateManager,
      clock: this.clock,
      inputController: this.inputController,
    });
    this.camera = new Camera();
    this.camera.follow(this.world.player);
    this.renderer = canvas
      ? new CanvasRenderer({
        canvas,
        camera: this.camera,
        mapRenderer: new MapRenderer(),
        playerRenderer: new PlayerRenderer(),
      })
      : null;
    this.loop = new GameLoop({
      ...loopOptions,
      stateManager: this.stateManager,
      world: this.world,
      render: () => this.renderer?.render(this.world.player),
    });
  }

  start() {
    this.inputController.start();
    this.renderer?.start();
    this.loop.start();
  }

  startGame() {
    if (this.stateManager.currentState !== GAME_STATES.MENU) return false;
    this.world.reset();
    return this.stateManager.startGame();
  }

  getHudSnapshot() {
    return this.world.getHudSnapshot();
  }

  togglePause() {
    if (this.stateManager.currentState === GAME_STATES.PLAYING) return this.pause();
    if (this.stateManager.currentState === GAME_STATES.PAUSED) return this.resume();
    return false;
  }

  returnToMenu() {
    if (this.stateManager.currentState !== GAME_STATES.PAUSED) return false;
    this.world.reset();
    return this.stateManager.returnToMenu();
  }

  pause() {
    return this.stateManager.pause();
  }

  resume() {
    return this.stateManager.resume();
  }

  stop() {
    this.loop.stop();
    this.inputController.stop();
    this.renderer?.stop();
  }
}
