import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';

describe('new weapon integration', () => {
  it('unlocks both through legal choices, settles a shared target once and resets weapons', () => {
    let randomValue = .76;
    const world = new GameWorld({ camera: new Camera(), upgradeRandom: () => randomValue });
    world.stateManager.startGame();
    world.player.exp = 6;
    world.update(1 / 60);
    expect(world.chooseUpgrade('UP-07')).toBe(true);
    randomValue = .99;
    world.player.exp = 10;
    world.update(1 / 60);
    expect(world.chooseUpgrade('UP-08')).toBe(true);
    expect(world.getHudSnapshot().weaponIds).toContain('arc-coil');
    expect(world.getHudSnapshot().weaponIds).toContain('railgun');
    let deaths = 0;
    world.subscribeEnemyDeath(() => deaths++);
    world.enemies.push({ id: 'shared', typeId: 'EN-01', category: 'normal', x: world.player.x + 200,
      y: world.player.y, radius: 16, speed: 0, hp: 20, alive: true, expDrop: 1, contactDamage: 10 });
    world.update(1 / 60);
    expect(world.killCount).toBe(1);
    expect(deaths).toBe(1);
    expect(world.experienceCrystals).toHaveLength(1);
    world.stateManager.pause();
    const snapshot = world.arcCoilSystem.getSnapshot();
    world.update(10);
    expect(world.arcCoilSystem.getSnapshot()).toEqual(snapshot);
    world.reset();
    expect(world.getHudSnapshot().weaponIds).toEqual(['pulse-gun']);
    expect(world.arcCoilSystem.getSnapshot()).toEqual([]);
    expect(world.railgunSystem.getSnapshot()).toEqual([]);
  });

  it('applies a picked-up battery to real pulse frequency without modifying base config', () => {
    const world = new GameWorld({ camera: new Camera() });
    world.stateManager.startGame();
    world.supplySystem.addPickup('overclock', world.player.x, world.player.y);
    world.enemies.push({ id: 'target', category: 'normal', x: world.player.x + 200, y: world.player.y,
      radius: 16, speed: 0, hp: 100, alive: true });
    world.update(1 / 60);
    expect(world.player.weaponStates[0].cooldownRemaining).toBeCloseTo(.8 / 1.3);
    expect(world.weaponSystem.config.fireIntervalSeconds).toBe(.8);
  });
});
