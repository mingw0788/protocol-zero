import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';

describe('EN-01 configuration and Enemy', () => {
  it('uses the confirmed SRS baseline without exposing mutable config', () => {
    expect(ENEMY_CONFIG.EN01).toMatchObject({
      typeId: 'EN-01',
      name: '普通感染体',
      maxHp: 30,
      hp: 30,
      speed: 80,
      radius: 16,
      contactDamage: 10,
      expDrop: 1,
      color: '#ff5e70',
    });
    expect(ENEMY_CONFIG.spawn).toMatchObject({
      intervalSeconds: 1,
      viewportClearance: 32,
      maxActive: 100,
      maxPositionAttempts: 16,
    });
    expect(Object.isFrozen(ENEMY_CONFIG)).toBe(true);
    expect(Object.isFrozen(ENEMY_CONFIG.EN01)).toBe(true);
    expect(Object.isFrozen(ENEMY_CONFIG.spawn)).toBe(true);
  });

  it('defines the swift and heavy enemies from SRS stats and frozen tuning values', () => {
    expect(ENEMY_CONFIG.EN02).toMatchObject({
      typeId: 'EN-02',
      name: '迅捷猎犬',
      maxHp: 18,
      hp: 18,
      speed: 155,
      radius: 12,
      contactDamage: 8,
      expDrop: 1,
      color: '#ff944d',
      category: 'normal',
    });
    expect(ENEMY_CONFIG.EN03).toMatchObject({
      typeId: 'EN-03',
      name: '重装机甲',
      maxHp: 100,
      hp: 100,
      speed: 55,
      radius: 22,
      contactDamage: 18,
      expDrop: 3,
      color: '#a9bacd',
      category: 'normal',
    });
    expect(Object.isFrozen(ENEMY_CONFIG.EN02)).toBe(true);
    expect(Object.isFrozen(ENEMY_CONFIG.EN03)).toBe(true);
  });

  it('copies the configured category to the entity and defaults it to normal', () => {
    const swift = new Enemy({ id: 'swift', x: 100, y: 200, config: ENEMY_CONFIG.EN02 });
    const heavy = new Enemy({ id: 'heavy', x: 200, y: 200, config: ENEMY_CONFIG.EN03 });
    const boss = new Enemy({
      id: 'boss',
      x: 300,
      y: 200,
      config: { ...ENEMY_CONFIG.EN01, category: 'boss' },
    });

    expect(swift).toMatchObject({ typeId: 'EN-02', radius: 12, category: 'normal' });
    expect(heavy).toMatchObject({ typeId: 'EN-03', radius: 22, category: 'normal' });
    expect(boss.category).toBe('boss');
    swift.hp = 0;
    expect(ENEMY_CONFIG.EN02.hp).toBe(18);
  });

  it('creates isolated run entities with one-shot state left for later combat tasks', () => {
    const first = new Enemy({ id: 'enemy-1', x: 100, y: 200 });
    const second = new Enemy({ id: 'enemy-2', x: 300, y: 400 });

    first.hp = 12;
    first.x = 105;

    expect(first).toMatchObject({
      id: 'enemy-1',
      typeId: 'EN-01',
      category: 'normal',
      x: 105,
      y: 200,
      radius: 16,
      hp: 12,
      maxHp: 30,
      speed: 80,
      contactDamage: 10,
      expDrop: 1,
      alive: true,
      deathProcessed: false,
    });
    expect(second).toMatchObject({ x: 300, y: 400, hp: 30, alive: true });
    expect(ENEMY_CONFIG.EN01.hp).toBe(30);
  });

  it('rejects invalid IDs, positions, map dimensions, and config values', () => {
    expect(() => new Enemy({ id: '', x: 100, y: 100 })).toThrow(TypeError);
    expect(() => new Enemy({ id: 'enemy', x: Number.NaN, y: 100 })).toThrow(TypeError);
    expect(() => new Enemy({ id: 'enemy', x: 0, y: 100 })).toThrow(RangeError);
    expect(() => new Enemy({ id: 'enemy', x: 100, y: 100, worldWidth: 20 })).toThrow(RangeError);
    expect(() => new Enemy({
      id: 'enemy',
      x: 100,
      y: 100,
      config: { ...ENEMY_CONFIG.EN01, speed: 0 },
    })).toThrow(RangeError);
    expect(() => new Enemy({
      id: 'enemy',
      x: 100,
      y: 100,
      config: { ...ENEMY_CONFIG.EN01, category: 'elite' },
    })).toThrow(TypeError);
  });
});

describe('EnemySystem tracking and cleanup', () => {
  it('tracks horizontally, vertically, and diagonally at the configured speed', () => {
    const makeEnemy = () => new Enemy({ id: 'enemy', x: 100, y: 100 });
    const horizontal = makeEnemy();
    const vertical = makeEnemy();
    const diagonal = makeEnemy();

    new EnemySystem({ enemies: [horizontal], player: { x: 300, y: 100 } }).update(0.5);
    new EnemySystem({ enemies: [vertical], player: { x: 100, y: 300 } }).update(0.5);
    new EnemySystem({ enemies: [diagonal], player: { x: 300, y: 300 } }).update(0.5);

    expect(horizontal.x - 100).toBeCloseTo(40, 10);
    expect(horizontal.y).toBe(100);
    expect(vertical.y - 100).toBeCloseTo(40, 10);
    expect(vertical.x).toBe(100);
    expect(Math.hypot(diagonal.x - 100, diagonal.y - 100)).toBeCloseTo(40, 10);
    expect(diagonal.x - 100).toBeCloseTo(diagonal.y - 100, 10);
  });

  it('does not divide at overlap or move through a nearby target', () => {
    const overlapping = new Enemy({ id: 'overlap', x: 100, y: 100 });
    const close = new Enemy({ id: 'close', x: 100, y: 100 });
    const system = new EnemySystem({
      enemies: [overlapping, close],
      player: { x: 100, y: 100 },
    });

    expect(() => system.update(1)).not.toThrow();
    expect({ x: overlapping.x, y: overlapping.y }).toEqual({ x: 100, y: 100 });

    system.player.x = 110;
    system.player.y = 100;
    system.update(1);
    expect({ x: close.x, y: close.y }).toEqual({ x: 110, y: 100 });
  });

  it('keeps a pursuing enemy inside its world bounds', () => {
    const enemy = new Enemy({ id: 'edge', x: 20, y: 100 });
    const system = new EnemySystem({
      enemies: [enemy],
      player: { x: 0, y: 100 },
      world: { width: 2400, height: 1350 },
    });

    system.update(1);

    expect(enemy.x).toBe(enemy.radius);
    expect(enemy.y).toBe(100);
  });

  it('skips inactive entities and removes dead entities without settling them', () => {
    const inactive = new Enemy({ id: 'inactive', x: 100, y: 100 });
    inactive.alive = false;
    const depleted = new Enemy({ id: 'depleted', x: 100, y: 100 });
    depleted.hp = 0;
    const survivor = new Enemy({ id: 'survivor', x: 100, y: 100 });
    const enemies = [inactive, depleted, survivor];
    const system = new EnemySystem({ enemies, player: { x: 300, y: 100 } });

    system.update(0.5);

    expect(inactive.x).toBe(100);
    expect(depleted.x).toBe(100);
    expect(survivor.x).toBeCloseTo(140, 10);
    expect(system.cleanup()).toBe(2);
    expect(enemies).toEqual([survivor]);
    expect(inactive.deathProcessed).toBe(false);
    expect(depleted.deathProcessed).toBe(false);
  });

  it('rejects invalid update deltas', () => {
    const system = new EnemySystem({ enemies: [], player: { x: 100, y: 100 } });

    expect(() => system.update(-1)).toThrow(RangeError);
    expect(() => system.update(Number.NaN)).toThrow(RangeError);
  });
});
