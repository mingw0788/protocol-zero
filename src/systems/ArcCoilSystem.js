import { ARC_COIL_CONFIG } from '../config/expansionWeaponConfig.js';
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
    return hit.size;
  }

  getSnapshot() { return weaponSnapshot(this); }
  reset() { resetWeapon(this); }
}
