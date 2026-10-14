import { describe, expect, it } from 'vitest';
import { HazardSystem } from '../src/systems/HazardSystem.js';
import { HAZARD_CONFIG } from '../src/config/hazardConfig.js';
import { Player } from '../src/entities/Player.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { RelaySystem } from '../src/systems/RelaySystem.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';

describe('barrels and electrical hazards', () => {
  it('limits a chain to four barrels, damages only enemies and retains the remaining barrels', () => {
    const player = new Player();
    const enemies = [
      { id: 'normal', typeId: 'EN-01', x: 200, y: 200, radius: 16, hp: 1000, alive: true, category: 'normal' },
      { id: 'boss', typeId: 'BOSS-01', x: 200, y: 200, radius: 44, hp: 1000, alive: true, category: 'boss' },
    ];
    const events = [];
    const system = new HazardSystem({ player, enemies, enemyDamageSystem: new EnemyDamageSystem({ onDamage: event => events.push(event) }),
      config: { ...HAZARD_CONFIG, barrels: { laboratory: Array.from({ length: 6 }, (_, index) => ({ id: `b-${index}`, x: 200 + index * 5, y: 200 })) } } });
    system.reset('laboratory');
    expect(system.damageBarrel('b-0', 20)).toBe(true);
    expect(system.getSnapshot().barrels.filter(barrel => barrel.alive)).toHaveLength(2);
    expect(enemies.map(enemy => enemy.hp)).toEqual([760, 880]);
    expect(player.hp).toBe(100);
    expect(events.every(event => event.sourceId === 'capacitor-barrel')).toBe(true);
    expect(system.damageBarrel('b-0', 20)).toBe(false);
  });

  it('warns before electrical damage, leaves safe corridors and disables a zone for this run', () => {
    const player = new Player();
    const system = new HazardSystem({ player, enemies: [], enemyDamageSystem: new EnemyDamageSystem() });
    system.reset('energy-hub');
    const zone = system.getSnapshot().zones[0];
    Object.assign(player, { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 });
    expect(system.update(1 / 60, .5)).toEqual([]);
    expect(system.getSnapshot().zones[0].phase).toBe('warning');
    expect(system.update(1 / 60, 1)).toEqual([{ damage: 10, sourceTypeId: 'hazard:arc' }]);
    for (let time = 1; time <= 18; time += .25) {
      system.update(.25, time);
      expect(system.getSnapshot().zones.filter(item => item.phase === 'active').length).toBeLessThanOrEqual(1);
    }
    expect(system.disableZone(zone.id)).toBe(true);
    expect(system.update(1 / 60, 1)).toEqual([]);
    system.reset('laboratory');
    expect(system.getSnapshot().zones).toEqual([]);
  });

  it('finishes a barrel destruction even if a presentation observer fails', () => {
    const system = new HazardSystem({ player: new Player(), enemies: [], enemyDamageSystem: new EnemyDamageSystem(),
      onBlast: () => { throw new Error('audio unavailable'); } });
    const barrel = system.getAttackTargets()[0];
    expect(() => system.damageBarrel(barrel.id, 20)).not.toThrow();
    expect(system.getSnapshot().barrels.find(item => item.id === barrel.id).alive).toBe(false);
  });
});

describe('relay specialties', () => {
  it('uses the power relay for temporary damage without healing and refreshes instead of stacking', () => {
    const player = new Player(); player.hp = 50; player.x = 1780; player.y = 360;
    const relay = new RelaySystem({ player, enemies: [], enemyDamageSystem: new EnemyDamageSystem() });
    relay.setEnabled(true);
    expect(relay.update(2)).toBe(1);
    expect(player.hp).toBe(50);
    expect(relay.damageMultiplier).toBe(1.25);
    relay.rechargeNearest(player.x, player.y); relay.update(2);
    expect(relay.damageMultiplier).toBe(1.25);
    expect(relay.getBuffSnapshot().remaining).toBe(10);
    player.x = 1200; player.y = 675; relay.update(10);
    expect(relay.damageMultiplier).toBe(1);
  });
});

describe('real world object combat', () => {
  it('fires at a barrel in an empty battlefield without awarding enemy kills or XP', () => {
    const world = new GameWorld({ camera: new Camera() });
    world.spawnSystem.update = () => 0;
    world.stateManager.startGame();
    const barrel = world.hazardSystem.getAttackTargets()[0];
    Object.assign(world.player, { x: barrel.x - 100, y: barrel.y });
    for (let i = 0; i < 30; i++) world.update(1 / 60);
    expect(world.hazardSystem.getSnapshot().barrels.find(item => item.id === barrel.id).alive).toBe(false);
    expect(world.killCount).toBe(0);
    expect(world.player.exp).toBe(0);
    expect(world.experienceCrystals).toHaveLength(0);
  });

  it('prioritizes a legal enemy over a closer barrel', () => {
    const world = new GameWorld({ camera: new Camera() }); world.spawnSystem.update = () => 0;
    world.stateManager.startGame();
    const barrel = world.hazardSystem.getAttackTargets()[0];
    Object.assign(world.player, { x: barrel.x - 100, y: barrel.y });
    world.enemies.push(new Enemy({ id: 'preferred', x: world.player.x, y: world.player.y + 200 }));
    world.update(1 / 60);
    expect(world.projectiles[0].vx).toBe(0);
    expect(world.projectiles[0].vy).toBe(500);
    expect(world.hazardSystem.getSnapshot().barrels.find(item => item.id === barrel.id).hp).toBe(20);
  });

  it('applies the relay damage multiplier to real shots, freezes it and clears it on reset', () => {
    const world = new GameWorld({ camera: new Camera() }); world.spawnSystem.update = () => 0;
    world.setMap('east-city'); world.stateManager.startGame();
    Object.assign(world.player, { x: 1780, y: 360, hp: 50 });
    world.relaySystem.update(2);
    world.enemies.push(new Enemy({ id: 'firepower-target', x: 1980, y: 360 }));
    world.update(1 / 60);
    expect(world.projectiles[0].damage).toBe(25);
    expect(world.player.hp).toBe(50);
    world.stateManager.pause();
    const before = world.getExpansionSnapshot(); world.update(5);
    expect(world.getExpansionSnapshot()).toEqual(before);
    world.reset();
    expect(world.relaySystem.damageMultiplier).toBe(1);
    expect(world.hazardSystem.getSnapshot().barrels.every(item => item.alive)).toBe(true);
  });
});
