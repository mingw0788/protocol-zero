import { DEPLOYABLE_CONFIG } from '../config/supplyConfig.js';
import { liveTargets, nearest } from './weaponTargeting.js';

const freezeList = list => Object.freeze(list.map(item => Object.freeze({ ...item })));
export class DeployableSystem {
  #turrets = [];
  #fields = [];
  #beams = [];
  #pulse = null;
  #nextId = 1;
  constructor({ player, enemies, enemyDamageSystem, statusSystem, config = DEPLOYABLE_CONFIG } = {}) {
    if (!player || !Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function'
      || typeof statusSystem?.applySlow !== 'function') throw new TypeError('Invalid deployable dependencies');
    for (const value of Object.values(config)) if (!Number.isFinite(value) || value <= 0) throw new RangeError('Invalid deployable config');
    Object.assign(this, { player, enemies, enemyDamageSystem, statusSystem, config: Object.freeze({ ...config }) });
  }
  deploy(type) {
    if (!this.player.alive || this.player.hp <= 0) return false;
    const c = this.config;
    if (type === 'cryo-grenade') {
      const targets = liveTargets(this.enemies).filter(enemy => Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= c.grenadeRadius + enemy.radius);
      if (!targets.length) return false;
      for (const enemy of targets) this.statusSystem.applySlow(enemy, { sourceId: type, factor: c.slowFactor, duration: c.slowSeconds });
      this.#pulse = { x: this.player.x, y: this.player.y, radius: c.grenadeRadius, remaining: c.grenadeVisualSeconds, lifetime: c.grenadeVisualSeconds };
      return true;
    }
    const list = type === 'turret-kit' ? this.#turrets : type === 'healing-field' ? this.#fields : null;
    if (!list || list.length >= (type === 'turret-kit' ? c.turretCap : c.fieldCap)) return false;
    list.push({ id: `deployable-${this.#nextId++}`, x: this.player.x, y: this.player.y,
      remaining: type === 'turret-kit' ? c.turretSeconds : c.fieldSeconds, cooldown: 0, aimAngle: 0,
      radius: type === 'turret-kit' ? c.turretRange : c.fieldRadius });
    return true;
  }
  update(deltaSeconds, { damageMultiplier = 1, fireRateMultiplier = 1 } = {}) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(damageMultiplier) || damageMultiplier <= 0
      || !Number.isFinite(fireRateMultiplier) || fireRateMultiplier <= 0) throw new RangeError('Invalid deployable step');
    if (deltaSeconds === 0) return;
    for (const field of this.#fields) {
      const activeSeconds = Math.min(deltaSeconds, field.remaining);
      if (this.player.alive && this.player.hp > 0 && Math.hypot(this.player.x - field.x, this.player.y - field.y) <= field.radius) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.config.healingPerSecond * activeSeconds);
      }
      field.remaining = Math.max(0, field.remaining - deltaSeconds);
    }
    this.#fields = this.#fields.filter(field => field.remaining > 1e-9);
    this.#beams = this.#beams.map(beam => ({ ...beam, remaining: beam.remaining - deltaSeconds })).filter(beam => beam.remaining > 0);
    if (this.#pulse) { this.#pulse.remaining -= deltaSeconds; if (this.#pulse.remaining <= 0) this.#pulse = null; }
    for (const turret of this.#turrets) {
      turret.remaining = Math.max(0, turret.remaining - deltaSeconds);
      turret.cooldown = Math.max(0, turret.cooldown - deltaSeconds);
      if (turret.remaining <= 1e-9 || turret.cooldown > 1e-9) continue;
      const target = nearest(turret, liveTargets(this.enemies), this.config.turretRange);
      if (!target) continue;
      turret.aimAngle = Math.atan2(target.y - turret.y, target.x - turret.x);
      if (this.enemyDamageSystem.applyDamage(target, this.config.turretDamage * damageMultiplier, 'turret-kit')) {
        if (this.#beams.length >= this.config.beamCap) this.#beams.shift();
        this.#beams.push({ x1: turret.x, y1: turret.y, x2: target.x, y2: target.y, remaining: this.config.beamSeconds });
      }
      turret.cooldown = this.config.turretInterval / fireRateMultiplier;
    }
    this.#turrets = this.#turrets.filter(turret => turret.remaining > 1e-9);
  }
  getSnapshot() { return Object.freeze({ turrets: freezeList(this.#turrets), healingFields: freezeList(this.#fields), beams: freezeList(this.#beams), pulse: this.#pulse ? Object.freeze({ ...this.#pulse }) : null }); }
  reset() { this.#turrets = []; this.#fields = []; this.#beams = []; this.#pulse = null; this.#nextId = 1; }
}
