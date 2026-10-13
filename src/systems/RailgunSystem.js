import { RAILGUN_CONFIG } from '../config/expansionWeaponConfig.js';
import { initializeWeapon, prepareShot, resetWeapon, weaponSnapshot } from './weaponTargeting.js';

export class RailgunSystem {
  constructor({ player, enemies, enemyDamageSystem, config = RAILGUN_CONFIG } = {}) {
    initializeWeapon(this, { player, enemies, enemyDamageSystem, config });
  }

  update(options) {
    const shot = prepareShot(this, options);
    if (!shot) return 0;
    let dx = shot.target.x - this.player.x, dy = shot.target.y - this.player.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) { dx = 1; dy = 0; } else { dx /= length; dy /= length; }
    this.player.weaponStates.find((state) => state.id === this.config.id).aimAngle = Math.atan2(dy, dx);
    const hits = shot.targets.map((enemy) => {
      const x = enemy.x - this.player.x, y = enemy.y - this.player.y;
      const along = Math.max(0, Math.min(this.config.range, x * dx + y * dy));
      return { enemy, along, intersects: Math.hypot(x - along * dx, y - along * dy) <= enemy.radius };
    }).filter((hit) => hit.intersects).sort((a, b) => a.along - b.along).slice(0, shot.maxTargets);
    for (const { enemy } of hits) this.enemyDamageSystem.applyDamage(enemy, shot.damage);
    this.visuals.push({ x1: this.player.x, y1: this.player.y, x2: this.player.x + dx * this.config.range,
      y2: this.player.y + dy * this.config.range, color: this.config.color, remaining: this.config.visualSeconds });
    return hits.length;
  }

  getSnapshot() { return weaponSnapshot(this); }
  reset() { resetWeapon(this); }
}
