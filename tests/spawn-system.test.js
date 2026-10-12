import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Camera } from '../src/rendering/Camera.js';
import { SpawnSystem } from '../src/systems/SpawnSystem.js';
import { WORLD_MAP } from '../src/config/worldConfig.js';

function createHarness({
  randomValues = [0.5],
  camera = new Camera(),
  player = { x: 1200, y: 675, radius: 16 },
  world = WORLD_MAP,
  spawn = {},
  extraEnemyConfigs = {},
} = {}) {
  let randomCalls = 0;
  const random = () => {
    const value = randomValues[randomCalls % randomValues.length];
    randomCalls += 1;
    return value;
  };
  const enemies = [];
  const system = new SpawnSystem({
    enemies,
    player,
    camera,
    random,
    world,
    enemyConfig: {
      ...ENEMY_CONFIG,
      ...extraEnemyConfigs,
      spawn: { ...ENEMY_CONFIG.spawn, ...spawn },
    },
  });

  return { system, enemies, player, camera, getRandomCalls: () => randomCalls };
}

function waveProfile(enemyWeights, spawnIntervalSeconds = 1) {
  return Object.freeze({
    phaseId: 'test-wave',
    startSeconds: 0,
    endSeconds: null,
    spawnIntervalSeconds,
    enemyWeights: Object.freeze(enemyWeights),
  });
}

describe('SpawnSystem cadence and limits', () => {
  it('waits one effective second for the first token and preserves the fractional remainder', () => {
    const { system, enemies } = createHarness();

    system.update(0.6);
    expect(enemies).toHaveLength(0);
    system.update(0.399);
    expect(enemies).toHaveLength(0);
    system.update(0.001);
    expect(enemies).toHaveLength(1);

    system.update(0.999);
    expect(enemies).toHaveLength(1);
    system.update(0.001);
    expect(enemies).toHaveLength(2);
  });

  it('settles multiple elapsed tokens without exceeding the active cap', () => {
    const { system, enemies } = createHarness({ spawn: { maxActive: 100 } });

    system.update(3.5);

    expect(enemies).toHaveLength(3);
    system.update(1000);
    expect(enemies).toHaveLength(100);
  });

  it('consumes tokens at the cap and does not burst after capacity opens', () => {
    const { system, enemies } = createHarness({ spawn: { maxActive: 1 } });

    system.update(1);
    expect(enemies).toHaveLength(1);
    system.update(4);
    expect(enemies).toHaveLength(1);
    enemies.length = 0;
    system.update(0.999);
    expect(enemies).toHaveLength(0);
    system.update(0.001);
    expect(enemies).toHaveLength(1);
    expect(enemies[0].id).toBe('enemy-2');
  });

  it.each([
    [0.7499, 'EN-01'],
    [0.75, 'EN-02'],
    [0.999, 'EN-02'],
  ])('selects mixed-wave enemy types at weighted boundary roll %s', (roll, typeId) => {
    const { system, enemies } = createHarness({ randomValues: [roll, 0.1, 0.5] });
    const wave = waveProfile({ 'EN-01': 0.75, 'EN-02': 0.25, 'EN-03': 0 });

    system.update(1, wave);

    expect(enemies).toHaveLength(1);
    expect(enemies[0].typeId).toBe(typeId);
  });

  it('preserves the opening position random sequence when only one enemy type is eligible', () => {
    const { system, enemies, getRandomCalls } = createHarness({ randomValues: [0.1, 0.5] });

    system.update(1, waveProfile({ 'EN-01': 1, 'EN-02': 0, 'EN-03': 0 }));

    expect(enemies).toHaveLength(1);
    expect(enemies[0].typeId).toBe('EN-01');
    expect(enemies[0].x).toBe(512);
    expect(getRandomCalls()).toBe(2);
  });

  it('uses the selected heavy enemy radius for viewport clearance, world bounds, and player separation', () => {
    const harness = createHarness({
      randomValues: [0, 0.5, 0.3, 0.5],
      player: { x: 540, y: 675, radius: 16 },
    });
    const wave = waveProfile({ 'EN-01': 0, 'EN-02': 0, 'EN-03': 1 });

    harness.system.update(1, wave);

    expect(harness.enemies).toHaveLength(1);
    const enemy = harness.enemies[0];
    expect(enemy).toMatchObject({ typeId: 'EN-03', radius: 22 });
    expect(enemy.x - enemy.radius).toBeGreaterThanOrEqual(0);
    expect(enemy.x + enemy.radius).toBeLessThanOrEqual(WORLD_MAP.width);
    expect(enemy.y - enemy.radius).toBeGreaterThanOrEqual(0);
    expect(enemy.y + enemy.radius).toBeLessThanOrEqual(WORLD_MAP.height);
    const dx = Math.max(harness.camera.x - enemy.x, 0, enemy.x - (harness.camera.x + harness.camera.viewportWidth));
    const dy = Math.max(harness.camera.y - enemy.y, 0, enemy.y - (harness.camera.y + harness.camera.viewportHeight));
    expect(Math.hypot(dx, dy) - enemy.radius).toBeGreaterThanOrEqual(32 - 1e-9);
    expect(Math.hypot(enemy.x - harness.player.x, enemy.y - harness.player.y))
      .toBeGreaterThanOrEqual(enemy.radius + harness.player.radius);
    expect(harness.getRandomCalls()).toBe(4);
  });

  it('rejects malformed or unknown enemy weights before adding an entity', () => {
    const { system, enemies } = createHarness();

    expect(() => system.update(1, waveProfile({ 'EN-99': 1 }))).toThrow(RangeError);
    expect(() => system.update(1, waveProfile({ 'EN-01': 0.8 }))).toThrow(RangeError);
    expect(enemies).toHaveLength(0);
  });

  it('does not permit a Boss config to enter the ordinary wave spawn pool', () => {
    const { system, enemies } = createHarness({
      extraEnemyConfigs: {
        BOSS01: { ...ENEMY_CONFIG.EN01, typeId: 'BOSS-01', category: 'boss' },
      },
    });

    expect(() => system.update(1, waveProfile({ 'BOSS-01': 1 }))).toThrow(RangeError);
    expect(enemies).toHaveLength(0);
  });

  it('counts only normal enemies toward the active cap', () => {
    const { system, enemies } = createHarness({ spawn: { maxActive: 1 } });
    enemies.push(new Enemy({
      id: 'boss-does-not-count',
      x: 1000,
      y: 600,
      config: { ...ENEMY_CONFIG.EN01, category: 'boss' },
    }));

    system.update(1);

    expect(enemies.filter((enemy) => enemy.category === 'normal')).toHaveLength(1);
    expect(enemies).toHaveLength(2);
  });

  it('applies a faster wave interval to preserved fractional elapsed time', () => {
    const { system, enemies } = createHarness();
    system.update(0.6);
    expect(enemies).toHaveLength(0);

    system.update(0.01, waveProfile({ 'EN-01': 1 }, 0.5));

    expect(enemies).toHaveLength(1);
    expect(system.elapsedSeconds).toBeCloseTo(0.11, 10);
  });

  it('resets only cadence, keeping IDs monotonic for the system lifetime', () => {
    const { system, enemies } = createHarness();

    system.update(1);
    expect(enemies[0].id).toBe('enemy-1');
    system.reset();
    enemies.length = 0;
    system.update(0.999);
    expect(enemies).toHaveLength(0);
    system.update(0.001);

    expect(enemies[0].id).toBe('enemy-2');
  });
});

describe('SpawnSystem placement', () => {
  it.each([
    ['left', 0.1, 'x', 512],
    ['right', 0.3, 'x', 1888],
    ['top', 0.6, 'y', 267],
    ['bottom', 0.9, 'y', 1083],
  ])('places the enemy outside the %s viewport edge within map bounds', (_edge, selection, axis, expected) => {
    const { system, enemies, camera } = createHarness({ randomValues: [selection, 0.5] });

    system.update(1);

    expect(enemies).toHaveLength(1);
    expect(enemies[0][axis]).toBeCloseTo(expected, 10);
    expect(enemies[0].x - enemies[0].radius).toBeGreaterThanOrEqual(0);
    expect(enemies[0].x + enemies[0].radius).toBeLessThanOrEqual(WORLD_MAP.width);
    expect(enemies[0].y - enemies[0].radius).toBeGreaterThanOrEqual(0);
    expect(enemies[0].y + enemies[0].radius).toBeLessThanOrEqual(WORLD_MAP.height);

    const dx = Math.max(camera.x - enemies[0].x, 0, enemies[0].x - (camera.x + camera.viewportWidth));
    const dy = Math.max(camera.y - enemies[0].y, 0, enemies[0].y - (camera.y + camera.viewportHeight));
    expect(Math.hypot(dx, dy) - enemies[0].radius).toBeGreaterThanOrEqual(32 - 1e-9);
  });

  it('handles deterministic random values at zero and immediately below one', () => {
    const atZero = createHarness({ randomValues: [0] });
    const nearOne = createHarness({ randomValues: [1 - Number.EPSILON] });

    atZero.system.update(1);
    nearOne.system.update(1);

    expect(atZero.enemies).toHaveLength(1);
    expect(nearOne.enemies).toHaveLength(1);
    expect(atZero.enemies[0].id).toBe('enemy-1');
    expect(nearOne.enemies[0].id).toBe('enemy-1');
  });

  it.each([
    ['top-left', { x: 16, y: 16 }, 0.1],
    ['bottom-right', { x: 2384, y: 1334 }, 0.9],
  ])('finds bounded spawn positions when the camera is at the %s map corner', (_corner, position, edge) => {
    const player = { ...position, radius: 16 };
    const camera = new Camera();
    camera.follow(player);
    const harness = createHarness({ camera, player, randomValues: [edge, 0.5] });

    harness.system.update(1);

    expect(harness.enemies).toHaveLength(1);
    expect(harness.enemies[0].x - harness.enemies[0].radius).toBeGreaterThanOrEqual(0);
    expect(harness.enemies[0].x + harness.enemies[0].radius).toBeLessThanOrEqual(WORLD_MAP.width);
    expect(harness.enemies[0].y - harness.enemies[0].radius).toBeGreaterThanOrEqual(0);
    expect(harness.enemies[0].y + harness.enemies[0].radius).toBeLessThanOrEqual(WORLD_MAP.height);
  });

  it('rejects points intersecting the player and recovers on a later sample', () => {
    const harness = createHarness({
      randomValues: [0, 0.5, 0.3, 0.5],
      player: { x: 512, y: 675, radius: 16 },
    });

    harness.system.update(1);

    expect(harness.enemies).toHaveLength(1);
    expect(harness.enemies[0].id).toBe('enemy-1');
    expect(Math.hypot(
      harness.enemies[0].x - harness.player.x,
      harness.enemies[0].y - harness.player.y,
    )).toBeGreaterThanOrEqual(harness.enemies[0].radius + harness.player.radius);
    expect(harness.getRandomCalls()).toBe(4);
  });

  it('bounds failed placement to sixteen samples and tries again at the next token', () => {
    const harness = createHarness({
      randomValues: [0, 0.5],
      player: { x: 512, y: 675, radius: 16 },
    });

    harness.system.update(1);
    expect(harness.enemies).toHaveLength(0);
    expect(harness.getRandomCalls()).toBe(32);

    harness.player.x = 1200;
    harness.player.y = 675;
    harness.system.update(1);
    expect(harness.enemies).toHaveLength(1);
  });

  it('skips safely when the map has no legal spawn segment outside the viewport', () => {
    const world = { width: 500, height: 500 };
    const camera = new Camera({
      worldWidth: world.width,
      worldHeight: world.height,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    const harness = createHarness({ world, camera });

    expect(() => harness.system.update(1)).not.toThrow();
    expect(harness.enemies).toHaveLength(0);
    expect(harness.getRandomCalls()).toBe(0);
  });

  it('rejects invalid deltas and random-source values', () => {
    const invalidRandom = createHarness({ randomValues: [Number.NaN] });
    const regular = createHarness();

    expect(() => regular.system.update(-1)).toThrow(RangeError);
    expect(() => regular.system.update(Number.NaN)).toThrow(RangeError);
    expect(() => invalidRandom.system.update(1)).toThrow(RangeError);
  });
});
