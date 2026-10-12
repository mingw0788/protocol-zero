import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Camera } from '../src/rendering/Camera.js';
import { CanvasRenderer } from '../src/rendering/CanvasRenderer.js';
import { EnemyRenderer } from '../src/rendering/EnemyRenderer.js';
import { SPRITE_PATTERNS } from '../src/rendering/spritePatterns.js';

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
  it('draws live enemies as bounded pixel patterns in logical screen coordinates', () => {
    const camera = new Camera();
    const context = createContext();
    const visible = createEnemy('visible', camera.x + 100, camera.y + 120);
    const dead = createEnemy('dead', camera.x + 200, camera.y + 120);
    dead.alive = false;
    const outside = createEnemy('outside', 100, 100);

    new EnemyRenderer().render(context, camera, [visible, dead, outside]);

    expect(context.fills.length).toBeGreaterThan(1);
    expect(context.fills.every(({ color, rect: [x, y, width, height] }) =>
      color !== undefined && x >= 84 && y >= 104 && x + width <= 116 && y + height <= 136)).toBe(true);
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
    expect(context.fills.length).toBeGreaterThan(0);
    expect(context.fills.every(({ rect: [x, y, width, height] }) =>
      x >= -26 && y >= 84 && x + width <= 6 && y + height <= 116)).toBe(true);
    expect(events.at(-1)).toBe('restore');
  });

  it('uses distinct silhouettes for every known enemy kind and a neutral fallback', () => {
    expect(SPRITE_PATTERNS.enemies['EN-01']).not.toEqual(SPRITE_PATTERNS.enemies['EN-02']);
    expect(SPRITE_PATTERNS.enemies['EN-02']).not.toEqual(SPRITE_PATTERNS.enemies['EN-03']);
    expect(SPRITE_PATTERNS.enemies.fallback).toBeDefined();
    expect(SPRITE_PATTERNS.boss).toBeDefined();
  });

  it('draws a neutral bounded fallback for an unknown enemy type and animates on effective time', () => {
    const camera = new Camera();
    const enemy = createEnemy('stable-phase', camera.x + 80, camera.y + 80);
    const render = (time) => {
      const context = createContext();
      new EnemyRenderer().render(context, camera, [enemy], time);
      return context.fills;
    };
    const first = render(0);
    expect(render(0.25)).not.toEqual(first);
    enemy.typeId = 'future-enemy';
    const fallback = render(0);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every(({ rect: [x, y, width, height] }) =>
      x >= 64 && y >= 64 && x + width <= 96 && y + height <= 96)).toBe(true);
    expect(render(0)).toEqual(fallback);
  });

  it('leaves Boss body rendering to BossRenderer', () => {
    const boss = createEnemy('boss', 1200, 675);
    boss.category = 'boss';
    const context = createContext();
    new EnemyRenderer().render(context, new Camera(), [boss]);
    expect(context.fills).toEqual([]);
  });
});

describe('CanvasRenderer layering', () => {
  it('draws the map, crystals, projectiles, enemies, orbital blade, then player', () => {
    const events = [];
    const camera = new Camera();
    const crystals = [new ExperienceCrystal({
      id: 'layered-crystal', x: 1200, y: 675, expValue: 1,
    })];
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
      experienceCrystalRenderer: { render: (_context, _camera, drawnCrystals) => {
        expect(drawnCrystals).toBe(crystals);
        events.push('crystals');
      } },
      projectileRenderer: { render: (_context, _camera, drawnProjectiles) => {
        expect(drawnProjectiles).toBe(projectiles);
        events.push('projectiles');
      } },
      enemyRenderer: { render: (_context, _camera, enemies) => {
        expect(enemies).toEqual([expect.objectContaining({ id: 'layered-enemy' })]);
        events.push('enemies');
      } },
      bossRenderer: { render: (_context, _camera, boss) => {
        expect(boss).toEqual(expect.objectContaining({ typeId: 'BOSS-01', phase: 'telegraph' }));
        events.push('boss-warning');
      } },
      particleRenderer: { render: (_context, _camera, effects) => {
        expect(effects).toEqual([{ id: 'effect' }]);
        events.push('particles');
      } },
      orbitalBladeRenderer: { render: (_context, _camera, snapshot) => {
        expect(snapshot).toEqual(expect.objectContaining({ active: true, level: 1 }));
        events.push('orbital-blade');
      } },
      playerRenderer: { render: () => events.push('player') },
    });

    renderer.render(
      { id: 'player' },
      [createEnemy('layered-enemy', 1200, 675)],
      projectiles,
      crystals,
      Object.freeze({ active: true, level: 1, x: 1200, y: 675, radius: 8, angleRadians: 0 }),
      Object.freeze({ typeId: 'BOSS-01', phase: 'telegraph' }),
      [{ id: 'effect' }],
      1.25,
    );

    expect(events.slice(-8)).toEqual([
      'map', 'crystals', 'projectiles', 'particles', 'boss-warning', 'enemies', 'orbital-blade', 'player',
    ]);
  });
});

describe('Game world rendering', () => {
  it('passes the shared projectile and crystal arrays and the blade snapshot each frame', () => {
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
    const bladeSnapshot = Object.freeze({
      active: false,
      level: 0,
      x: null,
      y: null,
      radius: 8,
      orbitRadius: 0,
      angleRadians: 0,
    });
    const bossSnapshot = Object.freeze({
      typeId: 'BOSS-01', phase: 'telegraph', hp: 1000, maxHp: 1800, alive: true,
    });
    game.world.getOrbitalBladeSnapshot = () => bladeSnapshot;
    game.world.getBossSnapshot = () => bossSnapshot;

    game.startGame();
    game.world.particleSystem.emitPlayerHit(game.world.player);
    const visualEffects = game.world.getVisualEffectsSnapshot();
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
    expect(renderCalls[0][3]).toBe(game.world.experienceCrystals);
    expect(renderCalls[0][4]).toBe(bladeSnapshot);
    expect(renderCalls[0][5]).toBe(bossSnapshot);
    expect(renderCalls[0][6]).toEqual(visualEffects);
    expect(renderCalls[0][7]).toBe(0);
    game.stop();
  });
});
