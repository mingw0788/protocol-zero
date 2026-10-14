function requireId(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${name} must be a non-empty string`);
}

function requireDamage(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a non-negative finite number`);
}

function rankedEntries(map, keyName, valueName) {
  return Object.freeze([...map.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) => bValue - aValue || aKey.localeCompare(bKey))
    .map(([key, value]) => Object.freeze({ [keyName]: key, [valueName]: value })));
}

export class CombatStatsSystem {
  #damageBySource = new Map();
  #killsBySource = new Map();
  #killsByType = new Map();
  #incomingDamageByType = new Map();
  #totalDamageDealt = 0;
  #totalDamageReceived = 0;
  #totalShieldAbsorbed = 0;
  #totalKills = 0;
  #normalKills = 0;
  #bossKills = 0;

  recordEnemyDamage({ sourceId, targetTypeId, actualDamage } = {}) {
    requireId(sourceId, 'sourceId');
    requireId(targetTypeId, 'targetTypeId');
    if (!Number.isFinite(actualDamage) || actualDamage <= 0) throw new RangeError('actualDamage must be a positive finite number');
    this.#totalDamageDealt += actualDamage;
    this.#damageBySource.set(sourceId, (this.#damageBySource.get(sourceId) ?? 0) + actualDamage);
  }

  recordEnemyKill({ sourceId = 'unknown', targetTypeId, category = 'normal' } = {}) {
    requireId(sourceId, 'sourceId');
    requireId(targetTypeId, 'targetTypeId');
    if (category !== 'normal' && category !== 'boss') throw new TypeError('category must be normal or boss');
    this.#totalKills += 1;
    this.#killsBySource.set(sourceId, (this.#killsBySource.get(sourceId) ?? 0) + 1);
    this.#killsByType.set(targetTypeId, (this.#killsByType.get(targetTypeId) ?? 0) + 1);
    if (category === 'boss') this.#bossKills += 1;
    else this.#normalKills += 1;
  }

  recordPlayerDamage({ sourceTypeIds, healthDamage, shieldDamage } = {}) {
    requireDamage(healthDamage, 'healthDamage');
    requireDamage(shieldDamage, 'shieldDamage');
    if (!Array.isArray(sourceTypeIds) || sourceTypeIds.length === 0) throw new TypeError('sourceTypeIds must be a non-empty array');
    if (healthDamage + shieldDamage <= 0) throw new RangeError('Player damage record must contain actual damage');
    const uniqueTypes = [...new Set(sourceTypeIds)];
    for (const typeId of uniqueTypes) requireId(typeId, 'sourceTypeId');
    this.#totalDamageReceived += healthDamage;
    this.#totalShieldAbsorbed += shieldDamage;
    if (healthDamage > 0) {
      const damagePerType = healthDamage / uniqueTypes.length;
      for (const typeId of uniqueTypes) {
        this.#incomingDamageByType.set(typeId, (this.#incomingDamageByType.get(typeId) ?? 0) + damagePerType);
      }
    }
  }

  getSnapshot() {
    return Object.freeze({
      totalDamageDealt: this.#totalDamageDealt,
      damageBySource: rankedEntries(this.#damageBySource, 'sourceId', 'damage'),
      totalDamageReceived: this.#totalDamageReceived,
      totalShieldAbsorbed: this.#totalShieldAbsorbed,
      incomingDamageByType: rankedEntries(this.#incomingDamageByType, 'typeId', 'damage'),
      totalKills: this.#totalKills,
      normalKills: this.#normalKills,
      bossKills: this.#bossKills,
      killsBySource: rankedEntries(this.#killsBySource, 'sourceId', 'kills'),
      killsByType: rankedEntries(this.#killsByType, 'typeId', 'kills'),
    });
  }

  reset() {
    this.#damageBySource.clear();
    this.#killsBySource.clear();
    this.#killsByType.clear();
    this.#incomingDamageByType.clear();
    this.#totalDamageDealt = 0;
    this.#totalDamageReceived = 0;
    this.#totalShieldAbsorbed = 0;
    this.#totalKills = 0;
    this.#normalKills = 0;
    this.#bossKills = 0;
  }
}
