import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';

describe('GameWorld HUD snapshots', () => {
  it('reports the real initial run state', () => {
    const world = new GameWorld();

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
    const world = new GameWorld();
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

  it('prevents presentation callers from changing current or later snapshots', () => {
    const world = new GameWorld();
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
    const world = new GameWorld();
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
