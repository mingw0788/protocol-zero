import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { SpawnSystem } from '../src/systems/SpawnSystem.js';
import { ENCOUNTER_CONFIG } from '../src/config/encounterConfig.js';

describe('encounters in the real world', () => {
  it('freezes events on pause, sends experience into the upgrade queue, and resets', () => {
    const world = new GameWorld({ camera: new Camera(), encounterRandom: () => 0 });
    world.spawnSystem.update = () => 0;
    world.stateManager.startGame();
    world.clock.advance(60 - 1 / 60);
    world.update(1 / 60);
    const node = world.getExpansionSnapshot().encounters.active;
    expect(node.type).toBe('defense');
    expect(world.getExpansionSnapshot().trackedObjective.kind).toBe('event');
    Object.assign(world.player, { x: node.x, y: node.y });
    world.stateManager.pause();
    const frozen = world.getExpansionSnapshot().encounters;
    world.update(10);
    expect(world.getExpansionSnapshot().encounters).toEqual(frozen);
    world.stateManager.resume();
    for (let step = 0; step < 900; step++) world.update(1 / 60);
    expect(world.stateManager.currentState).toBe('LEVEL_UP');
    expect(world.getExpansionSnapshot().encounters.completed).toBe(1);
    expect(world.player.level).toBe(2);
    expect(world.levelSystem.pendingLevelUps).toBe(1);
    world.chooseUpgrade(world.getUpgradeChoices()[0].id);
    world.reset();
    expect(world.getExpansionSnapshot().encounters).toMatchObject({ active: null, completed: 0, failed: 0 });
    expect(world.rewardSystem.getSnapshot().grantedCount).toBe(0);
  });

  it('cycles tracked objectives without changing progress or rewards', () => {
    const world = new GameWorld({ camera: new Camera(), encounterRandom: () => 0 });
    const before = world.getExpansionSnapshot().trackedObjective;
    world.cycleObjective();
    const after = world.getExpansionSnapshot().trackedObjective;
    expect(after.id).not.toBe(before.id);
    expect(world.player.exp).toBe(0);
  });

  it('spawns at most one event elite outside the viewport and observes the enemy cap', () => {
    const camera = new Camera();
    const enemies = [];
    const player = { x: 1200, y: 675, radius: 16 };
    const system = new SpawnSystem({ camera, enemies, player });
    const options = { x: 2200, y: 1100, config: ENCOUNTER_CONFIG.elite, encounterId: 'event-1' };
    const elite = system.spawnEncounterElite(options);
    expect(elite).toMatchObject({ elite: true, category: 'normal', hp: 160 });
    expect(system.spawnEncounterElite(options)).toBeNull();
    enemies.length = 0;
    for (let i = 0; i < 100; i++) enemies.push({ id: `enemy-${i}`, alive: true, hp: 1, category: 'normal' });
    expect(system.spawnEncounterElite(options)).toBeNull();
    enemies.length = 0;
    expect(system.spawnEncounterElite({ ...options, x: 1000, y: 500 })).toBeNull();
  });
});
