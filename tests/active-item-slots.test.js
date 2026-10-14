import { describe, expect, it } from 'vitest';
import { SupplySystem } from '../src/systems/SupplySystem.js';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';

function setup() {
  const player = new Player();
  const enemies = [];
  const relayCalls = [];
  const system = new SupplySystem({ player, random: () => 0.5 });
  system.setEnabled(true);
  system.setEffects({
    enemies,
    enemyDamageSystem: new EnemyDamageSystem(),
    relaySystem: { rechargeNearest: (...args) => { relayCalls.push(args); return false; } },
  });
  return { enemies, player, relayCalls, system };
}

describe('two active item slots', () => {
  it('fills the first empty slot and preserves further active pickups while full', () => {
    const { player, system } = setup();
    for (const type of ['decoy', 'emp-charge', 'relay-cell']) system.addPickup(type, player.x, player.y);
    system.update(1 / 60, 1 / 60);
    expect(system.getSnapshot()).toMatchObject({ activeItems: ['decoy', 'emp-charge'], selectedSlot: 0 });
    expect(system.getSnapshot().activeItem).toBe('decoy');
    expect(system.getSnapshot().pickups.map(({ type }) => type)).toEqual(['relay-cell']);
  });

  it('uses the requested slot and leaves other active slot contents intact', () => {
    const { enemies, player, system } = setup();
    system.addPickup('decoy', player.x, player.y);
    system.addPickup('emp-charge', player.x, player.y);
    system.update(1 / 60, 1 / 60);
    const enemy = new Enemy({ id: 'emp-target', x: player.x + 60, y: player.y });
    enemies.push(enemy);
    expect(system.deploy(1)).toBe(true);
    expect(enemy.hp).toBe(0);
    expect(system.getSnapshot().activeItems).toEqual(['decoy', null]);
    expect(system.getSnapshot().selectedSlot).toBe(1);
    expect(system.deploy(0)).toBe(true);
    expect(system.getSnapshot().decoy).not.toBeNull();
    expect(system.getSnapshot().activeItems).toEqual([null, null]);
  });

  it('exchanges the selected slot with the nearest pickup atomically', () => {
    const { player, system } = setup();
    system.addPickup('decoy', player.x, player.y);
    system.addPickup('emp-charge', player.x, player.y);
    system.update(1 / 60, 1 / 60);
    system.selectSlot(1);
    const x = player.x + 40;
    system.addPickup('relay-cell', x, player.y);
    system.addPickup('shield', player.x + 50, player.y);
    expect(system.exchangeNearby()).toBe(true);
    expect(system.getSnapshot().activeItems).toEqual(['decoy', 'relay-cell']);
    expect(system.getSnapshot().pickups).toHaveLength(2);
    expect(system.getSnapshot().pickups[0]).toMatchObject({ type: 'emp-charge', x, remaining: 60 });
    expect(system.getSnapshot().pickups[1].type).toBe('shield');
  });

  it('picks an item into an empty selected slot, uses stable ties, and preserves out-of-range items', () => {
    const { player, system } = setup();
    system.selectSlot(1);
    system.addPickup('emp-charge', player.x + 65, player.y);
    system.addPickup('relay-cell', player.x + 50, player.y);
    system.addPickup('decoy', player.x + 50, player.y);
    expect(system.exchangeNearby()).toBe(true);
    expect(system.getSnapshot().activeItems).toEqual([null, 'relay-cell']);
    expect(system.getSnapshot().pickups.map(({ type }) => type).sort()).toEqual(['decoy', 'emp-charge']);
    player.x += 150;
    system.selectSlot(0);
    expect(system.exchangeNearby()).toBe(false);
    expect(system.getSnapshot().activeItems).toEqual([null, 'relay-cell']);
    expect(system.getSnapshot().pickups).toHaveLength(2);
    expect(system.getSnapshot().notices.length).toBeGreaterThan(0);
  });

  it('preserves a relay cell in its own slot when there is no usable relay', () => {
    const { player, relayCalls, system } = setup();
    system.addPickup('relay-cell', player.x, player.y);
    system.update(1 / 60, 1 / 60);
    expect(system.deploy(0)).toBe(false);
    expect(system.getSnapshot().activeItems).toEqual(['relay-cell', null]);
    expect(relayCalls).toHaveLength(1);
    expect(system.getSnapshot().notices.map(({ text }) => text).join('')).toContain('电芯未消耗');
  });

  it('accepts the exact exchange radius and rejects a pickup just outside it', () => {
    const { player, system } = setup();
    system.addPickup('decoy', player.x + 64, player.y);
    expect(system.exchangeNearby()).toBe(true);
    expect(system.getSnapshot().activeItems).toEqual(['decoy', null]);
    system.addPickup('emp-charge', player.x + 64.01, player.y);
    expect(system.exchangeNearby()).toBe(false);
    expect(system.getSnapshot().pickups[0].type).toBe('emp-charge');
  });

  it('clears both slots and selection on reset', () => {
    const { player, system } = setup();
    system.addPickup('decoy', player.x, player.y);
    system.addPickup('emp-charge', player.x, player.y);
    system.update(1 / 60, 1 / 60);
    system.selectSlot(1);
    system.reset();
    expect(system.getSnapshot()).toMatchObject({ activeItems: [null, null], activeItem: null, selectedSlot: 0 });
  });
});
