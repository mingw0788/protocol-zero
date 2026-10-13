import { UPGRADE_CONFIG } from '../config/upgradeConfig.js';

const FULL_REPAIR_ID = 'full-repair';
const EMPTY_CHOICES = Object.freeze([]);

function requirePlayer(player) {
  if (!player || typeof player !== 'object') {
    throw new TypeError('UpgradeSystem requires a player');
  }
  if (!Number.isFinite(player.hp)
    || !Number.isFinite(player.maxHp)
    || player.hp < 0
    || player.maxHp <= 0
    || player.hp > player.maxHp) {
    throw new RangeError('Player health must be finite and within its maximum');
  }
}

function normalizeUpgrades(upgrades) {
  if (!Array.isArray(upgrades)) {
    throw new TypeError('UpgradeSystem requires an upgrade array');
  }

  const ids = new Set();
  return Object.freeze(upgrades.map((upgrade) => {
    if (!upgrade || typeof upgrade !== 'object'
      || typeof upgrade.id !== 'string'
      || upgrade.id.length === 0
      || upgrade.id === FULL_REPAIR_ID
      || typeof upgrade.name !== 'string'
      || upgrade.name.length === 0
      || typeof upgrade.description !== 'string'
      || upgrade.description.length === 0) {
      throw new TypeError('Upgrade definitions require an ID, name, and description');
    }
    if (!Number.isSafeInteger(upgrade.maxLevel) || upgrade.maxLevel < 1) {
      throw new RangeError('Upgrade maximum level must be a positive safe integer');
    }
    if (ids.has(upgrade.id)) {
      throw new RangeError(`Duplicate upgrade ID: ${upgrade.id}`);
    }
    ids.add(upgrade.id);
    return Object.freeze({
      id: upgrade.id,
      name: upgrade.name,
      description: upgrade.description,
      maxLevel: upgrade.maxLevel,
    });
  }));
}

export class UpgradeSystem {
  #upgrades;
  #levels = new Map();
  #random;
  #choices = EMPTY_CHOICES;

  constructor({ player, random = Math.random, upgrades = UPGRADE_CONFIG } = {}) {
    requirePlayer(player);
    if (typeof random !== 'function') {
      throw new TypeError('UpgradeSystem random source must be a function');
    }

    this.player = player;
    this.#random = random;
    this.#upgrades = normalizeUpgrades(upgrades);
    for (const upgrade of this.#upgrades) this.#levels.set(upgrade.id, 0);
  }

  getChoicesSnapshot() {
    return this.#choices;
  }

  getUpgradeLevelsSnapshot() {
    return Object.freeze(this.#upgrades.map((upgrade) => Object.freeze({
      id: upgrade.id,
      level: this.#levels.get(upgrade.id),
      maxLevel: upgrade.maxLevel,
    })));
  }

  getLevel(id) {
    if (!this.#levels.has(id)) throw new RangeError(`Unknown upgrade ID: ${id}`);
    return this.#levels.get(id);
  }

  prepareChoices() {
    const eligible = this.#upgrades.filter((upgrade) => this.#levels.get(upgrade.id) < upgrade.maxLevel);
    let choices;

    if (eligible.length === 0) {
      choices = [Object.freeze({
        id: FULL_REPAIR_ID,
        name: '纳米维护',
        description: '恢复生命至上限',
        currentLevel: null,
        targetLevel: null,
        maxLevel: null,
        repeatable: true,
      })];
    } else {
      const pool = [...eligible];
      const count = Math.min(3, pool.length);
      for (let index = 0; index < count; index += 1) {
        const sample = this.#random();
        if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
          throw new RangeError('Upgrade random source must return a finite value in [0, 1)');
        }
        const selectedIndex = index + Math.floor(sample * (pool.length - index));
        [pool[index], pool[selectedIndex]] = [pool[selectedIndex], pool[index]];
      }

      choices = pool.slice(0, count).map((upgrade) => {
        const currentLevel = this.#levels.get(upgrade.id);
        return Object.freeze({
          id: upgrade.id,
          name: upgrade.name,
          description: upgrade.description,
          currentLevel,
          targetLevel: currentLevel + 1,
          maxLevel: upgrade.maxLevel,
          repeatable: false,
        });
      });
    }

    this.#choices = Object.freeze(choices);
    return this.#choices;
  }

  canReroll() {
    return this.#choices.length > 0 && this.#upgrades.some(upgrade =>
      this.#levels.get(upgrade.id) < upgrade.maxLevel && !this.#choices.some(choice => choice.id === upgrade.id));
  }

  rerollChoices() {
    if (!this.canReroll()) return false;
    const previousIds = this.#choices.map(c => c.id);
    this.prepareChoices();
    if (this.#choices.every(c => previousIds.includes(c.id))) {
      // Guarantee a new card without unbounded retries on deterministic random streams.
      const alternative = this.#upgrades.find(u => this.#levels.get(u.id) < u.maxLevel && !previousIds.includes(u.id));
      const level = this.#levels.get(alternative.id);
      this.#choices = Object.freeze([...this.#choices.slice(0, -1), Object.freeze({
        ...alternative, currentLevel: level, targetLevel: level + 1, repeatable: false,
      })]);
    }
    return true;
  }

  select(choiceId) {
    const choice = this.#choices.find((candidate) => candidate.id === choiceId);
    if (!choice) return false;

    let result;
    if (choice.id === FULL_REPAIR_ID) {
      requirePlayer(this.player);
      this.player.hp = this.player.maxHp;
      result = Object.freeze({ id: FULL_REPAIR_ID, type: 'restore-health' });
    } else {
      const currentLevel = this.#levels.get(choice.id);
      if (!Number.isSafeInteger(currentLevel) || currentLevel >= choice.maxLevel) return false;
      const level = currentLevel + 1;
      this.#levels.set(choice.id, level);
      result = Object.freeze({
        id: choice.id,
        previousLevel: currentLevel,
        level,
        maxLevel: choice.maxLevel,
      });
    }

    this.#choices = EMPTY_CHOICES;
    return result;
  }

  reset() {
    for (const upgrade of this.#upgrades) this.#levels.set(upgrade.id, 0);
    this.#choices = EMPTY_CHOICES;
  }
}
