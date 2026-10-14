import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';

describe('world supply lifecycle', () => {
  it('freezes city supplies in pause and level-up; reset clears effects and keeps map', () => {
    const world = new GameWorld({ camera: new Camera() });
    world.setMap('east-city');
    world.stateManager.startGame();
    world.supplySystem.addPickup('scanner', world.player.x, world.player.y);
    world.supplySystem.addPickup('overclock', world.player.x, world.player.y);
    world.supplySystem.addPickup('decoy', world.player.x, world.player.y);
    world.supplySystem.addPickup('emp-charge', world.player.x, world.player.y);
    world.experienceCrystals.push(new ExperienceCrystal({ id: 'scanner-range', x: world.player.x + 35, y: world.player.y, expValue: 1 }));
    world.update(1 / 60);
    expect(world.player.exp).toBe(1);
    expect(world.getSupplySnapshot().scannerStacks).toBe(1);
    const snapshot = world.getSupplySnapshot();
    world.stateManager.pause();
    world.update(10);
    expect(world.getSupplySnapshot()).toEqual(snapshot);
    world.stateManager.resume();
    world.stateManager.beginLevelUp();
    world.update(10);
    expect(world.getSupplySnapshot()).toEqual(snapshot);
    world.stateManager.completeLevelUp();
    world.reset();
    expect(world.getMapSnapshot().id).toBe('east-city');
    expect(world.getSupplySnapshot()).toMatchObject({
      scannerStacks: 0,
      overclockRemaining: 0,
      activeItem: null,
      activeItems: [null, null],
      selectedSlot: 0,
    });
  });
});
