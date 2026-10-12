import { describe, expect, it } from 'vitest';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';

function makeEnemy(id, x, y = 100) {
  return new Enemy({ id, x, y });
}

function makeProjectile({
  id = 'projectile-1',
  x = 100,
  y = 100,
  vx = 500,
  vy = 0,
  radius = 4,
  damage = 20,
  lifetimeSeconds = 1.28,
} = {}) {
  return new Projectile({
    id,
    ownerId: 'player',
    weaponId: 'pulse-gun',
    x,
    y,
    vx,
    vy,
    radius,
    damage,
    lifetimeSeconds,
  });
}

function makeSystem(projectiles, enemies) {
  return new ProjectileSystem({
    projectiles,
    enemies,
    enemyDamageSystem: new EnemyDamageSystem(),
  });
}

describe('ProjectileSystem', () => {
  it('moves projectiles by speed and valid delta without replacing the shared array', () => {
    const projectile = makeProjectile();
    const projectiles = [projectile];
    const system = makeSystem(projectiles, []);

    system.update(0.2);

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]).toBe(projectile);
    expect(projectile).toMatchObject({ x: 200, y: 100, remainingLife: 1.08, active: true });
  });

  it('sweeps the full segment and stops at the first live enemy', () => {
    const dead = makeEnemy('dead', 140);
    dead.alive = false;
    const nearer = makeEnemy('nearer', 180);
    const farther = makeEnemy('farther', 280);
    const projectile = makeProjectile();
    const projectiles = [projectile];
    const reference = projectiles;
    const system = makeSystem(projectiles, [farther, dead, nearer]);

    system.update(0.5);

    expect(projectiles).toBe(reference);
    expect(projectiles).toHaveLength(0);
    expect(projectile.active).toBe(false);
    expect(nearer).toMatchObject({ hp: 10, alive: true });
    expect(farther).toMatchObject({ hp: 30, alive: true });
    expect(dead.hp).toBe(30);
  });

  it('uses stable enemy order for equal intersections', () => {
    const first = makeEnemy('first', 200);
    const second = makeEnemy('second', 200);
    const projectiles = [makeProjectile()];
    const system = makeSystem(projectiles, [first, second]);

    system.update(0.5);

    expect(first.hp).toBe(10);
    expect(second.hp).toBe(30);
    expect(projectiles).toHaveLength(0);
  });

  it('hits when the segment starts inside an enemy', () => {
    const enemy = makeEnemy('overlap', 110);
    const projectile = makeProjectile({ x: 100, vx: 0 });
    const projectiles = [projectile];
    const system = makeSystem(projectiles, [enemy]);

    system.update(0.1);

    expect(enemy.hp).toBe(10);
    expect(projectiles).toHaveLength(0);
    expect(projectile.active).toBe(false);
  });

  it('does not hit beyond the projectile remaining lifetime', () => {
    const enemy = makeEnemy('beyond-life', 300);
    const projectile = makeProjectile({ lifetimeSeconds: 0.2 });
    const projectiles = [projectile];
    const system = makeSystem(projectiles, [enemy]);

    system.update(0.5);

    expect(enemy.hp).toBe(30);
    expect(projectiles).toHaveLength(0);
    expect(projectile).toMatchObject({ x: 200, remainingLife: 0, active: false });
  });

  it('hits within the remaining-life segment before expiring', () => {
    const enemy = makeEnemy('within-life', 180);
    const projectile = makeProjectile({ lifetimeSeconds: 0.2 });
    const projectiles = [projectile];
    const system = makeSystem(projectiles, [enemy]);

    system.update(0.5);

    expect(enemy.hp).toBe(10);
    expect(projectiles).toHaveLength(0);
    expect(projectile.active).toBe(false);
  });

  it('does not hit enemies with depleted HP or invalid coordinates', () => {
    const depleted = makeEnemy('depleted', 150);
    depleted.hp = 0;
    const malformed = makeEnemy('malformed', 180);
    malformed.x = Number.NaN;
    const projectile = makeProjectile();
    const projectiles = [projectile];
    const system = makeSystem(projectiles, [depleted, malformed]);

    system.update(0.1);

    expect(projectiles[0]).toBe(projectile);
    expect(projectile).toMatchObject({ x: 150, remainingLife: 1.18, active: true });
    expect(depleted.hp).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid update delta %s without mutating entities',
    (deltaSeconds) => {
      const projectile = makeProjectile();
      const projectiles = [projectile];
      const enemy = makeEnemy('target', 200);
      const system = makeSystem(projectiles, [enemy]);

      expect(() => system.update(deltaSeconds)).toThrow(RangeError);
      expect(projectiles[0]).toBe(projectile);
      expect(projectile).toMatchObject({ x: 100, remainingLife: 1.28, active: true });
      expect(enemy.hp).toBe(30);
    },
  );

  it('does not mutate projectiles or enemies for zero delta', () => {
    const projectile = makeProjectile();
    const projectiles = [projectile];
    const enemy = makeEnemy('target', 200);
    const system = makeSystem(projectiles, [enemy]);

    system.update(0);

    expect(projectiles).toEqual([projectile]);
    expect(projectile).toMatchObject({ x: 100, remainingLife: 1.28, active: true });
    expect(enemy.hp).toBe(30);
  });
});
