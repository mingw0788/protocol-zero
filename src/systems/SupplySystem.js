import { SUPPLY_CONFIG, SUPPLY_NAMES, ACTIVE_ITEM_TYPES } from '../config/supplyConfig.js';
import { TACTICAL_CONFIG } from '../config/tacticalConfig.js';

const freeze = (value) => value === null ? null : Object.freeze({ ...value });

export class SupplySystem {
  #enabled = false;
  #nextEvent = 0;
  #nextId = 1;
  #station = null;
  #pickups = [];
  #decoy = null;
  #activeSlots = [null, null];
  #selectedSlot = 0;
  #overclockRemaining = 0;
  #scannerStacks = 0;
  #pulse = null;
  #normalKills = 0;
  #collected = 0;
  #notices = [];

  constructor({ player, random = Math.random, config = SUPPLY_CONFIG } = {}) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)
      || !Number.isFinite(player.radius) || player.radius <= 0 || typeof random !== 'function') {
      throw new TypeError('SupplySystem requires player coordinates, radius and random source');
    }
    for (const key of ['windowSeconds', 'channelSeconds', 'stationRadius', 'pickupRadius', 'pickupLifetime',
      'overclockSeconds', 'fireRateBonus', 'decoySeconds', 'decoyRadius', 'scannerBonus', 'scannerCap', 'exchangeRadius',
      'medkitHealing', 'empRadius', 'empDamage', 'empBossDamage', 'empVisualSeconds']) {
      if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError('Invalid supply setting: ' + key);
    }
    if (!Number.isSafeInteger(config.scannerCap) || !Array.isArray(config.schedule)
      || !Array.isArray(config.rewards) || config.rewards.length === 0
      || config.rewards.some((id) => !Object.hasOwn(SUPPLY_NAMES, id))) throw new RangeError('Invalid supply configuration');
    let previous = -1;
    for (const event of config.schedule) {
      if (!Number.isFinite(event.time) || event.time < 0 || event.time <= previous
        || !Number.isFinite(event.x) || !Number.isFinite(event.y)) throw new RangeError('Invalid supply schedule');
      previous = event.time;
    }
    this.player = player;
    this.random = random;
    const stationRewards = config.stationRewards ?? config.rewards;
    if (!Array.isArray(stationRewards) || !stationRewards.length || stationRewards.some(id => !Object.hasOwn(SUPPLY_NAMES, id))) throw new RangeError('Invalid station reward pool');
    const supportedStationRewards = stationRewards.filter(id => config.rewards.includes(id));
    this.config = Object.freeze({ ...config, schedule: Object.freeze(config.schedule.map(freeze)), rewards: Object.freeze([...config.rewards]),
      stationRewards: Object.freeze(supportedStationRewards.length ? supportedStationRewards : [...config.rewards]) });
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    this.reset();
  }

  setEffects({ enemies, enemyDamageSystem, relaySystem, deployableSystem = null, experienceSystem = null, onEvent = null } = {}) {
    if (!Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function'
      || typeof relaySystem?.rechargeNearest !== 'function' || (onEvent !== null && typeof onEvent !== 'function')) {
      throw new TypeError('Supply effects require enemies, damage, relay and event interfaces');
    }
    this.enemies = enemies; this.enemyDamageSystem = enemyDamageSystem;
    this.relaySystem = relaySystem; this.onEvent = onEvent;
    this.experienceSystem = experienceSystem;
    this.deployableSystem = deployableSystem;
  }

  notify(text) {
    if (this.#notices.length >= 4) this.#notices.shift();
    this.#notices.push({ text, remaining: TACTICAL_CONFIG.noticeSeconds });
  }

  notifyEnemyDeath(event) {
    if (event.category !== 'normal') return;
    this.#normalKills += 1;
    if (this.#normalKills % TACTICAL_CONFIG.killsPerDrop !== 0) return;
    const rewards = TACTICAL_CONFIG.killRewards;
    const type = rewards[(this.#normalKills / TACTICAL_CONFIG.killsPerDrop - 1) % rewards.length];
    if (this.addPickup(type, event.x, event.y)) this.notify(`击杀补给掉落 · ${SUPPLY_NAMES[type]}`);
  }

  get fireRateMultiplier() { return this.#overclockRemaining > 0 ? 1 + this.config.fireRateBonus : 1; }
  get pickupRadiusBonus() { return this.#scannerStacks * this.config.scannerBonus; }
  get scannerStacks() { return this.#scannerStacks; }

  addPickup(type, x, y) {
    if (!this.config.rewards.includes(type) || !Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Invalid supply pickup');
    if (this.#pickups.length >= TACTICAL_CONFIG.maxPickups) return false;
    this.#pickups.push({ id: 'supply-' + this.#nextId++, type, x, y, remaining: this.config.pickupLifetime });
    return true;
  }

  selectSlot(slotIndex) {
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.#activeSlots.length) {
      throw new RangeError('Active item slot must be 0 or 1');
    }
    this.#selectedSlot = slotIndex;
    return true;
  }

  cycleSelectedSlot() {
    this.#selectedSlot = 1 - this.#selectedSlot;
    return this.#selectedSlot;
  }

  deploy(slotIndex = this.#selectedSlot) {
    this.selectSlot(slotIndex);
    const activeItem = this.#activeSlots[slotIndex];
    if (!this.player.alive) return false;
    if (!activeItem) {
      this.notify(`${slotIndex === 0 ? 'E' : 'Q'} 道具槽为空`);
      return false;
    }
    if (activeItem === 'decoy') {
      this.#activeSlots[slotIndex] = null;
      this.#decoy = { x: this.player.x, y: this.player.y, radius: this.config.decoyRadius, remaining: this.config.decoySeconds };
      this.onEvent?.('decoy-deploy');
      return true;
    }
    if (activeItem === 'emp-charge' && this.enemyDamageSystem && this.enemies) {
      for (const enemy of this.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= this.config.empRadius + enemy.radius) {
          this.enemyDamageSystem.applyDamage(enemy, enemy.category === 'boss' ? this.config.empBossDamage : this.config.empDamage, 'emp-charge');
        }
      }
      this.#activeSlots[slotIndex] = null;
      this.#pulse = { x: this.player.x, y: this.player.y, radius: this.config.empRadius,
        remaining: this.config.empVisualSeconds, lifetime: this.config.empVisualSeconds };
      this.onEvent?.('emp-fire');
      return true;
    }
    if (activeItem === 'relay-cell' && this.relaySystem?.rechargeNearest(this.player.x, this.player.y)) {
      this.#activeSlots[slotIndex] = null;
      this.onEvent?.('relay-recharge');
      return true;
    }
    if (activeItem === 'relay-cell') this.notify('电芯未消耗 · 靠近未满能量中继后按 E 或 Q');
    if (['cryo-grenade', 'turret-kit', 'healing-field'].includes(activeItem)) {
      if (!this.deployableSystem?.deploy(activeItem)) {
        this.notify(activeItem === 'cryo-grenade' ? '冷凝炸弹未消耗 · 附近没有目标' : '道具未消耗 · 同类装置已达上限');
        return false;
      }
      this.#activeSlots[slotIndex] = null;
      this.onEvent?.('tactical-deploy');
      return true;
    }
    return false;
  }

  exchangeNearby() {
    if (!this.player.alive) return false;
    const pickupIndex = this.#findNearbyActivePickupIndex();
    if (pickupIndex < 0) {
      this.notify('附近没有可交换的主动道具');
      return false;
    }
    const pickup = this.#pickups[pickupIndex];
    const previousItem = this.#activeSlots[this.#selectedSlot];
    const nextItem = pickup.type;
    this.#activeSlots[this.#selectedSlot] = nextItem;
    if (previousItem) {
      pickup.type = previousItem;
      pickup.remaining = this.config.pickupLifetime;
    } else {
      this.#pickups.splice(pickupIndex, 1);
    }
    this.#collected += 1;
    this.notify(previousItem
      ? `道具已交换 · ${SUPPLY_NAMES[nextItem]} / ${SUPPLY_NAMES[previousItem]}`
      : `已拾取 · ${SUPPLY_NAMES[nextItem]}`);
    this.onEvent?.('item-pickup');
    return true;
  }

  #findNearbyActivePickupIndex() {
    let index = -1;
    let distance = Infinity;
    for (let candidateIndex = 0; candidateIndex < this.#pickups.length; candidateIndex += 1) {
      const pickup = this.#pickups[candidateIndex];
      if (!ACTIVE_ITEM_TYPES.includes(pickup.type)) continue;
      const candidateDistance = Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y);
      if (candidateDistance > this.config.exchangeRadius) continue;
      const current = index >= 0 ? this.#pickups[index] : null;
      if (candidateDistance < distance || (candidateDistance === distance && pickup.id.localeCompare(current.id) < 0)) {
        index = candidateIndex;
        distance = candidateDistance;
      }
    }
    return index;
  }

  targetFor(enemy) {
    if (enemy?.category !== 'normal' || !this.#decoy) return null;
    return Math.hypot(enemy.x - this.#decoy.x, enemy.y - this.#decoy.y) <= this.#decoy.radius ? this.#decoy : null;
  }

  update(deltaSeconds, elapsedSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(elapsedSeconds)
      || elapsedSeconds < deltaSeconds) throw new RangeError('Invalid supply time');
    if (deltaSeconds === 0) return;
    for (const notice of this.#notices) notice.remaining -= deltaSeconds;
    this.#notices = this.#notices.filter(notice => notice.remaining > 0);
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
      } else if (pickup.type === 'shield') {
        if (this.player.shield >= TACTICAL_CONFIG.shieldCapacity) return true;
        this.player.shield = TACTICAL_CONFIG.shieldCapacity;
      } else if (pickup.type === 'magnet') {
        if (!this.experienceSystem) return true;
        const amount = this.experienceSystem.collectAll();
        this.notify(`回收磁铁 · +${amount} 经验`);
      } else if (pickup.type === 'relay-amplifier') {
        if (!this.relaySystem?.armAmplifier()) return true;
      } else if (ACTIVE_ITEM_TYPES.includes(pickup.type)) {
        const emptySlot = this.#activeSlots.indexOf(null);
        if (emptySlot < 0) return true;
        this.#activeSlots[emptySlot] = pickup.type;
      } else {
        if (this.#scannerStacks >= this.config.scannerCap) return true;
        this.#scannerStacks += 1;
      }
      this.#collected += 1;
      if (pickup.type !== 'magnet') this.notify(`已拾取 · ${SUPPLY_NAMES[pickup.type]}`);
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
      const pool = this.config.stationRewards ?? this.config.rewards;
      this.addPickup(pool[Math.floor(sample * pool.length)], station.x, station.y);
      this.#station = null;
    } else if (elapsedSeconds >= expiry) this.#station = null;
    else station.remaining = expiry - elapsedSeconds;
  }

  getSnapshot() {
    const nearbyIndex = this.#findNearbyActivePickupIndex();
    const nearbyPickup = nearbyIndex < 0 ? null : this.#pickups[nearbyIndex];
    const nearbyActivePickup = nearbyPickup ? freeze({
      ...nearbyPickup,
      distance: Math.hypot(this.player.x - nearbyPickup.x, this.player.y - nearbyPickup.y),
    }) : null;
    return Object.freeze({
      enabled: this.#enabled,
      station: this.#station ? freeze({ x: this.#station.x, y: this.#station.y, radius: this.config.stationRadius,
        progress: Math.min(1, this.#station.charge / this.config.channelSeconds), remaining: this.#station.remaining }) : null,
      pickups: Object.freeze(this.#pickups.map(freeze)), decoy: freeze(this.#decoy),
      pulse: freeze(this.#pulse), activeItem: this.#activeSlots[0], activeItems: Object.freeze([...this.#activeSlots]),
      selectedSlot: this.#selectedSlot, nearbyActivePickup, overclockRemaining: this.#overclockRemaining, scannerStacks: this.#scannerStacks,
      amplifierArmed: this.relaySystem?.amplifierArmed ?? false,
      collected: this.#collected, killsUntilDrop: TACTICAL_CONFIG.killsPerDrop - this.#normalKills % TACTICAL_CONFIG.killsPerDrop,
      notices: Object.freeze(this.#notices.map(freeze)),
    });
  }

  reset() {
    this.#station = null;
    this.#pickups = [];
    this.#decoy = null;
    this.#pulse = null;
    this.#activeSlots = [null, null];
    this.#selectedSlot = 0;
    this.#overclockRemaining = 0;
    this.#scannerStacks = 0;
    this.#nextEvent = 0;
    this.#normalKills = 0;
    this.#collected = 0;
    this.#notices = [];
  }
}
