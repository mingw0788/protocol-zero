import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Camera } from '../src/rendering/Camera.js';

function createWorld(options = {}) {
  const camera = new Camera();
  const world = new GameWorld({ ...options, camera });
  return world;
}

describe('GameWorld HUD snapshots', () => {
  it('reports the real initial run state', () => {
    const world = createWorld();

    expect(world.getHudSnapshot()).toEqual({
      health: { current: 100, max: 100 },
      experience: 0,
      level: 1,
      weaponIds: ['pulse-gun'],
      killCount: 0,
      elapsedSeconds: 0,
    });
  });

  it('reads changed player, clock, equipment, and kill values from the model', () => {
    const world = createWorld();
    world.stateManager.startGame();
    world.update(1.5);
    world.player.hp = 70;
    world.player.maxHp = 120;
    world.player.exp = 4;
    world.player.level = 2;
    world.player.weaponStates.push({ id: 'orbital-blade' });
    expect(world.recordKill()).toBe(1);
    expect(world.recordKill()).toBe(2);

    expect(world.getHudSnapshot()).toEqual({
      health: { current: 70, max: 120 },
      experience: 4,
      level: 2,
      weaponIds: ['pulse-gun', 'orbital-blade'],
      killCount: 2,
      elapsedSeconds: 1.5,
    });
  });

  it('reports contact damage in an immutable real-health snapshot', () => {
    const world = createWorld();
    world.stateManager.startGame();
    world.enemies.push(new Enemy({ id: 'hud-contact', x: world.player.x, y: world.player.y }));

    world.update(1 / 60);
    const snapshot = world.getHudSnapshot();

    expect(snapshot.health.current).toBe(90);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.health)).toBe(true);
    expect(() => { snapshot.health.current = 100; }).toThrow(TypeError);
  });

  it('reflects same-step crystal pickup in a new immutable experience snapshot', () => {
    const world = createWorld();
    const initialSnapshot = world.getHudSnapshot();
    world.stateManager.startGame();
    const enemy = new Enemy({
      id: 'hud-experience-drop',
      x: world.player.x,
      y: world.player.y,
    });
    enemy.alive = false;
    enemy.hp = 0;
    world.enemies.push(enemy);

    world.update(1 / 60);

    expect(initialSnapshot.experience).toBe(0);
    expect(world.getHudSnapshot().experience).toBe(1);
    expect(Object.isFrozen(world.getHudSnapshot())).toBe(true);
    expect(world.experienceCrystals).toEqual([]);
  });

  it('prevents presentation callers from changing current or later snapshots', () => {
    const world = createWorld();
    const snapshot = world.getHudSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.health)).toBe(true);
    expect(Object.isFrozen(snapshot.weaponIds)).toBe(true);
    expect(() => { snapshot.health.current = 1; }).toThrow(TypeError);
    expect(() => { snapshot.weaponIds.push('injected'); }).toThrow(TypeError);
    expect(() => { snapshot.killCount = 90; }).toThrow(TypeError);
    world.player.hp = 60;
    world.player.weaponStates[0].id = 'changed-in-model';

    expect(snapshot.health.current).toBe(100);
    expect(snapshot.weaponIds).toEqual(['pulse-gun']);
    expect(world.getHudSnapshot().health.current).toBe(60);
    expect(world.killCount).toBe(0);
  });

  it('resets all existing run data together', () => {
    const world = createWorld();
    world.stateManager.startGame();
    world.update(2);
    world.player.update({ x: 1, y: 1 }, 1);
    world.player.hp = 10;
    world.player.maxHp = 160;
    world.player.exp = 8;
    world.player.level = 4;
    world.player.weaponStates.push({ id: 'orbital-blade' });
    world.recordKill();

    world.reset();

    expect(world.getHudSnapshot()).toEqual({
      health: { current: 100, max: 100 },
      experience: 0,
      level: 1,
      weaponIds: ['pulse-gun'],
      killCount: 0,
      elapsedSeconds: 0,
    });
    expect(world.simulationSteps).toBe(0);
    expect({ x: world.player.x, y: world.player.y }).toEqual({ x: 1200, y: 675 });
  });
});
