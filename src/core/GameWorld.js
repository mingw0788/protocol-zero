import { GameClock } from './GameClock.js';
import { GameStateManager } from './GameStateManager.js';
import { Player } from '../entities/Player.js';
import { ENEMY_CONFIG } from '../config/enemyConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';

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

  constructor({
    stateManager = new GameStateManager(),
    clock = new GameClock(),
    player = new Player(),
    camera,
    inputController = null,
    random = Math.random,
    world = WORLD_MAP,
    enemyConfig = ENEMY_CONFIG,
  } = {}) {
    requireCamera(camera);
    this.stateManager = stateManager;
    this.clock = clock;
    this.player = player;
    this.camera = camera;
    this.enemies = [];
    this.playerSystem = new PlayerSystem({ player, inputController });
    this.camera.follow(this.player);
    this.enemySystem = new EnemySystem({ enemies: this.enemies, player, world });
    this.spawnSystem = new SpawnSystem({
      enemies: this.enemies,
      player,
      camera,
      random,
      world,
      enemyConfig,
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
    this.camera.follow(this.player);
    this.enemySystem.cleanup();
    this.spawnSystem.update(deltaSeconds);
    this.enemySystem.update(deltaSeconds);
    this.clock.advance(deltaSeconds);
    this.#simulationSteps += 1;
    return true;
  }

  reset() {
    this.clock.reset();
    this.playerSystem.reset();
    this.camera.follow(this.player);
    this.enemies.length = 0;
    this.spawnSystem.reset();
    this.#simulationSteps = 0;
    this.#killCount = 0;
  }
}
