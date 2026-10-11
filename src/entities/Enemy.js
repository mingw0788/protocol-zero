import { ENEMY_CONFIG } from '../config/enemyConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function requireNonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

export class Enemy {
  constructor({
    id,
    x,
    y,
    config = ENEMY_CONFIG.EN01,
    worldWidth = WORLD_MAP.width,
    worldHeight = WORLD_MAP.height,
  } = {}) {
    if (!(typeof id === 'string' && id.trim().length > 0)
      && !(typeof id === 'number' && Number.isFinite(id))) {
      throw new TypeError('Enemy id must be a non-empty string or finite number');
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Enemy position must have finite x and y coordinates');
    }
    requirePositiveFinite(worldWidth, 'worldWidth');
    requirePositiveFinite(worldHeight, 'worldHeight');
    if (!config || typeof config !== 'object') throw new TypeError('Enemy config is required');

    requirePositiveFinite(config.maxHp, 'maxHp');
    requirePositiveFinite(config.hp, 'hp');
    requirePositiveFinite(config.speed, 'speed');
    requirePositiveFinite(config.radius, 'radius');
    requireNonNegativeFinite(config.contactDamage, 'contactDamage');
    requireNonNegativeFinite(config.expDrop, 'expDrop');
    if (config.hp > config.maxHp) throw new RangeError('Enemy hp cannot exceed maxHp');
    if (typeof config.typeId !== 'string' || config.typeId.length === 0) {
      throw new TypeError('Enemy config must provide a typeId');
    }
    if (config.radius * 2 >= worldWidth || config.radius * 2 >= worldHeight) {
      throw new RangeError('Enemy diameter must be smaller than the world dimensions');
    }
    if (x < config.radius || x > worldWidth - config.radius
      || y < config.radius || y > worldHeight - config.radius) {
      throw new RangeError('Enemy position must keep its full body inside the world');
    }

    this.id = id;
    this.typeId = config.typeId;
    this.name = config.name;
    this.x = x;
    this.y = y;
    this.radius = config.radius;
    this.hp = config.hp;
    this.maxHp = config.maxHp;
    this.speed = config.speed;
    this.contactDamage = config.contactDamage;
    this.expDrop = config.expDrop;
    this.color = config.color;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.alive = true;
    this.deathProcessed = false;
  }
}
