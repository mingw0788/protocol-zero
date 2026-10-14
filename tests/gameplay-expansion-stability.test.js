import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { UPGRADE_CONFIG } from '../src/config/upgradeConfig.js';
import { getExperienceToNextLevel } from '../src/systems/LevelSystem.js';

function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function createWorld() {
  return new GameWorld({ camera: new Camera(), random: random(10), upgradeRandom: random(20),
    supplyRandom: random(30), encounterRandom: random(40), encounterRewardRandom: random(50), layoutRandom: random(60) });
}

function selectUpgrade(world, id) {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const card = world.upgradeSystem.prepareChoices().find(choice => choice.id === id);
    if (!card) continue;
    const selection = world.upgradeSystem.select(id);
    world.upgradeEffectSystem.applySelection(selection);
    return;
  }
  throw new Error(`Expected upgrade ${id} did not become available`);
}

function choosePendingLevel(world) {
  for (let guard = 0; world.stateManager.currentState === 'LEVEL_UP' && guard < 1000; guard++) {
    const choice = world.getUpgradeChoices()[0];
    expect(choice).toBeDefined();
    expect(world.chooseUpgrade(choice.id)).toBe(true);
  }
  expect(world.stateManager.currentState).not.toBe('LEVEL_UP');
}

describe('gameplay expansion long-run stability', () => {
  it('holds a 20-minute fixed-step endless session within entity caps and fully resets ten times', () => {
    const world = createWorld();
    expect(world.setMap('energy-hub')).toBe(true);
    expect(world.setProtocol('guard')).toBe(true);
    expect(world.setChallenge('pressure')).toBe(true);
    world.reset();
    world.stateManager.startGame();

    for (const upgrade of UPGRADE_CONFIG) {
      for (let level = 0; level < upgrade.maxLevel; level++) selectUpgrade(world, upgrade.id);
    }
    world.supplySystem.addPickup('scanner', world.player.x, world.player.y);
    world.supplySystem.update(1 / 60, 1 / 60);
    for (const evolution of ['EV-01', 'EV-02', 'EV-03', 'EV-04']) selectUpgrade(world, evolution);

    // Start the long pressure phase at a controlled, normally won five-minute boundary.
    // Damage, enemy health, fixed steps, experience, and all subsequent timers use production rules.
    world.clock.advance(300);
    world.bossSystem.update(1 / 60, 300);
    const boss = world.enemies.find(enemy => enemy.category === 'boss');
    expect(boss).toBeDefined();
    world.enemyDamageSystem.applyDamage(boss, boss.hp, 'pulse-gun');
    world.update(1 / 60);
    expect(world.stateManager.currentState).toBe('VICTORY');
    expect(world.continueEndless()).toBe(true);
    choosePendingLevel(world);
    expect(world.getExpansionSnapshot().endless.active).toBe(true);
    const longRunStartSeconds = world.clock.elapsedSeconds;

    let maximumNormalEnemies = 0;
    let maximumCrystals = 0;
    let maximumProjectiles = 0;
    let maximumHostileProjectiles = 0;
    const snapshots = [];
    for (let step = 0; step < 20 * 60 * 60; step++) {
      // A QA-only survival guard keeps the session observable while leaving combat math untouched.
      world.player.invulnerabilityRemaining = 1;
      world.update(1 / 60);
      choosePendingLevel(world);
      if (world.stateManager.currentState === 'VICTORY') {
        expect(world.continueEndless()).toBe(true);
        choosePendingLevel(world);
      }
      maximumNormalEnemies = Math.max(maximumNormalEnemies, world.enemies.filter(enemy => enemy.category === 'normal' && enemy.alive).length);
      maximumCrystals = Math.max(maximumCrystals, world.experienceCrystals.length);
      const expansion = world.getExpansionSnapshot();
      maximumProjectiles = Math.max(maximumProjectiles, world.projectiles.length + expansion.drones.bolts.length);
      maximumHostileProjectiles = Math.max(maximumHostileProjectiles, expansion.hostileAttacks.projectiles.length);
      if ((step + 1) % (5 * 60 * 60) === 0) snapshots.push({ seconds: (step + 1) / 60,
        state: world.stateManager.currentState, kills: world.killCount, level: world.player.level,
        normalEnemies: world.enemies.filter(enemy => enemy.category === 'normal' && enemy.alive).length,
        crystals: world.experienceCrystals.length, activeSlots: [...expansion.supply.activeItems] });
    }
    expect(world.clock.elapsedSeconds - longRunStartSeconds).toBeCloseTo(1200, 7);
    expect(world.stateManager.currentState).toBe('PLAYING');
    expect(world.getExpansionSnapshot().endless.elapsedSeconds).toBeCloseTo(1200, 7);
    expect(maximumNormalEnemies).toBeLessThanOrEqual(100);
    expect(maximumCrystals).toBeLessThan(600);
    expect(maximumProjectiles).toBeLessThanOrEqual(128 + 24);
    expect(maximumHostileProjectiles).toBeLessThanOrEqual(64);

    const deathEvents = [];
    world.subscribeEnemyDeath(event => deathEvents.push(event.enemyId));
    const resetRuns = [];
    for (let run = 0; run < 10; run++) {
      const endless = world.getExpansionSnapshot().endless;
      expect(world.stateManager.pause()).toBe(true);
      if (endless.active) {
        expect(endless.elapsedSeconds).toBeGreaterThanOrEqual(1200);
        expect(world.endEndless()).toBe(true);
      } else {
        expect(world.stateManager.currentState).toBe('PAUSED');
      }
      world.reset();
      const expansion = world.getExpansionSnapshot();
      expect(world.clock.elapsedSeconds).toBe(0);
      expect(world.killCount).toBe(0);
      expect(world.simulationSteps).toBe(0);
      expect(world.player).toMatchObject({ hp: 120, maxHp: 120, level: 1, exp: 0, shield: 15, alive: true });
      expect(world.enemies).toHaveLength(0);
      expect(world.projectiles).toHaveLength(0);
      expect(world.experienceCrystals).toHaveLength(0);
      expect(expansion.drones.bolts).toHaveLength(0);
      expect(expansion.railFields).toHaveLength(0);
      expect(expansion.hostileAttacks.projectiles).toHaveLength(0);
      expect(expansion.deployables.turrets).toHaveLength(0);
      expect(expansion.deployables.healingFields).toHaveLength(0);
      expect(expansion.damageNumbers).toHaveLength(0);
      expect(expansion.endless.active).toBe(false);
      expect(expansion.supply.activeItems).toEqual([null, null]);
      expect(expansion.upgrades.every(item => item.level === 0)).toBe(true);
      expect(world.spawnSystem.elapsedSeconds).toBe(0);
      expect(world.combatStatsSystem.getSnapshot()).toMatchObject({ totalDamageDealt: 0, totalKills: 0, normalKills: 0, bossKills: 0,
        damageBySource: [], killsBySource: [], incomingDamageByType: [] });
      expect(world.stateManager.returnToMenu()).toBe(true);
      expect(world.stateManager.startGame()).toBe(true);
      const victim = new Enemy({ id: `reset-death-${run}`, x: world.player.x + 300, y: world.player.y, config: ENEMY_CONFIG.EN01 });
      world.enemies.push(victim);
      world.enemyDamageSystem.applyDamage(victim, victim.hp, 'pulse-gun');
      world.update(1 / 60);
      expect(deathEvents).toHaveLength(run + 1);
      resetRuns.push({ run: run + 1, deathEvents: deathEvents.length, state: world.stateManager.currentState });
    }

    expect(snapshots.map(sample => sample.seconds)).toEqual([300, 600, 900, 1200]);
    expect(snapshots.at(-1)).toMatchObject({ state: 'PLAYING', seconds: 1200 });
    expect(resetRuns.map(sample => sample.run)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(getExperienceToNextLevel(world.player.level)).toBeGreaterThan(0);
  }, 120000);
});
