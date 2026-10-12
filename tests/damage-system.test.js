import { describe, expect, it } from 'vitest';
import { DamageSystem } from '../src/systems/DamageSystem.js';
import { Player } from '../src/entities/Player.js';

function contact(contactDamage) {
  return { contactDamage };
}

describe('DamageSystem', () => {
  it('applies one contact damage and clamps hp at zero', () => {
    const player = new Player();
    const damageSystem = new DamageSystem({ player });

    expect(damageSystem.applyContactDamage([contact(10)])).toEqual({
      damaged: true,
      killed: false,
      damage: 10,
    });
    expect(player.hp).toBe(90);
    expect(player.hp).toBeLessThanOrEqual(player.maxHp);
    expect(player.invulnerabilityRemaining).toBe(0.6);

    const lowHealthPlayer = new Player();
    lowHealthPlayer.hp = 5;
    const lowHealthDamageSystem = new DamageSystem({ player: lowHealthPlayer });

    expect(lowHealthDamageSystem.applyContactDamage([contact(10)])).toEqual({
      damaged: true,
      killed: true,
      damage: 5,
    });
    expect(lowHealthPlayer.hp).toBe(0);
    expect(lowHealthPlayer.alive).toBe(false);
    expect(lowHealthDamageSystem.applyContactDamage([contact(10)])).toEqual({
      damaged: false,
      killed: false,
      damage: 0,
    });
    expect(lowHealthPlayer.hp).toBeGreaterThanOrEqual(0);
  });

  it('ignores empty zero-damage and invulnerable contacts without refreshing immunity', () => {
    const player = new Player();
    const damageSystem = new DamageSystem({ player });

    expect(damageSystem.applyContactDamage([])).toEqual({ damaged: false, killed: false, damage: 0 });
    expect(damageSystem.applyContactDamage([contact(0)])).toEqual({ damaged: false, killed: false, damage: 0 });

    damageSystem.applyContactDamage([contact(10)]);
    damageSystem.update(0.2);
    const remainingAfterUpdate = player.invulnerabilityRemaining;

    expect(damageSystem.applyContactDamage([contact(10)])).toEqual({ damaged: false, killed: false, damage: 0 });
    expect(player.hp).toBe(90);
    expect(player.invulnerabilityRemaining).toBe(remainingAfterUpdate);
    expect(player.invulnerabilityRemaining).toBeCloseTo(0.4, 12);
  });

  it('uses the maximum contact damage once independent of order', () => {
    const run = (contacts) => {
      const player = new Player();
      const damageSystem = new DamageSystem({ player });
      damageSystem.applyContactDamage(contacts);
      return player.hp;
    };

    expect(run([contact(10), contact(20)])).toBe(80);
    expect(run([contact(20), contact(10)])).toBe(80);
  });

  it('allows damage at the exact invulnerability boundary', () => {
    const player = new Player();
    const damageSystem = new DamageSystem({ player });

    damageSystem.applyContactDamage([contact(10)]);
    damageSystem.update(0.6);

    expect(player.invulnerabilityRemaining).toBe(0);
    expect(damageSystem.applyContactDamage([contact(10)])).toEqual({
      damaged: true,
      killed: false,
      damage: 10,
    });
    expect(player.hp).toBe(80);
  });

  it('rejects invalid durations deltas contacts and damage values', () => {
    const player = new Player();
    expect(() => new DamageSystem()).toThrow(TypeError);
    for (const invulnerabilitySeconds of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new DamageSystem({ player, invulnerabilitySeconds })).toThrow(RangeError);
    }

    const damageSystem = new DamageSystem({ player });
    for (const deltaSeconds of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => damageSystem.update(deltaSeconds)).toThrow(RangeError);
    }
    expect(() => damageSystem.applyContactDamage(null)).toThrow(TypeError);
    for (const contactDamage of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => damageSystem.applyContactDamage([contact(contactDamage)])).toThrow(RangeError);
      expect(player.hp).toBe(100);
    }
  });
});
