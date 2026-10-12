import { describe, expect, it, vi } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
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
    stateManager.pause();
    stateManager.resume();
    const frozenClock = world.clock.elapsedSeconds;
    expect(world.update(1 / 60)).toBe(false);
    expect(world.clock.elapsedSeconds).toBe(frozenClock);

    world.reset();
    expect(world.player.hp).toBe(100);
    expect(world.player.alive).toBe(true);
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
