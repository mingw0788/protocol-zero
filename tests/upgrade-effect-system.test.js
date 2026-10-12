import { describe, expect, it } from 'vitest';
import { UPGRADE_CONFIG } from '../src/config/upgradeConfig.js';
import { UPGRADE_EFFECT_CONFIG } from '../src/config/upgradeEffectConfig.js';
import { Player } from '../src/entities/Player.js';
import { UpgradeEffectSystem } from '../src/systems/UpgradeEffectSystem.js';

function makeUpgradeSystem(levelOverrides = {}) {
  const levels = Object.fromEntries(UPGRADE_CONFIG.map(({ id }) => [id, levelOverrides[id] ?? 0]));
  return {
    getUpgradeLevelsSnapshot() {
      return UPGRADE_CONFIG.map(({ id, maxLevel }) => ({ id, level: levels[id], maxLevel }));
    },
    getLevel(id) {
      return levels[id];
    },
  };
}

function makeSelection(id, previousLevel, level) {
  return Object.freeze({ id, previousLevel, level, maxLevel: UPGRADE_CONFIG.find((item) => item.id === id).maxLevel });
}

describe('UpgradeEffectSystem', () => {
  it('keeps per-level effect configuration immutable and matches the SRS', () => {
    expect(Object.isFrozen(UPGRADE_EFFECT_CONFIG)).toBe(true);
    for (const effect of Object.values(UPGRADE_EFFECT_CONFIG)) expect(Object.isFrozen(effect)).toBe(true);
    expect(UPGRADE_EFFECT_CONFIG['UP-01'].damageBonusPerLevel).toBe(0.15);
    expect(UPGRADE_EFFECT_CONFIG['UP-02'].pulseGunFireRateBonusPerLevel).toBe(0.12);
    expect(UPGRADE_EFFECT_CONFIG['UP-03'].extraProjectilesPerLevel).toBe(1);
    expect(UPGRADE_EFFECT_CONFIG['UP-05'].moveSpeedBonusPerLevel).toBe(0.08);
    expect(UPGRADE_EFFECT_CONFIG['UP-06']).toMatchObject({
      maxHpIncreasePerLevel: 20,
      healPerLevel: 20,
    });
  });

  it('derives neutral and maximum-rank modifiers linearly', () => {
    const neutral = new UpgradeEffectSystem({ player: new Player(), upgradeSystem: makeUpgradeSystem() });
    expect(neutral.getSnapshot()).toEqual({
      damageMultiplier: 1,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: 1,
      moveSpeedMultiplier: 1,
      orbitalBladeLevel: 0,
    });

    const maximum = new UpgradeEffectSystem({
      player: new Player(),
      upgradeSystem: makeUpgradeSystem({
        'UP-01': 5,
        'UP-02': 5,
        'UP-03': 2,
        'UP-04': 5,
        'UP-05': 5,
        'UP-06': 5,
      }),
    });

    expect(maximum.getSnapshot()).toEqual({
      damageMultiplier: 1.75,
      pulseGunFireRateMultiplier: 1.6,
      pulseGunProjectileCount: 3,
      moveSpeedMultiplier: 1.4,
      orbitalBladeLevel: 5,
    });
    expect(Object.isFrozen(maximum.getSnapshot())).toBe(true);
  });

  it('exposes orbital blade rank without equipping the weapon', () => {
    const player = new Player();
    const system = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem({ 'UP-04': 1 }),
    });

    expect(system.getSnapshot().orbitalBladeLevel).toBe(1);
    expect(player.weaponStates.map((weapon) => weapon.id)).toEqual(['pulse-gun']);
  });

  it('applies nano armor max-health growth and healing without exceeding the new cap', () => {
    const player = new Player();
    player.hp = 65;
    const system = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem({ 'UP-06': 1 }),
    });

    system.applySelection(makeSelection('UP-06', 0, 1));

    expect(player.maxHp).toBe(120);
    expect(player.hp).toBe(85);

    player.hp = 120;
    const levelTwoSystem = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem({ 'UP-06': 2 }),
    });
    levelTwoSystem.applySelection(makeSelection('UP-06', 1, 2));

    expect(player.maxHp).toBe(140);
    expect(player.hp).toBe(140);
  });

  it('derives movement from the player base speed and applies only the current selection', () => {
    const player = new Player({ moveSpeed: 150 });
    const system = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem({ 'UP-05': 2 }),
    });

    system.applySelection(makeSelection('UP-05', 1, 2));

    expect(player.baseMoveSpeed).toBe(150);
    expect(player.moveSpeed).toBe(174);
    expect(system.getSnapshot().moveSpeedMultiplier).toBeCloseTo(1.16, 12);
  });

  it('rejects a stale selection before mutating player attributes', () => {
    const player = new Player();
    player.hp = 75;
    const system = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem({ 'UP-06': 2 }),
    });

    expect(() => system.applySelection(makeSelection('UP-06', 0, 1))).toThrow(RangeError);
    expect(player.hp).toBe(75);
    expect(player.maxHp).toBe(100);
  });

  it('rejects fabricated zero-rank selections before applying nano armor', () => {
    const player = new Player();
    player.hp = 80;
    const system = new UpgradeEffectSystem({
      player,
      upgradeSystem: makeUpgradeSystem(),
    });

    expect(() => system.applySelection(makeSelection('UP-06', -1, 0))).toThrow(RangeError);
    expect(player.hp).toBe(80);
    expect(player.maxHp).toBe(100);
  });
});
