import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Camera } from '../src/rendering/Camera.js';

function createWorld(randomValues = [0.35, 0, 0, 0, 0, 0, 0.35, 0, 0]) {
  let cursor = 0;
  return new GameWorld({
    camera: new Camera(),
    enemyConfig: {
      ...ENEMY_CONFIG,
      spawn: { ...ENEMY_CONFIG.spawn, intervalSeconds: 1000 },
    },
    upgradeRandom: () => randomValues[cursor++ % randomValues.length],
  });
}

function grantLevelUp(world, expValue) {
  if (world.stateManager.currentState === GAME_STATES.MENU) world.stateManager.startGame();
  world.experienceCrystals.push(new ExperienceCrystal({
    id: `orbital-upgrade-${world.player.level}-${expValue}`,
    x: world.player.x,
    y: world.player.y,
    expValue,
  }));
  world.update(1 / 60);
  expect(world.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
}

function selectUpgrade(world, upgradeId) {
  expect(world.getUpgradeChoices().map(({ id }) => id)).toContain(upgradeId);
  expect(world.chooseUpgrade(upgradeId)).toBe(true);
}

function makeEnemy(id, x, y, hp = 30) {
  const enemy = new Enemy({ id, x, y, config: ENEMY_CONFIG.EN01 });
  enemy.hp = hp;
  return enemy;
}

describe('GameWorld orbital blade integration', () => {
  it('damages a Boss through the same orbital blade collision path', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const stateManager = world.stateManager;
    stateManager.startGame();
    world.clock.advance(270 - world.clock.elapsedSeconds);
    world.update(1 / 60);
    const boss = world.enemies.find(({ category }) => category === 'boss');
    const blade = world.getOrbitalBladeSnapshot();
    boss.x = blade.x;
    boss.y = blade.y;
    world.player.weaponStates.find(({ id }) => id === 'pulse-gun').cooldownRemaining = 10;

    world.update(1 / 60);

    expect(boss.hp).toBe(1788);
    expect(world.getBossSnapshot()).toMatchObject({ hp: 1788, alive: true });
  });

  it('unlocks the blade through a real UP-04 choice and includes it once in the HUD', () => {
    const world = createWorld();
    expect(world.getHudSnapshot().weaponIds).toEqual(['pulse-gun']);
    expect(world.getOrbitalBladeSnapshot()).toMatchObject({ active: false, level: 0 });

    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');

    expect(world.getUpgradeEffectSnapshot().orbitalBladeLevel).toBe(1);
    expect(world.getOrbitalBladeSnapshot()).toMatchObject({
      active: true,
      level: 1,
      radius: 8,
      orbitRadius: 48,
    });
    expect(world.getHudSnapshot().weaponIds).toEqual(['pulse-gun', 'orbital-blade']);
    expect(Object.isFrozen(world.getHudSnapshot().weaponIds)).toBe(true);
  });

  it('applies UP-04 rank growth and UP-01 shared damage to both weapons', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    grantLevelUp(world, 10);
    selectUpgrade(world, 'UP-01');
    grantLevelUp(world, 14);
    selectUpgrade(world, 'UP-04');

    expect(world.getUpgradeEffectSnapshot()).toMatchObject({
      damageMultiplier: 1.15,
      orbitalBladeLevel: 2,
    });
    expect(world.getOrbitalBladeSnapshot()).toMatchObject({ level: 2, orbitRadius: 56 });

    const blade = world.getOrbitalBladeSnapshot();
    const target = makeEnemy('ranked-blade-target', blade.x, blade.y, 100);
    world.enemies.push(target);
    world.update(1 / 60);

    expect(target.hp).toBeCloseTo(81.6, 10);
    expect(world.projectiles.some((projectile) => projectile.damage === 23)).toBe(true);
    expect(world.player.weaponStates.map(({ id }) => id)).toEqual(['pulse-gun']);
    expect(world.getHudSnapshot().weaponIds).toEqual(['pulse-gun', 'orbital-blade']);
  });

  it('settles same-step pulse and blade kills once through the existing crystal pipeline', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const center = world.player;
    const pulseTarget = makeEnemy('same-step-pulse-kill', center.x - 40, center.y, 1);
    const bladeSnapshot = world.getOrbitalBladeSnapshot();
    const bladeTarget = makeEnemy('same-step-blade-kill', bladeSnapshot.x, bladeSnapshot.y, 12);
    world.enemies.push(pulseTarget, bladeTarget);
    world.projectiles.push(new Projectile({
      id: 'preexisting-pulse-projectile',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: center.x - 20,
      y: center.y,
      vx: -500,
      vy: 0,
      radius: 4,
      damage: 20,
      lifetimeSeconds: 1.28,
    }));
    const deathEvents = [];
    world.subscribeEnemyDeath((snapshot) => deathEvents.push(snapshot));

    world.update(1 / 60);

    expect(world.killCount).toBe(2);
    expect(deathEvents.map(({ enemyId }) => enemyId).sort()).toEqual([
      'same-step-blade-kill', 'same-step-pulse-kill',
    ]);
    expect(deathEvents.every((snapshot) => Object.isFrozen(snapshot))).toBe(true);
    expect(world.enemies).toEqual([]);
    expect(world.experienceCrystals).toHaveLength(2);
  });

  it('keeps pulse gun and blade active together', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const blade = world.getOrbitalBladeSnapshot();
    const target = makeEnemy('coexisting-target', blade.x, blade.y);
    world.enemies.push(target);

    world.update(1 / 60);

    expect(world.projectiles.some(({ weaponId }) => weaponId === 'pulse-gun')).toBe(true);
    expect(target.hp).toBeLessThan(30);
    expect(world.getOrbitalBladeSnapshot().active).toBe(true);
  });

  it('freezes blade state and target health during PAUSED and LEVEL_UP', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const blade = world.getOrbitalBladeSnapshot();
    const target = makeEnemy('freeze-target', blade.x, blade.y, 100);
    world.enemies.push(target);
    world.update(1 / 60);
    world.stateManager.pause();
    const pausedBlade = world.getOrbitalBladeSnapshot();
    const pausedHp = target.hp;

    expect(world.update(0.8)).toBe(false);
    expect(world.getOrbitalBladeSnapshot()).toEqual(pausedBlade);
    expect(target.hp).toBe(pausedHp);

    world.enemies.length = 0;
    world.stateManager.resume();
    world.experienceCrystals.push(new ExperienceCrystal({
      id: 'enter-level-up-while-blade-unlocked',
      x: world.player.x,
      y: world.player.y,
      expValue: 10,
    }));
    world.update(1 / 60);
    expect(world.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
    const levelUpBlade = world.getOrbitalBladeSnapshot();
    const levelUpTime = world.clock.elapsedSeconds;

    expect(world.update(0.8)).toBe(false);
    expect(world.getOrbitalBladeSnapshot()).toEqual(levelUpBlade);
    expect(world.clock.elapsedSeconds).toBe(levelUpTime);
  });

  it('freezes blade angle and target health after player death', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const blade = world.getOrbitalBladeSnapshot();
    const target = makeEnemy('death-freeze-blade-target', blade.x, blade.y, 100);
    const contact = new Enemy({
      id: 'death-freeze-contact',
      x: world.player.x,
      y: world.player.y,
      config: ENEMY_CONFIG.EN01,
    });
    world.enemies.push(target, contact);
    world.player.hp = 1;

    world.update(1 / 60);
    expect(world.player.alive).toBe(false);
    const frozenBlade = world.getOrbitalBladeSnapshot();
    const frozenTargetHp = target.hp;

    expect(world.update(0.8)).toBe(false);
    expect(world.getOrbitalBladeSnapshot()).toEqual(frozenBlade);
    expect(target.hp).toBe(frozenTargetHp);
  });

  it('clears rank, angle, cooldown, entities, and HUD blade on reset', () => {
    const world = createWorld();
    grantLevelUp(world, 6);
    selectUpgrade(world, 'UP-04');
    const blade = world.getOrbitalBladeSnapshot();
    world.enemies.push(makeEnemy('reset-orbital-target', blade.x, blade.y));
    world.update(1 / 60);
    world.stateManager.pause();

    world.reset();

    expect(world.getUpgradeEffectSnapshot().orbitalBladeLevel).toBe(0);
    expect(world.getOrbitalBladeSnapshot()).toMatchObject({ active: false, level: 0, angleRadians: 0 });
    expect(world.getHudSnapshot().weaponIds).toEqual(['pulse-gun']);
    expect(world.enemies).toEqual([]);
    expect(world.projectiles).toEqual([]);
    expect(world.experienceCrystals).toEqual([]);
  });
});
