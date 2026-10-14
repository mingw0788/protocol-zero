import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { UPGRADE_CONFIG } from '../src/config/upgradeConfig.js';
import { EVOLUTION_CONFIG } from '../src/config/evolutionConfig.js';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { OrbitalBladeSystem } from '../src/systems/OrbitalBladeSystem.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';

function pick(system, id) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const choices = system.prepareChoices();
    if (choices.some(choice => choice.id === id)) return system.select(id);
  }
  throw new Error(`Never offered ${id}`);
}

function generator() {
  let state = 7;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

describe('weapon build rules', () => {
  it('filters a fourth weapon in tactical mode but keeps existing weapon upgrades legal', () => {
    const system = new UpgradeSystem({ player: new Player(), random: () => 0,
      upgrades: UPGRADE_CONFIG.filter(item => ['UP-04', 'UP-07', 'UP-08'].includes(item.id)) });
    system.setWeaponLimit(3);
    pick(system, 'UP-04'); pick(system, 'UP-07');
    const choices = system.prepareChoices();
    expect(choices.map(choice => choice.id)).not.toContain('UP-08');
    expect(choices.map(choice => choice.id)).toContain('UP-04');
    expect(system.getBuildSnapshot().weaponIds).toHaveLength(3);
    system.reset();
    expect(system.getBuildSnapshot().weaponIds).toEqual(['pulse-gun']);
    expect(system.getBuildSnapshot().weaponLimit).toBe(3);
  });

  it('guarantees an owned weapon improvement whenever one is eligible', () => {
    const system = new UpgradeSystem({ player: new Player(), random: generator() });
    for (let step = 0; step < 30; step++) {
      expect(system.prepareChoices().some(choice => choice.id === 'UP-02' || choice.id === 'UP-03')).toBe(true);
    }
  });

  it('guarantees a newly eligible evolution, preserves it on reroll and selects it once', () => {
    const system = new UpgradeSystem({ player: new Player(), random: generator(),
      upgrades: UPGRADE_CONFIG.filter(item => ['UP-01', 'UP-03', 'UP-05', 'UP-06'].includes(item.id)) });
    for (let i = 0; i < 3; i++) pick(system, 'UP-01');
    for (let i = 0; i < 2; i++) pick(system, 'UP-03');
    expect(system.prepareChoices().some(choice => choice.id === EVOLUTION_CONFIG[0].id)).toBe(true);
    const before = system.getChoicesSnapshot().map(choice => choice.id);
    expect(system.rerollChoices()).toBe(true);
    expect(system.getChoicesSnapshot().some(choice => choice.type === 'evolution')).toBe(true);
    expect(system.getChoicesSnapshot().some(choice => !before.includes(choice.id))).toBe(true);
    expect(system.select('EV-01')).toMatchObject({ type: 'evolution', weaponId: 'pulse-gun' });
    expect(system.isEvolved('pulse-gun')).toBe(true);
    expect(system.prepareChoices().some(choice => choice.id === 'EV-01')).toBe(false);
    system.reset();
    expect(system.isEvolved('pulse-gun')).toBe(false);
  });
});

describe('evolved attack behavior', () => {
  it('splits once toward other enemies and children cannot re-hit the original enemy', () => {
    const original = new Enemy({ id: 'original', x: 200, y: 200, config: ENEMY_CONFIG.EN03 });
    const a = new Enemy({ id: 'a', x: 260, y: 170 });
    const b = new Enemy({ id: 'b', x: 260, y: 230 });
    const projectiles = [new Projectile({ id: 'root', ownerId: 'player', weaponId: 'pulse-gun',
      x: 100, y: 200, vx: 500, vy: 0, radius: 4, damage: 20, lifetimeSeconds: 1, canSplit: true })];
    const system = new ProjectileSystem({ projectiles, enemies: [original, a, b], enemyDamageSystem: new EnemyDamageSystem() });
    system.update(.2);
    expect(original.hp).toBe(80);
    expect(projectiles).toHaveLength(2);
    expect(projectiles.every(projectile => projectile.canSplit === false && projectile.ignoreEnemyId === 'original')).toBe(true);
    system.update(.3);
    expect(original.hp).toBe(80);
    expect([a.hp, b.hp]).toEqual([20, 20]);
    expect(projectiles).toHaveLength(0);
  });

  it('adds an orbital sweep and shares its per-target cooldown with the normal blade', () => {
    const player = new Player();
    const near = new Enemy({ id: 'near', x: player.x + 80, y: player.y, config: ENEMY_CONFIG.EN03 });
    const outer = new Enemy({ id: 'outer', x: player.x + 130, y: player.y, config: ENEMY_CONFIG.EN03 });
    const system = new OrbitalBladeSystem({ player, enemies: [near, outer], enemyDamageSystem: new EnemyDamageSystem() });
    system.update({ deltaSeconds: .01, upgradeEffects: { orbitalBladeLevel: 5, damageMultiplier: 1 }, evolved: true });
    expect(near.hp).toBe(72);
    expect(outer.hp).toBe(76);
    expect(system.getSnapshot().sweepRemaining).toBeGreaterThan(0);
    system.update({ deltaSeconds: .1, upgradeEffects: { orbitalBladeLevel: 5, damageMultiplier: 1 }, evolved: true });
    expect(outer.hp).toBe(76);
    system.reset();
    expect(system.getSnapshot().sweepRemaining).toBe(0);
  });
});
