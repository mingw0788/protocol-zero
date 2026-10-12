import { BOSS_CONFIG } from '../config/bossConfig.js';
import { Enemy } from '../entities/Enemy.js';
import { WORLD_MAP } from '../config/worldConfig.js';

const POSITIVE_FIELDS = Object.freeze([
  'hp',
  'maxHp',
  'speed',
  'radius',
  'contactDamage',
  'spawnTimeSeconds',
  'spawnClearance',
  'initialAttackDelaySeconds',
  'telegraphSeconds',
  'chargeSpeed',
  'chargeDurationSeconds',
  'recoverySeconds',
  'attackCooldownSeconds',
]);

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('BossSystem requires a Boss config');
  }
  for (const field of POSITIVE_FIELDS) requirePositiveFinite(config[field], field);
  if (!Number.isFinite(config.expDrop) || config.expDrop !== 0) {
    throw new RangeError('Boss expDrop must be zero');
  }
  if (!Number.isFinite(config.warningWidthPadding) || config.warningWidthPadding < 0) {
    throw new RangeError('warningWidthPadding must be a non-negative finite number');
  }
  if (config.hp > config.maxHp) throw new RangeError('Boss hp cannot exceed maxHp');
  if (config.category !== 'boss') throw new TypeError('Boss category must be boss');
  if (typeof config.typeId !== 'string' || config.typeId.trim().length === 0
    || typeof config.name !== 'string' || config.name.trim().length === 0
    || typeof config.color !== 'string' || config.color.trim().length === 0) {
    throw new TypeError('Boss config requires a typeId, name, and color');
  }
}

function validateWorld(world) {
  if (!world || !Number.isFinite(world.width) || world.width <= 0
    || !Number.isFinite(world.height) || world.height <= 0) {
    throw new TypeError('BossSystem requires valid world dimensions');
  }
}

function validatePlayer(player) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)
    || !Number.isFinite(player.radius) || player.radius <= 0) {
    throw new TypeError('BossSystem requires a player with finite position and radius');
  }
}

function validateCamera(camera) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y)
    || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
    || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
    throw new TypeError('BossSystem requires a camera with a finite logical viewport');
  }
}

function distanceToView(camera, x, y) {
  const dx = Math.max(camera.x - x, 0, x - (camera.x + camera.viewportWidth));
  const dy = Math.max(camera.y - y, 0, y - (camera.y + camera.viewportHeight));
  return Math.hypot(dx, dy);
}

export class BossSystem {
  #config;
  #enemies;
  #player;
  #camera;
  #world;
  #boss = null;
  #spawned = false;
  #phase = 'approach';
  #phaseRemaining = 0;

  constructor({
    enemies,
    player,
    camera,
    world = WORLD_MAP,
    config = BOSS_CONFIG,
  } = {}) {
    if (!Array.isArray(enemies)) throw new TypeError('BossSystem requires an enemy array');
    validatePlayer(player);
    validateCamera(camera);
    validateWorld(world);
    validateConfig(config);
    if (world.width < 2 * (config.radius + config.spawnClearance)
      || world.height < 2 * (config.radius + config.spawnClearance)) {
      throw new RangeError('World must fit a Boss plus its spawn clearance');
    }

    this.#config = Object.freeze({ ...config });
    this.#enemies = enemies;
    this.#player = player;
    this.#camera = camera;
    this.#world = world;
    this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
  }

  update(deltaSeconds, effectiveEndSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (!Number.isFinite(effectiveEndSeconds) || effectiveEndSeconds < 0) {
      throw new RangeError('effectiveEndSeconds must be a non-negative finite number');
    }

    if (!this.#spawned && effectiveEndSeconds >= this.#config.spawnTimeSeconds) {
      const position = this.#findSpawnPosition();
      const boss = new Enemy({
        id: 'boss-t01',
        x: position.x,
        y: position.y,
        config: this.#config,
        worldWidth: this.#world.width,
        worldHeight: this.#world.height,
      });
      this.#boss = boss;
      this.#enemies.push(boss);
      this.#spawned = true;
      this.#phase = 'approach';
      this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
      return true;
    }

    return false;
  }

  getSnapshot() {
    if (!this.#boss) return null;
    return Object.freeze({
      id: this.#boss.id,
      typeId: this.#boss.typeId,
      name: this.#boss.name,
      x: this.#boss.x,
      y: this.#boss.y,
      radius: this.#boss.radius,
      hp: this.#boss.hp,
      maxHp: this.#boss.maxHp,
      alive: this.#boss.alive && this.#boss.hp > 0,
      phase: this.#phase,
      phaseRemaining: this.#phaseRemaining,
      chargeDirection: null,
      chargeEnd: null,
    });
  }

  #findSpawnPosition() {
    const inset = this.#config.radius + this.#config.spawnClearance;
    const candidates = [
      { x: inset, y: inset },
      { x: this.#world.width - inset, y: inset },
      { x: inset, y: this.#world.height - inset },
      { x: this.#world.width - inset, y: this.#world.height - inset },
    ].filter((point) => this.#isPositionSafe(point));

    if (candidates.length === 0) {
      throw new RangeError('No legal map corner is available for the Boss');
    }

    const offView = candidates.filter((point) => distanceToView(this.#camera, point.x, point.y)
      >= this.#config.radius + this.#config.spawnClearance);
    const pool = offView.length > 0 ? offView : candidates;
    let farthest = pool[0];
    let greatestDistanceSquared = -1;
    for (const candidate of pool) {
      const dx = candidate.x - this.#player.x;
      const dy = candidate.y - this.#player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > greatestDistanceSquared) {
        farthest = candidate;
        greatestDistanceSquared = distanceSquared;
      }
    }
    return farthest;
  }

  #isPositionSafe(point) {
    if (point.x < this.#config.radius || point.x > this.#world.width - this.#config.radius
      || point.y < this.#config.radius || point.y > this.#world.height - this.#config.radius) {
      return false;
    }
    return Math.hypot(point.x - this.#player.x, point.y - this.#player.y)
      >= this.#config.radius + this.#player.radius;
  }
}
