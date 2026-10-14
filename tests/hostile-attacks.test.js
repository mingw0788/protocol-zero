import { describe, expect, it } from 'vitest';
import { EnemyAttackSystem } from '../src/systems/EnemyAttackSystem.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { DamageSystem } from '../src/systems/DamageSystem.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { ENEMY_ATTACK_CONFIG } from '../src/config/enemyAttackConfig.js';

function setup(type, distance) {
  const player = new Player();
  const enemy = new Enemy({ id: 'hostile', x: player.x - distance, y: player.y, config: ENEMY_CONFIG[type] });
  const enemies = [enemy];
  const system = new EnemyAttackSystem({ player, enemies });
  return { player, enemy, enemies, system };
}

describe('telegraphed enemy attacks', () => {
  it('locks a sniper aim for 0.9 seconds and a fast bullet cannot tunnel through the player', () => {
    const { player, enemy, system } = setup('EN04', 200);
    expect(system.update(.1)).toEqual([]);
    expect(system.getSnapshot().aims).toHaveLength(1);
    expect(enemy.attackLocked).toBe(true);
    system.update(.89);
    expect(system.getSnapshot().projectiles).toHaveLength(0);
    system.update(.01);
    expect(system.getSnapshot().projectiles).toHaveLength(1);
    expect(system.update(.7)).toEqual([expect.objectContaining({ damage: 12, sourceTypeId: 'EN-04' })]);
    expect(system.getSnapshot().projectiles).toHaveLength(0);
    expect(player.hp).toBe(100); // The shared DamageSystem applies candidate hits.
  });

  it('does not retarget a sniper shot when its original target moves', () => {
    const { player, system } = setup('EN04', 200);
    system.update(.1);
    player.y += 150;
    system.update(.9);
    expect(system.update(.7)).toEqual([]);
    expect(system.getSnapshot().projectiles[0].y).toBe(675);
  });

  it('stops and warns for a full second before exploding, without rewarding self-destruction', () => {
    const { enemy, system } = setup('EN05', 70);
    system.update(.1);
    expect(enemy.attackLocked).toBe(true);
    expect(system.getSnapshot().fuses[0].remaining).toBe(1);
    expect(system.update(.99)).toEqual([]);
    expect(system.update(.01)).toEqual([expect.objectContaining({ damage: 22, sourceTypeId: 'EN-05' })]);
    expect(enemy).toMatchObject({ hp: 0, alive: false, defeatedBySelf: true, deathProcessed: false });
  });

  it('cancels an armed bomber when it dies before detonation and resets all effects', () => {
    const { enemy, system } = setup('EN05', 70);
    system.update(.1);
    enemy.hp = 0; enemy.alive = false;
    expect(system.update(1)).toEqual([]);
    expect(system.getSnapshot().explosions).toEqual([]);
    system.reset();
    expect(system.getSnapshot()).toEqual({ aims: [], fuses: [], projectiles: [], explosions: [] });
  });

  it('boosts other normal enemies once without changing their base speed', () => {
    const player = new Player();
    const ordinary = new Enemy({ id: 'ordinary', x: 1000, y: player.y });
    const elite = new Enemy({ id: 'elite', x: 1000, y: player.y + 100, config: ENEMY_CONFIG.EN06 });
    const otherElite = new Enemy({ id: 'elite-2', x: 1000, y: player.y + 120, config: ENEMY_CONFIG.EN06 });
    new EnemySystem({ player, enemies: [ordinary, elite, otherElite] }).update(1);
    expect(ordinary.x).toBeCloseTo(1096);
    expect(ordinary.speed).toBe(80);
    expect(Math.hypot(elite.x - 1000, elite.y - (player.y + 100))).toBeCloseTo(60);
  });

  it('uses aura positions from the beginning of the step independently of enemy order', () => {
    const run = eliteFirst => {
      const player = new Player();
      const ordinary = new Enemy({ id: 'ordinary', x: 760, y: player.y });
      const elite = new Enemy({ id: 'elite', x: 1000, y: player.y, config: ENEMY_CONFIG.EN06 });
      new EnemySystem({ player, enemies: eliteFirst ? [elite, ordinary] : [ordinary, elite] }).update(1);
      return ordinary.x;
    };
    expect(run(true)).toBe(856);
    expect(run(false)).toBe(856);
  });

  it('rejects unsafe warning times or missing projectile settings', () => {
    const player = new Player();
    expect(() => new EnemyAttackSystem({ player, enemies: [], config: { ...ENEMY_ATTACK_CONFIG, sniperWarning: .1 } })).toThrow(RangeError);
    const missingSpeed = { ...ENEMY_ATTACK_CONFIG }; delete missingSpeed.bulletSpeed;
    expect(() => new EnemyAttackSystem({ player, enemies: [], config: missingSpeed })).toThrow(RangeError);
  });

  it('caps hostile projectiles and clears expired projectiles without accumulating history', () => {
    const player = new Player();
    const enemies = Array.from({ length: 70 }, (_, index) => new Enemy({ id: `sniper-${index}`,
      x: player.x - 200, y: player.y, config: ENEMY_CONFIG.EN04 }));
    const system = new EnemyAttackSystem({ player, enemies });
    system.update(.1); system.update(.9);
    expect(system.getSnapshot().projectiles).toHaveLength(64);
    player.y += 300;
    for (const enemy of enemies) enemy.alive = false;
    system.update(3);
    expect(system.getSnapshot().projectiles).toHaveLength(0);
  });
});

describe('unified player damage', () => {
  it('takes the strongest simultaneous impact once, with shield absorption and shared immunity', () => {
    const player = new Player(); player.shield = 15;
    const damage = new DamageSystem({ player });
    const hits = [{ damage: 10, sourceTypeId: 'EN-01' }, { damage: 22, sourceTypeId: 'EN-05' }, { damage: 12, sourceTypeId: 'EN-04' }];
    expect(damage.applyDamageBatch(hits)).toMatchObject({ damage: 7, shieldDamage: 15, sourceTypeIds: ['EN-05'] });
    expect(player.hp).toBe(93);
    expect(damage.applyDamageBatch(hits).damaged).toBe(false);
    damage.update(.6); player.dashRemaining = .1;
    expect(damage.applyDamageBatch(hits).damaged).toBe(false);
  });

  it('rejects an empty source before applying any player damage', () => {
    const player = new Player();
    const damage = new DamageSystem({ player });
    expect(() => damage.applyDamageBatch([{ damage: 10, sourceTypeId: ' ' }])).toThrow(TypeError);
    expect(player.hp).toBe(100);
  });
});
