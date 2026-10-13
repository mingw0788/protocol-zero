import { describe, expect, it } from 'vitest';
import { ArcCoilSystem } from '../src/systems/ArcCoilSystem.js';
import { RailgunSystem } from '../src/systems/RailgunSystem.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';

const enemy = (id, x, y = 0) => ({ id, x, y, radius: 10, hp: 1000, alive: true, category: 'normal' });
function setup(Type, id, enemies) {
  const player = { x: 0, y: 0, weaponStates: [{ id, cooldownRemaining: 0 }] };
  return { player, system: new Type({ player, enemies, enemyDamageSystem: new EnemyDamageSystem() }) };
}
const step = { deltaSeconds: .01, level: 1, damageMultiplier: 1, fireRateMultiplier: 1 };

describe('arc coil', () => {
  it('chains to nearest distinct live targets with falloff and a target limit', () => {
    const a = enemy('a', 100), b = enemy('b', 200), c = enemy('c', 300), d = enemy('d', 400);
    const { system } = setup(ArcCoilSystem, 'arc-coil', [d, b, a, a, c, { ...a, id: 'dead', hp: 0 }]);
    expect(system.update(step)).toBe(3);
    expect(a.hp).toBe(984);
    expect(b.hp).toBeCloseTo(988.8);
    expect(c.hp).toBeCloseTo(992.16);
    expect(d.hp).toBe(1000);
    expect(system.getSnapshot()).toHaveLength(3);
    system.update({ ...step, deltaSeconds: .2 });
    expect(system.getSnapshot()).toHaveLength(0);
  });

  it('respects initial and jump range, module rank, Boss and global damage', () => {
    const targets = [enemy('boss', 360), enemy('b', 510), enemy('c', 660), enemy('d', 810), enemy('e', 960)];
    targets[0].category = 'boss';
    const { system } = setup(ArcCoilSystem, 'arc-coil', targets);
    expect(system.update({ ...step, level: 5, damageMultiplier: 2 })).toBe(5);
    expect(targets[0].hp).toBeCloseTo(1000 - 16 * 1.48 * 2);
    expect(targets[4].hp).toBeLessThan(1000);
  });
});

describe('railgun', () => {
  it('keeps its short-lived beam attached to the moving weapon after firing', () => {
    const { system, player } = setup(RailgunSystem, 'railgun', [enemy('anchor', 200)]);
    system.update(step);
    const before = system.getSnapshot()[0];
    player.x += 25; player.y -= 10;
    const after = system.getSnapshot()[0];
    expect(after.x1 - before.x1).toBe(25);
    expect(after.y1 - before.y1).toBe(-10);
    expect(after.x2 - before.x2).toBe(25);
    expect(after.y2 - before.y2).toBe(-10);
  });

  it('hits only the line segment, in projection order, once per distinct enemy', () => {
    const a = enemy('a', 100), b = enemy('b', 200), c = enemy('c', 800), outside = enemy('out', 820);
    const side = enemy('side', 200, 11);
    const { system } = setup(RailgunSystem, 'railgun', [c, side, b, a, a, outside]);
    expect(system.update(step)).toBe(3);
    expect([a.hp, b.hp, c.hp]).toEqual([972, 972, 972]);
    expect(side.hp).toBe(1000);
    expect(outside.hp).toBe(1000);
    expect(system.getSnapshot()).toHaveLength(1);
  });

  it('ignores dead targets and increases damage and penetration with rank', () => {
    const enemies = Array.from({ length: 6 }, (_, i) => enemy(String(i), 50 + i * 100));
    const { system } = setup(RailgunSystem, 'railgun', enemies);
    expect(system.update({ ...step, level: 5 })).toBe(5);
    expect(enemies[0].hp).toBeCloseTo(1000 - 28 * 1.48);
    expect(enemies[5].hp).toBe(1000);
  });
});

describe.each([[ArcCoilSystem, 'arc-coil', 1.1], [RailgunSystem, 'railgun', 1.2]])('%s lifecycle', (Type, id, interval) => {
  it('uses absolute cooldown and recalculates frequency only when firing; reset clears', () => {
    const enemies = [enemy('a', 100)];
    const { system, player } = setup(Type, id, enemies);
    expect(system.update({ ...step, level: 0 })).toBe(0);
    system.update({ ...step, fireRateMultiplier: 1.3 });
    expect(player.weaponStates[0].cooldownRemaining).toBeCloseTo(interval / 1.3);
    enemies.length = 0;
    system.update({ ...step, deltaSeconds: 2 });
    expect(player.weaponStates[0].cooldownRemaining).toBe(0);
    enemies.push(enemy('b', 100));
    system.update(step);
    expect(player.weaponStates[0].cooldownRemaining).toBe(interval);
    system.reset();
    expect(system.getSnapshot()).toEqual([]);
    expect(player.weaponStates[0].cooldownRemaining).toBe(0);
    expect(() => system.update({ ...step, deltaSeconds: NaN })).toThrow();
    expect(() => system.update({ ...step, level: 6 })).toThrow();
  });
});
