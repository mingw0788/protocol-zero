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
import { ArcCoilSystem } from '../systems/ArcCoilSystem.js';
import { RailgunSystem } from '../systems/RailgunSystem.js';
import { RelaySystem } from '../systems/RelaySystem.js';
import { getExperienceToNextLevel } from '../systems/LevelSystem.js';
import { DashSystem } from '../systems/DashSystem.js';
import { ExplorationSystem } from '../systems/ExplorationSystem.js';
import { TACTICAL_CONFIG } from '../config/tacticalConfig.js';
import { CombatStatsSystem } from '../systems/CombatStatsSystem.js';
import { EncounterSystem } from '../systems/EncounterSystem.js';
import { RunRewardSystem } from '../systems/RunRewardSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { EnemyAttackSystem } from '../systems/EnemyAttackSystem.js';
import { HazardSystem } from '../systems/HazardSystem.js';
import { getRunMode } from '../config/runConfig.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { CryoSystem } from '../systems/CryoSystem.js';
import { DroneSystem } from '../systems/DroneSystem.js';
import { DeployableSystem } from '../systems/DeployableSystem.js';

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
  #lastWeaponHitSoundAt = Number.NEGATIVE_INFINITY;
  #lastEnemyWarningAt = Number.NEGATIVE_INFINITY;
  #killCount = 0;
  #modeId = 'standard';
  #rerolls = TACTICAL_CONFIG.initialRerolls;
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
    encounterRandom = createRandomStream(),
    encounterRewardRandom = createRandomStream(),
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
    this.rewardSystem = new RunRewardSystem({ player, supplySystem: this.supplySystem });
    this.objectiveSystem = new ObjectiveSystem();
    this.camera = camera;
    this.enemies = [];
    this.projectiles = [];
    this.experienceCrystals = [];
    this.playerSystem = new PlayerSystem({ player, inputController });
    this.dashSystem = new DashSystem({ player, onDash: () => this.#emitSoundEvent('dash') });
    this.camera.follow(this.player);
    this.enemySystem = new EnemySystem({ enemies: this.enemies, player, world });
    this.statusEffectSystem = new StatusEffectSystem({ enemies: this.enemies });
    this.enemyAttackSystem = new EnemyAttackSystem({ player, enemies: this.enemies, onWarning: () => {
      if (this.clock.elapsedSeconds - this.#lastEnemyWarningAt < .2) return;
      this.#lastEnemyWarningAt = this.clock.elapsedSeconds;
      this.#emitSoundEvent('enemy-warning');
    } });
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
    this.combatStatsSystem = new CombatStatsSystem();
    this.enemyDamageSystem = new EnemyDamageSystem({ onDamage: (event) => {
      this.combatStatsSystem.recordEnemyDamage(event);
      const { lethal } = event;
      if (!lethal) this.particleSystem?.emitEnemyHit(event);
      const elapsed = this.clock.elapsedSeconds;
      if (!lethal && elapsed - this.#lastWeaponHitSoundAt >= 0.1) {
        this.#lastWeaponHitSoundAt = elapsed;
        this.#emitSoundEvent('weapon-hit');
      }
    } });
    this.hazardSystem = new HazardSystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem,
      onBlast: () => this.#emitSoundEvent('barrel-blast') });
    this.relaySystem = new RelaySystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem });
    this.deployableSystem = new DeployableSystem({ player, enemies: this.enemies,
      enemyDamageSystem: this.enemyDamageSystem, statusSystem: this.statusEffectSystem });
    this.supplySystem.setEffects({ enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem, relaySystem: this.relaySystem,
      deployableSystem: this.deployableSystem,
      onEvent: type => this.#emitSoundEvent(type) });
    this.arcCoilSystem = new ArcCoilSystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem });
    this.railgunSystem = new RailgunSystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem });
    this.cryoSystem = new CryoSystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem, statusSystem: this.statusEffectSystem });
    this.droneSystem = new DroneSystem({ player, enemies: this.enemies, enemyDamageSystem: this.enemyDamageSystem });
    this.weaponSystem = new WeaponSystem();
    this.projectileSystem = new ProjectileSystem({
      projectiles: this.projectiles,
      enemies: this.enemies,
      enemyDamageSystem: this.enemyDamageSystem,
      getObjects: () => this.hazardSystem.getAttackTargets(),
      applyObjectDamage: (id, damage) => this.hazardSystem.damageBarrel(id, damage),
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
    this.encounterSystem = new EncounterSystem({ player, enemies: this.enemies, random: encounterRandom, world,
      rewardRandom: encounterRewardRandom,
      spawnElite: options => this.spawnSystem.spawnEncounterElite(options),
      onNotice: message => this.supplySystem.notify(message),
      onReward: reward => {
        this.rewardSystem.grant(reward);
        this.supplySystem.notify(`事件完成 · ${reward.name} · +${reward.experience} 经验 / 补给`);
        this.#emitSoundEvent('terminal-complete');
      },
    });
    this.experienceSystem = new ExperienceSystem({
      crystals: this.experienceCrystals,
      player: this.player,
      subscribeEnemyDeath: (listener) => this.subscribeEnemyDeath(listener),
    });
    this.supplySystem.experienceSystem = this.experienceSystem;
    this.explorationSystem = new ExplorationSystem({ player,
      onReward: terminal => {
        this.supplySystem.addPickup(terminal.reward, terminal.x, terminal.y);
        this.supplySystem.notify(`${terminal.name} 已上传 · +${TACTICAL_CONFIG.terminalExperience} 经验`);
        this.#emitSoundEvent('terminal-complete');
      },
      onComplete: () => {
        this.#rerolls += 1;
        this.supplySystem.notify(`区域档案完整 · +${TACTICAL_CONFIG.completionExperience} 经验 / 重抽 +1`);
      },
    });
    this.levelSystem = new LevelSystem({ player: this.player, stateManager: this.stateManager });
    this.upgradeSystem = new UpgradeSystem({ player: this.player, random: upgradeRandom,
      getContext: () => ({ scannerStacks: this.supplySystem.scannerStacks }) });
    this.upgradeEffectSystem = new UpgradeEffectSystem({
      player: this.player,
      upgradeSystem: this.upgradeSystem,
    });
    this.particleSystem = new ParticleSystem();
    this.subscribeEnemyDeath((event) => this.particleSystem.emitEnemyDeath(event));
    this.subscribeEnemyDeath((event) => this.relaySystem.notifyEnemyDeath(event));
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
    this.relaySystem.setEnabled(map.id === 'east-city');
    this.explorationSystem.reset(map.id);
    this.encounterSystem.reset(map.id);
    this.rewardSystem.reset();
    this.objectiveSystem.reset();
    this.hazardSystem.reset(map.id);
    return true;
  }

  getMapSnapshot() {
    return Object.freeze({ id: this.mapConfig.id, name: this.mapConfig.name });
  }

  setMode(id) {
    const mode = getRunMode(id);
    if (!mode || this.stateManager.currentState !== GAME_STATES.MENU) return false;
    this.upgradeSystem.setWeaponLimit(mode.weaponLimit ?? Infinity);
    this.#modeId = mode.id;
    return true;
  }

  getRunConfigSnapshot() {
    const mode = getRunMode(this.#modeId);
    return Object.freeze({ modeId: mode.id, modeName: mode.name, weaponLimit: mode.weaponLimit });
  }

  getSupplySnapshot() { return this.supplySystem.getSnapshot(); }

  getExpansionSnapshot() {
    const snapshot = { map: this.getMapSnapshot(), supply: this.getSupplySnapshot(),
      dash: this.dashSystem.getSnapshot(), shield: this.player.shield,
      exploration: this.explorationSystem.getSnapshot(),
      playerPosition: Object.freeze({ x: this.player.x, y: this.player.y }),
      arc: this.arcCoilSystem.getSnapshot(), rail: this.railgunSystem.getSnapshot(), relays: this.relaySystem.getSnapshot(),
      encounters: this.encounterSystem.getSnapshot(), rewards: this.rewardSystem.getSnapshot(),
      hostileAttacks: this.enemyAttackSystem.getSnapshot() };
    snapshot.hazards = this.hazardSystem.getSnapshot();
    snapshot.relayBuff = this.relaySystem.getBuffSnapshot();
    snapshot.build = this.upgradeSystem.getBuildSnapshot();
    snapshot.runConfig = this.getRunConfigSnapshot();
    snapshot.cryo = this.cryoSystem.getSnapshot();
    snapshot.drones = this.droneSystem.getSnapshot();
    snapshot.railFields = this.railgunSystem.getFieldsSnapshot();
    snapshot.deployables = this.deployableSystem.getSnapshot();
    snapshot.trackedObjective = this.objectiveSystem.getTrackedSnapshot(snapshot);
    return Object.freeze(snapshot);
  }

  cycleObjective() { return this.objectiveSystem.cycle(this.getExpansionSnapshot()); }

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
      experienceRequired: getExperienceToNextLevel(this.player.level),
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

  getCombatStatsSnapshot() {
    return this.combatStatsSystem.getSnapshot();
  }

  getUpgradeChoices() {
    return this.upgradeSystem.getChoicesSnapshot();
  }

  getUpgradeRerollSnapshot() {
    return Object.freeze({ remaining: this.#rerolls,
      available: this.stateManager.currentState === GAME_STATES.LEVEL_UP
        && this.#rerolls > 0 && this.upgradeSystem.canReroll() });
  }

  rerollUpgrades() {
    if (!this.getUpgradeRerollSnapshot().available || !this.upgradeSystem.rerollChoices()) return false;
    this.#rerolls -= 1;
    return true;
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
    this.statusEffectSystem.update(deltaSeconds);
    for (const enemy of this.enemies) enemy.hitFlashRemaining = Math.max(0, (enemy.hitFlashRemaining ?? 0) - deltaSeconds);
    for (const weapon of this.player.weaponStates) weapon.fireFlashRemaining = Math.max(0, (weapon.fireFlashRemaining ?? 0) - deltaSeconds);
    this.damageSystem.update(deltaSeconds);
    const direction = this.inputController?.getMovementVector() ?? { x: 0, y: 0 };
    if (!this.dashSystem.update(deltaSeconds, direction, this.inputController?.consumeDashPress?.())) {
      this.playerSystem.update(deltaSeconds);
    }
    if (this.inputController?.consumeItemSelectPress?.()) this.supplySystem.cycleSelectedSlot();
    if (this.inputController?.consumeObjectivePress?.()) this.cycleObjective();
    const exchangeItem = this.inputController?.consumeItemExchangePress?.() ?? false;
    const itemUse = this.inputController?.consumeItemUsePress?.() ?? null;
    if (exchangeItem) this.supplySystem.exchangeNearby();
    else if (itemUse) this.supplySystem.deploy(itemUse.slot);
    this.rewardSystem.update();
    this.supplySystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds);
    if (this.relaySystem.update(deltaSeconds) > 0) this.#emitSoundEvent('relay-pulse');
    this.camera.follow(this.player);
    this.#settleEnemyDeaths(this.clock.elapsedSeconds + deltaSeconds);
    this.enemySystem.cleanup();
    const waveSnapshot = this.waveSystem.getSnapshot(this.clock.elapsedSeconds + deltaSeconds);
    this.spawnSystem.update(deltaSeconds, waveSnapshot);
    this.bossSystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds);
    const hostileHits = this.enemyAttackSystem.update(deltaSeconds, enemy => this.supplySystem.targetFor(enemy));
    const hazardHits = this.hazardSystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds);
    this.enemySystem.update(deltaSeconds, (enemy) => this.supplySystem.targetFor(enemy));
    const contacts = this.collisionSystem.getPlayerContacts();
    const damageResult = this.damageSystem.applyDamageBatch([
      ...contacts.map(enemy => ({ damage: enemy.contactDamage, sourceTypeId: enemy.typeId })),
      ...hostileHits,
      ...hazardHits,
    ]);
    if (damageResult.damaged) {
      this.combatStatsSystem.recordPlayerDamage({
        sourceTypeIds: damageResult.sourceTypeIds,
        healthDamage: damageResult.damage,
        shieldDamage: damageResult.shieldDamage,
      });
    }
    if (damageResult.damaged && !damageResult.killed) {
      this.particleSystem.emitPlayerHit(this.player);
      this.#emitSoundEvent('player-hit');
    }
    const baseUpgradeEffects = this.upgradeEffectSystem.getSnapshot();
    const upgradeEffects = Object.freeze({ ...baseUpgradeEffects,
      damageMultiplier: baseUpgradeEffects.damageMultiplier * this.relaySystem.damageMultiplier });
    const firedProjectileCount = this.weaponSystem.update({
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      deltaSeconds,
      upgradeEffects,
      fireRateMultiplier: this.supplySystem.fireRateMultiplier,
      fallbackTargets: this.hazardSystem.getAttackTargets(this.hazardSystem.config.targetRange),
      evolved: this.upgradeSystem.isEvolved('pulse-gun'),
    });
    if (firedProjectileCount > 0) this.#emitSoundEvent('pulse-fire');
    this.projectileSystem.update(deltaSeconds);
    this.orbitalBladeSystem.update({
      deltaSeconds,
      upgradeEffects,
      fireRateMultiplier: this.supplySystem.fireRateMultiplier,
      evolved: this.upgradeSystem.isEvolved('orbital-blade'),
    });
    const weaponStep = { deltaSeconds, damageMultiplier: upgradeEffects.damageMultiplier, fireRateMultiplier: this.supplySystem.fireRateMultiplier };
    if (this.arcCoilSystem.update({ ...weaponStep, level: upgradeEffects.arcCoilLevel, evolved: this.upgradeSystem.isEvolved('arc-coil') }) > 0) this.#emitSoundEvent('arc-fire');
    if (this.railgunSystem.update({ ...weaponStep, level: upgradeEffects.railgunLevel, evolved: this.upgradeSystem.isEvolved('railgun') }) > 0) this.#emitSoundEvent('rail-fire');
    if (this.cryoSystem.update({ ...weaponStep, level: upgradeEffects.cryoLevel }) > 0) this.#emitSoundEvent('cryo-fire');
    if (this.droneSystem.update({ ...weaponStep, level: upgradeEffects.droneLevel }) > 0) this.#emitSoundEvent('drone-fire');
    this.deployableSystem.update(deltaSeconds, weaponStep);
    this.#settleEnemyDeaths(this.clock.elapsedSeconds + deltaSeconds);
    this.enemySystem.cleanup();
    this.experienceSystem.update(deltaSeconds, this.supplySystem.pickupRadiusBonus);
    this.explorationSystem.update(deltaSeconds);
    this.encounterSystem.update(deltaSeconds, this.clock.elapsedSeconds + deltaSeconds,
      [...this.explorationSystem.getSnapshot().terminals, ...this.relaySystem.getSnapshot(), ...this.hazardSystem.getBlockedPoints()]);
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

  #settleEnemyDeaths(elapsedSeconds) {
    for (const enemy of [...this.enemies]) {
      if ((enemy.alive === true && enemy.hp > 0) || enemy.deathProcessed === true) continue;

      enemy.deathProcessed = true;
      if (enemy.defeatedBySelf) continue;
      this.recordKill();
      this.combatStatsSystem.recordEnemyKill({
        sourceId: enemy.lastDamageSourceId ?? 'unknown',
        targetTypeId: enemy.typeId ?? 'unknown',
        category: enemy.category ?? 'normal',
      });
      const snapshot = Object.freeze({
        enemyId: enemy.id,
        typeId: enemy.typeId,
        x: enemy.x,
        y: enemy.y,
        expDrop: enemy.expDrop,
      });
      this.supplySystem.notifyEnemyDeath({ ...snapshot, category: enemy.category });
      this.encounterSystem.notifyEnemyDeath(snapshot, elapsedSeconds);
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
    this.dashSystem.reset();
    this.enemyAttackSystem.reset();
    this.inputController?.clear?.();
    this.supplySystem.reset();
    this.relaySystem.reset();
    this.explorationSystem.reset(this.mapConfig.id);
    this.encounterSystem.reset(this.mapConfig.id);
    this.rewardSystem.reset();
    this.objectiveSystem.reset();
    this.hazardSystem.reset(this.mapConfig.id);
    this.#rerolls = TACTICAL_CONFIG.initialRerolls;
    this.camera.follow(this.player);
    this.statusEffectSystem.reset();
    this.enemies.length = 0;
    this.bossSystem.reset();
    for (const projectile of this.projectiles) projectile.active = false;
    this.projectiles.length = 0;
    this.projectileSystem.reset();
    this.experienceSystem.reset();
    this.levelSystem.reset();
    this.upgradeSystem.reset();
    this.orbitalBladeSystem.reset();
    this.arcCoilSystem.reset();
    this.railgunSystem.reset();
    this.cryoSystem.reset();
    this.droneSystem.reset();
    this.deployableSystem.reset();
    this.spawnSystem.reset();
    this.#simulationSteps = 0;
    this.#lastWeaponHitSoundAt = Number.NEGATIVE_INFINITY;
    this.#lastEnemyWarningAt = Number.NEGATIVE_INFINITY;
    this.#killCount = 0;
    this.combatStatsSystem.reset();
    this.#playerDeathFrozen = false;
    this.#runResult = null;
  }

  #finishRun(outcome) {
    this.#runResult = Object.freeze({
      outcome: outcome === GAME_STATES.VICTORY ? 'victory' : 'defeat',
      killCount: this.#killCount,
      elapsedSeconds: this.clock.elapsedSeconds,
      statistics: this.combatStatsSystem.getSnapshot(),
      modeId: this.#modeId,
      mapId: this.mapConfig.id,
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
