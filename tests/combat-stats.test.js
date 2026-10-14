import { describe, expect, it } from 'vitest';
import { CombatStatsSystem } from '../src/systems/CombatStatsSystem.js';
import { Enemy } from '../src/entities/Enemy.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { DamageSystem } from '../src/systems/DamageSystem.js';
import { Player } from '../src/entities/Player.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { Camera } from '../src/rendering/Camera.js';

describe('CombatStatsSystem', () => {
  it('aggregates real damage and freezes stable sorted snapshots', () => {
    const stats = new CombatStatsSystem();
    stats.recordEnemyDamage({ sourceId: 'railgun', targetTypeId: 'heavy', actualDamage: 12 });
    stats.recordEnemyDamage({ sourceId: 'pulse-gun', targetTypeId: 'drone', actualDamage: 12 });
    stats.recordEnemyDamage({ sourceId: 'railgun', targetTypeId: 'drone', actualDamage: 8 });
    stats.recordEnemyKill({ sourceId: 'pulse-gun', targetTypeId: 'drone', category: 'normal' });
    stats.recordEnemyKill({ sourceId: 'pulse-gun', targetTypeId: 'drone', category: 'boss' });
    stats.recordPlayerDamage({ sourceTypeIds: ['heavy', 'infected'], healthDamage: 7, shieldDamage: 3 });

    const snapshot = stats.getSnapshot();
    expect(snapshot).toMatchObject({
      totalDamageDealt: 32,
      totalDamageReceived: 7,
      totalShieldAbsorbed: 3,
      totalKills: 2,
      normalKills: 1,
      bossKills: 1,
    });
    expect(snapshot.damageBySource).toEqual([
      { sourceId: 'railgun', damage: 20 },
      { sourceId: 'pulse-gun', damage: 12 },
    ]);
    expect(snapshot.killsBySource).toEqual([{ sourceId: 'pulse-gun', kills: 2 }]);
    expect(snapshot.killsByType).toEqual([{ typeId: 'drone', kills: 2 }]);
    expect(snapshot.incomingDamageByType).toEqual([
      { typeId: 'heavy', damage: 3.5 },
      { typeId: 'infected', damage: 3.5 },
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.damageBySource)).toBe(true);
    expect(Object.isFrozen(snapshot.damageBySource[0])).toBe(true);
    expect(() => snapshot.damageBySource.push({ sourceId: 'x', damage: 1 })).toThrow();
  });

  it('ignores invalid damage records and resets only the current run', () => {
    const stats = new CombatStatsSystem();
    expect(() => stats.recordEnemyDamage({ sourceId: '', targetTypeId: 'enemy', actualDamage: 1 })).toThrow(TypeError);
    expect(() => stats.recordEnemyDamage({ sourceId: 'pulse-gun', targetTypeId: 'enemy', actualDamage: -1 })).toThrow(RangeError);
    expect(() => stats.recordPlayerDamage({ sourceTypeIds: ['enemy'], healthDamage: 0, shieldDamage: 0 })).toThrow(RangeError);
    stats.recordEnemyDamage({ sourceId: 'pulse-gun', targetTypeId: 'enemy', actualDamage: 1 });
    stats.reset();
    expect(stats.getSnapshot().totalDamageDealt).toBe(0);
  });
});

describe('damage attribution', () => {
  it('counts clamped actual enemy damage and reports source without changing bool result', () => {
    const events = [];
    const enemy = new Enemy({ id: 'enemy-1', x: 200, y: 200 });
    const system = new EnemyDamageSystem({ onDamage: event => events.push(event) });
    expect(system.applyDamage(enemy, 40, 'railgun')).toBe(true);
    expect(events[0]).toMatchObject({
      sourceId: 'railgun', damage: 40, actualDamage: 30, targetTypeId: enemy.typeId,
      category: 'normal', lethal: true,
    });
    expect(enemy.lastDamageSourceId).toBe('railgun');
    expect(system.applyDamage(enemy, 3, 'railgun')).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('reports real shield absorption and only the strongest contact sources', () => {
    const player = new Player();
    player.shield = 4;
    const system = new DamageSystem({ player });
    const result = system.applyContactDamage([
      { id: 'b', typeId: 'heavy', contactDamage: 10 },
      { id: 'a', typeId: 'fast', contactDamage: 10 },
      { id: 'c', typeId: 'weak', contactDamage: 4 },
    ]);
    expect(result).toMatchObject({ damage: 6, shieldDamage: 4, sourceTypeIds: ['fast', 'heavy'] });
    expect(player.hp).toBe(94);
    expect(player.shield).toBe(0);
  });
});

describe('GameWorld combat statistics', () => {
  it('records weapon damage, contact damage and one kill then clears on reset', () => {
    const stateManager = new GameStateManager();
    const world = new GameWorld({
      stateManager,
      camera: new Camera({ viewportWidth: 1280, viewportHeight: 720 }),
      random: () => 0.5,
      upgradeRandom: () => 0.5,
      supplyRandom: () => 0.5,
    });
    stateManager.startGame();
    const enemy = new Enemy({ id: 'stat-target', x: world.player.x + 36, y: world.player.y });
    world.enemies.push(enemy);
    world.enemyDamageSystem.applyDamage(enemy, 20, 'pulse-gun');
    world.update(1 / 60);

    const stats = world.getCombatStatsSnapshot();
    expect(stats.damageBySource).toEqual([{ sourceId: 'pulse-gun', damage: 20 }]);
    world.enemyDamageSystem.applyDamage(enemy, 20, 'pulse-gun');
    world.update(1 / 60);
    expect(world.getCombatStatsSnapshot().totalKills).toBe(1);
    expect(world.getCombatStatsSnapshot().killsBySource).toEqual([{ sourceId: 'pulse-gun', kills: 1 }]);

    world.reset();
    expect(world.getCombatStatsSnapshot()).toMatchObject({ totalDamageDealt: 0, totalDamageReceived: 0, totalKills: 0 });
  });

  it('freezes damage statistics into the terminal result snapshot', () => {
    const stateManager = new GameStateManager();
    const world = new GameWorld({ stateManager, camera: new Camera({ viewportWidth: 1280, viewportHeight: 720 }) });
    stateManager.startGame();
    world.player.shield = 5;
    world.player.hp = 5;
    world.enemies.push(new Enemy({ id: 'contact', x: world.player.x + 31, y: world.player.y }));
    world.playerSystem.update = () => {};
    world.update(1 / 60);
    expect(world.getCombatStatsSnapshot().totalShieldAbsorbed).toBe(5);
    expect(world.getCombatStatsSnapshot().totalDamageReceived).toBe(5);
    expect(world.getRunResultSnapshot().statistics).toMatchObject({
      totalShieldAbsorbed: 5,
      totalDamageReceived: 5,
    });
    expect(Object.isFrozen(world.getRunResultSnapshot().statistics)).toBe(true);
  });
});
