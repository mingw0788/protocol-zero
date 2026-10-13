import { describe, expect, it } from 'vitest';
import { SupplySystem } from '../src/systems/SupplySystem.js';
import { RelaySystem } from '../src/systems/RelaySystem.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';

function setup(random = () => 0) {
  const player = { x: 360, y: 360, radius: 16, alive: true };
  const system = new SupplySystem({ player, random });
  system.setEnabled(true);
  return { player, system };
}

describe('city supplies', () => {
  it('keeps a full-health medkit and heals once health is missing', () => {
    const { player, system } = setup();
    player.maxHp = 100; player.hp = 100;
    system.addPickup('medkit', player.x, player.y); system.update(.01, .01);
    expect(system.getSnapshot().pickups).toHaveLength(1);
    player.hp = 70; system.update(.01, .02);
    expect(player.hp).toBe(100);
    expect(system.getSnapshot().pickups).toHaveLength(0);
  });

  it('uses one active slot for EMP or relay cell and preserves a relay cell out of range', () => {
    const { player, system } = setup();
    const enemies = [{id:'near',x:player.x+100,y:player.y,radius:16,hp:100,alive:true},
      {id:'boss',x:player.x+100,y:player.y+15,radius:24,hp:100,alive:true,category:'boss'},
      {id:'far',x:player.x+400,y:player.y,radius:16,hp:100,alive:true}];
    const relaySystem = new RelaySystem({player,enemies,enemyDamageSystem:new EnemyDamageSystem()});
    relaySystem.setEnabled(true); player.x = 620; player.y = 360; relaySystem.update(2);
    system.setEffects({enemies,enemyDamageSystem:new EnemyDamageSystem(),relaySystem});
    system.addPickup('relay-cell',player.x,player.y); system.update(.01,.01);
    player.x = 1200; expect(system.deploy()).toBe(false);
    expect(system.getSnapshot().activeItem).toBe('relay-cell');
    player.x = 620; player.y = 360; expect(system.deploy()).toBe(true);
    expect(system.getSnapshot().activeItem).toBeNull();
    expect(relaySystem.getSnapshot()[0].energy).toBe(100);
    player.x = 360; player.y = 360;
    system.addPickup('emp-charge',player.x,player.y); system.update(.01,.02);
    expect(system.deploy()).toBe(true);
    expect(enemies.map(e=>e.hp)).toEqual([0,50,40]);
    expect(system.getSnapshot().pulse).toMatchObject({radius:220});
  });
  it('channels only time after appearance, pauses outside radius, and gives one reward', () => {
    const { player, system } = setup();
    system.update(45, 45);
    expect(system.getSnapshot().station.progress).toBe(0);
    system.update(1, 46);
    expect(system.getSnapshot().station.progress).toBeCloseTo(2 / 3);
    player.x = 500;
    system.update(1, 47);
    expect(system.getSnapshot().station.progress).toBeCloseTo(2 / 3);
    player.x = 360;
    system.update(.5, 47.5);
    expect(system.getSnapshot().station).toBeNull();
    expect(system.fireRateMultiplier).toBe(1.3);
    system.update(8, 55.5);
    expect(system.fireRateMultiplier).toBe(1);
    expect(system.getSnapshot().pickups).toHaveLength(0);
    system.update(1, 56.5);
    expect(system.getSnapshot().station).toBeNull();
  });

  it('skips missed windows and starts later stations without accumulated charging', () => {
    const { player, system } = setup();
    system.update(100, 100);
    expect(system.getSnapshot().station).toBeNull();
    player.x = 2040;
    system.update(35, 135);
    expect(system.getSnapshot().station).toMatchObject({ x: 2040, progress: 0 });
    system.update(25, 160);
    expect(system.getSnapshot().station).toBeNull();
  });

  it('refreshes battery, caps scanner and preserves pickups that cannot fit', () => {
    const { player, system } = setup();
    system.addPickup('overclock', player.x, player.y);
    system.update(.1, .1);
    system.update(7, 7.1);
    system.addPickup('overclock', player.x, player.y);
    system.update(.1, 7.2);
    expect(system.getSnapshot().overclockRemaining).toBe(8);
    for (let i = 0; i < 4; i++) system.addPickup('scanner', player.x, player.y);
    system.update(.1, 7.3);
    expect(system.pickupRadiusBonus).toBe(24);
    expect(system.getSnapshot().pickups).toHaveLength(1);
    system.update(60, 67.3);
    expect(system.getSnapshot().pickups).toHaveLength(0);
  });

  it('carries one charge, preserves overflow, deploys one beacon and excludes Boss', () => {
    const { player, system } = setup();
    system.addPickup('decoy', player.x, player.y);
    system.addPickup('decoy', player.x, player.y);
    system.update(.1, .1);
    expect(system.getSnapshot().pickups).toHaveLength(1);
    expect(system.deploy()).toBe(true);
    expect(system.deploy()).toBe(false);
    expect(system.targetFor({ x: 780, y: 360, category: 'normal' })).toMatchObject({ x: 360 });
    expect(system.targetFor({ x: 781, y: 360, category: 'normal' })).toBeNull();
    expect(system.targetFor({ x: 360, y: 360, category: 'boss' })).toBeNull();
    system.update(5, 5.1);
    expect(system.getSnapshot().decoy).toBeNull();
    expect(system.getSnapshot().activeItem).toBe('decoy');
    system.reset();
    expect(system.getSnapshot()).toMatchObject({ activeItem: null, scannerStacks: 0, overclockRemaining: 0, station: null, pickups: [] });
  });

  it.each([[0, 'overclock'], [.13, 'decoy'], [.26, 'scanner'], [.38, 'medkit'], [.51, 'emp-charge'], [.63, 'relay-cell'], [.76, 'shield'], [.99, 'magnet']])('uses independent equal reward weights at %s', (sample, type) => {
    const { system, player } = setup(() => sample);
    player.x += 50; // Channel radius includes this point, pickup radius does not.
    system.update(45, 45);
    system.update(1.5, 46.5);
    expect(system.getSnapshot().pickups[0].type).toBe(type);
  });

  it('validates time, reward types and random values; lab has no stations', () => {
    const { system } = setup(() => NaN);
    expect(() => system.update(-1, 0)).toThrow();
    expect(() => system.addPickup('invalid', 0, 0)).toThrow();
    system.update(45, 45);
    expect(() => system.update(1.5, 46.5)).toThrow();
    system.setEnabled(false);
    system.update(45, 45);
    expect(system.getSnapshot().station).toBeNull();
  });
});
