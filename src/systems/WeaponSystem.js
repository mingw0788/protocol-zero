import { PULSE_GUN_CONFIG } from '../config/weaponConfig.js';
import { Projectile } from '../entities/Projectile.js';

const NUMERIC_CONFIG_FIELDS = [
  'damage',
  'fireIntervalSeconds',
  'range',
  'projectileSpeed',
  'projectileRadius',
  'projectileLifetimeSeconds',
];

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Weapon config is required');
  }
  if (typeof config.id !== 'string' || config.id.trim().length === 0) {
    throw new TypeError('Weapon config id must be a non-empty string');
  }
  for (const field of NUMERIC_CONFIG_FIELDS) {
    if (!Number.isFinite(config[field]) || config[field] <= 0) {
      throw new RangeError(`${field} must be a positive finite number`);
    }
  }
  if (typeof config.projectileColor !== 'string' || config.projectileColor.trim().length === 0) {
    throw new TypeError('projectileColor must be a non-empty string');
  }
}

function findNearestTarget(player, enemies, range) {
  if (!Array.isArray(enemies) || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) {
    return null;
  }

  const rangeSquared = range * range;
  let nearest = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy?.alive !== true
      || !Number.isFinite(enemy.hp)
      || enemy.hp <= 0
      || !Number.isFinite(enemy.x)
      || !Number.isFinite(enemy.y)) {
      continue;
    }

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= rangeSquared && distanceSquared < nearestDistanceSquared) {
      nearest = enemy;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

export class WeaponSystem {
  #nextProjectileId = 1;

  constructor({ config = PULSE_GUN_CONFIG } = {}) {
    validateConfig(config);
    this.config = Object.freeze({ ...config });
  }

  update({ player, enemies, projectiles, deltaSeconds } = {}) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return 0;
    if (!Array.isArray(projectiles)) {
      throw new TypeError('projectiles must be an array');
    }

    const weaponState = player?.weaponStates?.find((state) => state?.id === this.config.id);
    if (!weaponState) return 0;
    if (!Number.isFinite(weaponState.cooldownRemaining) || weaponState.cooldownRemaining < 0) {
      throw new RangeError('weapon cooldownRemaining must be a non-negative finite number');
    }

    weaponState.cooldownRemaining = Math.max(0, weaponState.cooldownRemaining - deltaSeconds);
    const target = findNearestTarget(player, enemies, this.config.range);
    if (!target || weaponState.cooldownRemaining > 0) return 0;

    let dx = target.x - player.x;
    let dy = target.y - player.y;
    let distance = Math.hypot(dx, dy);
    if (distance === 0) {
      dx = 1;
      dy = 0;
      distance = 1;
    }

    const projectile = new Projectile({
      id: `${this.config.id}-projectile-${this.#nextProjectileId}`,
      ownerId: 'player',
      weaponId: this.config.id,
      x: player.x,
      y: player.y,
      vx: (dx / distance) * this.config.projectileSpeed,
      vy: (dy / distance) * this.config.projectileSpeed,
      radius: this.config.projectileRadius,
      damage: this.config.damage,
      lifetimeSeconds: this.config.projectileLifetimeSeconds,
    });
    this.#nextProjectileId += 1;
    projectiles.push(projectile);
    weaponState.cooldownRemaining = this.config.fireIntervalSeconds;
    return 1;
  }
}
