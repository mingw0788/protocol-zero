import { DRONE_CONFIG } from '../config/expansionWeaponConfig.js';
import { Projectile } from '../entities/Projectile.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { initializeWeapon, liveTargets, nearest, resetWeapon } from './weaponTargeting.js';

export class DroneSystem {
  #drones = [];
  #bolts = [];
  #angle = 0;
  #nextId = 1;
  constructor({ player, enemies, enemyDamageSystem, config = DRONE_CONFIG } = {}) {
    initializeWeapon(this, { player, enemies, enemyDamageSystem, config });
    this.projectileSystem = new ProjectileSystem({ projectiles: this.#bolts, enemies, enemyDamageSystem });
  }
  update({ deltaSeconds, level = 0, damageMultiplier = 1, fireRateMultiplier = 1 } = {}) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isSafeInteger(level) || level < 0 || level > this.config.maxLevel
      || !Number.isFinite(damageMultiplier) || damageMultiplier <= 0 || !Number.isFinite(fireRateMultiplier) || fireRateMultiplier <= 0) throw new RangeError('Invalid drone step');
    if (deltaSeconds === 0) return 0;
    this.projectileSystem.update(deltaSeconds);
    const active = level > 0 && this.player.weaponStates.some(state => state.id === this.config.id);
    const count = active ? Math.min(3, 1 + Math.floor((level - 1) / 2)) : 0;
    this.#drones.length = Math.min(this.#drones.length, count);
    while (this.#drones.length < count) this.#drones.push({ cooldown: 0, x: this.player.x, y: this.player.y, aimAngle: 0 });
    this.#angle = (this.#angle + deltaSeconds) % (Math.PI * 2);
    const targets = liveTargets(this.enemies);
    let fired = 0;
    for (const [index, drone] of this.#drones.entries()) {
      const angle = this.#angle + Math.PI * 2 * index / count;
      drone.x = this.player.x + Math.cos(angle) * this.config.orbitRadius;
      drone.y = this.player.y + Math.sin(angle) * this.config.orbitRadius;
      drone.cooldown = Math.max(0, drone.cooldown - deltaSeconds);
      const target = nearest(drone, targets, this.config.range);
      if (!target || drone.cooldown > 1e-9 || this.#bolts.length >= this.config.maxProjectiles) continue;
      drone.aimAngle = Math.atan2(target.y - drone.y, target.x - drone.x);
      this.#bolts.push(new Projectile({ id: `drone-bolt-${this.#nextId++}`, ownerId: 'player', weaponId: this.config.id,
        x: drone.x, y: drone.y, vx: Math.cos(drone.aimAngle) * this.config.projectileSpeed,
        vy: Math.sin(drone.aimAngle) * this.config.projectileSpeed, radius: this.config.projectileRadius,
        damage: this.config.damage * (1 + this.config.damageBonusPerLevel * (level - 1)) * damageMultiplier,
        lifetimeSeconds: this.config.projectileLifetime }));
      drone.cooldown = this.config.fireIntervalSeconds / fireRateMultiplier;
      fired++;
    }
    return fired;
  }
  getSnapshot() {
    return Object.freeze({ drones: Object.freeze(this.#drones.map(drone => Object.freeze({ x: drone.x, y: drone.y, aimAngle: drone.aimAngle }))),
      bolts: Object.freeze(this.#bolts.map(bolt => Object.freeze({ x: bolt.x, y: bolt.y, radius: bolt.radius }))) });
  }
  reset() { this.#drones.length = 0; this.#bolts.length = 0; this.#angle = 0; this.#nextId = 1; this.projectileSystem.reset(); resetWeapon(this); }
}
