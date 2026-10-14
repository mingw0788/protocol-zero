import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { getExperienceToNextLevel } from '../src/systems/LevelSystem.js';

function create(options = {}) {
  const world = new GameWorld({ camera: new Camera(), upgradeRandom: () => 0 });
  expect(world.configureExpedition).toBeTypeOf('function');
  expect(world.configureExpedition(options)).toBe(true);
  world.reset(); world.spawnSystem.update = () => 0; world.stateManager.startGame();
  return world;
}
function clear(world) {
  const stage = world.getExpeditionSnapshot().stage;
  world.clock.advance(stage.durationSeconds - world.clock.elapsedSeconds);
  world.bossSystem.update(1 / 60, stage.durationSeconds);
  world.enemyDamageSystem.applyDamage(world.enemies.find(e => e.category === 'boss'), 100000);
  world.update(1 / 60);
}
describe('three-stage expedition', () => {
  it('runs ordered stages, requires both Boss death and time, and ends only after level three', () => {
    const w = create({ journeyId: 'campaign' });
    w.clock.advance(150); w.bossSystem.update(1 / 60, 150);
    expect(w.getBossSnapshot().maxHp).toBe(1200);
    w.enemyDamageSystem.applyDamage(w.enemies.find(e => e.category === 'boss'), 10000);
    w.update(1 / 60); expect(w.stateManager.currentState).toBe('PLAYING');
    clear(w); expect(w.getRunResultSnapshot()).toMatchObject({ intermission: true, outcome: 'victory' });
    expect(w.continueEndless()).toBe(false);
    expect(w.advanceCampaign('reactor')).toBe(true);
    expect(w.mapConfig.id).toBe('east-city'); expect(w.advanceCampaign('armor')).toBe(false);
    clear(w); expect(w.advanceCampaign('armor')).toBe(true);
    expect(w.mapConfig.id).toBe('energy-hub');
    w.clock.advance(210); w.bossSystem.update(1 / 60, 210);
    expect(w.getBossSnapshot()).toMatchObject({ typeId: 'BOSS-02', maxHp: 2800 });
    clear(w);
    expect(w.getRunResultSnapshot()).toMatchObject({ intermission: false, outcome: 'victory', expedition: { completed: 3, stageCount: 3 } });
    expect(w.getRunResultSnapshot().elapsedSeconds).toBeCloseTo(600.05, 4);
    expect(w.advanceCampaign('mobility')).toBe(false);
  });
  it('preserves build, XP, slots and counters while clearing stage-local objects', () => {
    const w = create({ journeyId: 'campaign' });
    w.upgradeSystem.prepareChoices(); w.upgradeEffectSystem.applySelection(w.upgradeSystem.select('UP-01'));
    w.player.level = 8; w.player.exp = 7;
    w.supplySystem.addPickup('emp-charge', w.player.x, w.player.y); w.supplySystem.addPickup('scanner', w.player.x, w.player.y);
    w.supplySystem.update(.01, .01); clear(w);
    w.player.hp = 50; w.player.shield = 9;
    const kills = w.killCount; const stats = w.getCombatStatsSnapshot().totalDamageDealt;
    expect(w.advanceCampaign('armor')).toBe(true);
    expect(w.player).toMatchObject({ level: 8, exp: 7, hp: 85, maxHp: 115, shield: 9 });
    expect(w.upgradeSystem.getLevel('UP-01')).toBe(1);
    expect(w.supplySystem.getSnapshot()).toMatchObject({ activeItems: ['emp-charge', null], scannerStacks: 1, pickups: [] });
    expect(w.killCount).toBe(kills); expect(w.getCombatStatsSnapshot().totalDamageDealt).toBe(stats);
    expect(w.enemies).toHaveLength(0); expect(w.projectiles).toHaveLength(0); expect(w.experienceCrystals).toHaveLength(0);
    expect(w.clock.elapsedSeconds).toBe(0); expect(w.getBossSnapshot()).toBeNull();
  });
  it('processes pending upgrades on next-stage entry and cannot change setup in combat', () => {
    const w = create({ journeyId: 'campaign' });
    w.player.exp = getExperienceToNextLevel(w.player.level);
    clear(w); expect(w.levelSystem.pendingLevelUps).toBe(1);
    expect(w.configureExpedition({ difficultyId: 'nightmare' })).toBe(false);
    expect(w.advanceCampaign('mobility')).toBe(true);
    expect(w.stateManager.currentState).toBe('LEVEL_UP');
    expect(w.chooseUpgrade(w.getUpgradeChoices()[0].id)).toBe(true);
    expect(w.stateManager.currentState).toBe('PLAYING');
  });
  it('prioritizes player death on a clear frame and restarts the whole route without duplicate rewards', () => {
    const w = create({ journeyId: 'campaign' });
    clear(w); w.advanceCampaign('reactor');
    const stage = w.getExpeditionSnapshot().stage;
    w.clock.advance(stage.durationSeconds); w.bossSystem.update(1 / 60, stage.durationSeconds);
    w.enemyDamageSystem.applyDamage(w.enemies.find(e => e.category === 'boss'), 10000);
    w.player.hp = 1;
    w.enemies.push(new Enemy({ id: 'contact', x: w.player.x, y: w.player.y, config: ENEMY_CONFIG.EN01 }));
    w.update(1 / 60);
    expect(w.getRunResultSnapshot()).toMatchObject({ outcome: 'defeat', intermission: false, expedition: { completed: 1 } });
    w.reset(); w.stateManager.restartRun();
    expect(w.mapConfig.id).toBe('laboratory'); expect(w.player.level).toBe(1);
    expect(w.getExpeditionSnapshot()).toMatchObject({ completed: 0, modules: [null, null] });
  });
  it('scales enemies and all damage candidates without changing the default single-map Boss', () => {
    const normal = create(); expect(normal.getWaveSnapshot().hpMultiplier ?? 1).toBe(1);
    normal.clock.advance(270); normal.bossSystem.update(1 / 60, 270); expect(normal.getBossSnapshot().maxHp).toBe(1800);
    const w = create({ difficultyId: 'nightmare' });
    expect(w.getWaveSnapshot()).toMatchObject({ hpMultiplier: 1.6, spawnIntervalSeconds: .8 });
    w.enemyAttackSystem.update = () => [{ damage: 10, sourceTypeId: 'EN-04' }];
    w.update(1 / 60); expect(w.player.hp).toBe(87);
    w.clock.advance(270 - w.clock.elapsedSeconds); w.bossSystem.update(1 / 60, 270);
    expect(w.getBossSnapshot().maxHp).toBe(2880);
  });
  it('scales encounter elites as well as ordinary waves at higher difficulty', () => {
    const w = create({ difficultyId: 'hard' });
    const elite = w.encounterSystem.spawnElite({ x: 56, y: 56, config: ENEMY_CONFIG.EN06, encounterId: 'difficulty-test' });
    expect(elite.maxHp).toBe(275);
  });
});
describe('characters and active skills', () => {
  it('clears all weapon flash and cooldown on stage entry even when an upgrade is immediately pending', () => {
    const w = create({ journeyId: 'campaign' }); clear(w);
    w.player.weaponStates[0].fireFlashRemaining = .09; w.player.weaponStates[0].cooldownRemaining = .8;
    w.player.exp = getExperienceToNextLevel(w.player.level); w.levelSystem.processExperience();
    expect(w.advanceCampaign('reactor')).toBe(true); expect(w.stateManager.currentState).toBe('LEVEL_UP');
    expect(w.player.weaponStates[0]).toMatchObject({ fireFlashRemaining: 0, cooldownRemaining: 0 });
    w.update(1); expect(w.player.weaponStates[0].fireFlashRemaining).toBe(0);
  });
  it('stacks character attributes with protocols and valid module rewards', () => {
    const w = new GameWorld({ camera: new Camera() });
    expect(w.configureExpedition).toBeTypeOf('function');
    w.setProtocol('guard'); w.configureExpedition({ characterId: 'bastion' }); w.reset();
    expect(w.player.maxHp).toBe(140); expect(w.getUpgradeEffectSnapshot().damageMultiplier).toBe(1);
    expect(w.player.moveSpeed).toBeCloseTo(w.player.baseMoveSpeed * .92 * .94);
    expect(w.configureExpedition({ characterId: 'missing' })).toBe(false);
  });
  it('never consumes skills without a target, counts pulse kills once and freezes cooldowns on pause', () => {
    const w = create(); expect(w.useCharacterSkill()).toBe(false);
    w.enemies.push(new Enemy({ id: 'pulse-target', x: w.player.x + 40, y: w.player.y, config: ENEMY_CONFIG.EN01 }));
    expect(w.useCharacterSkill()).toBe(true); expect(w.useCharacterSkill()).toBe(false);
    w.update(.5); expect(w.killCount).toBe(1);
    expect(w.getExpeditionSnapshot().skill.cooldownRemaining).toBeCloseTo(13.5);
    w.stateManager.pause(); w.update(2); expect(w.getExpeditionSnapshot().skill.cooldownRemaining).toBeCloseTo(13.5);
    expect(w.useCharacterSkill()).toBe(false);
    w.stateManager.resume(); w.update(.5); expect(w.killCount).toBe(1);
  });
  it('applies nonlethal slow for VEIL and a capped shield for BASTION', () => {
    const veil = create({ characterId: 'veil' });
    const target = new Enemy({ id: 'slow', x: veil.player.x + 40, y: veil.player.y, config: ENEMY_CONFIG.EN01 });
    veil.enemies.push(target); expect(veil.useCharacterSkill()).toBe(true); expect(target.slowMultiplier).toBe(.4);
    expect(veil.player.maxHp).toBe(85);
    const guard = create({ characterId: 'bastion' }); guard.player.shield = 40;
    expect(guard.useCharacterSkill()).toBe(true); expect(guard.player.shield).toBe(50);
    guard.characterSkillSystem.reset(); expect(guard.useCharacterSkill()).toBe(false);
    expect(guard.getExpeditionSnapshot().skill.cooldownRemaining).toBe(0);
  });
});
