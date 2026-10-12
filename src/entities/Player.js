import { PLAYER_CONFIG } from '../config/playerConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class Player {
  constructor({
    worldWidth = WORLD_MAP.width,
    worldHeight = WORLD_MAP.height,
    x = worldWidth / 2,
    y = worldHeight / 2,
    radius = PLAYER_CONFIG.radius,
    moveSpeed = PLAYER_CONFIG.moveSpeed,
  } = {}) {
    requirePositiveFinite(worldWidth, 'worldWidth');
    requirePositiveFinite(worldHeight, 'worldHeight');
    requirePositiveFinite(radius, 'radius');
    requirePositiveFinite(moveSpeed, 'moveSpeed');
    if (radius * 2 >= worldWidth || radius * 2 >= worldHeight) {
      throw new RangeError('Player diameter must be smaller than the world dimensions');
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Player position must have finite x and y coordinates');
    }

    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.radius = radius;
    this.baseMoveSpeed = moveSpeed;
    this.moveSpeed = moveSpeed;
    this.x = clamp(x, radius, worldWidth - radius);
    this.y = clamp(y, radius, worldHeight - radius);
    this.#resetRunAttributes();
  }

  update(direction, deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }

    const inputX = Number.isFinite(direction?.x) ? direction.x : 0;
    const inputY = Number.isFinite(direction?.y) ? direction.y : 0;
    const magnitude = Math.hypot(inputX, inputY);
    if (magnitude === 0 || deltaSeconds === 0) return false;

    const distance = this.moveSpeed * deltaSeconds;
    this.x = clamp(this.x + (inputX / magnitude) * distance, this.radius, this.worldWidth - this.radius);
    this.y = clamp(this.y + (inputY / magnitude) * distance, this.radius, this.worldHeight - this.radius);
    return true;
  }

  reset() {
    this.x = this.worldWidth / 2;
    this.y = this.worldHeight / 2;
    this.#resetRunAttributes();
  }

  #resetRunAttributes() {
    this.moveSpeed = this.baseMoveSpeed;
    this.maxHp = PLAYER_CONFIG.maxHp;
    this.hp = this.maxHp;
    this.alive = true;
    this.invulnerabilityRemaining = 0;
    this.level = PLAYER_CONFIG.initialLevel;
    this.exp = PLAYER_CONFIG.initialExp;
    this.weaponStates = [{ id: PLAYER_CONFIG.startingWeaponId, cooldownRemaining: 0 }];
  }
}
