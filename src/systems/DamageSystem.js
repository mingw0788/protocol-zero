import { PLAYER_CONFIG } from '../config/playerConfig.js';

function requireNonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function noDamageResult() {
  return { damaged: false, killed: false, damage: 0, shieldDamage: 0, sourceTypeIds: Object.freeze([]) };
}

export class DamageSystem {
  constructor({ player, invulnerabilitySeconds = PLAYER_CONFIG.invulnerabilitySeconds } = {}) {
    if (!player || typeof player !== 'object') {
      throw new TypeError('DamageSystem requires a player');
    }
    if (!Number.isFinite(invulnerabilitySeconds) || invulnerabilitySeconds <= 0) {
      throw new RangeError('invulnerabilitySeconds must be a positive finite number');
    }

    this.player = player;
    this.invulnerabilitySeconds = invulnerabilitySeconds;
  }

  update(deltaSeconds) {
    requireNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    requireNonNegativeFinite(this.player.invulnerabilityRemaining, 'invulnerabilityRemaining');
    this.player.invulnerabilityRemaining = Math.max(0, this.player.invulnerabilityRemaining - deltaSeconds);
  }

  applyContactDamage(contacts) {
    if (!Array.isArray(contacts)) {
      throw new TypeError('contacts must be an array');
    }
    return this.applyDamageBatch(contacts.map(contact => {
      if (!contact || typeof contact !== 'object') throw new TypeError('Each contact must be an object');
      return { damage: contact.contactDamage, sourceTypeId: contact.typeId ?? 'unknown' };
    }));
  }

  applyDamageBatch(hits) {
    if (!Array.isArray(hits)) throw new TypeError('hits must be an array');

    let maximumDamage = 0;
    let sourceTypeIds = [];
    for (const hit of hits) {
      if (!hit || typeof hit !== 'object' || typeof hit.sourceTypeId !== 'string' || !hit.sourceTypeId.trim()) {
        throw new TypeError('Each hit must provide a source type');
      }
      if (!Number.isFinite(hit.damage) || hit.damage < 0) {
        throw new RangeError('damage must be a non-negative finite number');
      }
      if (hit.damage > maximumDamage) {
        maximumDamage = hit.damage;
        sourceTypeIds = [hit.sourceTypeId];
      } else if (hit.damage === maximumDamage && maximumDamage > 0) {
        sourceTypeIds.push(hit.sourceTypeId);
      }
    }

    if (hits.length === 0
      || maximumDamage === 0
      || this.player.alive !== true
      || this.player.hp <= 0
      || this.player.invulnerabilityRemaining > 0
      || this.player.dashRemaining > 0) {
      return noDamageResult();
    }

    if (!Number.isFinite(this.player.hp)
      || !Number.isFinite(this.player.maxHp)
      || this.player.maxHp <= 0) {
      throw new RangeError('Player health must be finite and maxHp must be positive');
    }

    const previousHp = this.player.hp;
    const absorbed = Math.min(this.player.shield ?? 0, maximumDamage);
    this.player.shield = Math.max(0, (this.player.shield ?? 0) - absorbed);
    const healthDamage = maximumDamage - absorbed;
    const nextHp = Math.max(0, Math.min(this.player.maxHp, previousHp - healthDamage));
    const actualDamage = Math.min(healthDamage, previousHp);
    const killed = previousHp > 0 && nextHp === 0;

    this.player.hp = nextHp;
    this.player.invulnerabilityRemaining = this.invulnerabilitySeconds;
    if (killed) this.player.alive = false;

    return {
      damaged: true,
      killed,
      damage: actualDamage,
      shieldDamage: absorbed,
      sourceTypeIds: Object.freeze([...new Set(sourceTypeIds)].sort()),
    };
  }
}
