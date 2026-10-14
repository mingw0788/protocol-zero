import { CRYO_CONFIG } from '../config/expansionWeaponConfig.js';
import { initializeWeapon, prepareShot, resetWeapon, weaponSnapshot } from './weaponTargeting.js';

export class CryoSystem {
  constructor({ player, enemies, enemyDamageSystem, statusSystem, config = CRYO_CONFIG } = {}) {
    initializeWeapon(this, { player, enemies, enemyDamageSystem, config });
    if (typeof statusSystem?.applySlow !== 'function') throw new TypeError('Cryo requires a status system');
    this.statusSystem = statusSystem;
  }
  update(options) {
    const shot = prepareShot(this, options);
    if (!shot) return 0;
    const angle = Math.atan2(shot.target.y - this.player.y, shot.target.x - this.player.x);
    this.player.weaponStates.find(state => state.id === this.config.id).aimAngle = angle;
    let hits = 0;
    for (const enemy of shot.targets) {
      const dx = enemy.x - this.player.x, dy = enemy.y - this.player.y;
      const difference = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
      if (Math.hypot(dx, dy) > this.config.range || Math.abs(difference) > this.config.halfAngle) continue;
      if (this.enemyDamageSystem.applyDamage(enemy, shot.damage, this.config.id)) {
        this.statusSystem.applySlow(enemy, { sourceId: this.config.id, factor: this.config.slowFactor, duration: this.config.slowDuration });
        hits++;
      }
    }
    this.visuals.push({ shape: 'cone', x1: this.player.x, y1: this.player.y,
      x2: this.player.x + Math.cos(angle) * this.config.range, y2: this.player.y + Math.sin(angle) * this.config.range,
      anchorX: this.player.x, anchorY: this.player.y, halfAngle: this.config.halfAngle,
      color: this.config.color, remaining: this.config.visualSeconds });
    return hits;
  }
  getSnapshot() { return weaponSnapshot(this); }
  reset() { resetWeapon(this); }
}
