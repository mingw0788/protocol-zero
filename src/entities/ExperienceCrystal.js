import { EXPERIENCE_CRYSTAL_CONFIG } from '../config/experienceCrystalConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export class ExperienceCrystal {
  constructor({
    id,
    x,
    y,
    expValue,
    pickupRadius = EXPERIENCE_CRYSTAL_CONFIG.pickupRadius,
    lifetimeSeconds = EXPERIENCE_CRYSTAL_CONFIG.lifetimeSeconds,
  } = {}) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new TypeError('Experience crystal id must be a non-empty string');
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Experience crystal position must have finite x and y coordinates');
    }
    requirePositiveFinite(expValue, 'expValue');
    requirePositiveFinite(pickupRadius, 'pickupRadius');
    requirePositiveFinite(lifetimeSeconds, 'lifetimeSeconds');

    this.id = id;
    this.x = x;
    this.y = y;
    this.expValue = expValue;
    this.pickupRadius = pickupRadius;
    this.remainingLifetime = lifetimeSeconds;
    this.active = true;
  }
}
