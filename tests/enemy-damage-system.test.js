import { describe, expect, it } from 'vitest';
import { Enemy } from '../src/entities/Enemy.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';

describe('EnemyDamageSystem', () => {
  it('clamps lethal damage and ignores an already dead enemy', () => {
    const enemy = new Enemy({ id: 'enemy-1', x: 200, y: 200 });
    const system = new EnemyDamageSystem();

    expect(system.applyDamage(enemy, 20)).toBe(true);
    expect(enemy).toMatchObject({ hp: 10, alive: true, deathProcessed: false });
    expect(enemy.hitFlashRemaining).toBeGreaterThan(0);

    expect(system.applyDamage(enemy, 20)).toBe(true);
    expect(enemy).toMatchObject({ hp: 0, alive: false, deathProcessed: false });
    expect(system.applyDamage(enemy, 20)).toBe(false);
    expect(enemy.hp).toBe(0);
  });

  it('keeps damage application successful when an observer throws', () => {
    const enemy = new Enemy({ id: 'enemy-1', x: 200, y: 200 });
    const system = new EnemyDamageSystem({ onDamage: () => { throw new Error('observer failed'); } });

    expect(system.applyDamage(enemy, 5)).toBe(true);
    expect(enemy).toMatchObject({ hp: 25, alive: true });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid damage %s',
    (damage) => {
      const enemy = new Enemy({ id: 'enemy-1', x: 200, y: 200 });
      const system = new EnemyDamageSystem();

      expect(() => system.applyDamage(enemy, damage)).toThrow(RangeError);
      expect(enemy.hp).toBe(30);
      expect(enemy.alive).toBe(true);
    },
  );
});
