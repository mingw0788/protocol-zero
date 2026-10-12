import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
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

  it('rejects a threshold that cannot be represented exactly', () => {
    expect(() => getExperienceToNextLevel(2 ** 52)).toThrow(RangeError);
  });
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

  it('does not award a level when the exact threshold is below Number precision', () => {
    const { player, levelSystem } = createLevelSystem({ level: 2 ** 52, exp: 2 ** 54 });

    expect(() => levelSystem.processExperience()).toThrow(RangeError);
    expect(player.level).toBe(2 ** 52);
    expect(player.exp).toBe(2 ** 54);
    expect(levelSystem.pendingLevelUps).toBe(0);
  });

  it('processes a large but representable experience value with bounded arithmetic', () => {
    const { player, levelSystem } = createLevelSystem({ exp: 1e30 });

    const gainedLevels = levelSystem.processExperience();

    expect(gainedLevels).toBeGreaterThan(1e14);
    expect(player.level).toBe(gainedLevels + 1);
    expect(player.exp).toBeLessThan(getExperienceToNextLevel(player.level));
    expect(levelSystem.pendingLevelUps).toBe(gainedLevels);
  });

  it('rejects an experience amount beyond the exact level range without blocking', () => {
    const playerUrl = new URL('../src/entities/Player.js', import.meta.url).href;
    const stateManagerUrl = new URL('../src/core/GameStateManager.js', import.meta.url).href;
    const levelSystemUrl = new URL('../src/systems/LevelSystem.js', import.meta.url).href;
    const script = `
      import { Player } from ${JSON.stringify(playerUrl)};
      import { GameStateManager } from ${JSON.stringify(stateManagerUrl)};
      import { LevelSystem } from ${JSON.stringify(levelSystemUrl)};
      const player = new Player();
      player.exp = Number.MAX_VALUE;
      const system = new LevelSystem({ player, stateManager: new GameStateManager() });
      try {
        system.processExperience();
        process.exitCode = 2;
      } catch (error) {
        if (!(error instanceof RangeError)) process.exitCode = 3;
        else process.stdout.write('RangeError');
      }
    `;

    expect(execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      timeout: 1500,
    })).toBe('RangeError');
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

  it('does not consume a choice outside LEVEL_UP', () => {
    const { stateManager, levelSystem } = createLevelSystem({ exp: 6 });
    levelSystem.processExperience();

    expect(levelSystem.completePendingLevelUp()).toBe(false);
    expect(levelSystem.pendingLevelUps).toBe(1);
    expect(stateManager.currentState).toBe('MENU');
    stateManager.startGame();
    expect(levelSystem.completePendingLevelUp()).toBe(false);
    expect(levelSystem.pendingLevelUps).toBe(1);
  });

  it('consumes each queued choice and resumes only after the final one', () => {
    const { stateManager, levelSystem } = createLevelSystem({ exp: 35 });
    levelSystem.processExperience();
    stateManager.startGame();
    stateManager.beginLevelUp();

    expect(levelSystem.completePendingLevelUp()).toBe(true);
    expect(levelSystem.pendingLevelUps).toBe(2);
    expect(stateManager.currentState).toBe('LEVEL_UP');
    expect(levelSystem.completePendingLevelUp()).toBe(true);
    expect(levelSystem.pendingLevelUps).toBe(1);
    expect(stateManager.currentState).toBe('LEVEL_UP');
    expect(levelSystem.completePendingLevelUp()).toBe(true);
    expect(levelSystem.pendingLevelUps).toBe(0);
    expect(stateManager.currentState).toBe('PLAYING');
    expect(levelSystem.completePendingLevelUp()).toBe(false);
  });

  it('clears the final pending count before notifying PLAYING state listeners', () => {
    const { stateManager, levelSystem } = createLevelSystem({ exp: 6 });
    levelSystem.processExperience();
    stateManager.startGame();
    stateManager.beginLevelUp();
    let pendingCountAtResume = null;
    stateManager.subscribe((state, previousState) => {
      if (state === 'PLAYING' && previousState === 'LEVEL_UP') {
        pendingCountAtResume = levelSystem.pendingLevelUps;
      }
    });

    expect(levelSystem.completePendingLevelUp()).toBe(true);

    expect(pendingCountAtResume).toBe(0);
  });
});
