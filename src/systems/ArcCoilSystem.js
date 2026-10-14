import { ARC_COIL_CONFIG } from '../config/expansionWeaponConfig.js';
import { ARC_EVOLUTION_CONFIG } from '../config/evolutionConfig.js';
import { initializeWeapon, nearest, prepareShot, resetWeapon, weaponSnapshot } from './weaponTargeting.js';

export class ArcCoilSystem {
  constructor({ player, enemies, enemyDamageSystem, config = ARC_COIL_CONFIG } = {}) {
    initializeWeapon(this, { player, enemies, enemyDamageSystem, config });
    if (!Number.isFinite(config.jumpRange) || config.jumpRange <= 0 || !Number.isFinite(config.falloff)
      || config.falloff <= 0 || config.falloff > 1) throw new RangeError('Invalid arc chaining configuration');
  }

  update(options) {
    const shot = prepareShot(this, options);
    if (!shot) return 0;
    const hit = new Set();
    let target = shot.target, origin = this.player, damage = shot.damage;
    while (target && hit.size < shot.maxTargets) {
      hit.add(target.id);
      this.enemyDamageSystem.applyDamage(target, damage, this.config.id);
      this.visuals.push({ x1: origin.x, y1: origin.y, x2: target.x, y2: target.y,
        color: this.config.color, remaining: this.config.visualSeconds });
      origin = target;
      damage *= this.config.falloff;
      target = nearest(origin, shot.targets, this.config.jumpRange, hit);
    }
    if (options.evolved === true && hit.size > 0) {
      for (const enemy of shot.targets) {
        if (enemy.alive && enemy.hp > 0 && Math.hypot(enemy.x - origin.x, enemy.y - origin.y) <= ARC_EVOLUTION_CONFIG.radius + enemy.radius) {
          this.enemyDamageSystem.applyDamage(enemy, ARC_EVOLUTION_CONFIG.damage * (options.damageMultiplier ?? 1), this.config.id);
        }
      }
      this.visuals.push({ shape: 'blast', x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y,
        radius: ARC_EVOLUTION_CONFIG.radius, color: '#d6b7ff', remaining: ARC_EVOLUTION_CONFIG.visualSeconds });
    }
    return hit.size;
  }

  getSnapshot() { return weaponSnapshot(this); }
  reset() { resetWeapon(this); }
}
