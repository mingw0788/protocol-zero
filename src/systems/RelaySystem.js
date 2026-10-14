import { RELAY_CONFIG } from '../config/relayConfig.js';

export class RelaySystem {
  #enabled = false;
  #stations = [];
  #firepowerRemaining = 0;

  constructor({ player, enemies, enemyDamageSystem, config = RELAY_CONFIG }) {
    if (!player || !Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function') {
      throw new TypeError('Invalid relay dependencies');
    }
    for (const key of ['radius', 'channelSeconds', 'healing', 'pulseRadius', 'damage', 'bossDamage', 'visualSeconds', 'energyCap', 'killEnergy', 'energyRadius', 'batteryRange', 'firepowerBonus', 'firepowerSeconds']) {
      if (!Number.isFinite(config[key]) || config[key] <= 0) throw new RangeError('Invalid relay setting: ' + key);
    }
    if (!Array.isArray(config.stations) || config.stations.some(s => !s.id || !s.name || !Number.isFinite(s.x) || !Number.isFinite(s.y))
      || new Set(config.stations.map(s => s.id)).size !== config.stations.length) throw new RangeError('Invalid relay stations');
    this.player = player;
    this.enemies = enemies;
    this.damageSystem = enemyDamageSystem;
    this.config = Object.freeze({ ...config, stations: Object.freeze(config.stations.map(s => Object.freeze({ ...s }))) });
    this.reset();
  }

  setEnabled(enabled) { this.#enabled = Boolean(enabled); this.reset(); }
  reset() {
    this.#stations = this.config.stations.map(s => ({ ...s, charge: 0, energy: this.config.energyCap, pulseRemaining: 0 }));
    this.#firepowerRemaining = 0;
  }

  get damageMultiplier() { return this.#firepowerRemaining > 0 ? 1 + this.config.firepowerBonus : 1; }
  getBuffSnapshot() { return Object.freeze({ remaining: this.#firepowerRemaining, damageMultiplier: this.damageMultiplier }); }

  notifyEnemyDeath(event) {
    if (!Number.isFinite(event?.x) || !Number.isFinite(event?.y)) throw new TypeError('Enemy death requires finite coordinates');
    if (!this.#enabled) return 0;
    let recharged = 0;
    for (const station of this.#stations) {
      if (Math.hypot(event.x - station.x, event.y - station.y) > this.config.energyRadius) continue;
      const next = Math.min(this.config.energyCap, station.energy + this.config.killEnergy);
      if (next !== station.energy) { station.energy = next; recharged++; }
    }
    return recharged;
  }

  rechargeNearest(x, y) {
    if (!this.#enabled || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const target = this.#stations.map(station => ({ station, distance: Math.hypot(x - station.x, y - station.y) }))
      .filter(({ station, distance }) => station.energy < this.config.energyCap && distance <= this.config.batteryRange)
      .sort((a, b) => a.distance - b.distance)[0]?.station;
    if (!target) return false;
    target.energy = this.config.energyCap;
    target.charge = 0;
    return true;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid relay delta');
    if (!this.#enabled || deltaSeconds === 0) return 0;
    this.#firepowerRemaining = Math.max(0, this.#firepowerRemaining - deltaSeconds);
    let activated = 0;
    for (const station of this.#stations) {
      station.pulseRemaining = Math.max(0, station.pulseRemaining - deltaSeconds);
      if (station.energy < this.config.energyCap || !this.player.alive || this.player.hp <= 0
        || Math.hypot(this.player.x - station.x, this.player.y - station.y) > this.config.radius) continue;
      station.charge = Math.min(this.config.channelSeconds, station.charge + deltaSeconds);
      if (station.charge + 1e-9 < this.config.channelSeconds) continue;
      station.energy = 0;
      station.charge = 0;
      station.pulseRemaining = this.config.visualSeconds;
      if (station.effect === 'firepower') this.#firepowerRemaining = this.config.firepowerSeconds;
      else this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.config.healing);
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - station.x, enemy.y - station.y) <= this.config.pulseRadius + enemy.radius) {
          this.damageSystem.applyDamage(enemy, enemy.category === 'boss' ? this.config.bossDamage : this.config.damage, 'relay-pulse');
        }
      }
      activated++;
    }
    return activated;
  }

  getSnapshot() {
    return Object.freeze(this.#enabled ? this.#stations.map(s => Object.freeze({ ...s, used: s.energy === 0,
      radius: this.config.radius, pulseRadius: this.config.pulseRadius,
      channelSeconds: this.config.channelSeconds, healing: this.config.healing,
      firepowerBonus: this.config.firepowerBonus, firepowerSeconds: this.config.firepowerSeconds,
      pulseProgress: 1 - s.pulseRemaining / this.config.visualSeconds,
      progress: Math.min(1, s.charge / this.config.channelSeconds),
    })) : []);
  }
}
