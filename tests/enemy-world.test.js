import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { GameLoop } from '../src/core/GameLoop.js';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';

function createAnimationFrameHarness() {
  let nextHandle = 0;
  const callbacks = new Map();
  return {
    requestAnimationFrame(callback) {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) {
      callbacks.delete(handle);
    },
    frame(timestamp) {
      const pendingCallbacks = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pendingCallbacks) callback(timestamp);
    },
  };
}

function createWorld() {
  const stateManager = new GameStateManager();
  const camera = new Camera();
  const world = new GameWorld({
    stateManager,
    camera,
    random: () => 0.5,
  });
  return { world, stateManager, camera };
}

describe('GameWorld enemy lifecycle', () => {
  it('settles an already dead enemy before cleanup exactly once', () => {
    const { world, stateManager } = createWorld();
    stateManager.startGame();
    const enemy = new Enemy({ id: 'pre-dead', x: world.player.x + 100, y: world.player.y });
    enemy.hp = 0;
    enemy.alive = false;
    world.enemies.push(enemy);
    const observations = [];
    world.subscribeEnemyDeath((snapshot) => {
      observations.push({ snapshot, stillPresent: world.enemies.includes(enemy) });
    });

    world.update(1 / 60);
    world.update(1 / 60);

    expect(world.killCount).toBe(1);
    expect(enemy.deathProcessed).toBe(true);
    expect(world.enemies).not.toContain(enemy);
    expect(observations).toEqual([{
      snapshot: {
        enemyId: 'pre-dead',
        typeId: 'EN-01',
        x: enemy.x,
        y: enemy.y,
        expDrop: 1,
      },
      stillPresent: true,
    }]);
  });

  it('keeps menu idle, then spawns and tracks only during active play', () => {
    const { world, stateManager, camera } = createWorld();

    world.update(2);
    expect(world.enemies).toHaveLength(0);
    expect(world.clock.elapsedSeconds).toBe(0);

    stateManager.startGame();
    world.update(1);

    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].y).toBeLessThan(675);
    expect(world.enemies[0].y).toBeGreaterThan(315);
    expect(world.clock.elapsedSeconds).toBe(1);
    expect(world.camera).toBe(camera);
    expect(world.spawnSystem.enemies).toBe(world.enemies);
    expect(world.enemySystem.enemies).toBe(world.enemies);
  });

  it('freezes cadence, enemy positions, and the world clock while paused', () => {
    const { world, stateManager } = createWorld();
    stateManager.startGame();
    world.update(1);
    world.update(0.4);
    stateManager.pause();
    const beforePause = world.enemies.map(({ x, y }) => ({ x, y }));

    expect(world.update(10)).toBe(false);
    expect(world.enemies).toHaveLength(1);
    expect(world.clock.elapsedSeconds).toBeCloseTo(1.4, 10);
    expect(world.enemies.map(({ x, y }) => ({ x, y }))).toEqual(beforePause);

    stateManager.resume();
    world.update(0.6);
    expect(world.spawnSystem.elapsedSeconds).toBe(0);
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].id).toBe('enemy-2');
    expect(world.killCount).toBe(1);
    expect(world.clock.elapsedSeconds).toBeCloseTo(2, 10);
  });

  it('clears an existing run in place and restarts cadence without reusing IDs', () => {
    const { world, stateManager } = createWorld();
    const enemyCollection = world.enemies;
    stateManager.startGame();
    world.update(1);
    const staleEnemy = world.enemies[0];
    expect(staleEnemy.id).toBe('enemy-1');

    stateManager.pause();
    world.reset();
    expect(world.enemies).toBe(enemyCollection);
    expect(world.enemies).toHaveLength(0);
    expect(world.clock.elapsedSeconds).toBe(0);
    expect(world.getHudSnapshot().killCount).toBe(0);

    stateManager.returnToMenu();
    stateManager.startGame();
    world.update(0.999);
    expect(world.enemies).toHaveLength(0);
    world.update(0.001);

    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].id).toBe('enemy-2');
    expect(world.enemies[0]).not.toBe(staleEnemy);
  });

  it.each([30, 60, 120])('produces the same spawn state at %i render frames per second', (rate) => {
    const { world, stateManager } = createWorld();
    const animationFrame = createAnimationFrameHarness();
    const loop = new GameLoop({
      stateManager,
      world,
      requestAnimationFrame: animationFrame.requestAnimationFrame,
      cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    });

    stateManager.startGame();
    loop.start();
    animationFrame.frame(0);
    for (let frame = 1; frame <= rate; frame += 1) {
      animationFrame.frame((frame * 1000) / rate);
    }
    loop.stop();

    expect(world.clock.elapsedSeconds).toBeCloseTo(1, 10);
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].x).toBeCloseTo(1200, 9);
    expect(world.enemies[0].y).toBeCloseTo(267 + 80 / 60, 8);
  });
});
