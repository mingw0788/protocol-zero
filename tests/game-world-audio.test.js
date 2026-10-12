import { describe, expect, it, vi } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';

function createWorld() {
  const stateManager = new GameStateManager();
  return { stateManager, world: new GameWorld({ stateManager, camera: new Camera() }) };
}

function addEnemy(world, id, x, y, config = ENEMY_CONFIG.EN01) {
  const enemy = new Enemy({
    id, x, y, config, worldWidth: 2400, worldHeight: 1350,
  });
  world.enemies.push(enemy);
  return enemy;
}

describe('GameWorld sound event contract', () => {
  it('emits frozen pulse-fire and actual player damage events only while playing', () => {
    const { stateManager, world } = createWorld();
    const listener = vi.fn();
    world.subscribeSoundEvent(listener);
    addEnemy(world, 'shot-target', world.player.x + 100, world.player.y);

    world.update(1 / 60);
    expect(listener).not.toHaveBeenCalled();
    stateManager.startGame();
    world.update(1 / 60);
    expect(listener).toHaveBeenCalledWith(Object.freeze({ type: 'pulse-fire' }));
    expect(Object.isFrozen(listener.mock.calls[0][0])).toBe(true);

    world.reset();
    stateManager.startGame();
    addEnemy(world, 'contact-target', world.player.x + 30, world.player.y);
    world.update(1 / 60);
    expect(listener.mock.calls.map(([event]) => event.type)).toContain('player-hit');
  });

  it('emits an enemy death once, keeps one subscription across reset, and never replays history', () => {
    const { stateManager, world } = createWorld();
    const listener = vi.fn();
    world.subscribeSoundEvent(listener);
    stateManager.startGame();
    const enemy = addEnemy(world, 'dead-target', world.player.x + 100, world.player.y);
    enemy.hp = 0;
    enemy.alive = false;
    world.update(1 / 60);
    world.update(1 / 60);
    expect(listener.mock.calls.map(([event]) => event.type).filter((type) => type === 'enemy-death'))
      .toHaveLength(1);

    world.reset();
    expect(listener).toHaveBeenCalledTimes(1);
    stateManager.startGame();
    const nextEnemy = addEnemy(world, 'second-dead-target', world.player.x + 100, world.player.y);
    nextEnemy.hp = 0;
    nextEnemy.alive = false;
    world.update(1 / 60);
    expect(listener.mock.calls.map(([event]) => event.type).filter((type) => type === 'enemy-death'))
      .toHaveLength(2);
  });

  it('emits upgrade and accepted terminal outcome events once', () => {
    const { stateManager, world } = createWorld();
    const events = [];
    world.subscribeSoundEvent(({ type }) => events.push(type));
    stateManager.startGame();
    world.player.exp = 6;
    world.levelSystem.processExperience();
    stateManager.beginLevelUp();
    world.upgradeSystem.prepareChoices();
    expect(world.chooseUpgrade(world.getUpgradeChoices()[0].id)).toBe(true);
    expect(events.filter((type) => type === 'upgrade')).toHaveLength(1);

    world.bossSystem.update(0, 270);
    const boss = world.enemies.find(({ category }) => category === 'boss');
    boss.hp = 0;
    boss.alive = false;
    world.clock.advance(300 - 1 / 60);
    world.update(1 / 60);
    expect(events.filter((type) => type === 'victory')).toHaveLength(1);
    expect(events.filter((type) => type === 'enemy-death')).toHaveLength(1);
    world.update(1 / 60);
    expect(events.filter((type) => type === 'victory')).toHaveLength(1);
  });

  it('emits player death and defeat as distinct accepted events', () => {
    const { stateManager, world } = createWorld();
    const events = [];
    world.subscribeSoundEvent(({ type }) => events.push(type));
    stateManager.startGame();
    world.player.hp = 10;
    addEnemy(world, 'lethal-contact', world.player.x + 30, world.player.y);
    world.update(1 / 60);
    expect(events).toContain('player-death');
    expect(events).toContain('defeat');
    world.update(1 / 60);
    expect(events.filter((type) => type === 'player-death')).toHaveLength(1);
    expect(events.filter((type) => type === 'defeat')).toHaveLength(1);
  });
});
