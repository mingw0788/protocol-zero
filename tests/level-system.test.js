import { describe, expect, it } from 'vitest';
import { LEVEL_CONFIG } from '../src/config/levelConfig.js';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { Player } from '../src/entities/Player.js';
import { LevelSystem, getExperienceToNextLevel } from '../src/systems/LevelSystem.js';

function createLevelSystem({ level = 1, exp = 0 } = {}) {
  const player = new Player();
  player.level = level;
  player.exp = exp;
  const stateManager = new GameStateManager();
  return { player, stateManager, levelSystem: new LevelSystem({ player, stateManager }) };
}

describe('getExperienceToNextLevel', () => {
  it('uses frozen SRS threshold configuration', () => {
    expect(LEVEL_CONFIG).toEqual({ baseExperience: 6, experienceStepPerLevel: 4 });
    expect(Object.isFrozen(LEVEL_CONFIG)).toBe(true);
  });

  it('uses the SRS threshold for the current level', () => {
    expect(getExperienceToNextLevel(1)).toBe(6);
    expect(getExperienceToNextLevel(2)).toBe(10);
    expect(getExperienceToNextLevel(3)).toBe(14);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid level %s',
    (level) => {
      expect(() => getExperienceToNextLevel(level)).toThrow(RangeError);
    },
  );
});

describe('LevelSystem experience accounting', () => {
  it('keeps experience below the threshold without adding a pending choice', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 6 - Number.EPSILON * 4 });

    expect(levelSystem.processExperience()).toBe(0);
    expect(player.level).toBe(1);
    expect(player.exp).toBeLessThan(6);
    expect(levelSystem.pendingLevelUps).toBe(0);
  });

  it('levels at the exact threshold and does not count that level twice', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 6 });

    expect(levelSystem.processExperience()).toBe(1);
    expect(player.level).toBe(2);
    expect(player.exp).toBe(0);
    expect(levelSystem.pendingLevelUps).toBe(1);
    expect(levelSystem.processExperience()).toBe(0);
    expect(levelSystem.pendingLevelUps).toBe(1);
  });

  it('preserves overflow as the next level remainder', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 8 });

    expect(levelSystem.processExperience()).toBe(1);
    expect(player.level).toBe(2);
    expect(player.exp).toBe(2);
    expect(levelSystem.pendingLevelUps).toBe(1);
  });

  it('crosses each increasing threshold and queues one choice per level', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 35 });

    expect(levelSystem.processExperience()).toBe(3);
    expect(player.level).toBe(4);
    expect(player.exp).toBe(5);
    expect(levelSystem.pendingLevelUps).toBe(3);
  });

  it('exposes pending count without a writable property', () => {
    const { levelSystem } = createLevelSystem();
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(levelSystem), 'pendingLevelUps');

    expect(levelSystem.pendingLevelUps).toBe(0);
    expect(descriptor?.get).toEqual(expect.any(Function));
    expect(descriptor?.set).toBeUndefined();
  });

  it('rejects invalid player level or experience before mutation', () => {
    for (const invalidState of [{ level: 0, exp: 8 }, { level: 1, exp: -1 }, { level: 1, exp: Number.NaN }]) {
      const player = new Player();
      player.level = invalidState.level;
      player.exp = invalidState.exp;

      expect(() => new LevelSystem({ player, stateManager: new GameStateManager() })).toThrow(RangeError);
      expect(player.level).toBe(invalidState.level);
      expect(player.exp).toBe(invalidState.exp);
    }
  });

  it('reset clears queued choices without resetting player-owned values', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 8 });
    levelSystem.processExperience();

    levelSystem.reset();

    expect(levelSystem.pendingLevelUps).toBe(0);
    expect(player.level).toBe(2);
    expect(player.exp).toBe(2);
  });
});
