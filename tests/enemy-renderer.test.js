import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
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
  it('draws the map before enemies and draws the player above enemies', () => {
    const events = [];
    const camera = new Camera();
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
      enemyRenderer: { render: (_context, _camera, enemies) => {
        expect(enemies).toEqual([expect.objectContaining({ id: 'layered-enemy' })]);
        events.push('enemies');
      } },
      playerRenderer: { render: () => events.push('player') },
    });

    renderer.render({ id: 'player' }, [createEnemy('layered-enemy', 1200, 675)]);

    expect(events.slice(-3)).toEqual(['map', 'enemies', 'player']);
  });
});
