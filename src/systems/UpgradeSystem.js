import { UPGRADE_CONFIG } from '../config/upgradeConfig.js';
import { EVOLUTION_CONFIG } from '../config/evolutionConfig.js';

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
      weaponId: upgrade.weaponId ?? null,
      unlocksWeapon: upgrade.unlocksWeapon === true,
    });
  }));
}

export class UpgradeSystem {
  #upgrades;
  #levels = new Map();
  #random;
  #choices = EMPTY_CHOICES;
  #evolvedWeapons = new Set();
  #weaponLimit = Infinity;
  #evolutions;
  #getContext;

  constructor({ player, random = Math.random, upgrades = UPGRADE_CONFIG, evolutions = EVOLUTION_CONFIG, getContext = () => ({}) } = {}) {
    requirePlayer(player);
    if (typeof random !== 'function') {
      throw new TypeError('UpgradeSystem random source must be a function');
    }

    this.player = player;
    this.#random = random;
    this.#upgrades = normalizeUpgrades(upgrades);
    if (!Array.isArray(evolutions) || typeof getContext !== 'function') throw new TypeError('Invalid evolution dependencies');
    this.#evolutions = Object.freeze(evolutions.map(evolution => Object.freeze({ ...evolution, requirements: Object.freeze({ ...evolution.requirements }) })));
    this.#getContext = getContext;
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

  #ownedWeaponIds() {
    const ids = new Set(this.player.weaponStates?.map(weapon => weapon.id) ?? ['pulse-gun']);
    ids.add('pulse-gun');
    for (const upgrade of this.#upgrades) if (upgrade.unlocksWeapon && this.#levels.get(upgrade.id) > 0) ids.add(upgrade.weaponId);
    return [...ids];
  }

  setWeaponLimit(limit) {
    if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1 || limit < this.#ownedWeaponIds().length)) throw new RangeError('Invalid weapon slot limit');
    this.#weaponLimit = limit; this.#choices = EMPTY_CHOICES;
  }

  isEvolved(weaponId) { return this.#evolvedWeapons.has(weaponId); }

  #evolutionEligible(evolution) {
    const context = this.#getContext();
    return !this.#evolvedWeapons.has(evolution.weaponId)
      && Object.entries(evolution.requirements).every(([id, level]) => (this.#levels.get(id) ?? 0) >= level)
      && (context.scannerStacks ?? 0) >= (evolution.scannerStacks ?? 0);
  }

  getBuildSnapshot() {
    return Object.freeze({ weaponIds: Object.freeze(this.#ownedWeaponIds()), weaponLimit: this.#weaponLimit === Infinity ? null : this.#weaponLimit,
      evolvedWeaponIds: Object.freeze([...this.#evolvedWeapons]),
      evolutions: Object.freeze(this.#evolutions.map(evolution => Object.freeze({ id: evolution.id, name: evolution.name,
        weaponId: evolution.weaponId, requirementText: evolution.requirementText,
        evolved: this.#evolvedWeapons.has(evolution.weaponId), eligible: this.#evolutionEligible(evolution) }))) });
  }

  #eligibleCards() {
    const owned = this.#ownedWeaponIds();
    const normal = this.#upgrades.filter(upgrade => this.#levels.get(upgrade.id) < upgrade.maxLevel
      && !(upgrade.unlocksWeapon && !owned.includes(upgrade.weaponId) && owned.length >= this.#weaponLimit)).map(upgrade => Object.freeze({
      id: upgrade.id, name: upgrade.name, description: upgrade.description, currentLevel: this.#levels.get(upgrade.id),
      targetLevel: this.#levels.get(upgrade.id) + 1, maxLevel: upgrade.maxLevel, repeatable: false,
    }));
    return [...normal, ...this.#evolutions.filter(evolution => this.#evolutionEligible(evolution)).map(evolution => Object.freeze({
      id: evolution.id, name: evolution.name, description: evolution.description, weaponId: evolution.weaponId,
      type: 'evolution', currentLevel: 0, targetLevel: 1, maxLevel: 1, repeatable: false,
    }))];
  }

  #isReinforcement(card) {
    const upgrade = this.#upgrades.find(upgrade => upgrade.id === card.id);
    return Boolean(upgrade?.weaponId && this.#ownedWeaponIds().includes(upgrade.weaponId));
  }

  #validGuarantees(choices, eligible) {
    return (!eligible.some(card => card.type === 'evolution') || choices.some(card => card.type === 'evolution'))
      && (!eligible.some(card => this.#isReinforcement(card)) || choices.some(card => this.#isReinforcement(card)));
  }

  #sample() {
    const sample = this.#random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Upgrade random source must return a finite value in [0, 1)');
    return sample;
  }

  prepareChoices() {
    const eligible = this.#eligibleCards();
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
        const sample = this.#sample();
        const selectedIndex = index + Math.floor(sample * (pool.length - index));
        [pool[index], pool[selectedIndex]] = [pool[selectedIndex], pool[index]];
      }

      choices = pool.slice(0, count);
      const evolutions = eligible.filter(card => card.type === 'evolution');
      if (evolutions.length && !choices.some(card => card.type === 'evolution')) {
        choices[choices.length - 1] = evolutions[Math.floor(this.#sample() * evolutions.length)];
      }
      const improvements = eligible.filter(card => this.#isReinforcement(card));
      if (improvements.length && !choices.some(card => this.#isReinforcement(card))) {
        const index = choices.findLastIndex(card => card.type !== 'evolution');
        choices[index] = improvements[Math.floor(this.#sample() * improvements.length)];
      }
    }

    this.#choices = Object.freeze(choices);
    return this.#choices;
  }

  canReroll() {
    return this.#choices.length > 0 && this.#eligibleCards().some(card => !this.#choices.some(choice => choice.id === card.id));
  }

  rerollChoices() {
    if (!this.canReroll()) return false;
    const previous = this.#choices;
    const previousIds = previous.map(c => c.id);
    this.prepareChoices();
    if (this.#choices.every(c => previousIds.includes(c.id))) {
      const eligible = this.#eligibleCards();
      for (const alternative of eligible.filter(card => !previousIds.includes(card.id))) {
        for (let index = this.#choices.length - 1; index >= 0; index--) {
          const candidate = [...this.#choices]; candidate[index] = alternative;
          if (!this.#validGuarantees(candidate, eligible)) continue;
          this.#choices = Object.freeze(candidate);
          return true;
        }
      }
      this.#choices = previous;
      return false;
    }
    return true;
  }

  select(choiceId) {
    const choice = this.#choices.find((candidate) => candidate.id === choiceId);
    if (!choice) return false;
    const eligible = this.#eligibleCards();
    if (choice.id !== FULL_REPAIR_ID && !eligible.some(card => card.id === choice.id)) return false;

    let result;
    if (choice.id === FULL_REPAIR_ID) {
      if (eligible.length !== 0) return false;
      requirePlayer(this.player);
      this.player.hp = this.player.maxHp;
      result = Object.freeze({ id: FULL_REPAIR_ID, type: 'restore-health' });
    } else if (choice.type === 'evolution') {
      this.#evolvedWeapons.add(choice.weaponId);
      result = Object.freeze({ id: choice.id, type: 'evolution', weaponId: choice.weaponId, name: choice.name });
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
    this.#evolvedWeapons.clear();
  }
}
