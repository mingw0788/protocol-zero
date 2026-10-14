import { RAILGUN_CONFIG } from '../config/expansionWeaponConfig.js';
import { RAIL_EVOLUTION_CONFIG } from '../config/evolutionConfig.js';
import { initializeWeapon, liveTargets, prepareShot, resetWeapon, weaponSnapshot } from './weaponTargeting.js';

export class RailgunSystem {
  #fields = [];
  #fieldCooldowns = new Map();
  constructor({ player, enemies, enemyDamageSystem, config = RAILGUN_CONFIG } = {}) {
    initializeWeapon(this, { player, enemies, enemyDamageSystem, config });
  }

  update(options) {
    const shot = prepareShot(this, options);
    if (options.deltaSeconds > 0) this.#updateFields(options.deltaSeconds);
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
    for (const { enemy } of hits) this.enemyDamageSystem.applyDamage(enemy, shot.damage, this.config.id);
    this.visuals.push({ x1: this.player.x, y1: this.player.y, x2: this.player.x + dx * this.config.range,
      y2: this.player.y + dy * this.config.range, anchorX: this.player.x, anchorY: this.player.y,
      color: this.config.color, remaining: this.config.visualSeconds });
    if (options.evolved === true) {
      if (this.#fields.length >= RAIL_EVOLUTION_CONFIG.maxFields) this.#fields.shift();
      this.#fields.push({ x1: this.player.x, y1: this.player.y, x2: this.player.x + dx * this.config.range,
        y2: this.player.y + dy * this.config.range, remaining: RAIL_EVOLUTION_CONFIG.lifetime, damage: RAIL_EVOLUTION_CONFIG.damage * (options.damageMultiplier ?? 1) });
      this.#damageFields();
    }
    return hits.length;
  }

  #updateFields(deltaSeconds) {
    for (const [id, time] of this.#fieldCooldowns) {
      if (time <= deltaSeconds + 1e-9) this.#fieldCooldowns.delete(id);
      else this.#fieldCooldowns.set(id, time - deltaSeconds);
    }
    this.#fields = this.#fields.map(field => ({ ...field, remaining: field.remaining - deltaSeconds })).filter(field => field.remaining > 1e-9);
    this.#damageFields();
    const ids = new Set(liveTargets(this.enemies).map(enemy => enemy.id));
    for (const id of this.#fieldCooldowns.keys()) if (!ids.has(id)) this.#fieldCooldowns.delete(id);
  }

  #damageFields() {
    for (const enemy of liveTargets(this.enemies)) {
      if (this.#fieldCooldowns.has(enemy.id)) continue;
      let damage = 0;
      for (const field of this.#fields) {
        const dx = field.x2 - field.x1, dy = field.y2 - field.y1, lengthSquared = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((enemy.x - field.x1) * dx + (enemy.y - field.y1) * dy) / lengthSquared));
        if (Math.hypot(enemy.x - field.x1 - t * dx, enemy.y - field.y1 - t * dy) <= RAIL_EVOLUTION_CONFIG.halfWidth + enemy.radius) damage = Math.max(damage, field.damage);
      }
      if (damage > 0 && this.enemyDamageSystem.applyDamage(enemy, damage, this.config.id)) this.#fieldCooldowns.set(enemy.id, RAIL_EVOLUTION_CONFIG.hitInterval);
    }
  }

  getSnapshot() { return weaponSnapshot(this); }
  getFieldsSnapshot() { return Object.freeze(this.#fields.map(({ damage, ...field }) => Object.freeze(field))); }
  reset() { this.#fields = []; this.#fieldCooldowns.clear(); resetWeapon(this); }
}
