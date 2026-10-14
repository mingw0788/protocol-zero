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
import { LocalProgressSystem } from '../systems/LocalProgressSystem.js';
import { FeedbackSettingsSystem } from '../systems/FeedbackSettingsSystem.js';

export class Game {
  #uiManager = null;
  #soundEnabled = true;
  #audioManager;
  #unsubscribeSoundEvents;
  #progressSystem;
  #mapRenderer = new MapRenderer();
  #feedbackSettings;
  #unsubscribeAudioState;
  #feedbackSaved = true;

  constructor({
    canvas = null,
    loopOptions = {},
    inputOptions = {},
    audioManager = new AudioManager(),
    progressSystem = new LocalProgressSystem(),
    feedbackSettings = new FeedbackSettingsSystem(),
  } = {}) {
    if (!audioManager
      || !['unlock', 'setEnabled', 'setVolume', 'playEvent', 'dispose'].every((method) => typeof audioManager[method] === 'function')
      || !Number.isFinite(audioManager.volume)) {
      throw new TypeError('Game requires a compatible audio manager');
    }
    if (!progressSystem
      || !['getSnapshot', 'recordRun', 'updateAudioPreferences'].every((method) => typeof progressSystem[method] === 'function')) {
      throw new TypeError('Game requires a compatible local progress system');
    }
    this.#progressSystem = progressSystem;
    this.#feedbackSettings = feedbackSettings;
    const savedProgress = this.#progressSystem.getSnapshot();
    if (!savedProgress || typeof savedProgress.soundEnabled !== 'boolean'
      || !Number.isFinite(savedProgress.soundVolume)) {
      throw new TypeError('Local progress system returned an invalid snapshot');
    }
    this.#soundEnabled = savedProgress.soundEnabled;
    this.#audioManager = audioManager;
    this.#audioManager.setEnabled(this.#soundEnabled);
    this.#audioManager.setVolume(savedProgress.soundVolume);
    this.#audioManager.setMusicVolume?.(this.#feedbackSettings.getSnapshot().musicVolume);
    this.stateManager = new GameStateManager();
    this.#unsubscribeAudioState = this.stateManager.subscribe(state => {
      if (state !== GAME_STATES.PLAYING) this.#audioManager.updateMusic?.({ active: false });
    });
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
      if (type === 'victory' || type === 'defeat') {
        this.#progressSystem.recordRun(this.world.getRunResultSnapshot());
      }
      this.#audioManager.playEvent(type);
    });
    this.camera.follow(this.world.player);
    this.renderer = canvas
      ? new CanvasRenderer({
        canvas,
        camera: this.camera,
        mapRenderer: this.#mapRenderer,
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
        this.#audioManager.updateMusic?.({ elapsedSeconds: this.clock.elapsedSeconds,
          active: this.stateManager.currentState === GAME_STATES.PLAYING,
          intensity: this.world.getBossSnapshot()?.alive ? 1 : Math.min(.7, this.world.enemies.length / 100) });
        this.renderer?.render(
          this.world.player,
          this.world.enemies,
          this.world.projectiles,
          this.world.experienceCrystals,
          this.world.getOrbitalBladeSnapshot(),
          this.world.getBossSnapshot(),
          this.world.getVisualEffectsSnapshot(),
          this.clock.elapsedSeconds,
          this.getExpansionSnapshot(),
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
    this.#progressSystem.updateAudioPreferences({ soundEnabled: this.#soundEnabled });
    return this.#soundEnabled;
  }

  get soundVolume() {
    return this.#audioManager.volume;
  }

  setSoundVolume(volume) {
    const updatedVolume = this.#audioManager.setVolume(volume);
    this.#progressSystem.updateAudioPreferences({ soundVolume: updatedVolume });
    return updatedVolume;
  }

  getProgressSnapshot() {
    return this.#progressSystem.getSnapshot();
  }

  startGame() {
    if (this.stateManager.currentState !== GAME_STATES.MENU) return false;
    if (this.#soundEnabled) this.#audioManager.unlock();
    this.world.reset();
    this.#mapRenderer.setMap(this.world.mapConfig);
    return this.stateManager.startGame();
  }

  selectMap(id) {
    if (!this.world.setMap(id)) return false;
    this.#mapRenderer.setMap(this.world.mapConfig);
    return true;
  }

  getMapSnapshot() {
    return this.world.getMapSnapshot();
  }

  getExpansionSnapshot() { return Object.freeze({ ...this.world.getExpansionSnapshot(), feedback: this.#feedbackSettings.getSnapshot() }); }
  getFeedbackSettings() { return this.#feedbackSettings.getSnapshot(); }
  get feedbackSaved() { return this.#feedbackSaved; }
  setFeedbackSettings(patch) {
    const saved = this.#feedbackSettings.update(patch);
    this.#feedbackSaved = saved;
    this.#audioManager.setMusicVolume?.(this.#feedbackSettings.getSnapshot().musicVolume);
    return saved;
  }
  selectMode(id) { return this.world.setMode(id); }
  getRunConfigSnapshot() { return this.world.getRunConfigSnapshot(); }

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

  getUpgradeRerollSnapshot() { return this.world.getUpgradeRerollSnapshot(); }

  rerollUpgrades() { return this.world.rerollUpgrades(); }

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
    this.#mapRenderer.setMap(this.world.mapConfig);
    return this.stateManager.returnToMenu();
  }

  restartGame() {
    if (this.stateManager.currentState !== GAME_STATES.VICTORY
      && this.stateManager.currentState !== GAME_STATES.DEFEAT) return false;
    if (this.#soundEnabled) this.#audioManager.unlock();
    this.world.reset();
    this.#mapRenderer.setMap(this.world.mapConfig);
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
    this.#unsubscribeAudioState?.(); this.#unsubscribeAudioState = null;
    this.#unsubscribeSoundEvents?.();
    this.#unsubscribeSoundEvents = null;
    this.#audioManager.dispose();
    this.loop.stop();
    this.inputController.stop();
    this.renderer?.stop();
    this.#uiManager?.stop();
  }
}
