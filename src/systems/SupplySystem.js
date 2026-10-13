import { SUPPLY_CONFIG } from '../config/supplyConfig.js';

const freeze = (value) => value === null ? null : Object.freeze({ ...value });

export class SupplySystem {
  #enabled = false;
  #nextEvent = 0;
  #nextId = 1;
  #station = null;
  #pickups = [];
  #decoy = null;
  #activeItem = null;
  #overclockRemaining = 0;
  #scannerStacks = 0;
  #pulse = null;

  constructor({ player, random = Math.random, config = SUPPLY_CONFIG } = {}) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)
      || !Number.isFinite(player.radius) || player.radius <= 0 || typeof random !== 'function') {
      throw new TypeError('SupplySystem requires player coordinates, radius and random source');
    }
    for (const key of ['windowSeconds', 'channelSeconds', 'stationRadius', 'pickupRadius', 'pickupLifetime',
      'overclockSeconds', 'fireRateBonus', 'decoySeconds', 'decoyRadius', 'scannerBonus', 'scannerCap',
      'medkitHealing', 'empRadius', 'empDamage', 'empBossDamage', 'empVisualSeconds']) {
      if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError('Invalid supply setting: ' + key);
    }
    if (!Number.isSafeInteger(config.scannerCap) || !Array.isArray(config.schedule)
      || !Array.isArray(config.rewards) || config.rewards.length === 0
      || config.rewards.some((id) => !['overclock', 'decoy', 'scanner', 'medkit', 'emp-charge', 'relay-cell'].includes(id))) throw new RangeError('Invalid supply configuration');
    let previous = -1;
    for (const event of config.schedule) {
      if (!Number.isFinite(event.time) || event.time < 0 || event.time <= previous
        || !Number.isFinite(event.x) || !Number.isFinite(event.y)) throw new RangeError('Invalid supply schedule');
      previous = event.time;
    }
    this.player = player;
    this.random = random;
    this.config = Object.freeze({ ...config, schedule: Object.freeze(config.schedule.map(freeze)), rewards: Object.freeze([...config.rewards]) });
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    this.reset();
  }

  setEffects({ enemies, enemyDamageSystem, relaySystem, onEvent = null } = {}) {
    if (!Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function'
      || typeof relaySystem?.rechargeNearest !== 'function' || (onEvent !== null && typeof onEvent !== 'function')) {
      throw new TypeError('Supply effects require enemies, damage, relay and event interfaces');
    }
    this.enemies = enemies; this.enemyDamageSystem = enemyDamageSystem;
    this.relaySystem = relaySystem; this.onEvent = onEvent;
  }

  get fireRateMultiplier() { return this.#overclockRemaining > 0 ? 1 + this.config.fireRateBonus : 1; }
  get pickupRadiusBonus() { return this.#scannerStacks * this.config.scannerBonus; }

  addPickup(type, x, y) {
    if (!this.config.rewards.includes(type) || !Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Invalid supply pickup');
    this.#pickups.push({ id: 'supply-' + this.#nextId++, type, x, y, remaining: this.config.pickupLifetime });
  }

  deploy() {
    if (!this.player.alive || !this.#activeItem) return false;
    if (this.#activeItem === 'decoy') {
      this.#activeItem = null;
      this.#decoy = { x: this.player.x, y: this.player.y, radius: this.config.decoyRadius, remaining: this.config.decoySeconds };
      this.onEvent?.('decoy-deploy');
      return true;
    }
    if (this.#activeItem === 'emp-charge' && this.enemyDamageSystem && this.enemies) {
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= this.config.empRadius + enemy.radius) {
          this.enemyDamageSystem.applyDamage(enemy, enemy.category === 'boss' ? this.config.empBossDamage : this.config.empDamage);
        }
      }
      this.#activeItem = null;
      this.#pulse = { x: this.player.x, y: this.player.y, radius: this.config.empRadius,
        remaining: this.config.empVisualSeconds, lifetime: this.config.empVisualSeconds };
      this.onEvent?.('emp-fire');
      return true;
    }
    if (this.#activeItem === 'relay-cell' && this.relaySystem?.rechargeNearest(this.player.x, this.player.y)) {
      this.#activeItem = null;
      this.onEvent?.('relay-recharge');
      return true;
    }
    return false;
  }

  targetFor(enemy) {
    if (enemy?.category !== 'normal' || !this.#decoy) return null;
    return Math.hypot(enemy.x - this.#decoy.x, enemy.y - this.#decoy.y) <= this.#decoy.radius ? this.#decoy : null;
  }

  update(deltaSeconds, elapsedSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(elapsedSeconds)
      || elapsedSeconds < deltaSeconds) throw new RangeError('Invalid supply time');
    if (deltaSeconds === 0) return;
    this.#overclockRemaining = Math.max(0, this.#overclockRemaining - deltaSeconds);
    if (this.#decoy) {
      this.#decoy.remaining = Math.max(0, this.#decoy.remaining - deltaSeconds);
      if (this.#decoy.remaining === 0) this.#decoy = null;
    }
    if (this.#pulse) {
      this.#pulse.remaining = Math.max(0, this.#pulse.remaining - deltaSeconds);
      if (this.#pulse.remaining === 0) this.#pulse = null;
    }
    for (const pickup of this.#pickups) pickup.remaining = Math.max(0, pickup.remaining - deltaSeconds);
    this.#pickups = this.#pickups.filter((pickup) => pickup.remaining > 0);
    if (this.#enabled) this.#updateStation(deltaSeconds, elapsedSeconds);
    if (!this.player.alive) return;
    this.#pickups = this.#pickups.filter((pickup) => {
      if (Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y) > this.player.radius + this.config.pickupRadius) return true;
      if (pickup.type === 'overclock') this.#overclockRemaining = this.config.overclockSeconds;
      else if (pickup.type === 'medkit') {
        if (this.player.hp >= this.player.maxHp) return true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.config.medkitHealing);
      } else if (['decoy', 'emp-charge', 'relay-cell'].includes(pickup.type)) {
        if (this.#activeItem) return true;
        this.#activeItem = pickup.type;
      } else {
        if (this.#scannerStacks >= this.config.scannerCap) return true;
        this.#scannerStacks += 1;
      }
      this.onEvent?.('item-pickup');
      return false;
    });
  }

  #updateStation(deltaSeconds, elapsedSeconds) {
    const start = elapsedSeconds - deltaSeconds;
    while (this.#nextEvent < this.config.schedule.length
      && this.config.schedule[this.#nextEvent].time <= elapsedSeconds) {
      const event = this.config.schedule[this.#nextEvent++];
      if (elapsedSeconds < event.time + this.config.windowSeconds) {
        this.#station = { ...event, charge: 0, remaining: event.time + this.config.windowSeconds - elapsedSeconds };
      }
    }
    const station = this.#station;
    if (!station) return;
    const expiry = station.time + this.config.windowSeconds;
    const activeDelta = Math.max(0, Math.min(elapsedSeconds, expiry) - Math.max(start, station.time));
    if (this.player.alive && Math.hypot(this.player.x - station.x, this.player.y - station.y) <= this.config.stationRadius) {
      station.charge += activeDelta;
    }
    if (station.charge + 1e-9 >= this.config.channelSeconds) {
      const sample = this.random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Supply random must be in [0,1)');
      this.addPickup(this.config.rewards[Math.floor(sample * this.config.rewards.length)], station.x, station.y);
      this.#station = null;
    } else if (elapsedSeconds >= expiry) this.#station = null;
    else station.remaining = expiry - elapsedSeconds;
  }

  getSnapshot() {
    return Object.freeze({
      enabled: this.#enabled,
      station: this.#station ? freeze({ x: this.#station.x, y: this.#station.y, radius: this.config.stationRadius,
        progress: Math.min(1, this.#station.charge / this.config.channelSeconds), remaining: this.#station.remaining }) : null,
      pickups: Object.freeze(this.#pickups.map(freeze)), decoy: freeze(this.#decoy),
      pulse: freeze(this.#pulse), activeItem: this.#activeItem, overclockRemaining: this.#overclockRemaining, scannerStacks: this.#scannerStacks,
    });
  }

  reset() {
    this.#station = null;
    this.#pickups = [];
    this.#decoy = null;
    this.#pulse = null;
    this.#activeItem = null;
    this.#overclockRemaining = 0;
    this.#scannerStacks = 0;
    this.#nextEvent = 0;
  }
}
