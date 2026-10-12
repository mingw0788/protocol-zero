import { describe, expect, it } from 'vitest';
import { Projectile } from '../src/entities/Projectile.js';
import { Camera } from '../src/rendering/Camera.js';
import { ProjectileRenderer } from '../src/rendering/ProjectileRenderer.js';

function createContext(events = []) {
  const fills = [];
  return {
    fills,
    save() { events.push('save'); },
    beginPath() { events.push('beginPath'); },
    rect(...args) { events.push(['clipRect', ...args]); },
    clip() { events.push('clip'); },
    fillRect(...args) { fills.push({ color: this.fillStyle, rect: args }); events.push('projectile'); },
    restore() { events.push('restore'); },
  };
}

function makeProjectile(id, x, y, radius = 4) {
  return new Projectile({
    id,
    ownerId: 'player',
    weaponId: 'pulse-gun',
    x,
    y,
    vx: 500,
    vy: 0,
    radius,
    damage: 20,
    lifetimeSeconds: 1.28,
  });
}

describe('ProjectileRenderer', () => {
  it('draws live projectiles in camera coordinates without mutating them', () => {
    const camera = new Camera();
    const context = createContext();
    const visible = makeProjectile('visible', camera.x + 100, camera.y + 120);
    const inactive = makeProjectile('inactive', camera.x + 200, camera.y + 120);
    inactive.active = false;
    const outside = makeProjectile('outside', 100, 100);
    const projectiles = [visible, inactive, outside];
    const before = projectiles.map((projectile) => ({ ...projectile }));

    new ProjectileRenderer().render(context, camera, projectiles);

    expect(context.fills).toHaveLength(2);
    expect(context.fills[0]).toEqual({ color: '#4cf3ff', rect: [96, 116, 8, 8] });
    expect(context.fills[1]).toEqual({ color: '#e9ffff', rect: [98, 118, 4, 4] });
    expect(projectiles).toEqual(before);
  });

  it('clips partial projectiles and culls fully offscreen projectiles', () => {
    const camera = new Camera();
    const events = [];
    const context = createContext(events);
    const partial = makeProjectile('partial', camera.x - 2, camera.y + 100);
    const outside = makeProjectile('outside', camera.x - 10, camera.y + 100);

    new ProjectileRenderer().render(context, camera, [partial, outside]);

    expect(events).toContainEqual(['clipRect', 0, 0, 1280, 720]);
    expect(events.indexOf('clip')).toBeLessThan(events.indexOf('projectile'));
    expect(context.fills).toHaveLength(2);
    expect(context.fills[0].rect).toEqual([-6, 96, 8, 8]);
    expect(events.at(-1)).toBe('restore');
  });
});
