import { describe, it, expect } from 'vitest';
import { RelaySystem } from '../src/systems/RelaySystem.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { Player } from '../src/entities/Player.js';

function setup() {
  const player = new Player();
  const enemies = [{ id: 'a', x: 620, y: 360, radius: 16, hp: 100, alive: true },
    { id: 'b', x: 620, y: 360, radius: 32, hp: 100, alive: true, category: 'boss' },
    { id: 'c', x: 900, y: 360, radius: 16, hp: 100, alive: true }];
  const system = new RelaySystem({ player, enemies, enemyDamageSystem: new EnemyDamageSystem() });
  system.setEnabled(true);
  player.x = 620; player.y = 360; player.hp = player.maxHp - 5;
  return { player, enemies, system };
}

describe('City relay', () => {
  it('charges only in range, heals to cap and applies a single bounded pulse', () => {
    const { player, enemies, system } = setup();
    system.update(1);
    player.x = 900;
    system.update(5);
    expect(system.getSnapshot()[0].progress).toBe(.5);
    player.x = 620;
    expect(system.update(1)).toBe(1);
    expect(player.hp).toBe(player.maxHp);
    expect(enemies.map(e => e.hp)).toEqual([40, 70, 100]);
    system.update(5);
    expect(enemies[0].hp).toBe(40);
    expect(system.getSnapshot()[0].used).toBe(true);
  });
  it('does not resurrect and resets all charges when disabled or restarted', () => {
    const { player, system } = setup();
    player.alive = false; player.hp = 0;
    system.update(3);
    expect(player.hp).toBe(0);
    expect(system.getSnapshot()[0].progress).toBe(0);
    player.alive = true; player.hp = 50;
    system.update(1);
    system.update(0);
    expect(system.getSnapshot()[0].progress).toBe(.5);
    system.reset();
    expect(system.getSnapshot()[0].progress).toBe(0);
    system.setEnabled(false);
    expect(system.getSnapshot()).toEqual([]);
  });

  it('recharges from nearby kills and once from an in-range relay cell', () => {
    const { system, player } = setup();
    player.x = 620; player.y = 360;
    expect(system.notifyEnemyDeath({x:620,y:360})).toBe(0);
    expect(system.getSnapshot()[0].energy).toBe(100);
    system.update(2);
    expect(system.getSnapshot()[0].energy).toBe(0);
    expect(system.getSnapshot()[0].progress).toBe(0);
    expect(system.notifyEnemyDeath({x:800,y:360})).toBe(1);
    expect(system.getSnapshot()[0].energy).toBe(25);
    expect(system.rechargeNearest(1300,360)).toBe(false);
    for (let i=0;i<3;i++) system.notifyEnemyDeath({x:620,y:360});
    expect(system.getSnapshot()[0].energy).toBe(100);
    expect(system.getSnapshot()[0].progress).toBe(0);
    expect(system.update(1)).toBe(0);
    expect(system.getSnapshot()[0].energy).toBe(100);
    expect(system.update(1)).toBe(1);
    expect(system.getSnapshot()[0].energy).toBe(0);
    expect(system.rechargeNearest(620,360)).toBe(true);
    expect(system.getSnapshot()[0].energy).toBe(100);
    expect(system.getSnapshot()[0].progress).toBe(0);
    expect(system.update(1)).toBe(0);
    expect(system.getSnapshot()[0].energy).toBe(100);
    expect(system.update(1)).toBe(1);
    expect(system.getSnapshot()[0].energy).toBe(0);
    system.notifyEnemyDeath({x:620,y:360});
    expect(system.getSnapshot()[0].energy).toBe(25);
  });
});
