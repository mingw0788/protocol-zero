import { ORBITAL_BLADE_CONFIG } from '../config/orbitalBladeConfig.js';
import { ORBITAL_EVOLUTION_CONFIG } from '../config/evolutionConfig.js';

const TWO_PI = Math.PI * 2;

const CONFIG_NUMERIC_FIELDS = Object.freeze([
  'bladeRadius',
  'baseDamage',
  'damagePerUpgradeLevel',
  'baseOrbitRadius',
  'orbitRadiusPerUpgradeLevel',
  'rotationRadiansPerSecond',
  'hitCooldownSeconds',
]);

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function copyConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('OrbitalBladeSystem requires a configuration object');
  }
  for (const field of CONFIG_NUMERIC_FIELDS) requirePositiveFinite(config[field], field);
  if (!Number.isSafeInteger(config.maxLevel) || config.maxLevel < 1) {
    throw new RangeError('maxLevel must be a positive safe integer');
  }
  if (typeof config.color !== 'string' || config.color.trim().length === 0) {
    throw new TypeError('color must be a non-empty string');
  }

  const copied = Object.freeze({
    id: typeof config.id === 'string' && config.id.length > 0 ? config.id : 'orbital-blade',
    ...Object.fromEntries(CONFIG_NUMERIC_FIELDS.map((field) => [field, config[field]])),
    maxLevel: config.maxLevel,
    color: config.color,
  });
  const maxDamage = copied.baseDamage + copied.damagePerUpgradeLevel * (copied.maxLevel - 1);
  const maxOrbitRadius = copied.baseOrbitRadius
    + copied.orbitRadiusPerUpgradeLevel * (copied.maxLevel - 1);
  requirePositiveFinite(maxDamage, 'maximum damage');
  requirePositiveFinite(maxOrbitRadius, 'maximum orbit radius');
  return copied;
}

function requireDependencies({ player, enemies, enemyDamageSystem }) {
  if (!player || typeof player !== 'object'
    || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
    throw new TypeError('OrbitalBladeSystem requires a player with finite coordinates');
  }
  if (!Array.isArray(enemies)) throw new TypeError('OrbitalBladeSystem requires an enemy array');
  if (typeof enemyDamageSystem?.applyDamage !== 'function') {
    throw new TypeError('OrbitalBladeSystem requires an enemy damage system');
  }
}

function requireUpdate({ deltaSeconds, upgradeEffects }, maxLevel) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError('deltaSeconds must be a non-negative finite number');
  }
  if (!upgradeEffects || typeof upgradeEffects !== 'object') {
    throw new TypeError('OrbitalBladeSystem requires an upgrade-effect snapshot');
  }
  if (!Number.isSafeInteger(upgradeEffects.orbitalBladeLevel)
    || upgradeEffects.orbitalBladeLevel < 0
    || upgradeEffects.orbitalBladeLevel > maxLevel) {
    throw new RangeError(`orbitalBladeLevel must be an integer from 0 through ${maxLevel}`);
  }
  requirePositiveFinite(upgradeEffects.damageMultiplier, 'damageMultiplier');
}

function isLiveEnemy(enemy) {
  return enemy?.alive === true
    && Number.isFinite(enemy.hp)
    && enemy.hp > 0
    && Number.isFinite(enemy.x)
    && Number.isFinite(enemy.y)
    && Number.isFinite(enemy.radius)
    && enemy.radius > 0
    && ((typeof enemy.id === 'string' && enemy.id.length > 0)
      || (typeof enemy.id === 'number' && Number.isFinite(enemy.id)));
}

export class OrbitalBladeSystem {
  #config;
  #angleRadians = 0;
  #level = 0;
  #hitCooldowns = new Map();
  #evolved = false;
  #sweepCooldown = 0;
  #sweepRemaining = 0;

  constructor({ player, enemies, enemyDamageSystem, config = ORBITAL_BLADE_CONFIG } = {}) {
    requireDependencies({ player, enemies, enemyDamageSystem });
    this.player = player;
    this.enemies = enemies;
    this.enemyDamageSystem = enemyDamageSystem;
    this.#config = copyConfig(config);
  }

  get config() {
    return this.#config;
  }

  update({ deltaSeconds, upgradeEffects, fireRateMultiplier = 1, evolved = false } = {}) {
    if (typeof evolved !== 'boolean') throw new TypeError('evolved must be a boolean');
    if (!Number.isFinite(fireRateMultiplier) || fireRateMultiplier <= 0) throw new RangeError('Invalid fire rate multiplier');
    requireUpdate({ deltaSeconds, upgradeEffects }, this.#config.maxLevel);
    if (!Number.isFinite(this.player.x) || !Number.isFinite(this.player.y)) {
      throw new RangeError('Player coordinates must remain finite');
    }
    if (deltaSeconds === 0) return false;

    const level = upgradeEffects.orbitalBladeLevel;
    this.#evolved = evolved && level > 0;
    this.#sweepRemaining = this.#evolved ? Math.max(0, this.#sweepRemaining - deltaSeconds) : 0;
    this.#sweepCooldown = this.#evolved ? Math.max(0, this.#sweepCooldown - deltaSeconds) : 0;
    const nextAngle = level > 0
      ? (this.#angleRadians + this.#config.rotationRadiansPerSecond * deltaSeconds * fireRateMultiplier) % TWO_PI
      : 0;
    if (!Number.isFinite(nextAngle)) throw new RangeError('Orbital angle must remain finite');

    const orbitRadius = level > 0
      ? this.#config.baseOrbitRadius + this.#config.orbitRadiusPerUpgradeLevel * (level - 1)
      : 0;
    const damage = level > 0
      ? (this.#config.baseDamage + this.#config.damagePerUpgradeLevel * (level - 1))
        * upgradeEffects.damageMultiplier
      : 0;
    const bladeX = level > 0 ? this.player.x + orbitRadius * Math.cos(nextAngle) : null;
    const bladeY = level > 0 ? this.player.y + orbitRadius * Math.sin(nextAngle) : null;
    if (level > 0 && (!Number.isFinite(damage) || damage <= 0
      || !Number.isFinite(orbitRadius) || orbitRadius <= 0
      || !Number.isFinite(bladeX) || !Number.isFinite(bladeY))) {
      throw new RangeError('Orbital blade combat values must remain finite');
    }

    this.#level = level;
    this.#angleRadians = nextAngle;

    const liveIds = new Set();
    for (const enemy of this.enemies) {
      if (isLiveEnemy(enemy)) liveIds.add(enemy.id);
    }
    for (const [enemyId, remaining] of this.#hitCooldowns) {
      if (!liveIds.has(enemyId)) {
        this.#hitCooldowns.delete(enemyId);
        continue;
      }
      const nextRemaining = Math.max(0, remaining - deltaSeconds);
      if (nextRemaining === 0) this.#hitCooldowns.delete(enemyId);
      else this.#hitCooldowns.set(enemyId, nextRemaining);
    }

    if (level === 0) {
      this.#hitCooldowns.clear();
      return true;
    }

    for (const enemy of this.enemies) {
      if (!isLiveEnemy(enemy) || this.#hitCooldowns.has(enemy.id)) continue;
      const distance = Math.hypot(bladeX - enemy.x, bladeY - enemy.y);
      if (distance > this.#config.bladeRadius + enemy.radius) continue;

      if (this.enemyDamageSystem.applyDamage(enemy, damage, this.#config.id)) {
        this.#hitCooldowns.set(enemy.id, this.#config.hitCooldownSeconds / fireRateMultiplier);
      }
    }
    if (this.#evolved && this.#sweepCooldown <= 1e-9) {
      this.#sweepCooldown = ORBITAL_EVOLUTION_CONFIG.sweepInterval / fireRateMultiplier;
      this.#sweepRemaining = ORBITAL_EVOLUTION_CONFIG.visualSeconds;
      for (const enemy of this.enemies) {
        if (!isLiveEnemy(enemy) || this.#hitCooldowns.has(enemy.id)
          || Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) > ORBITAL_EVOLUTION_CONFIG.sweepRadius + enemy.radius) continue;
        if (this.enemyDamageSystem.applyDamage(enemy, ORBITAL_EVOLUTION_CONFIG.sweepDamage * upgradeEffects.damageMultiplier, this.#config.id)) {
          this.#hitCooldowns.set(enemy.id, this.#config.hitCooldownSeconds / fireRateMultiplier);
        }
      }
    }
    return true;
  }

  getSnapshot(level = this.#level) {
    if (!Number.isSafeInteger(level) || level < 0 || level > this.#config.maxLevel) {
      throw new RangeError(`orbitalBladeLevel must be an integer from 0 through ${this.#config.maxLevel}`);
    }
    const active = level > 0;
    const orbitRadius = active
      ? this.#config.baseOrbitRadius
        + this.#config.orbitRadiusPerUpgradeLevel * (level - 1)
      : 0;
    return Object.freeze({
      active,
      level,
      playerX: this.player.x,
      playerY: this.player.y,
      x: active ? this.player.x + orbitRadius * Math.cos(this.#angleRadians) : null,
      y: active ? this.player.y + orbitRadius * Math.sin(this.#angleRadians) : null,
      radius: this.#config.bladeRadius,
      orbitRadius,
      angleRadians: this.#angleRadians,
      color: this.#evolved ? '#ffcf7c' : this.#config.color,
      evolved: active && this.#evolved,
      sweepRadius: ORBITAL_EVOLUTION_CONFIG.sweepRadius,
      sweepRemaining: active ? this.#sweepRemaining : 0,
      sweepLifetime: ORBITAL_EVOLUTION_CONFIG.visualSeconds,
    });
  }

  reset() {
    this.#angleRadians = 0;
    this.#level = 0;
    this.#hitCooldowns.clear();
    this.#evolved = false; this.#sweepCooldown = 0; this.#sweepRemaining = 0;
  }
}
