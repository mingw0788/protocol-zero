import { describe, expect, it } from 'vitest';
import { EncounterSystem } from '../src/systems/EncounterSystem.js';
import { RunRewardSystem } from '../src/systems/RunRewardSystem.js';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENCOUNTER_CONFIG } from '../src/config/encounterConfig.js';

function setup(sample = 0, spawnAllowed = true) {
  const player = new Player();
  const enemies = [];
  const rewards = [];
  const system = new EncounterSystem({
    player, enemies, random: () => sample, rewardRandom: () => 0,
    spawnElite: ({ x, y, config }) => {
      if (!spawnAllowed) return null;
      const enemy = new Enemy({ id: 'event-elite', x, y, config });
      enemies.push(enemy);
      return enemy;
    },
    onReward: reward => rewards.push(reward),
  });
  return { player, enemies, rewards, system };
}

describe('EncounterSystem', () => {
  it('starts at 60, accumulates only inside the node, and awards once', () => {
    const { player, rewards, system } = setup();
    system.update(59, 59);
    expect(system.getSnapshot().active).toBeNull();
    system.update(1, 60);
    const node = system.getSnapshot().active;
    expect(node).toMatchObject({ type: 'defense', progress: 0, remaining: 35 });
    Object.assign(player, { x: node.x, y: node.y });
    system.update(14, 74);
    player.x += 200;
    system.update(1, 75);
    expect(system.getSnapshot().active.progress).toBeCloseTo(14 / 15);
    player.x = node.x;
    system.update(1, 76);
    system.update(1, 77);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ experience: 12, items: ['shield'] });
    expect(Object.isFrozen(rewards[0])).toBe(true);
    expect(system.getSnapshot()).toMatchObject({ active: null, completed: 1 });
  });

  it('moves a transport drone and completes after five seconds of following', () => {
    const { player, rewards, system } = setup(0.4);
    system.update(1, 60);
    const initial = system.getSnapshot().active;
    expect(initial.type).toBe('transport');
    for (let step = 1; step <= 300; step += 1) {
      const active = system.getSnapshot().active;
      if (active) Object.assign(player, { x: active.x, y: active.y });
      system.update(1 / 60, 60 + step / 60);
    }
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ experience: 10, items: ['scanner'] });
  });

  it('rewards an elite death once and skips it when spawning is unavailable', () => {
    const h = setup(0.9);
    h.system.update(1, 60);
    expect(h.system.getSnapshot().active.enemyId).toBe('event-elite');
    expect(h.system.notifyEnemyDeath({ enemyId: 'unrelated' })).toBe(false);
    expect(h.system.notifyEnemyDeath({ enemyId: 'event-elite', x: 1000, y: 500 })).toBe(true);
    expect(h.system.notifyEnemyDeath({ enemyId: 'event-elite' })).toBe(false);
    expect(h.rewards[0]).toMatchObject({ experience: 16, items: ['overclock'], x: 1000, y: 500 });
    const blocked = setup(0.9, false);
    blocked.system.update(1, 60);
    expect(blocked.system.getSnapshot()).toMatchObject({ active: null, skipped: 1 });
  });

  it('skips unsafe anchors, missed windows and does not backfill late events', () => {
    const h = setup();
    h.system.update(1, 60, [{ x: 1200, y: 675, radius: 10000 }]);
    expect(h.system.getSnapshot()).toMatchObject({ active: null, skipped: 1 });
    const late = setup();
    late.system.update(110, 110);
    expect(late.system.getSnapshot()).toMatchObject({ active: null, skipped: 1 });
    late.system.update(130, 240);
    expect(late.system.getSnapshot()).toMatchObject({ active: null, skipped: 2 });
  });

  it('expires without reward, freezes snapshots and resets its map state', () => {
    const h = setup();
    h.system.update(1, 60);
    const before = h.system.getSnapshot();
    expect(Object.isFrozen(before.active)).toBe(true);
    h.system.update(0, 60);
    expect(h.system.getSnapshot()).toEqual(before);
    h.system.update(35, 95);
    expect(h.system.getSnapshot()).toMatchObject({ active: null, failed: 1 });
    expect(h.rewards).toHaveLength(0);
    h.system.reset('east-city');
    expect(h.system.getSnapshot()).toMatchObject({ active: null, completed: 0, failed: 0, skipped: 0 });
  });

  it('allows an elite kill on the deadline and rejects it immediately after the deadline', () => {
    const exact = setup(0.9);
    exact.system.update(1, 60);
    expect(exact.system.notifyEnemyDeath({ enemyId: 'event-elite' }, 100)).toBe(true);
    const late = setup(0.9);
    late.system.update(1, 60);
    expect(late.system.notifyEnemyDeath({ enemyId: 'event-elite' }, 100.01)).toBe(false);
    expect(late.rewards).toHaveLength(0);
    expect(late.system.getSnapshot()).toMatchObject({ active: null, failed: 1 });
  });

  it('rejects an invalid event configuration before accepting gameplay state', () => {
    expect(() => new EncounterSystem({ player: new Player(), enemies: [], spawnElite: () => null,
      onReward: () => {}, config: { ...ENCOUNTER_CONFIG, transportSpeed: 0 } })).toThrow(RangeError);
  });
});

describe('RunRewardSystem', () => {
  it('delivers experience once and retries a supply reward when capacity returns', () => {
    const player = new Player();
    let full = true;
    const delivered = [];
    const supplies = { config: { rewards: ['shield'] }, addPickup: (...args) => {
      if (full) return false;
      delivered.push(args); return true;
    } };
    const rewards = new RunRewardSystem({ player, supplySystem: supplies });
    const reward = { id: 'event-1', experience: 12, items: ['shield'], x: 50, y: 60 };
    expect(rewards.grant(reward)).toBe(true);
    expect(rewards.grant(reward)).toBe(false);
    expect(player.exp).toBe(12);
    expect(rewards.getSnapshot().pendingItems).toBe(1);
    full = false;
    rewards.update();
    rewards.update();
    expect(delivered).toEqual([['shield', 50, 60]]);
    rewards.reset();
    expect(rewards.getSnapshot()).toEqual({ grantedCount: 0, pendingItems: 0 });
  });

  it('validates the whole reward before changing experience or the receipt ledger', () => {
    const player = new Player();
    const rewards = new RunRewardSystem({ player, supplySystem: { config: { rewards: ['shield'] }, addPickup: () => true } });
    expect(() => rewards.grant({ id: 'bad', experience: 3, items: ['unknown'], x: 0, y: 0 })).toThrow();
    expect(player.exp).toBe(0);
    expect(rewards.getSnapshot().grantedCount).toBe(0);
  });
});
