import { describe, expect, it } from 'vitest';
import { CollisionSystem } from '../src/systems/CollisionSystem.js';

describe('CollisionSystem', () => {
  it('detects tangent circles but not a gap', () => {
    const player = { x: 0, y: 0, radius: 5 };
    const enemy = { id: 'tangent', x: 10, y: 0, radius: 5, hp: 1, alive: true };
    const collisions = new CollisionSystem({ player, enemies: [enemy] });

    expect(collisions.getPlayerContacts()).toEqual([enemy]);

    enemy.x = 10.01;
    expect(collisions.getPlayerContacts()).toEqual([]);
  });

  it('uses current world positions and both radii', () => {
    const player = { x: 100, y: 100, radius: 3 };
    const enemy = { id: 'different-radii', x: 108.1, y: 100, radius: 5, hp: 1, alive: true };
    const collisions = new CollisionSystem({ player, enemies: [enemy] });

    expect(collisions.getPlayerContacts()).toEqual([]);

    enemy.x = 108;
    expect(collisions.getPlayerContacts()).toEqual([enemy]);

    player.x = 200;
    expect(collisions.getPlayerContacts()).toEqual([]);
  });

  it('excludes dead enemies and does not mutate entities', () => {
    const player = { x: 10, y: 10, radius: 5 };
    const enemies = [
      { id: 'live', x: 20, y: 10, radius: 5, hp: 10, alive: true },
      { id: 'dead', x: 20, y: 10, radius: 5, hp: 10, alive: false },
      { id: 'empty-hp', x: 20, y: 10, radius: 5, hp: 0, alive: true },
    ];
    const beforePlayer = { ...player };
    const beforeEnemies = enemies.map((enemy) => ({ ...enemy }));
    const collisions = new CollisionSystem({ player, enemies });

    expect(collisions.getPlayerContacts()).toEqual([enemies[0]]);
    expect(player).toEqual(beforePlayer);
    expect(enemies).toEqual(beforeEnemies);
  });

  it('rejects missing dependencies and invalid geometry', () => {
    expect(() => new CollisionSystem()).toThrow(TypeError);
    expect(() => new CollisionSystem({ player: { x: 0, y: 0, radius: 1 } })).toThrow(TypeError);
    expect(() => new CollisionSystem({ player: { x: Number.NaN, y: 0, radius: 1 }, enemies: [] })).toThrow(RangeError);
    expect(() => new CollisionSystem({ player: { x: 0, y: 0, radius: 0 }, enemies: [] })).toThrow(RangeError);

    const enemy = { id: 'mutable', x: 10, y: 0, radius: 1, hp: 1, alive: true };
    const collisions = new CollisionSystem({ player: { x: 0, y: 0, radius: 1 }, enemies: [enemy] });
    enemy.x = Number.NaN;

    expect(() => collisions.getPlayerContacts()).toThrow(RangeError);
  });
});
