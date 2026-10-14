import { describe, expect, it } from 'vitest';
import { PULSE_GUN_CONFIG } from '../src/config/weaponConfig.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Camera } from '../src/rendering/Camera.js';

const OFFER_RANDOM_VALUES = Object.freeze({
  'UP-01': [0, 0, 0],
  'UP-02': [0, 0, 0],
  'UP-03': [0, 0, 0],
  'UP-04': [0.35, 0, 0],
  'UP-05': [0.45, 0, 0],
  'UP-06': [0.55, 0, 0],
});

function createWorld(randomValues = [0]) {
  let cursor = 0;
  return new GameWorld({
    camera: new Camera(),
    upgradeRandom: () => randomValues[cursor++] ?? 0,
  });
}

function enterLevelUp(world, expValue = 6) {
  world.stateManager.startGame();
  world.experienceCrystals.push(new ExperienceCrystal({
    id: `upgrade-effects-${expValue}`,
    x: world.player.x,
    y: world.player.y,
    expValue,
  }));
  world.update(1 / 60);
  expect(world.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
}

describe('GameWorld upgrade effect integration', () => {
  it.each([
    ['UP-01', { damageMultiplier: 1.15 }],
    ['UP-02', { pulseGunFireRateMultiplier: 1.12 }],
    ['UP-03', { pulseGunProjectileCount: 2 }],
    ['UP-04', { orbitalBladeLevel: 1 }],
    ['UP-05', { moveSpeedMultiplier: 1.08 }],
    ['UP-06', {}],
  ])('applies selected %s upgrade to live run state', (upgradeId, expectedEffect) => {
    const world = createWorld(OFFER_RANDOM_VALUES[upgradeId]);
    enterLevelUp(world);

    expect(world.getUpgradeChoices().map(({ id }) => id)).toContain(upgradeId);
    expect(world.chooseUpgrade(upgradeId)).toBe(true);
    const effects = world.getUpgradeEffectSnapshot();

    expect(effects).toMatchObject(expectedEffect);
    expect(Object.isFrozen(effects)).toBe(true);
    expect(world.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    if (upgradeId === 'UP-04') {
      expect(world.player.weaponStates.map(({ id }) => id)).toEqual(['pulse-gun']);
    }
    if (upgradeId === 'UP-05') expect(world.player.moveSpeed).toBeCloseTo(237.6, 12);
    if (upgradeId === 'UP-06') {
      expect(world.player.maxHp).toBe(120);
      expect(world.player.hp).toBe(120);
    }
  });

  it('leaves every effect and pending choice unchanged for an invalid selection', () => {
    const world = createWorld();
    enterLevelUp(world);
    const beforeChoices = world.getUpgradeChoices();
    const beforeLevels = world.upgradeSystem.getUpgradeLevelsSnapshot();
    const beforePlayer = {
      hp: world.player.hp,
      maxHp: world.player.maxHp,
      moveSpeed: world.player.moveSpeed,
    };

    expect(world.chooseUpgrade('not-offered')).toBe(false);

    expect(world.getUpgradeChoices()).toBe(beforeChoices);
    expect(world.upgradeSystem.getUpgradeLevelsSnapshot()).toEqual(beforeLevels);
    expect(world.player).toMatchObject(beforePlayer);
    expect(world.levelSystem.pendingLevelUps).toBe(1);
    expect(world.getUpgradeEffectSnapshot()).toMatchObject({
      damageMultiplier: 1,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: 1,
      moveSpeedMultiplier: 1,
      orbitalBladeLevel: 0,
    });
  });

  it('uses chosen damage, fire-rate, and multi-shot effects on the next volley', () => {
    const world = createWorld([0, 0, 0]);
    enterLevelUp(world, 35);
    for (const upgradeId of ['UP-01', 'UP-02', 'UP-03']) {
      expect(world.getUpgradeChoices().map(({ id }) => id)).toContain(upgradeId);
      expect(world.chooseUpgrade(upgradeId)).toBe(true);
    }
    expect(world.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    const target = new Enemy({
      id: 'upgrade-effect-target',
      x: world.player.x + 200,
      y: world.player.y,
    });
    world.enemies.push(target);

    expect(world.update(1 / 60)).toBe(true);

    expect(world.projectiles).toHaveLength(2);
    expect(world.projectiles.map(({ damage }) => damage)).toEqual([23, 23]);
    expect(world.player.weaponStates[0].cooldownRemaining)
      .toBeCloseTo(PULSE_GUN_CONFIG.fireIntervalSeconds / 1.12, 12);
  });

  it('clears selected gameplay effects and restores player baselines on reset', () => {
    // Each offer includes a pulse improvement under the owned-weapon guarantee.
    const world = createWorld([0, 0, 0, 0.45, 0, 0, 0.55, 0, 0]);
    enterLevelUp(world, 35);
    for (const upgradeId of ['UP-01', 'UP-05', 'UP-06']) {
      expect(world.getUpgradeChoices().map(({ id }) => id)).toContain(upgradeId);
      expect(world.chooseUpgrade(upgradeId)).toBe(true);
    }
    expect(world.getUpgradeEffectSnapshot()).toMatchObject({
      damageMultiplier: 1.15,
      moveSpeedMultiplier: 1.08,
    });
    expect(world.player.maxHp).toBe(120);
    expect(world.player.moveSpeed).toBeCloseTo(237.6, 12);
    world.stateManager.pause();

    world.reset();

    expect(world.getUpgradeEffectSnapshot()).toMatchObject({
      damageMultiplier: 1,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: 1,
      moveSpeedMultiplier: 1,
      orbitalBladeLevel: 0,
    });
    expect(world.player).toMatchObject({ hp: 100, maxHp: 100, moveSpeed: 220 });
    expect(world.upgradeSystem.getUpgradeLevelsSnapshot().every(({ level }) => level === 0)).toBe(true);
    expect(world.projectiles).toEqual([]);
    expect(world.getHudSnapshot()).toMatchObject({ level: 1, experience: 0, pendingLevelUps: 0 });
  });
});
