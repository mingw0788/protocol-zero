import { describe, expect, it } from 'vitest';
import { BOSS_CONFIG } from '../src/config/bossConfig.js';
import { BossSystem } from '../src/systems/BossSystem.js';
import { Player } from '../src/entities/Player.js';
import { Camera } from '../src/rendering/Camera.js';
import { WORLD_MAP } from '../src/config/worldConfig.js';

function createBossSystem({ playerX, playerY, config = BOSS_CONFIG } = {}) {
  const player = new Player({
    worldWidth: WORLD_MAP.width,
    worldHeight: WORLD_MAP.height,
    x: playerX ?? WORLD_MAP.width / 2,
    y: playerY ?? WORLD_MAP.height / 2,
  });
  const camera = new Camera({ worldWidth: WORLD_MAP.width, worldHeight: WORLD_MAP.height });
  camera.follow(player);
  const enemies = [];
  const bossSystem = new BossSystem({ enemies, player, camera, world: WORLD_MAP, config });
  return { enemies, player, camera, bossSystem };
}

describe('BossSystem spawn', () => {
  it('keeps the confirmed Boss health and frozen D-036 first-tuning configuration', () => {
    expect(BOSS_CONFIG).toMatchObject({
      typeId: 'BOSS-01',
      name: '机械暴君 T-01',
      category: 'boss',
      hp: 1800,
      maxHp: 1800,
      radius: 44,
      speed: 60,
      contactDamage: 20,
      expDrop: 0,
      spawnTimeSeconds: 270,
      spawnClearance: 32,
      initialAttackDelaySeconds: 2,
      telegraphSeconds: 0.8,
      chargeSpeed: 420,
      chargeDurationSeconds: 0.6,
      recoverySeconds: 0.8,
      attackCooldownSeconds: 3.2,
      warningWidthPadding: 24,
    });
    expect(Object.isFrozen(BOSS_CONFIG)).toBe(true);
  });

  it.each([
    ['radius', 0],
    ['speed', Number.POSITIVE_INFINITY],
    ['spawnTimeSeconds', -1],
    ['spawnClearance', Number.NaN],
    ['telegraphSeconds', 0],
    ['chargeDurationSeconds', -0.1],
  ])('rejects an invalid %s config value', (key, value) => {
    expect(() => createBossSystem({ config: { ...BOSS_CONFIG, [key]: value } }))
      .toThrow(RangeError);
  });

  it('does not create the Boss before the effective-time spawn boundary', () => {
    const { enemies, bossSystem } = createBossSystem();

    bossSystem.update(1 / 60, 269.999);

    expect(enemies).toHaveLength(0);
    expect(bossSystem.getSnapshot()).toBeNull();
  });

  it.each([
    [80, 80],
    [WORLD_MAP.width - 80, 80],
    [80, WORLD_MAP.height - 80],
    [WORLD_MAP.width - 80, WORLD_MAP.height - 80],
  ])('spawns one safe off-view Boss at or after 270 seconds for player position %i,%i', (playerX, playerY) => {
    const { enemies, player, camera, bossSystem } = createBossSystem({ playerX, playerY });

    bossSystem.update(0, 270);
    bossSystem.update(0, 271);

    expect(enemies).toHaveLength(1);
    const [boss] = enemies;
    expect(boss).toMatchObject({
      id: 'boss-t01',
      typeId: 'BOSS-01',
      category: 'boss',
      hp: 1800,
      maxHp: 1800,
      expDrop: 0,
    });
    expect(boss.x).toBeGreaterThanOrEqual(boss.radius);
    expect(boss.x).toBeLessThanOrEqual(WORLD_MAP.width - boss.radius);
    expect(boss.y).toBeGreaterThanOrEqual(boss.radius);
    expect(boss.y).toBeLessThanOrEqual(WORLD_MAP.height - boss.radius);
    expect(Math.hypot(boss.x - player.x, boss.y - player.y))
      .toBeGreaterThanOrEqual(boss.radius + player.radius);

    const dx = Math.max(camera.x - boss.x, 0, boss.x - (camera.x + camera.viewportWidth));
    const dy = Math.max(camera.y - boss.y, 0, boss.y - (camera.y + camera.viewportHeight));
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(boss.radius + BOSS_CONFIG.spawnClearance);
  });

  it('returns an immutable snapshot without exposing the Boss entity', () => {
    const { enemies, bossSystem } = createBossSystem();

    bossSystem.update(0, 270);
    const snapshot = bossSystem.getSnapshot();

    expect(snapshot).toMatchObject({
      id: 'boss-t01',
      typeId: 'BOSS-01',
      name: '机械暴君 T-01',
      hp: 1800,
      maxHp: 1800,
      alive: true,
      phase: 'approach',
      phaseRemaining: 2,
      chargeDirection: null,
      chargeEnd: null,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).not.toBe(enemies[0]);
    expect(() => Object.assign(snapshot, { hp: 0 })).toThrow(TypeError);
  });
});
