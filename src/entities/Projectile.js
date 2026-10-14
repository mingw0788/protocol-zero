function requireId(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function requireFinite(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
}

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export class Projectile {
  constructor({
    id,
    ownerId,
    weaponId,
    x,
    y,
    vx,
    vy,
    radius,
    damage,
    lifetimeSeconds,
    canSplit = false,
    ignoreEnemyId = null,
  } = {}) {
    requireId(id, 'id');
    requireId(ownerId, 'ownerId');
    requireId(weaponId, 'weaponId');
    requireFinite(x, 'x');
    requireFinite(y, 'y');
    requireFinite(vx, 'vx');
    requireFinite(vy, 'vy');
    requirePositiveFinite(radius, 'radius');
    requirePositiveFinite(damage, 'damage');
    requirePositiveFinite(lifetimeSeconds, 'lifetimeSeconds');
    if (typeof canSplit !== 'boolean' || (ignoreEnemyId !== null && typeof ignoreEnemyId !== 'string' && !Number.isFinite(ignoreEnemyId))) {
      throw new TypeError('Invalid projectile generation metadata');
    }

    this.id = id;
    this.ownerId = ownerId;
    this.weaponId = weaponId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.damage = damage;
    this.remainingLife = lifetimeSeconds;
    this.active = true;
    this.canSplit = canSplit;
    this.ignoreEnemyId = ignoreEnemyId;
  }
}
