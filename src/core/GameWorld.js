import { GameClock } from './GameClock.js';
import { GAME_STATES, GameStateManager } from './GameStateManager.js';
import { Player } from '../entities/Player.js';
import { ENEMY_CONFIG } from '../config/enemyConfig.js';
import { WAVE_CONFIG } from '../config/waveConfig.js';
import { BOSS_CONFIG } from '../config/bossConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { BossSystem } from '../systems/BossSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { DamageSystem } from '../systems/DamageSystem.js';
import { EnemyDamageSystem } from '../systems/EnemyDamageSystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { OrbitalBladeSystem } from '../systems/OrbitalBladeSystem.js';
import { ExperienceSystem } from '../systems/ExperienceSystem.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { UpgradeEffectSystem } from '../systems/UpgradeEffectSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { createRandomStream } from './createRandomStream.js';
import { getMapConfig } from '../config/mapConfig.js';
import { SupplySystem } from '../systems/SupplySystem.js';

function requireCamera(camera) {
  if (!camera
    || typeof camera.follow !== 'function'
    || !Number.isFinite(camera.x)
    || !Number.isFinite(camera.y)
    || !Number.isFinite(camera.viewportWidth)
    || camera.viewportWidth <= 0
    || !Number.isFinite(camera.viewportHeight)
    || camera.viewportHeight <= 0) {
    throw new TypeError('GameWorld requires a camera with a finite logical viewport');
  }
}

export class GameWorld {
  #simulationSteps = 0;
  #killCount = 0;
  #playerDeathFrozen = false;
  #runResult = null;
  #playerDeathListeners = new Set();
  #enemyDeathListeners = new Set();
  #soundEventListeners = new Set();

  constructor({
    stateManager = new GameStateManager(),
    clock = new GameClock(),
    player = new Player(),
    camera,
    inputController = null,
    random = Math.random,
    upgradeRandom = createRandomStream(),
    supplyRandom = createRandomStream(),
    world = WORLD_MAP,
    enemyConfig = ENEMY_CONFIG,
    waveConfig = WAVE_CONFIG,
    bossConfig = BOSS_CONFIG,
  } = {}) {
    requireCamera(camera);
    this.stateManager = stateManager;
    this.mapConfig = getMapConfig('laboratory');
    this.clock = clock;
    this.player = player;
    this.inputController = inputController;
    this.supplySystem = new SupplySystem({ player, random: supplyRandom });
    this.camera = camera;
    this.enemies = [];
    this.projectiles = [];
    this.experienceCrystals = [];
    this.playerSystem = new PlayerSystem({ player, inputController });
    this.camera.follow(this.player);
    this.enemySystem = new EnemySystem({ enemies: this.enemies, player, world });
    this.bossSystem = new BossSystem({
      enemies: this.enemies,
      player,
      camera,
      world,
      config: bossConfig,
    });
    this.waveSystem = new WaveSystem({ config: waveConfig });
    this.collisionSystem = new CollisionSystem({ player, enemies: this.enemies });
    this.damageSystem = new DamageSystem({ player });
    this.enemyDamageSystem = new EnemyDamageSystem();
    this.weaponSystem = new WeaponSystem();
    this.projectileSystem = new ProjectileSystem({
      projectiles: this.projectiles,
      enemies: this.enemies,
      enemyDamageSystem: this.enemyDamageSystem,
    });
    this.orbitalBladeSystem = new OrbitalBladeSystem({
      player: this.player,
      enemies: this.enemies,
      enemyDamageSystem: this.enemyDamageSystem,
    });
    this.spawnSystem = new SpawnSystem({
      enemies: this.enemies,
      player,
      camera,
      random,
      world,
      enemyConfig,
    });
    this.experienceSystem = new ExperienceSystem({
      crystals: this.experienceCrystals,
      player: this.player,
      subscribeEnemyDeath: (listener) => this.subscribeEnemyDeath(listener),
    });
    this.levelSystem = new LevelSystem({ player: this.player, stateManager: this.stateManager });
    this.upgradeSystem = new UpgradeSystem({ player: this.player, random: upgradeRandom });
    this.upgradeEffectSystem = new UpgradeEffectSystem({
      player: this.player,
      upgradeSystem: this.upgradeSystem,
    });
    this.particleSystem = new ParticleSystem();
    this.subscribeEnemyDeath((event) => this.particleSystem.emitEnemyDeath(event));
    this.subscribePlayerDeath(() => this.particleSystem.emitPlayerDeath(this.player));
  }

  get simulationSteps() {
    return this.#simulationSteps;
  }

  setMap(id) {
    const map = getMapConfig(id);
    if (!map || this.stateManager.currentState !== GAME_STATES.MENU) return false;
    this.mapConfig = map;
    this.supplySystem.setEnabled(map.supplies);
    return true;
  }

  getMapSnapshot() {
    return Object.freeze({ id: this.mapConfig.id, name: this.mapConfig.name });
  }

  getSupplySnapshot() { return this.supplySystem.getSnapshot(); }

  get killCount() {
    return this.#killCount;
  }

  recordKill() {
    this.#killCount += 1;
    return this.#killCount;
  }

  getHudSnapshot() {
    const weaponIds = this.player.weaponStates.map((weapon) => weapon.id);
    if (this.upgradeSystem.getLevel('UP-04') > 0 && !weaponIds.includes('orbital-blade')) {
      weaponIds.push('orbital-blade');
    }
    return Object.freeze({
      health: Object.freeze({ current: this.player.hp, max: this.player.maxHp }),
      experience: this.player.exp,
      level: this.player.level,
      pendingLevelUps: this.levelSystem.pendingLevelUps,
      weaponIds: Object.freeze(weaponIds),
      killCount: this.#killCount,
      elapsedSeconds: this.clock.elapsedSeconds,
    });
  }

  getWaveSnapshot() {
    return this.waveSystem.getSnapshot(this.clock.elapsedSeconds);
  }

  getBossSnapshot() {
    return this.bossSystem.getSnapshot();
  }

  getRunResultSnapshot() {
    return this.#runResult;
  }

  getUpgradeChoices() {
    return this.upgradeSystem.getChoicesSnapshot();
  }

  getUpgradeEffectSnapshot() {
    return this.upgradeEffectSystem.getSnapshot();
  }

  getVisualEffectsSnapshot() {
    return this.particleSystem.getSnapshot();
  }

  getOrbitalBladeSnapshot() {
    return this.orbitalBladeSystem.getSnapshot(this.upgradeSystem.getLevel('UP-04'));
  }

  chooseUpgrade(choiceId) {
    if (this.stateManager.currentState !== GAME_STATES.LEVEL_UP
      || this.levelSystem.pendingLevelUps === 0) return false;

    const selection = this.upgradeSystem.select(choiceId);
    if (selection === false) return false;
    this.upgradeEffectSystem.applySelection(selection);
    if (!this.levelSystem.completePendingLevelUp()) return false;
    this.#emitSoundEvent('upgrade');
    if (this.levelSystem.pendingLevelUps > 0) this.upgradeSystem.prepareChoices();
    return true;
  }

  subscribePlayerDeath(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Player death listener must be a function');
    }

    this.#playerDeathListeners.add(listener);
    return () => this.#playerDeathListeners.delete(listener);
  }

  subscribeEnemyDeath(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Enemy death listener must be a function');
    }

    this.#enemyDeathListeners.add(listener);
    return () => this.#enemyDeathListeners.delete(listener);
  }

  subscribeSoundEvent(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Sound event listener must be a function');
    }
    this.#soundEventListeners.add(listener);
    return () => this.#soundEventListeners.delete(listener);
  }

  update(deltaSeconds) {
    if (!this.stateManager.isPlaying() || this.#playerDeathFrozen) return false;

    this.particleSystem.update(deltaSeconds);
    this.damageSystem.update(deltaSeconds);
    this.playerSystem.update(deltaSeconds);
    if (this.inputController?.consumeItemUsePress?.()) this.supplySystem.deploy();
    this.supplySystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds);
    this.camera.follow(this.player);
    this.#settleEnemyDeaths();
    this.enemySystem.cleanup();
    const waveSnapshot = this.waveSystem.getSnapshot(this.clock.elapsedSeconds + deltaSeconds);
    this.spawnSystem.update(deltaSeconds, waveSnapshot);
    this.bossSystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds);
    this.enemySystem.update(deltaSeconds, (enemy) => this.supplySystem.targetFor(enemy));
    const damageResult = this.damageSystem.applyContactDamage(this.collisionSystem.getPlayerContacts());
    if (damageResult.damaged && !damageResult.killed) {
      this.particleSystem.emitPlayerHit(this.player);
      this.#emitSoundEvent('player-hit');
    }
    const upgradeEffects = this.upgradeEffectSystem.getSnapshot();
    const firedProjectileCount = this.weaponSystem.update({
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      deltaSeconds,
      upgradeEffects,
    });
    if (firedProjectileCount > 0) this.#emitSoundEvent('pulse-fire');
    this.projectileSystem.update(deltaSeconds);
    this.orbitalBladeSystem.update({
      deltaSeconds,
      upgradeEffects,
    });
    this.#settleEnemyDeaths();
    this.enemySystem.cleanup();
    this.experienceSystem.update(deltaSeconds, this.supplySystem.pickupRadiusBonus);
    const gainedLevels = this.levelSystem.processExperience();
    this.clock.advance(deltaSeconds);
    this.#simulationSteps += 1;

    if (damageResult.killed) {
      this.playerSystem.clearInput();
      this.#playerDeathFrozen = true;
      const payload = Object.freeze({ elapsedSeconds: this.clock.elapsedSeconds });
      for (const listener of [...this.#playerDeathListeners]) listener(payload);
      this.#emitSoundEvent('player-death');
      this.#finishRun(GAME_STATES.DEFEAT);
    } else {
      const bossSnapshot = this.bossSystem.getSnapshot();
      if (this.clock.elapsedSeconds >= 300 && bossSnapshot?.alive === false) {
        this.#finishRun(GAME_STATES.VICTORY);
      }
    }

    if (gainedLevels > 0 && damageResult.killed !== true && this.player.alive === true
      && this.stateManager.currentState === GAME_STATES.PLAYING) {
      this.upgradeSystem.prepareChoices();
      this.stateManager.beginLevelUp();
    }

    return true;
  }

  #settleEnemyDeaths() {
    for (const enemy of [...this.enemies]) {
      if ((enemy.alive === true && enemy.hp > 0) || enemy.deathProcessed === true) continue;

      enemy.deathProcessed = true;
      this.recordKill();
      const snapshot = Object.freeze({
        enemyId: enemy.id,
        typeId: enemy.typeId,
        x: enemy.x,
        y: enemy.y,
        expDrop: enemy.expDrop,
      });
      for (const listener of [...this.#enemyDeathListeners]) listener(snapshot);
      this.#emitSoundEvent('enemy-death');
    }
  }

  reset() {
    if (this.stateManager.currentState === GAME_STATES.LEVEL_UP) {
      throw new RangeError('GameWorld cannot reset while level-up choices are pending');
    }

    this.clock.reset();
    this.particleSystem.reset();
    this.playerSystem.reset();
    this.inputController?.clear?.();
    this.supplySystem.reset();
    this.camera.follow(this.player);
    this.enemies.length = 0;
    this.bossSystem.reset();
    for (const projectile of this.projectiles) projectile.active = false;
    this.projectiles.length = 0;
    this.experienceSystem.reset();
    this.levelSystem.reset();
    this.upgradeSystem.reset();
    this.orbitalBladeSystem.reset();
    this.spawnSystem.reset();
    this.#simulationSteps = 0;
    this.#killCount = 0;
    this.#playerDeathFrozen = false;
    this.#runResult = null;
  }

  #finishRun(outcome) {
    this.#runResult = Object.freeze({
      outcome: outcome === GAME_STATES.VICTORY ? 'victory' : 'defeat',
      killCount: this.#killCount,
      elapsedSeconds: this.clock.elapsedSeconds,
    });
    if (!this.stateManager.finishRun(outcome)) {
      this.#runResult = null;
      return false;
    }
    this.#emitSoundEvent(outcome === GAME_STATES.VICTORY ? 'victory' : 'defeat');
    return true;
  }

  #emitSoundEvent(type) {
    const event = Object.freeze({ type });
    for (const listener of [...this.#soundEventListeners]) {
      try {
        listener(event);
      } catch {
        // Presentation failures must never interrupt simulation or settlement.
      }
    }
  }
}
