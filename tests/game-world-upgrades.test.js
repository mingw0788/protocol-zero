import { describe, expect, it, vi } from 'vitest';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Camera } from '../src/rendering/Camera.js';

function createWorld(options = {}) {
  return new GameWorld({ ...options, camera: new Camera() });
}

function addExperience(world, expValue) {
  world.experienceCrystals.push(new ExperienceCrystal({
    id: `level-up-${expValue}`,
    x: world.player.x,
    y: world.player.y,
    expValue,
  }));
}

describe('GameWorld upgrade choice integration', () => {
  it('prepares candidates before LEVEL_UP state listeners run', () => {
    const world = createWorld({ upgradeRandom: () => 0 });
    world.stateManager.startGame();
    let candidatesAtEntry = null;
    world.stateManager.subscribe((state) => {
      if (state === GAME_STATES.LEVEL_UP) candidatesAtEntry = world.getUpgradeChoices();
    });
    addExperience(world, 35);

    world.update(1 / 60);

    expect(world.levelSystem.pendingLevelUps).toBe(3);
    expect(candidatesAtEntry).toHaveLength(3);
    expect(Object.isFrozen(candidatesAtEntry)).toBe(true);
    expect(world.getUpgradeChoices()).toBe(candidatesAtEntry);
  });

  it('consumes one choice per selection while the world remains frozen', () => {
    const world = createWorld({ upgradeRandom: () => 0 });
    world.stateManager.startGame();
    addExperience(world, 35);
    world.update(1 / 60);
    const frozenSnapshot = world.getUpgradeChoices();
    const frozenTime = world.clock.elapsedSeconds;
    const frozenSteps = world.simulationSteps;
    const frozenLevels = world.upgradeSystem.getUpgradeLevelsSnapshot();

    expect(world.chooseUpgrade('not-offered')).toBe(false);
    expect(world.getUpgradeChoices()).toBe(frozenSnapshot);
    expect(world.levelSystem.pendingLevelUps).toBe(3);
    expect(world.upgradeSystem.getUpgradeLevelsSnapshot()).toEqual(frozenLevels);

    for (let choice = 0; choice < 3; choice += 1) {
      const [candidate] = world.getUpgradeChoices();
      expect(world.chooseUpgrade(candidate.id)).toBe(true);
      expect(world.clock.elapsedSeconds).toBeCloseTo(frozenTime, 12);
      expect(world.simulationSteps).toBe(frozenSteps);
      if (choice < 2) {
        expect(world.update(1)).toBe(false);
        expect(world.clock.elapsedSeconds).toBeCloseTo(frozenTime, 12);
        expect(world.simulationSteps).toBe(frozenSteps);
        expect(world.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
        expect(world.levelSystem.pendingLevelUps).toBe(2 - choice);
        expect(world.getUpgradeChoices()).toHaveLength(3);
      } else {
        expect(world.stateManager.currentState).toBe(GAME_STATES.PLAYING);
        expect(world.levelSystem.pendingLevelUps).toBe(0);
        expect(world.update(1 / 60)).toBe(true);
        expect(world.simulationSteps).toBe(frozenSteps + 1);
      }
    }

    expect(world.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(world.levelSystem.pendingLevelUps).toBe(0);
    expect(world.getUpgradeChoices()).toEqual([]);
  });

  it('keeps upgrade draws separate from enemy spawning randomness', () => {
    let enemyRandomCalls = 0;
    let upgradeRandomCalls = 0;
    const world = createWorld({
      random: () => { enemyRandomCalls += 1; return 0; },
      upgradeRandom: () => { upgradeRandomCalls += 1; return 0; },
    });
    world.stateManager.startGame();
    addExperience(world, 6);

    world.update(1 / 60);

    expect(upgradeRandomCalls).toBe(3);
    expect(enemyRandomCalls).toBe(0);
  });

  it('uses an independent default upgrade random stream', () => {
    const sharedRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const world = createWorld();

      world.upgradeSystem.prepareChoices();

      expect(sharedRandom).not.toHaveBeenCalled();
    } finally {
      sharedRandom.mockRestore();
    }
  });
});
