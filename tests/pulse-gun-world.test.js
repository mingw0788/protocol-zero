import { describe, expect, it, vi } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Camera } from '../src/rendering/Camera.js';

function createWorld() {
  const stateManager = new GameStateManager();
  const enemyConfig = {
    ...ENEMY_CONFIG,
    spawn: { ...ENEMY_CONFIG.spawn, intervalSeconds: 100 },
  };
  const world = new GameWorld({
    stateManager,
    camera: new Camera(),
    random: () => 0.5,
    enemyConfig,
  });
  return { stateManager, world };
}

function addEnemy(world, id, offsetX = 200) {
  const enemy = new Enemy({
    id,
    x: world.player.x + offsetX,
    y: world.player.y,
  });
  world.enemies.push(enemy);
  return enemy;
}

describe('GameWorld pulse gun integration', () => {
  it('targets and damages the live Boss through the shared projectile pipeline', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    world.clock.advance(270);
    world.update(1 / 60);
    const boss = world.enemies.find(({ category }) => category === 'boss');
    boss.x = world.player.x + 200;
    boss.y = world.player.y;

    for (let step = 0; step < 20; step += 1) world.update(1 / 60);

    expect(boss.hp).toBe(1780);
    expect(world.getBossSnapshot()).toMatchObject({ hp: 1780, alive: true });
    expect(world.killCount).toBe(0);
  });

  it('automatically kills a standard enemy and emits one frozen snapshot before cleanup', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    const enemy = addEnemy(world, 'pulse-target');
    const observations = [];

    world.subscribeEnemyDeath((snapshot) => {
      observations.push({
        snapshot,
        enemyStillPresent: world.enemies.includes(enemy),
        frozen: Object.isFrozen(snapshot),
      });
    });

    for (let step = 0; step < 72; step += 1) world.update(1 / 60);

    expect(enemy).toMatchObject({ hp: 0, alive: false, deathProcessed: true });
    expect(world.killCount).toBe(1);
    expect(world.enemies).not.toContain(enemy);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      snapshot: {
        enemyId: 'pulse-target',
        typeId: 'EN-01',
        x: enemy.x,
        y: enemy.y,
        expDrop: 1,
      },
      enemyStillPresent: true,
      frozen: true,
    });
    expect(Object.keys(observations[0].snapshot).sort()).toEqual([
      'enemyId', 'expDrop', 'typeId', 'x', 'y',
    ]);
  });

  it('retains enemy death listeners across reset without replaying history', () => {
    const { stateManager, world } = createWorld();
    const listener = vi.fn();
    world.subscribeEnemyDeath(listener);
    stateManager.startGame();
    const first = addEnemy(world, 'first-run-dead');
    first.alive = false;
    first.hp = 0;
    world.update(1 / 60);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(world.killCount).toBe(1);

    stateManager.pause();
    stateManager.returnToMenu();
    world.reset();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(world.killCount).toBe(0);
    stateManager.startGame();
    const second = addEnemy(world, 'second-run-dead');
    second.alive = false;
    second.hp = 0;
    world.update(1 / 60);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toMatchObject({ enemyId: 'second-run-dead' });
  });

  it('supports listener validation and unsubscribe', () => {
    const { stateManager, world } = createWorld();
    const listener = vi.fn();

    expect(() => world.subscribeEnemyDeath(null)).toThrow(TypeError);
    const unsubscribe = world.subscribeEnemyDeath(listener);
    unsubscribe();
    stateManager.startGame();
    const dead = addEnemy(world, 'unobserved-dead');
    dead.alive = false;
    dead.hp = 0;

    world.update(1 / 60);

    expect(listener).not.toHaveBeenCalled();
    expect(world.killCount).toBe(1);
  });

  it('resets projectiles, cooldown, and kill count without replacing the projectile array', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    addEnemy(world, 'reset-target');
    const projectiles = world.projectiles;

    world.update(1 / 60);
    expect(projectiles).toHaveLength(1);
    expect(world.player.weaponStates[0].cooldownRemaining).toBe(0.8);
    world.recordKill();

    world.reset();

    expect(world.projectiles).toBe(projectiles);
    expect(projectiles).toHaveLength(0);
    expect(world.player.weaponStates[0].cooldownRemaining).toBe(0);
    expect(world.getHudSnapshot().killCount).toBe(0);
  });

  it('freezes projectile motion and weapon cooldown while paused', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    addEnemy(world, 'pause-target');
    world.update(1 / 60);
    const projectile = world.projectiles[0];
    const pausedState = {
      x: projectile.x,
      y: projectile.y,
      remainingLife: projectile.remainingLife,
      cooldown: world.player.weaponStates[0].cooldownRemaining,
      elapsed: world.clock.elapsedSeconds,
    };

    stateManager.pause();
    expect(world.update(0.5)).toBe(false);
    expect({
      x: projectile.x,
      y: projectile.y,
      remainingLife: projectile.remainingLife,
      cooldown: world.player.weaponStates[0].cooldownRemaining,
      elapsed: world.clock.elapsedSeconds,
    }).toEqual(pausedState);

    stateManager.resume();
    expect(world.update(1 / 60)).toBe(true);
    expect(projectile.x).toBeGreaterThan(pausedState.x);
    expect(world.player.weaponStates[0].cooldownRemaining).toBeLessThan(pausedState.cooldown);
  });

  it('drops a positive exp crystal before cleanup and awards it through the HUD snapshot', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    const enemy = addEnemy(world, 'experience-target');
    enemy.alive = false;
    enemy.hp = 0;
    const deathPosition = { x: enemy.x, y: enemy.y };
    const deathObservations = [];
    world.subscribeEnemyDeath(() => {
      deathObservations.push(world.enemies.includes(enemy));
    });
    const crystals = world.experienceCrystals;

    world.update(1 / 60);

    expect(crystals).toBeInstanceOf(Array);
    expect(world.experienceCrystals).toBe(crystals);
    expect(deathObservations).toEqual([true]);
    expect(world.enemies).not.toContain(enemy);
    expect(crystals).toHaveLength(1);
    expect(crystals[0]).toMatchObject({
      x: deathPosition.x,
      y: deathPosition.y,
      expValue: 1,
      active: true,
    });
    expect(world.player.exp).toBe(0);

    world.update(1 / 60);
    expect(crystals).toHaveLength(1);

    world.player.x = crystals[0].x - world.player.radius - crystals[0].pickupRadius;
    world.player.y = crystals[0].y;
    world.update(1 / 60);

    expect(world.player.exp).toBe(1);
    expect(world.getHudSnapshot().experience).toBe(1);
    expect(crystals).toEqual([]);
  });

  it('does not create a crystal for a zero-exp death', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    const enemy = new Enemy({
      id: 'zero-exp-target',
      x: world.player.x + 200,
      y: world.player.y,
      config: { ...ENEMY_CONFIG.EN01, expDrop: 0 },
    });
    enemy.alive = false;
    enemy.hp = 0;
    world.enemies.push(enemy);

    world.update(1 / 60);

    expect(world.experienceCrystals).toEqual([]);
    expect(world.killCount).toBe(1);
  });

  it('freezes crystal lifetime while paused and after player death', () => {
    const { stateManager, world } = createWorld();
    stateManager.startGame();
    const droppedEnemy = addEnemy(world, 'lifetime-target', 200);
    droppedEnemy.alive = false;
    droppedEnemy.hp = 0;
    world.update(1 / 60);
    expect(world.experienceCrystals).toBeInstanceOf(Array);
    expect(world.experienceCrystals).toHaveLength(1);
    const crystal = world.experienceCrystals[0];
    const beforePause = crystal.remainingLifetime;

    stateManager.pause();
    expect(world.update(1)).toBe(false);
    expect(crystal.remainingLifetime).toBe(beforePause);

    stateManager.resume();
    world.player.hp = 10;
    const contactEnemy = new Enemy({
      id: 'lethal-contact',
      x: world.player.x,
      y: world.player.y,
      config: { ...ENEMY_CONFIG.EN01, expDrop: 0 },
    });
    world.enemies.push(contactEnemy);
    expect(world.update(1 / 60)).toBe(true);
    expect(world.player.alive).toBe(false);
    const frozenLifetime = crystal.remainingLifetime;

    expect(world.update(1)).toBe(false);
    expect(crystal.remainingLifetime).toBe(frozenLifetime);
  });

  it('clears crystals on reset without replay and keeps the subscription for the next run', () => {
    const { stateManager, world } = createWorld();
    const sharedCrystals = world.experienceCrystals;
    const observedDeaths = [];
    world.subscribeEnemyDeath((snapshot) => observedDeaths.push(snapshot.enemyId));
    stateManager.startGame();
    const first = addEnemy(world, 'first-exp-run', 200);
    first.alive = false;
    first.hp = 0;
    world.update(1 / 60);
    expect(world.experienceCrystals).toBeInstanceOf(Array);
    expect(world.experienceCrystals).toHaveLength(1);
    const firstCrystal = sharedCrystals[0];
    expect(observedDeaths).toEqual(['first-exp-run']);

    stateManager.pause();
    stateManager.returnToMenu();
    world.reset();

    expect(world.experienceCrystals).toBe(sharedCrystals);
    expect(sharedCrystals).toEqual([]);
    expect(firstCrystal.active).toBe(false);
    expect(observedDeaths).toEqual(['first-exp-run']);
    expect(world.getHudSnapshot().experience).toBe(0);

    stateManager.startGame();
    const second = addEnemy(world, 'second-exp-run', 200);
    second.alive = false;
    second.hp = 0;
    world.update(1 / 60);

    expect(observedDeaths).toEqual(['first-exp-run', 'second-exp-run']);
    expect(sharedCrystals).toHaveLength(1);
    expect(sharedCrystals[0].id).toBe('experience-crystal-2');
  });
});
