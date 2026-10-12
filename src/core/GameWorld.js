import { GameClock } from './GameClock.js';
import { GAME_STATES, GameStateManager } from './GameStateManager.js';
import { Player } from '../entities/Player.js';
import { ENEMY_CONFIG } from '../config/enemyConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
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
import { createRandomStream } from './createRandomStream.js';

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
  #playerDeathListeners = new Set();
  #enemyDeathListeners = new Set();

  constructor({
    stateManager = new GameStateManager(),
    clock = new GameClock(),
    player = new Player(),
    camera,
    inputController = null,
    random = Math.random,
    upgradeRandom = createRandomStream(),
    world = WORLD_MAP,
    enemyConfig = ENEMY_CONFIG,
  } = {}) {
    requireCamera(camera);
    this.stateManager = stateManager;
    this.clock = clock;
    this.player = player;
    this.camera = camera;
    this.enemies = [];
    this.projectiles = [];
    this.experienceCrystals = [];
    this.playerSystem = new PlayerSystem({ player, inputController });
    this.camera.follow(this.player);
    this.enemySystem = new EnemySystem({ enemies: this.enemies, player, world });
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

  getUpgradeChoices() {
    return this.upgradeSystem.getChoicesSnapshot();
  }

  getUpgradeEffectSnapshot() {
    return this.upgradeEffectSystem.getSnapshot();
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

  update(deltaSeconds) {
    if (!this.stateManager.isPlaying() || this.#playerDeathFrozen) return false;

    this.damageSystem.update(deltaSeconds);
    this.playerSystem.update(deltaSeconds);
    this.camera.follow(this.player);
    this.#settleEnemyDeaths();
    this.enemySystem.cleanup();
    this.spawnSystem.update(deltaSeconds);
    this.enemySystem.update(deltaSeconds);
    const damageResult = this.damageSystem.applyContactDamage(this.collisionSystem.getPlayerContacts());
    const upgradeEffects = this.upgradeEffectSystem.getSnapshot();
    this.weaponSystem.update({
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      deltaSeconds,
      upgradeEffects,
    });
    this.projectileSystem.update(deltaSeconds);
    this.orbitalBladeSystem.update({
      deltaSeconds,
      upgradeEffects,
    });
    this.#settleEnemyDeaths();
    this.enemySystem.cleanup();
    this.experienceSystem.update(deltaSeconds);
    const gainedLevels = this.levelSystem.processExperience();
    this.clock.advance(deltaSeconds);
    this.#simulationSteps += 1;

    if (damageResult.killed) {
      this.playerSystem.clearInput();
      this.#playerDeathFrozen = true;
      const payload = Object.freeze({ elapsedSeconds: this.clock.elapsedSeconds });
      for (const listener of [...this.#playerDeathListeners]) listener(payload);
    }

    if (gainedLevels > 0 && damageResult.killed !== true && this.player.alive === true) {
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
    }
  }

  reset() {
    if (this.stateManager.currentState === GAME_STATES.LEVEL_UP) {
      throw new RangeError('GameWorld cannot reset while level-up choices are pending');
    }

    this.clock.reset();
    this.playerSystem.reset();
    this.camera.follow(this.player);
    this.enemies.length = 0;
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
  }
}
