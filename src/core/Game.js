import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { GameStateManager, GAME_STATES } from './GameStateManager.js';
import { GameWorld } from './GameWorld.js';
import { InputController } from '../input/InputController.js';
import { Camera } from '../rendering/Camera.js';
import { CanvasRenderer } from '../rendering/CanvasRenderer.js';
import { MapRenderer } from '../rendering/MapRenderer.js';
import { PlayerRenderer } from '../rendering/PlayerRenderer.js';
import { EnemyRenderer } from '../rendering/EnemyRenderer.js';
import { ProjectileRenderer } from '../rendering/ProjectileRenderer.js';
import { ExperienceCrystalRenderer } from '../rendering/ExperienceCrystalRenderer.js';
import { OrbitalBladeRenderer } from '../rendering/OrbitalBladeRenderer.js';
import { BossRenderer } from '../rendering/BossRenderer.js';
import { AudioManager } from '../audio/AudioManager.js';

export class Game {
  #uiManager = null;
  #soundEnabled = true;
  #audioManager;
  #unsubscribeSoundEvents;

  constructor({ canvas = null, loopOptions = {}, inputOptions = {}, audioManager = new AudioManager() } = {}) {
    if (!audioManager
      || !['unlock', 'setEnabled', 'setVolume', 'playEvent', 'dispose'].every((method) => typeof audioManager[method] === 'function')
      || !Number.isFinite(audioManager.volume)) {
      throw new TypeError('Game requires a compatible audio manager');
    }
    this.#audioManager = audioManager;
    this.stateManager = new GameStateManager();
    this.clock = new GameClock();
    this.inputController = new InputController({ ...inputOptions, stateManager: this.stateManager });
    this.camera = new Camera();
    this.world = new GameWorld({
      stateManager: this.stateManager,
      clock: this.clock,
      camera: this.camera,
      inputController: this.inputController,
    });
    this.#unsubscribeSoundEvents = this.world.subscribeSoundEvent(({ type }) => {
      this.#audioManager.playEvent(type);
    });
    this.camera.follow(this.world.player);
    this.renderer = canvas
      ? new CanvasRenderer({
        canvas,
        camera: this.camera,
        mapRenderer: new MapRenderer(),
        experienceCrystalRenderer: new ExperienceCrystalRenderer(),
        projectileRenderer: new ProjectileRenderer(),
        enemyRenderer: new EnemyRenderer(),
        orbitalBladeRenderer: new OrbitalBladeRenderer(),
        bossRenderer: new BossRenderer(),
        playerRenderer: new PlayerRenderer(),
      })
      : null;
    this.loop = new GameLoop({
      ...loopOptions,
      stateManager: this.stateManager,
      world: this.world,
      render: () => {
        this.renderer?.render(
          this.world.player,
          this.world.enemies,
          this.world.projectiles,
          this.world.experienceCrystals,
          this.world.getOrbitalBladeSnapshot(),
          this.world.getBossSnapshot(),
          this.world.getVisualEffectsSnapshot(),
          this.clock.elapsedSeconds,
        );
        this.#uiManager?.renderSnapshot(
          this.getHudSnapshot(),
          this.stateManager.currentState,
          this.world.getBossSnapshot(),
        );
      },
    });
  }

  start() {
    this.inputController.start();
    this.renderer?.start();
    this.#uiManager?.start();
    this.loop.start();
  }

  attachUIManager(manager) {
    if (!manager || !['start', 'stop', 'renderSnapshot'].every((method) => typeof manager[method] === 'function')) {
      throw new TypeError('UI manager must provide start, stop, and renderSnapshot methods');
    }
    if (this.#uiManager && this.#uiManager !== manager) throw new Error('A UI manager is already attached');
    this.#uiManager = manager;
  }

  get soundEnabled() {
    return this.#soundEnabled;
  }

  toggleSound() {
    this.#soundEnabled = !this.#soundEnabled;
    this.#audioManager.setEnabled(this.#soundEnabled);
    if (this.#soundEnabled) this.#audioManager.unlock();
    return this.#soundEnabled;
  }

  get soundVolume() {
    return this.#audioManager.volume;
  }

  setSoundVolume(volume) {
    return this.#audioManager.setVolume(volume);
  }

  startGame() {
    if (this.stateManager.currentState !== GAME_STATES.MENU) return false;
    if (this.#soundEnabled) this.#audioManager.unlock();
    this.world.reset();
    return this.stateManager.startGame();
  }

  getHudSnapshot() {
    return this.world.getHudSnapshot();
  }

  getBossSnapshot() {
    return this.world.getBossSnapshot();
  }

  getUpgradeChoices() {
    return this.world.getUpgradeChoices();
  }

  chooseUpgrade(choiceId) {
    return this.world.chooseUpgrade(choiceId);
  }

  togglePause() {
    if (this.stateManager.currentState === GAME_STATES.PLAYING) return this.pause();
    if (this.stateManager.currentState === GAME_STATES.PAUSED) return this.resume();
    return false;
  }

  returnToMenu() {
    if (this.stateManager.currentState !== GAME_STATES.PAUSED
      && this.stateManager.currentState !== GAME_STATES.VICTORY
      && this.stateManager.currentState !== GAME_STATES.DEFEAT) return false;
    this.world.reset();
    return this.stateManager.returnToMenu();
  }

  restartGame() {
    if (this.stateManager.currentState !== GAME_STATES.VICTORY
      && this.stateManager.currentState !== GAME_STATES.DEFEAT) return false;
    if (this.#soundEnabled) this.#audioManager.unlock();
    this.world.reset();
    return this.stateManager.restartRun();
  }

  getRunResultSnapshot() {
    return this.world.getRunResultSnapshot();
  }

  pause() {
    return this.stateManager.pause();
  }

  resume() {
    return this.stateManager.resume();
  }

  stop() {
    this.#unsubscribeSoundEvents?.();
    this.#unsubscribeSoundEvents = null;
    this.#audioManager.dispose();
    this.loop.stop();
    this.inputController.stop();
    this.renderer?.stop();
    this.#uiManager?.stop();
  }
}
