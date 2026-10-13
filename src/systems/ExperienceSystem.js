import { EXPERIENCE_CRYSTAL_CONFIG } from '../config/experienceCrystalConfig.js';
import { ExperienceCrystal } from '../entities/ExperienceCrystal.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function requireDependencies({ crystals, player, subscribeEnemyDeath }) {
  if (!Array.isArray(crystals)) {
    throw new TypeError('ExperienceSystem requires a crystal array');
  }
  if (!player
    || !Number.isFinite(player.x)
    || !Number.isFinite(player.y)
    || !Number.isFinite(player.radius)
    || player.radius <= 0
    || !Number.isFinite(player.exp)
    || player.exp < 0
    || typeof player.alive !== 'boolean') {
    throw new TypeError('ExperienceSystem requires a player with finite run state');
  }
  if (typeof subscribeEnemyDeath !== 'function') {
    throw new TypeError('ExperienceSystem requires an enemy death subscription function');
  }
}

function requireConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('ExperienceSystem requires crystal configuration');
  }
  requirePositiveFinite(config.pickupRadius, 'pickupRadius');
  requirePositiveFinite(config.lifetimeSeconds, 'lifetimeSeconds');
}

export class ExperienceSystem {
  #nextId = 1;

  constructor({
    crystals,
    player,
    subscribeEnemyDeath,
    config = EXPERIENCE_CRYSTAL_CONFIG,
  } = {}) {
    requireDependencies({ crystals, player, subscribeEnemyDeath });
    requireConfig(config);

    this.crystals = crystals;
    this.player = player;
    this.config = config;
    subscribeEnemyDeath((snapshot) => this.#handleEnemyDeath(snapshot));
  }

  #handleEnemyDeath(snapshot) {
    const expDrop = snapshot?.expDrop;
    if (!Number.isFinite(expDrop) || expDrop <= 0) return;

    this.crystals.push(new ExperienceCrystal({
      id: `experience-crystal-${this.#nextId}`,
      x: snapshot.x,
      y: snapshot.y,
      expValue: expDrop,
      pickupRadius: this.config.pickupRadius,
      lifetimeSeconds: this.config.lifetimeSeconds,
    }));
    this.#nextId += 1;
  }

  update(deltaSeconds, pickupRadiusBonus = 0) {
    if (!Number.isFinite(pickupRadiusBonus) || pickupRadiusBonus < 0) throw new RangeError('Invalid pickup radius bonus');
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return;

    for (const crystal of this.crystals) {
      if (crystal.active !== true) continue;

      const distance = Math.hypot(this.player.x - crystal.x, this.player.y - crystal.y);
      if (this.player.alive === true
        && distance <= this.player.radius + crystal.pickupRadius + pickupRadiusBonus) {
        crystal.active = false;
        this.player.exp += crystal.expValue;
        continue;
      }

      crystal.remainingLifetime = Math.max(0, crystal.remainingLifetime - deltaSeconds);
      if (crystal.remainingLifetime === 0) crystal.active = false;
    }

    this.#cleanupInactiveCrystals();
  }

  #cleanupInactiveCrystals() {
    for (let index = this.crystals.length - 1; index >= 0; index -= 1) {
      if (this.crystals[index].active !== true) this.crystals.splice(index, 1);
    }
  }

  reset() {
    for (const crystal of this.crystals) crystal.active = false;
    this.crystals.length = 0;
  }
}
