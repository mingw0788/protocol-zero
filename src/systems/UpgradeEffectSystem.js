import { UPGRADE_CONFIG } from '../config/upgradeConfig.js';
import { UPGRADE_EFFECT_CONFIG } from '../config/upgradeEffectConfig.js';

function requirePlayer(player) {
  if (!player || typeof player !== 'object'
    || !Number.isFinite(player.baseMoveSpeed) || player.baseMoveSpeed <= 0
    || !Number.isFinite(player.moveSpeed) || player.moveSpeed <= 0
    || !Number.isFinite(player.hp) || !Number.isFinite(player.maxHp)
    || player.maxHp <= 0 || player.hp < 0 || player.hp > player.maxHp) {
    throw new RangeError('Upgrade effects require valid player attributes');
  }
}

function requireUpgradeSystem(upgradeSystem) {
  if (!upgradeSystem
    || typeof upgradeSystem.getUpgradeLevelsSnapshot !== 'function'
    || typeof upgradeSystem.getLevel !== 'function') {
    throw new TypeError('UpgradeEffectSystem requires an UpgradeSystem');
  }
}

function requireLevelSnapshot(upgradeSystem) {
  const snapshot = upgradeSystem.getUpgradeLevelsSnapshot();
  if (!Array.isArray(snapshot) || snapshot.length !== UPGRADE_CONFIG.length) {
    throw new TypeError('UpgradeSystem must provide one level for every configured upgrade');
  }

  const levels = new Map();
  for (const entry of snapshot) {
    if (!entry || typeof entry.id !== 'string' || levels.has(entry.id)) {
      throw new TypeError('Upgrade level snapshot contains an invalid or duplicate ID');
    }
    const configured = UPGRADE_CONFIG.find((upgrade) => upgrade.id === entry.id);
    if (!configured
      || !Number.isSafeInteger(entry.level)
      || entry.level < 0
      || entry.level > configured.maxLevel
      || entry.maxLevel !== configured.maxLevel) {
      throw new RangeError(`Invalid level snapshot for upgrade ${entry.id}`);
    }
    levels.set(entry.id, entry.level);
  }

  if (UPGRADE_CONFIG.some((upgrade) => !levels.has(upgrade.id))) {
    throw new TypeError('Upgrade level snapshot is missing a configured ID');
  }
  return levels;
}

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export class UpgradeEffectSystem {
  constructor({ player, upgradeSystem } = {}) {
    requirePlayer(player);
    requireUpgradeSystem(upgradeSystem);
    this.player = player;
    this.upgradeSystem = upgradeSystem;
  }

  getSnapshot() {
    const levels = requireLevelSnapshot(this.upgradeSystem);
    const damage = UPGRADE_EFFECT_CONFIG['UP-01'].damageBonusPerLevel;
    const fireRate = UPGRADE_EFFECT_CONFIG['UP-02'].pulseGunFireRateBonusPerLevel;
    const extraProjectiles = UPGRADE_EFFECT_CONFIG['UP-03'].extraProjectilesPerLevel;
    const moveSpeed = UPGRADE_EFFECT_CONFIG['UP-05'].moveSpeedBonusPerLevel;

    for (const [value, name] of [
      [damage, 'damageBonusPerLevel'],
      [fireRate, 'pulseGunFireRateBonusPerLevel'],
      [extraProjectiles, 'extraProjectilesPerLevel'],
      [moveSpeed, 'moveSpeedBonusPerLevel'],
    ]) {
      requirePositiveFinite(value, name);
    }
    if (UPGRADE_EFFECT_CONFIG['UP-04'].exposesOrbitalBladeLevel !== true) {
      throw new TypeError('UP-04 must expose its orbital blade level');
    }
    requirePositiveFinite(UPGRADE_EFFECT_CONFIG['UP-06'].maxHpIncreasePerLevel, 'maxHpIncreasePerLevel');
    requirePositiveFinite(UPGRADE_EFFECT_CONFIG['UP-06'].healPerLevel, 'healPerLevel');

    const snapshot = Object.freeze({
      damageMultiplier: 1 + (damage * levels.get('UP-01')),
      pulseGunFireRateMultiplier: 1 + (fireRate * levels.get('UP-02')),
      pulseGunProjectileCount: 1 + (extraProjectiles * levels.get('UP-03')),
      moveSpeedMultiplier: 1 + (moveSpeed * levels.get('UP-05')),
      orbitalBladeLevel: UPGRADE_EFFECT_CONFIG['UP-04'].exposesOrbitalBladeLevel
        ? levels.get('UP-04')
        : 0,
      arcCoilLevel: levels.get('UP-07'),
      railgunLevel: levels.get('UP-08'),
    });
    for (const [key, value] of Object.entries(snapshot)) {
      if (!Number.isFinite(value) || value <= 0 && !key.endsWith('Level')) {
        throw new RangeError(`Invalid derived upgrade effect ${key}`);
      }
    }
    if (!Number.isSafeInteger(snapshot.pulseGunProjectileCount)
      || snapshot.pulseGunProjectileCount > 3
      || !Number.isSafeInteger(snapshot.orbitalBladeLevel)) {
      throw new RangeError('Derived upgrade effect exceeds its supported range');
    }
    return snapshot;
  }

  applySelection(selection) {
    if (!selection || typeof selection !== 'object' || typeof selection.id !== 'string') {
      throw new TypeError('A successful upgrade selection is required');
    }
    if (selection.id === 'full-repair' || selection.type === 'evolution') return this.getSnapshot();

    const configured = UPGRADE_CONFIG.find((upgrade) => upgrade.id === selection.id);
    const currentLevel = this.upgradeSystem.getLevel(selection.id);
    if (!configured
      || !Number.isSafeInteger(selection.previousLevel)
      || selection.previousLevel < 0
      || !Number.isSafeInteger(selection.level)
      || selection.level < 1
      || selection.level !== selection.previousLevel + 1
      || selection.level !== currentLevel
      || selection.maxLevel !== configured.maxLevel
      || selection.level > configured.maxLevel) {
      throw new RangeError('Upgrade selection does not match the current recorded level');
    }

    requirePlayer(this.player);
    const snapshot = this.getSnapshot();
    const nextMoveSpeed = this.player.baseMoveSpeed * snapshot.moveSpeedMultiplier;
    requirePositiveFinite(nextMoveSpeed, 'derived moveSpeed');

    let nextMaxHp = this.player.maxHp;
    let nextHp = this.player.hp;
    if (selection.id === 'UP-06') {
      const { maxHpIncreasePerLevel, healPerLevel } = UPGRADE_EFFECT_CONFIG['UP-06'];
      nextMaxHp += maxHpIncreasePerLevel;
      nextHp = Math.min(nextMaxHp, nextHp + healPerLevel);
      requirePositiveFinite(nextMaxHp, 'derived maxHp');
      if (!Number.isFinite(nextHp) || nextHp < 0 || nextHp > nextMaxHp) {
        throw new RangeError('Derived hp must remain within the new maximum');
      }
    }

    this.player.moveSpeed = nextMoveSpeed;
    this.player.maxHp = nextMaxHp;
    this.player.hp = nextHp;
    const weaponId = { 'UP-07': 'arc-coil', 'UP-08': 'railgun' }[selection.id];
    if (weaponId && !this.player.weaponStates.some((weapon) => weapon.id === weaponId)) {
      this.player.weaponStates.push({ id: weaponId, cooldownRemaining: 0 });
    }
    return snapshot;
  }
}
