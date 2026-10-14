import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { SpawnSystem } from '../src/systems/SpawnSystem.js';
import { ENCOUNTER_CONFIG } from '../src/config/encounterConfig.js';

const create = () => {
  const world = new GameWorld({ camera: new Camera() });
  world.spawnSystem.update = () => 0; world.weaponSystem.update = () => 0;
  world.stateManager.startGame(); return world;
};

describe('tactical enemy world integration', () => {
  it('applies a bomber hit through the shared damage system and gives no self-destruction rewards', () => {
    const world = create();
    world.enemies.push(new Enemy({ id: 'bomber', x: world.player.x + 70, y: world.player.y, config: ENEMY_CONFIG.EN05 }));
    for (let step = 0; step <= 60; step++) world.update(1 / 60);
    expect(world.player.hp).toBe(78);
    expect(world.killCount).toBe(0);
    expect(world.experienceCrystals).toHaveLength(0);
    expect(world.getCombatStatsSnapshot().incomingDamageByType).toEqual([{ typeId: 'EN-05', damage: 22 }]);
  });

  it('freezes warnings on pause and clears all hostile attacks on restart', () => {
    const world = create();
    world.enemies.push(new Enemy({ id: 'sniper', x: world.player.x + 300, y: world.player.y, config: ENEMY_CONFIG.EN04 }));
    world.update(1 / 60);
    const before = world.getExpansionSnapshot().hostileAttacks;
    expect(before.aims).toHaveLength(1);
    world.stateManager.pause(); world.update(10);
    expect(world.getExpansionSnapshot().hostileAttacks).toEqual(before);
    world.reset();
    expect(world.getExpansionSnapshot().hostileAttacks).toEqual({ aims: [], fuses: [], projectiles: [], explosions: [] });
  });

  it('shares the single elite cap with the event guard and substitutes a normal spawn', () => {
    const enemies = [], player = { x: 1200, y: 675, radius: 16 };
    const spawn = new SpawnSystem({ enemies, player, camera: new Camera(), random: () => 0.5 });
    spawn.update(2, { phaseId: 'elite-test', spawnIntervalSeconds: 1, enemyWeights: { 'EN-06': 1 } });
    expect(enemies.filter(enemy => enemy.elite)).toHaveLength(1);
    expect(enemies.some(enemy => enemy.typeId === 'EN-01')).toBe(true);
    expect(spawn.spawnEncounterElite({ x: 2200, y: 1100, config: ENCOUNTER_CONFIG.elite })).toBeNull();
  });
});
