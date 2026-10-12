import { describe, expect, it } from 'vitest';
import { PULSE_GUN_CONFIG } from '../src/config/weaponConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { WeaponSystem } from '../src/systems/WeaponSystem.js';

function makePlayer(x = 100, y = 100) {
  const player = new Player();
  player.x = x;
  player.y = y;
  return player;
}

function makeEnemy(id, x, y) {
  return new Enemy({ id, x, y });
}

function update(system, player, enemies, projectiles, deltaSeconds, upgradeEffects) {
  return system.update({ player, enemies, projectiles, deltaSeconds, upgradeEffects });
}

describe('WeaponSystem', () => {
  it('fires only at the nearest valid target in range', () => {
    const player = makePlayer();
    const nearest = makeEnemy('nearest', 100, 150);
    const farther = makeEnemy('farther', 300, 100);
    const dead = makeEnemy('dead', 110, 100);
    dead.alive = false;
    const depleted = makeEnemy('depleted', 105, 100);
    depleted.hp = 0;
    const malformed = makeEnemy('malformed', 110, 100);
    malformed.x = Number.NaN;
    const outside = makeEnemy('outside', 741, 100);
    const enemies = [farther, dead, depleted, malformed, outside, nearest];
    const projectiles = [];
    const system = new WeaponSystem();

    expect(update(system, player, enemies, projectiles, 1 / 60)).toBe(1);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]).toMatchObject({
      x: 100,
      y: 100,
      vx: 0,
      vy: 500,
      damage: 20,
      remainingLife: 1.28,
    });
  });

  it('preserves enemy array order for equal-distance targets', () => {
    const player = makePlayer();
    const east = makeEnemy('east', 200, 100);
    const north = makeEnemy('north', 100, 200);
    const projectiles = [];
    const system = new WeaponSystem();

    update(system, player, [east, north], projectiles, 1 / 60);

    expect(projectiles[0]).toMatchObject({ vx: 500, vy: 0 });
  });

  it('includes the 640-pixel range edge and excludes targets beyond it', () => {
    const player = makePlayer(100, 100);
    const system = new WeaponSystem();
    const projectiles = [];

    expect(update(system, player, [makeEnemy('edge', 740, 100)], projectiles, 1 / 60)).toBe(1);

    const outsidePlayer = makePlayer(100, 100);
    const outsideSystem = new WeaponSystem();
    const outsideProjectiles = [];
    expect(update(
      outsideSystem,
      outsidePlayer,
      [makeEnemy('outside', 741, 100)],
      outsideProjectiles,
      1 / 60,
    )).toBe(0);
    expect(outsideProjectiles).toEqual([]);
  });

  it('fires immediately and continues cooldown without a target', () => {
    const player = makePlayer();
    const system = new WeaponSystem();
    const projectiles = [];

    expect(update(system, player, [], projectiles, 0.2)).toBe(0);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0);

    expect(update(system, player, [makeEnemy('first', 200, 100)], projectiles, 0.1)).toBe(1);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0.8);

    expect(update(system, player, [], projectiles, 0.3)).toBe(0);
    expect(player.weaponStates[0].cooldownRemaining).toBeCloseTo(0.5, 12);
    expect(update(system, player, [], projectiles, 0.5)).toBe(0);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0);

    expect(update(system, player, [makeEnemy('second', 200, 100)], projectiles, 1 / 60)).toBe(1);
    expect(projectiles).toHaveLength(2);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0.8);
  });

  it('applies damage and attack-rate modifiers while preserving the current cooldown', () => {
    const player = makePlayer();
    const system = new WeaponSystem();
    const projectiles = [];
    const effects = Object.freeze({
      damageMultiplier: 1.75,
      pulseGunFireRateMultiplier: 1.6,
      pulseGunProjectileCount: 1,
    });
    player.weaponStates[0].cooldownRemaining = 0.3;

    expect(update(system, player, [makeEnemy('cooling', 200, 100)], projectiles, 0.1, effects)).toBe(0);
    expect(player.weaponStates[0].cooldownRemaining).toBeCloseTo(0.2, 12);
    expect(projectiles).toHaveLength(0);

    expect(update(system, player, [makeEnemy('ready', 200, 100)], projectiles, 0.2, effects)).toBe(1);
    expect(projectiles[0].damage).toBe(35);
    expect(player.weaponStates[0].cooldownRemaining).toBeCloseTo(0.5, 12);
  });

  it.each([
    { projectileCount: 2, expectedAngles: [-6, 6] },
    { projectileCount: 3, expectedAngles: [-12, 0, 12] },
  ])('fires $projectileCount symmetric projectiles around the target direction', ({ projectileCount, expectedAngles }) => {
    const player = makePlayer();
    const system = new WeaponSystem();
    const projectiles = [];
    const effects = Object.freeze({
      damageMultiplier: 1,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: projectileCount,
    });

    expect(update(system, player, [makeEnemy(`volley-${projectileCount}`, 200, 100)], projectiles, 1 / 60, effects))
      .toBe(projectileCount);
    const angles = projectiles.map((projectile) => Math.atan2(projectile.vy, projectile.vx) * (180 / Math.PI));
    for (let index = 0; index < expectedAngles.length; index += 1) {
      expect(angles[index]).toBeCloseTo(expectedAngles[index], 10);
      expect(projectiles[index].damage).toBe(20);
    }
    expect(new Set(projectiles.map((projectile) => projectile.id)).size).toBe(projectileCount);
  });

  it('keeps in-flight projectile damage fixed when later shots receive a stronger modifier', () => {
    const player = makePlayer();
    const system = new WeaponSystem();
    const projectiles = [];
    const target = makeEnemy('damage-snapshot', 200, 100);

    update(system, player, [target], projectiles, 1 / 60, {
      damageMultiplier: 1,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: 1,
    });
    update(system, player, [target], projectiles, 0.8, {
      damageMultiplier: 1.75,
      pulseGunFireRateMultiplier: 1,
      pulseGunProjectileCount: 1,
    });

    expect(projectiles.map((projectile) => projectile.damage)).toEqual([20, 35]);
  });

  it.each([
    { damageMultiplier: Number.POSITIVE_INFINITY, pulseGunFireRateMultiplier: 1, pulseGunProjectileCount: 1 },
    { damageMultiplier: 1, pulseGunFireRateMultiplier: 0, pulseGunProjectileCount: 1 },
    { damageMultiplier: 1, pulseGunFireRateMultiplier: 1, pulseGunProjectileCount: 4 },
  ])('rejects invalid upgrade effect snapshot $damageMultiplier/$pulseGunFireRateMultiplier/$pulseGunProjectileCount', (upgradeEffects) => {
    const system = new WeaponSystem();

    expect(() => update(
      system,
      makePlayer(),
      [makeEnemy('invalid-effects', 200, 100)],
      [],
      1 / 60,
      upgradeEffects,
    )).toThrow(RangeError);
  });

  it('does not mutate run state or fire for zero delta', () => {
    const player = makePlayer();
    player.weaponStates[0].cooldownRemaining = 0.5;
    const projectiles = [];
    const system = new WeaponSystem();

    expect(update(system, player, [makeEnemy('target', 200, 100)], projectiles, 0)).toBe(0);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0.5);
    expect(projectiles).toEqual([]);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid update delta %s',
    (deltaSeconds) => {
      const system = new WeaponSystem();

      expect(() => update(system, makePlayer(), [], [], deltaSeconds)).toThrow(RangeError);
    },
  );

  it.each([
    'damage',
    'fireIntervalSeconds',
    'range',
    'projectileSpeed',
    'projectileRadius',
    'projectileLifetimeSeconds',
  ])('rejects a non-positive or non-finite %s value', (field) => {
    for (const value of [-1, 0, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() => new WeaponSystem({ config: { ...PULSE_GUN_CONFIG, [field]: value } })).toThrow(RangeError);
    }
  });

  it('rejects an empty projectile color', () => {
    expect(() => new WeaponSystem({
      config: { ...PULSE_GUN_CONFIG, projectileColor: '' },
    })).toThrow(TypeError);
  });

  it('configures a 12-degree adjacent spread step', () => {
    expect(PULSE_GUN_CONFIG.multiShotAngleStepDegrees).toBe(12);
    expect(Object.isFrozen(PULSE_GUN_CONFIG)).toBe(true);
  });

  it('aims safely when player and target overlap', () => {
    const player = makePlayer();
    const projectiles = [];
    const system = new WeaponSystem();

    expect(update(system, player, [makeEnemy('overlap', 100, 100)], projectiles, 1 / 60)).toBe(1);
    expect(projectiles[0].x).toBe(player.x);
    expect(projectiles[0].y).toBe(player.y);
    expect(Number.isFinite(projectiles[0].vx)).toBe(true);
    expect(Number.isFinite(projectiles[0].vy)).toBe(true);
    expect(Math.hypot(projectiles[0].vx, projectiles[0].vy)).toBeCloseTo(500, 12);
  });

  it('keeps projectile IDs unique across shots for the system lifetime', () => {
    const player = makePlayer();
    const projectiles = [];
    const system = new WeaponSystem();

    update(system, player, [makeEnemy('first', 200, 100)], projectiles, 1 / 60);
    update(system, player, [], projectiles, 0.8);
    update(system, player, [makeEnemy('second', 200, 100)], projectiles, 1 / 60);

    expect(projectiles).toHaveLength(2);
    expect(projectiles[0].id).not.toBe(projectiles[1].id);
  });
});
