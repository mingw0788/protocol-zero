import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player.js';
import { UPGRADE_CONFIG } from '../src/config/upgradeConfig.js';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.js';

function createSystem({ random = () => 0, upgrades = UPGRADE_CONFIG } = {}) {
  const player = new Player();
  return { player, system: new UpgradeSystem({ player, random, upgrades }) };
}

describe('UPGRADE_CONFIG', () => {
  it('freezes the six original and two expansion upgrade definitions', () => {
    expect(UPGRADE_CONFIG.map(({ id, maxLevel }) => [id, maxLevel])).toEqual([
      ['UP-01', 5],
      ['UP-02', 5],
      ['UP-03', 2],
      ['UP-04', 5],
      ['UP-05', 5],
      ['UP-06', 5],
      ['UP-07', 5],
      ['UP-08', 5],
    ]);
    expect(Object.isFrozen(UPGRADE_CONFIG)).toBe(true);
    expect(UPGRADE_CONFIG.every((upgrade) => Object.isFrozen(upgrade))).toBe(true);
  });
});

describe('UpgradeSystem candidate selection', () => {
  it('draws three distinct eligible candidates with injected RNG', () => {
    const { system } = createSystem();

    const choices = system.prepareChoices();

    expect(choices.map(({ id }) => id)).toEqual(['UP-01', 'UP-02', 'UP-03']);
    expect(new Set(choices.map(({ id }) => id)).size).toBe(3);
    expect(choices.map(({ currentLevel, targetLevel, maxLevel }) => [
      currentLevel, targetLevel, maxLevel,
    ])).toEqual([[0, 1, 5], [0, 1, 5], [0, 1, 2]]);
    expect(Object.isFrozen(choices)).toBe(true);
    expect(choices.every((choice) => Object.isFrozen(choice))).toBe(true);
  });

  it('filters maxed options and returns one or two remaining choices', () => {
    const upgrades = [
      { id: 'one', name: '一', description: '第一项', maxLevel: 1 },
      { id: 'two', name: '二', description: '第二项', maxLevel: 1 },
      { id: 'three', name: '三', description: '第三项', maxLevel: 1 },
    ];
    const { system } = createSystem({ upgrades });

    system.prepareChoices();
    expect(system.select('one')).toMatchObject({ id: 'one', previousLevel: 0, level: 1, maxLevel: 1 });
    let choices = system.prepareChoices();
    expect(choices.map(({ id }) => id)).toEqual(['two', 'three']);
    expect(choices.every(({ id }) => id !== 'one')).toBe(true);

    system.select('two');
    choices = system.prepareChoices();
    expect(choices.map(({ id }) => id)).toEqual(['three']);
    expect(choices).toHaveLength(1);
  });

  it('offers repeatable full repair when no upgrade remains', () => {
    const upgrades = [{ id: 'one', name: '一', description: '第一项', maxLevel: 1 }];
    const { player, system } = createSystem({ upgrades });
    system.prepareChoices();
    system.select('one');
    player.hp = 42;

    const [choice] = system.prepareChoices();
    expect(choice).toMatchObject({ id: 'full-repair', repeatable: true });
    expect(system.select('full-repair')).toEqual({ id: 'full-repair', type: 'restore-health' });
    expect(player.hp).toBe(player.maxHp);
    expect(system.getLevel('one')).toBe(1);

    player.hp = 25;
    expect(system.prepareChoices()).toHaveLength(1);
    system.select('full-repair');
    expect(player.hp).toBe(player.maxHp);
  });

  it('rejects stale choices and invalid random/config values atomically', () => {
    let randomValue = 0;
    const { player, system } = createSystem({ random: () => randomValue });
    const currentChoices = system.prepareChoices();
    const levels = system.getUpgradeLevelsSnapshot();
    player.hp = 61;

    expect(system.select('not-offered')).toBe(false);
    expect(system.getChoicesSnapshot()).toBe(currentChoices);
    expect(system.getUpgradeLevelsSnapshot()).toEqual(levels);
    expect(player.hp).toBe(61);

    randomValue = 1;
    expect(() => system.prepareChoices()).toThrow(RangeError);
    expect(system.getChoicesSnapshot()).toBe(currentChoices);
    expect(system.getUpgradeLevelsSnapshot()).toEqual(levels);

    expect(() => new UpgradeSystem({
      player,
      upgrades: [
        { id: 'duplicate', name: '甲', description: 'a', maxLevel: 1 },
        { id: 'duplicate', name: '乙', description: 'b', maxLevel: 2 },
      ],
    })).toThrow(RangeError);
    expect(() => new UpgradeSystem({
      player,
      upgrades: [{ id: 'bad-max', name: '无效', description: 'c', maxLevel: 0 }],
    })).toThrow(RangeError);
  });

  it('returns immutable level snapshots and clears levels and choices on reset', () => {
    const upgrades = [{ id: 'one', name: '一', description: '第一项', maxLevel: 1 }];
    const { system } = createSystem({ upgrades });
    system.prepareChoices();
    system.select('one');
    const snapshot = system.getUpgradeLevelsSnapshot();

    expect(snapshot).toEqual([{ id: 'one', level: 1, maxLevel: 1 }]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(() => { snapshot[0].level = 0; }).toThrow(TypeError);

    system.reset();

    expect(system.getUpgradeLevelsSnapshot()).toEqual([{ id: 'one', level: 0, maxLevel: 1 }]);
    expect(system.getChoicesSnapshot()).toEqual([]);
    expect(system.getLevel('one')).toBe(0);
    expect(() => system.getLevel('unknown')).toThrow(RangeError);
  });
});
