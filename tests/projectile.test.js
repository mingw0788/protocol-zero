import { describe, expect, it } from 'vitest';
import { Projectile } from '../src/entities/Projectile.js';

describe('Projectile', () => {
  it('copies a valid projectile profile and starts with its configured lifetime', () => {
    const projectile = new Projectile({
      id: 'projectile-1',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: 10,
      y: 20,
      vx: 500,
      vy: 0,
      radius: 4,
      damage: 20,
      lifetimeSeconds: 1.28,
    });

    expect(projectile).toMatchObject({
      id: 'projectile-1',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: 10,
      y: 20,
      vx: 500,
      vy: 0,
      radius: 4,
      damage: 20,
      remainingLife: 1.28,
      active: true,
    });
  });

  it.each([
    [{ id: '', ownerId: 'player', weaponId: 'pulse-gun' }, TypeError],
    [{ id: 'p', ownerId: '', weaponId: 'pulse-gun' }, TypeError],
    [{ id: 'p', ownerId: 'player', weaponId: '' }, TypeError],
    [{ x: Number.NaN }, TypeError],
    [{ y: Number.POSITIVE_INFINITY }, TypeError],
    [{ vx: Number.NaN }, TypeError],
    [{ vy: Number.NEGATIVE_INFINITY }, TypeError],
    [{ radius: 0 }, RangeError],
    [{ damage: -1 }, RangeError],
    [{ lifetimeSeconds: Number.POSITIVE_INFINITY }, RangeError],
  ])('rejects invalid fields %o', (override, errorType) => {
    const profile = {
      id: 'projectile-1',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: 10,
      y: 20,
      vx: 500,
      vy: 0,
      radius: 4,
      damage: 20,
      lifetimeSeconds: 1.28,
      ...override,
    };

    expect(() => new Projectile(profile)).toThrow(errorType);
  });
});
