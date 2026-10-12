import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Camera } from '../src/rendering/Camera.js';
import { CanvasRenderer } from '../src/rendering/CanvasRenderer.js';
import { EnemyRenderer } from '../src/rendering/EnemyRenderer.js';

function createContext(events = []) {
  const fills = [];
  return {
    fills,
    save() { events.push('save'); },
    beginPath() { events.push('beginPath'); },
    rect(...args) { events.push(['clipRect', ...args]); },
    clip() { events.push('clip'); },
    fillRect(...args) { fills.push({ color: this.fillStyle, rect: args }); events.push('enemy'); },
    restore() { events.push('restore'); },
    setTransform() {},
    clearRect() {},
  };
}

function createEnemy(id, x, y) {
  return new Enemy({ id, x, y, config: ENEMY_CONFIG.EN01 });
}

describe('EnemyRenderer', () => {
  it('draws live enemies in logical screen coordinates with the configured enemy color', () => {
    const camera = new Camera();
    const context = createContext();
    const visible = createEnemy('visible', camera.x + 100, camera.y + 120);
    const dead = createEnemy('dead', camera.x + 200, camera.y + 120);
    dead.alive = false;
    const outside = createEnemy('outside', 100, 100);

    new EnemyRenderer().render(context, camera, [visible, dead, outside]);

    expect(context.fills).toEqual([{
      color: '#ff5e70',
      rect: [84, 104, 32, 32],
    }]);
  });

  it('clips to the viewport and draws partial intersections while culling fully offscreen enemies', () => {
    const camera = new Camera();
    const events = [];
    const context = createContext(events);
    const partial = createEnemy('partial', camera.x - 10, camera.y + 100);
    const outside = createEnemy('outside', camera.x - 40, camera.y + 100);

    new EnemyRenderer().render(context, camera, [partial, outside]);

    expect(events).toContainEqual(['clipRect', 0, 0, 1280, 720]);
    expect(events.indexOf('clip')).toBeLessThan(events.indexOf('enemy'));
    expect(context.fills).toEqual([{
      color: '#ff5e70',
      rect: [-26, 84, 32, 32],
    }]);
    expect(events.at(-1)).toBe('restore');
  });
});

describe('CanvasRenderer layering', () => {
  it('draws the map, projectiles, enemies, then player', () => {
    const events = [];
    const camera = new Camera();
    const projectiles = [new Projectile({
      id: 'layered-projectile',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: 1200,
      y: 675,
      vx: 500,
      vy: 0,
      radius: 4,
      damage: 20,
      lifetimeSeconds: 1.28,
    })];
    const canvas = {
      width: 1280,
      height: 720,
      getContext: () => createContext(events),
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    };
    const renderer = new CanvasRenderer({
      canvas,
      camera,
      mapRenderer: { render: () => events.push('map') },
      projectileRenderer: { render: (_context, _camera, drawnProjectiles) => {
        expect(drawnProjectiles).toBe(projectiles);
        events.push('projectiles');
      } },
      enemyRenderer: { render: (_context, _camera, enemies) => {
        expect(enemies).toEqual([expect.objectContaining({ id: 'layered-enemy' })]);
        events.push('enemies');
      } },
      playerRenderer: { render: () => events.push('player') },
    });

    renderer.render({ id: 'player' }, [createEnemy('layered-enemy', 1200, 675)], projectiles);

    expect(events.slice(-4)).toEqual(['map', 'projectiles', 'enemies', 'player']);
  });
});

describe('Game projectile rendering', () => {
  it('passes the shared world projectile array to CanvasRenderer each frame', () => {
    let nextFrame;
    const canvas = {
      width: 1280,
      height: 720,
      getContext: () => ({}),
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    };
    const game = new Game({
      canvas,
      loopOptions: {
        requestAnimationFrame: (callback) => { nextFrame = callback; return 1; },
        cancelAnimationFrame: () => {},
        windowTarget: null,
        documentTarget: null,
      },
      inputOptions: { windowTarget: null, documentTarget: null },
    });
    const renderCalls = [];
    game.renderer.render = (...args) => renderCalls.push(args);

    game.startGame();
    game.world.projectiles.push(new Projectile({
      id: 'game-projectile',
      ownerId: 'player',
      weaponId: 'pulse-gun',
      x: game.world.player.x,
      y: game.world.player.y,
      vx: 500,
      vy: 0,
      radius: 4,
      damage: 20,
      lifetimeSeconds: 1.28,
    }));
    game.start();
    nextFrame(0);

    expect(renderCalls).toHaveLength(1);
    expect(renderCalls[0][0]).toBe(game.world.player);
    expect(renderCalls[0][1]).toBe(game.world.enemies);
    expect(renderCalls[0][2]).toBe(game.world.projectiles);
    game.stop();
  });
});
