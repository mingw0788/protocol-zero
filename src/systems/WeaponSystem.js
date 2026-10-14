import { PULSE_GUN_CONFIG } from '../config/weaponConfig.js';
import { Projectile } from '../entities/Projectile.js';

const NUMERIC_CONFIG_FIELDS = [
  'damage',
  'fireIntervalSeconds',
  'range',
  'projectileSpeed',
  'projectileRadius',
  'projectileLifetimeSeconds',
  'multiShotAngleStepDegrees',
];

const NEUTRAL_UPGRADE_EFFECTS = Object.freeze({
  damageMultiplier: 1,
  pulseGunFireRateMultiplier: 1,
  pulseGunProjectileCount: 1,
});

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

function validateUpgradeEffects(upgradeEffects) {
  if (!upgradeEffects || typeof upgradeEffects !== 'object') {
    throw new TypeError('upgradeEffects must be an effect snapshot');
  }
  if (!Number.isFinite(upgradeEffects.damageMultiplier) || upgradeEffects.damageMultiplier <= 0
    || !Number.isFinite(upgradeEffects.pulseGunFireRateMultiplier)
    || upgradeEffects.pulseGunFireRateMultiplier <= 0) {
    throw new RangeError('Weapon upgrade multipliers must be positive finite numbers');
  }
  if (!Number.isSafeInteger(upgradeEffects.pulseGunProjectileCount)
    || upgradeEffects.pulseGunProjectileCount < 1
    || upgradeEffects.pulseGunProjectileCount > 3) {
    throw new RangeError('Pulse gun projectile count must be an integer from 1 to 3');
  }
  return upgradeEffects;
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

  update({ player, enemies, projectiles, deltaSeconds, upgradeEffects = NEUTRAL_UPGRADE_EFFECTS, fireRateMultiplier = 1, fallbackTargets = [] } = {}) {
    if (!Number.isFinite(fireRateMultiplier) || fireRateMultiplier <= 0) throw new RangeError('Invalid fire rate multiplier');
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return 0;
    if (!Array.isArray(projectiles)) {
      throw new TypeError('projectiles must be an array');
    }
    const effects = validateUpgradeEffects(upgradeEffects);

    const weaponState = player?.weaponStates?.find((state) => state?.id === this.config.id);
    if (!weaponState) return 0;
    if (!Number.isFinite(weaponState.cooldownRemaining) || weaponState.cooldownRemaining < 0) {
      throw new RangeError('weapon cooldownRemaining must be a non-negative finite number');
    }

    weaponState.cooldownRemaining = Math.max(0, weaponState.cooldownRemaining - deltaSeconds);
    if (!Array.isArray(fallbackTargets)) throw new TypeError('fallbackTargets must be an array');
    const target = findNearestTarget(player, enemies, this.config.range) ?? findNearestTarget(player, fallbackTargets, this.config.range);
    if (!target || weaponState.cooldownRemaining > 0) return 0;

    const damage = this.config.damage * effects.damageMultiplier;
    const fireIntervalSeconds = this.config.fireIntervalSeconds / effects.pulseGunFireRateMultiplier / fireRateMultiplier;
    if (!Number.isFinite(damage) || damage <= 0
      || !Number.isFinite(fireIntervalSeconds) || fireIntervalSeconds <= 0) {
      throw new RangeError('Derived pulse gun values must be positive and finite');
    }

    let dx = target.x - player.x;
    let dy = target.y - player.y;
    let distance = Math.hypot(dx, dy);
    if (distance === 0) {
      dx = 1;
      dy = 0;
      distance = 1;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;
    weaponState.aimAngle = Math.atan2(directionY, directionX);
    weaponState.fireFlashRemaining = 0.09;
    const angleStep = this.config.multiShotAngleStepDegrees * (Math.PI / 180);
    for (let index = 0; index < effects.pulseGunProjectileCount; index += 1) {
      const centeredOffset = index - ((effects.pulseGunProjectileCount - 1) / 2);
      const angle = centeredOffset * angleStep;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const velocityX = centeredOffset === 0
        ? directionX * this.config.projectileSpeed
        : ((directionX * cosine) - (directionY * sine)) * this.config.projectileSpeed;
      const velocityY = centeredOffset === 0
        ? directionY * this.config.projectileSpeed
        : ((directionX * sine) + (directionY * cosine)) * this.config.projectileSpeed;
      projectiles.push(new Projectile({
        id: `${this.config.id}-projectile-${this.#nextProjectileId}`,
        ownerId: 'player',
        weaponId: this.config.id,
        x: player.x,
        y: player.y,
        vx: velocityX,
        vy: velocityY,
        radius: this.config.projectileRadius,
        damage,
        lifetimeSeconds: this.config.projectileLifetimeSeconds,
      }));
      this.#nextProjectileId += 1;
    }
    weaponState.cooldownRemaining = fireIntervalSeconds;
    return effects.pulseGunProjectileCount;
  }
}
