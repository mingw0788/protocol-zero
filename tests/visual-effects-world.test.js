import { describe, expect, it } from 'vitest';
import { GAME_STATES, GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Camera } from '../src/rendering/Camera.js';

function createWorld() {
  const stateManager = new GameStateManager();
  return { stateManager, world: new GameWorld({ stateManager, camera: new Camera() }) };
}

describe('GameWorld visual effects', () => {
  it('emits effects for an enemy death with no experience drop and clears them on reset', () => {
    const { stateManager, world } = createWorld();
    const enemy = new Enemy({
      id: 'no-xp', x: world.player.x + 100, y: world.player.y,
      config: { ...ENEMY_CONFIG.EN01, expDrop: 0 },
    });
    enemy.alive = false;
    enemy.hp = 0;
    world.enemies.push(enemy);
    stateManager.startGame();
    world.update(1 / 60);
    expect(world.killCount).toBe(1);
    expect(world.experienceCrystals).toHaveLength(0);
    expect(world.getVisualEffectsSnapshot().length).toBeGreaterThan(0);
    world.reset();
    expect(world.getVisualEffectsSnapshot()).toEqual([]);
    const nextRunEnemy = new Enemy({ id: 'next-run-no-xp', x: world.player.x + 100, y: world.player.y });
    nextRunEnemy.alive = false;
    nextRunEnemy.hp = 0;
    world.enemies.push(nextRunEnemy);
    world.update(1 / 60);
    expect(world.getVisualEffectsSnapshot().length).toBeGreaterThan(0);
  });

  it('emits player-hit effects only when contact damage is actually applied', () => {
    const { stateManager, world } = createWorld();
    world.enemies.push(new Enemy({ id: 'attacker', x: world.player.x, y: world.player.y }));
    stateManager.startGame();
    world.update(1 / 60);
    expect(world.player.hp).toBeLessThan(world.player.maxHp);
    expect(world.getVisualEffectsSnapshot().length).toBeGreaterThan(0);
  });

  it('freezes active effects while paused and during terminal results', () => {
    const { stateManager, world } = createWorld();
    world.enemies.push(new Enemy({ id: 'attacker', x: world.player.x, y: world.player.y }));
    stateManager.startGame();
    world.update(1 / 60);
    const pausedSnapshot = world.getVisualEffectsSnapshot();
    stateManager.pause();
    expect(world.update(0.1)).toBe(false);
    expect(world.getVisualEffectsSnapshot()).toEqual(pausedSnapshot);

    stateManager.resume();
    world.player.hp = 1;
    world.player.invulnerabilityRemaining = 0;
    world.update(1 / 60);
    expect(stateManager.currentState).toBe(GAME_STATES.DEFEAT);
    const defeatSnapshot = world.getVisualEffectsSnapshot();
    expect(world.update(0.1)).toBe(false);
    expect(world.getVisualEffectsSnapshot()).toEqual(defeatSnapshot);
  });

  it('freezes effect aging while LEVEL_UP blocks world simulation', () => {
    const { stateManager, world } = createWorld();
    world.enemies.push(new Enemy({ id: 'attacker', x: world.player.x, y: world.player.y }));
    stateManager.startGame();
    world.update(1 / 60);
    const snapshot = world.getVisualEffectsSnapshot();
    stateManager.beginLevelUp();
    expect(world.update(0.1)).toBe(false);
    expect(world.getVisualEffectsSnapshot()).toEqual(snapshot);
  });
});
