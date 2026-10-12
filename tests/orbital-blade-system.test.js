import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { ORBITAL_BLADE_CONFIG } from '../src/config/orbitalBladeConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { OrbitalBladeSystem } from '../src/systems/OrbitalBladeSystem.js';

const TWO_PI = Math.PI * 2;

function createHarness({ config = ORBITAL_BLADE_CONFIG, enemies = [] } = {}) {
  const player = { x: 600, y: 400 };
  const damageSystem = new EnemyDamageSystem();
  const system = new OrbitalBladeSystem({ player, enemies, enemyDamageSystem: damageSystem, config });
  return { player, enemies, damageSystem, system };
}

function effects(orbitalBladeLevel = 1, damageMultiplier = 1) {
  return { orbitalBladeLevel, damageMultiplier };
}

function createEnemy(id, x, y) {
  return new Enemy({ id, x, y, config: ENEMY_CONFIG.EN01 });
}

function moveEnemyToNextBladePosition(enemy, snapshot, deltaSeconds, config = ORBITAL_BLADE_CONFIG) {
  const angle = snapshot.angleRadians + config.rotationRadiansPerSecond * deltaSeconds;
  enemy.x = snapshot.playerX + snapshot.orbitRadius * Math.cos(angle);
  enemy.y = snapshot.playerY + snapshot.orbitRadius * Math.sin(angle);
}

describe('OrbitalBladeSystem', () => {
  it('starts locked and returns a frozen inactive snapshot', () => {
    const { system } = createHarness();

    const snapshot = system.getSnapshot();

    expect(snapshot).toMatchObject({ active: false, level: 0, x: null, y: null });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('orbits at the configured speed and reports world coordinates', () => {
    const { system } = createHarness();

    system.update({ deltaSeconds: 0.25, upgradeEffects: effects() });

    expect(system.getSnapshot()).toMatchObject({
      active: true,
      level: 1,
      playerX: 600,
      playerY: 400,
      x: 600,
      y: 448,
      radius: 8,
      orbitRadius: 48,
      angleRadians: Math.PI / 2,
      color: '#d66dff',
    });
  });

  it('damages a contacting target using the shared damage multiplier', () => {
    const { enemies, system } = createHarness();
    const target = createEnemy('blade-hit', 600, 448);
    enemies.push(target);

    system.update({ deltaSeconds: 0.25, upgradeEffects: effects(1, 1.5) });

    expect(target).toMatchObject({ hp: 12, alive: true });
  });

  it('limits repeat hits independently per target until cooldown expires', () => {
    const { enemies, system } = createHarness();
    const first = createEnemy('first-target', 600, 448);
    const second = createEnemy('second-target', 600, 448);
    enemies.push(first, second);
    const config = ORBITAL_BLADE_CONFIG;

    system.update({ deltaSeconds: 0.25, upgradeEffects: effects() });
    expect([first.hp, second.hp]).toEqual([18, 18]);
    system.update({ deltaSeconds: 1 / 60, upgradeEffects: effects() });
    expect([first.hp, second.hp]).toEqual([18, 18]);

    system.update({ deltaSeconds: 0.74, upgradeEffects: effects() });
    moveEnemyToNextBladePosition(first, system.getSnapshot(), 0.011, config);
    moveEnemyToNextBladePosition(second, system.getSnapshot(), 0.011, config);
    system.update({ deltaSeconds: 0.011, upgradeEffects: effects() });

    expect([first.hp, second.hp]).toEqual([6, 6]);
  });

  it('allows a target again after exactly the configured cooldown in fixed steps', () => {
    const { enemies, system } = createHarness();
    const target = createEnemy('exact-cooldown-target', 648, 400);
    enemies.push(target);
    const deltaSeconds = 1 / 60;

    system.update({ deltaSeconds, upgradeEffects: effects() });
    expect(target.hp).toBe(18);
    for (let step = 0; step < 44; step += 1) {
      moveEnemyToNextBladePosition(target, system.getSnapshot(), deltaSeconds);
      system.update({ deltaSeconds, upgradeEffects: effects() });
    }
    expect(target.hp).toBe(18);

    moveEnemyToNextBladePosition(target, system.getSnapshot(), deltaSeconds);
    system.update({ deltaSeconds, upgradeEffects: effects() });

    expect(target.hp).toBe(6);
  });

  it('cleans cooldowns for dead and removed enemies', () => {
    const { enemies, system } = createHarness();
    const target = createEnemy('reused-id', 600, 448);
    enemies.push(target);
    system.update({ deltaSeconds: 0.25, upgradeEffects: effects() });
    expect(target.hp).toBe(18);

    target.alive = false;
    target.hp = 0;
    system.update({ deltaSeconds: 0.1, upgradeEffects: effects() });
    enemies.length = 0;
    system.update({ deltaSeconds: 0.1, upgradeEffects: effects() });

    const replacement = createEnemy('reused-id', 600, 448);
    enemies.push(replacement);
    const snapshot = system.getSnapshot();
    moveEnemyToNextBladePosition(replacement, snapshot, 0.01);
    system.update({ deltaSeconds: 0.01, upgradeEffects: effects() });

    expect(replacement.hp).toBe(18);
  });

  it('reset clears angle and target cooldown, returns to locked state, and preserves its copied config', () => {
    const injectedConfig = { ...ORBITAL_BLADE_CONFIG };
    const { enemies, system } = createHarness({ config: injectedConfig });
    const target = createEnemy('reset-target', 600, 448);
    enemies.push(target);
    system.update({ deltaSeconds: 0.25, upgradeEffects: effects() });
    injectedConfig.bladeRadius = 99;

    system.reset();

    expect(system.getSnapshot()).toMatchObject({ active: false, level: 0, angleRadians: 0, radius: 8 });
    expect(Object.isFrozen(ORBITAL_BLADE_CONFIG)).toBe(true);
    expect(injectedConfig.bladeRadius).toBe(99);
  });

  it('rejects invalid inputs without mutating combat state', () => {
    const { enemies, system } = createHarness();
    const target = createEnemy('invalid-input-target', 600, 448);
    enemies.push(target);
    system.update({ deltaSeconds: 0.25, upgradeEffects: effects() });
    const before = system.getSnapshot();

    expect(() => system.update({ deltaSeconds: -1, upgradeEffects: effects() })).toThrow(RangeError);
    expect(() => system.update({ deltaSeconds: 0.1, upgradeEffects: effects(6) })).toThrow(RangeError);
    expect(() => system.update({ deltaSeconds: 0.1, upgradeEffects: effects(1, Number.NaN) }))
      .toThrow(RangeError);
    expect(() => createHarness({ config: { ...ORBITAL_BLADE_CONFIG, baseDamage: 0 } }))
      .toThrow(RangeError);

    expect(system.getSnapshot()).toEqual(before);
    expect(target.hp).toBe(18);
  });
});
