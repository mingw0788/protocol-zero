import { describe, expect, it, vi } from 'vitest';
import { GAME_STATES, GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { InputController } from '../src/input/InputController.js';
import { Camera } from '../src/rendering/Camera.js';

function createEventTarget(properties = {}) {
  const listeners = new Map();

  return {
    ...properties,
    addEventListener(type, listener) {
      const eventListeners = listeners.get(type) ?? new Set();
      eventListeners.add(listener);
      listeners.set(type, eventListeners);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) {
        listener({ type, code: '', preventDefault() {}, ...event });
      }
    },
  };
}

function createHarness() {
  const stateManager = new GameStateManager();
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget({ hidden: false });
  const inputController = new InputController({ stateManager, windowTarget, documentTarget });
  inputController.start();
  const world = new GameWorld({ stateManager, inputController, camera: new Camera() });

  return { documentTarget, inputController, stateManager, windowTarget, world };
}

function addEnemyAtPlayer(world, id = 'contact-enemy') {
  const enemy = new Enemy({ id, x: world.player.x, y: world.player.y });
  world.enemies.push(enemy);
  return enemy;
}

describe('GameWorld player damage', () => {
  it('fails on the lethal step before a same-step eligible Boss victory', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.bossSystem.update(0, 270);
    const boss = world.enemies[0];
    boss.hp = 0;
    boss.alive = false;
    world.clock.advance(300);
    world.player.hp = 10;
    addEnemyAtPlayer(world, 'same-step-lethal-enemy');

    world.update(1 / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.DEFEAT);
    expect(world.getRunResultSnapshot()).toMatchObject({
      outcome: 'defeat',
      elapsedSeconds: expect.any(Number),
    });
    expect(world.getRunResultSnapshot().killCount).toBe(1);
  });

  it('waits until 300 seconds for an already defeated Boss, then freezes a victory snapshot', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.bossSystem.update(0, 270);
    world.enemies[0].hp = 0;
    world.enemies[0].alive = false;
    world.update(1 / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(world.getRunResultSnapshot()).toBeNull();

    world.clock.advance(299.99);
    world.update(1 / 60);
    const result = world.getRunResultSnapshot();

    expect(stateManager.currentState).toBe(GAME_STATES.VICTORY);
    expect(result).toMatchObject({ outcome: 'victory', killCount: 1 });
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(300);
    expect(Object.isFrozen(result)).toBe(true);
    expect(world.update(1 / 60)).toBe(false);
    expect(world.getRunResultSnapshot()).toBe(result);
  });

  it('continues after 300 seconds while Boss is alive and wins when it is defeated', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.bossSystem.update(0, 270);
    world.clock.advance(300);
    world.update(1 / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(world.getRunResultSnapshot()).toBeNull();

    world.enemies[0].hp = 0;
    world.enemies[0].alive = false;
    world.update(1 / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.VICTORY);
    expect(world.getRunResultSnapshot().outcome).toBe('victory');
  });

  it('prefers victory to a new level-up choice on the same living step', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.bossSystem.update(0, 270);
    world.enemies[0].hp = 0;
    world.enemies[0].alive = false;
    world.experienceCrystals.push(new ExperienceCrystal({
      id: 'final-step-level-up',
      x: world.player.x,
      y: world.player.y,
      expValue: 6,
    }));
    world.clock.advance(300);

    world.update(1 / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.VICTORY);
    expect(world.levelSystem.pendingLevelUps).toBe(1);
  });

  it('finishes the lethal step then freezes projectile and cooldown simulation', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.player.hp = 10;
    const enemy = new Enemy({
      id: 'lethal-contact-with-target',
      x: world.player.x + 33,
      y: world.player.y,
    });
    world.enemies.push(enemy);

    expect(world.update(1 / 60)).toBe(true);
    expect(world.player.hp).toBe(0);
    expect(world.projectiles).toHaveLength(1);
    expect(world.player.weaponStates[0].cooldownRemaining).toBe(0.8);
    expect(world.clock.elapsedSeconds).toBe(1 / 60);

    const projectile = world.projectiles[0];
    const frozenState = {
      x: projectile.x,
      y: projectile.y,
      remainingLife: projectile.remainingLife,
      cooldown: world.player.weaponStates[0].cooldownRemaining,
      elapsed: world.clock.elapsedSeconds,
      steps: world.simulationSteps,
    };

    expect(world.update(1 / 60)).toBe(false);
    expect({
      x: projectile.x,
      y: projectile.y,
      remainingLife: projectile.remainingLife,
      cooldown: world.player.weaponStates[0].cooldownRemaining,
      elapsed: world.clock.elapsedSeconds,
      steps: world.simulationSteps,
    }).toEqual(frozenState);
    expect(enemy.hp).toBe(30);
  });

  it('damages after player and enemy have moved', () => {
    const { inputController, stateManager, windowTarget, world } = createHarness();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    const enemy = new Enemy({ id: 'closing-enemy', x: world.player.x + 35, y: world.player.y });
    world.enemies.push(enemy);

    world.update(1 / 60);

    expect(world.player.x).toBeCloseTo(1200 + 220 / 60, 10);
    expect(enemy.x).toBeCloseTo(1235 - 80 / 60, 10);
    expect(world.player.hp).toBe(90);
    inputController.stop();
  });

  it('updates contact damage only while playing', () => {
    const { stateManager, world } = createHarness();

    expect(world.update(0.2)).toBe(false);
    expect(world.player.invulnerabilityRemaining).toBe(0);
    stateManager.startGame();
    addEnemyAtPlayer(world);
    world.update(1 / 60);
    expect(world.player.hp).toBe(90);
    expect(world.player.invulnerabilityRemaining).toBe(0.6);

    stateManager.pause();
    expect(world.update(0.2)).toBe(false);
    expect(world.player.invulnerabilityRemaining).toBe(0.6);

    stateManager.resume();
    expect(world.update(0.2)).toBe(true);
    expect(world.player.hp).toBe(90);
    expect(world.player.invulnerabilityRemaining).toBeCloseTo(0.4, 12);
  });

  it('updates the hud from real player health', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    addEnemyAtPlayer(world);

    world.update(1 / 60);

    expect(world.getHudSnapshot().health.current).toBe(90);
  });

  it('completes the lethal tick before synchronously notifying once', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();
    world.player.hp = 10;
    addEnemyAtPlayer(world);
    const observations = [];
    world.subscribePlayerDeath((payload) => {
      observations.push({
        elapsedSeconds: payload.elapsedSeconds,
        frozen: Object.isFrozen(payload),
        hp: world.player.hp,
        simulationSteps: world.simulationSteps,
        worldElapsedSeconds: world.clock.elapsedSeconds,
      });
    });

    expect(world.update(1 / 60)).toBe(true);
    const enemyPositionAtDeath = { x: world.enemies[0].x, y: world.enemies[0].y };
    const spawnTimeAtDeath = world.spawnSystem.elapsedSeconds;
    expect(observations).toEqual([{
      elapsedSeconds: 1 / 60,
      frozen: true,
      hp: 0,
      simulationSteps: 1,
      worldElapsedSeconds: 1 / 60,
    }]);

    expect(world.update(1 / 60)).toBe(false);
    expect(world.clock.elapsedSeconds).toBe(1 / 60);
    expect(world.simulationSteps).toBe(1);
    expect(world.spawnSystem.elapsedSeconds).toBe(spawnTimeAtDeath);
    expect(world.enemies[0]).toMatchObject(enemyPositionAtDeath);
    expect(observations).toHaveLength(1);
  });

  it('clears input and stays frozen after resume until reset', () => {
    const { inputController, stateManager, windowTarget, world } = createHarness();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    world.player.hp = 10;
    let deathCount = 0;
    world.subscribePlayerDeath(() => { deathCount += 1; });
    addEnemyAtPlayer(world);

    world.update(1 / 60);

    expect(world.player.alive).toBe(false);
    expect(world.player.hp).toBe(0);
    expect(deathCount).toBe(1);
    expect(inputController.getMovementVector()).toEqual({ x: 0, y: 0 });
    expect(stateManager.currentState).toBe(GAME_STATES.DEFEAT);
    const frozenClock = world.clock.elapsedSeconds;
    expect(world.update(1 / 60)).toBe(false);
    expect(world.clock.elapsedSeconds).toBe(frozenClock);

    world.reset();
    expect(world.player.hp).toBe(100);
    expect(world.player.alive).toBe(true);
    expect(stateManager.returnToMenu()).toBe(true);
    expect(stateManager.startGame()).toBe(true);
    world.player.hp = 10;
    addEnemyAtPlayer(world, 'second-run-enemy');
    world.update(1 / 60);

    expect(deathCount).toBe(2);
    inputController.stop();
  });

  it('supports unsubscribe and rejects non-function listeners', () => {
    const { stateManager, world } = createHarness();
    stateManager.startGame();

    expect(() => world.subscribePlayerDeath(null)).toThrow(TypeError);
    const listener = vi.fn();
    const unsubscribe = world.subscribePlayerDeath(listener);
    unsubscribe();
    world.player.hp = 10;
    addEnemyAtPlayer(world);
    world.update(1 / 60);
    expect(listener).not.toHaveBeenCalled();

    const lateListener = vi.fn();
    world.subscribePlayerDeath(lateListener);
    expect(lateListener).not.toHaveBeenCalled();
  });
});
