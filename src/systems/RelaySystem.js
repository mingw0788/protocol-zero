import { RELAY_CONFIG } from '../config/relayConfig.js';

export class RelaySystem {
  #enabled = false;
  #stations = [];
  #firepowerRemaining = 0;
  #firepowerBonus = 0;
  #amplifierArmed = false;
  #definitions;

  constructor({ player, enemies, enemyDamageSystem, config = RELAY_CONFIG }) {
    if (!player || !Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function') {
      throw new TypeError('Invalid relay dependencies');
    }
    for (const key of ['radius', 'channelSeconds', 'healing', 'pulseRadius', 'damage', 'bossDamage', 'visualSeconds', 'energyCap', 'killEnergy', 'energyRadius', 'batteryRange', 'firepowerBonus', 'firepowerSeconds', 'amplifierMultiplier', 'amplifierRadiusMultiplier']) {
      if (!Number.isFinite(config[key]) || config[key] <= 0) throw new RangeError('Invalid relay setting: ' + key);
    }
    if (!Array.isArray(config.stations) || config.stations.some(s => !s.id || !s.name || !Number.isFinite(s.x) || !Number.isFinite(s.y))
      || new Set(config.stations.map(s => s.id)).size !== config.stations.length) throw new RangeError('Invalid relay stations');
    this.player = player;
    this.enemies = enemies;
    this.damageSystem = enemyDamageSystem;
    this.config = Object.freeze({ ...config, stations: Object.freeze(config.stations.map(s => Object.freeze({ ...s }))) });
    this.#definitions = this.config.stations;
    this.reset();
  }

  setEnabled(enabled) { this.#enabled = Boolean(enabled); this.reset(); }
  configure({ enabled, stations = this.config.stations } = {}) {
    if (!Array.isArray(stations) || new Set(stations.map(station => station.id)).size !== stations.length
      || stations.some(station => !station.id || !station.name || !Number.isFinite(station.x) || !Number.isFinite(station.y))) throw new RangeError('Invalid relay layout');
    this.#definitions = Object.freeze(stations.map(station => Object.freeze({ ...station })));
    this.#enabled = Boolean(enabled); this.reset();
  }
  reset() {
    this.#stations = this.#definitions.map(s => ({ ...s, charge: 0, energy: s.initialEnergy ?? this.config.energyCap,
      basePulseRadius: s.pulseRadius ?? this.config.pulseRadius, pulseRemaining: 0 }));
    this.#firepowerRemaining = 0;
    this.#firepowerBonus = 0;
    this.#amplifierArmed = false;
  }

  get amplifierArmed() { return this.#amplifierArmed; }
  armAmplifier() { if (this.#amplifierArmed) return false; this.#amplifierArmed = true; return true; }
  get damageMultiplier() { return this.#firepowerRemaining > 0 ? 1 + this.#firepowerBonus : 1; }
  getBuffSnapshot() { return Object.freeze({ remaining: this.#firepowerRemaining, damageMultiplier: this.damageMultiplier }); }

  notifyEnemyDeath(event) {
    if (!Number.isFinite(event?.x) || !Number.isFinite(event?.y)) throw new TypeError('Enemy death requires finite coordinates');
    if (!this.#enabled) return 0;
    let recharged = 0;
    for (const station of this.#stations) {
      if (Math.hypot(event.x - station.x, event.y - station.y) > (station.energyRadius ?? this.config.energyRadius)) continue;
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
        || Math.hypot(this.player.x - station.x, this.player.y - station.y) > (station.radius ?? this.config.radius)) continue;
      const channelSeconds = station.channelSeconds ?? this.config.channelSeconds;
      station.charge = Math.min(channelSeconds, station.charge + deltaSeconds);
      if (station.charge + 1e-9 < channelSeconds) continue;
      station.energy = 0;
      station.charge = 0;
      station.pulseRemaining = this.config.visualSeconds;
      const multiplier = this.#amplifierArmed ? this.config.amplifierMultiplier : 1;
      station.amplified = this.#amplifierArmed;
      station.pulseRadius = station.basePulseRadius * (this.#amplifierArmed ? this.config.amplifierRadiusMultiplier : 1);
      this.#amplifierArmed = false;
      if (station.effect === 'firepower') {
        this.#firepowerRemaining = this.config.firepowerSeconds * multiplier;
        this.#firepowerBonus = this.config.firepowerBonus * multiplier;
      } else if (station.effect !== 'reactor') this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round((station.healing ?? this.config.healing) * multiplier));
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - station.x, enemy.y - station.y) <= station.pulseRadius + enemy.radius) {
          this.damageSystem.applyDamage(enemy, (enemy.category === 'boss' ? station.bossDamage ?? this.config.bossDamage : station.damage ?? this.config.damage) * multiplier, 'relay-pulse');
        }
      }
      activated++;
    }
    return activated;
  }

  getSnapshot() {
    return Object.freeze(this.#enabled ? this.#stations.map(s => Object.freeze({ ...s, used: s.energy === 0,
      radius: s.radius ?? this.config.radius, pulseRadius: s.pulseRadius ?? this.config.pulseRadius,
      channelSeconds: s.channelSeconds ?? this.config.channelSeconds, healing: s.healing ?? this.config.healing,
      firepowerBonus: this.config.firepowerBonus, firepowerSeconds: this.config.firepowerSeconds,
      pulseProgress: 1 - s.pulseRemaining / this.config.visualSeconds,
      progress: Math.min(1, s.charge / (s.channelSeconds ?? this.config.channelSeconds)),
    })) : []);
  }
}
