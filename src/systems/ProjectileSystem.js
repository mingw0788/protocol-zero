function requireCircleEnemy(enemy) {
  return enemy?.alive === true
    && Number.isFinite(enemy.hp)
    && enemy.hp > 0
    && Number.isFinite(enemy.x)
    && Number.isFinite(enemy.y)
    && Number.isFinite(enemy.radius)
    && enemy.radius > 0;
}

function firstIntersectionParameter(projectile, enemies, deltaSeconds) {
  const moveX = projectile.vx * deltaSeconds;
  const moveY = projectile.vy * deltaSeconds;
  const moveLengthSquared = moveX * moveX + moveY * moveY;
  let firstT = Number.POSITIVE_INFINITY;
  let firstEnemy = null;

  for (const enemy of enemies) {
    if (!requireCircleEnemy(enemy)) continue;

    const radius = projectile.radius + enemy.radius;
    const offsetX = projectile.x - enemy.x;
    const offsetY = projectile.y - enemy.y;
    const startDistanceSquared = offsetX * offsetX + offsetY * offsetY;
    const radiusSquared = radius * radius;

    if (startDistanceSquared <= radiusSquared) {
      if (0 < firstT) {
        firstT = 0;
        firstEnemy = enemy;
      }
      continue;
    }
    if (moveLengthSquared === 0) continue;

    const along = offsetX * moveX + offsetY * moveY;
    const discriminant = (along * along)
      - (moveLengthSquared * (startDistanceSquared - radiusSquared));
    if (discriminant < 0) continue;

    const t = (-along - Math.sqrt(discriminant)) / moveLengthSquared;
    if (t >= 0 && t <= 1 && t < firstT) {
      firstT = t;
      firstEnemy = enemy;
    }
  }

  return firstEnemy;
}

export class ProjectileSystem {
  constructor({ projectiles, enemies, enemyDamageSystem } = {}) {
    if (!Array.isArray(projectiles)) {
      throw new TypeError('ProjectileSystem requires a projectile array');
    }
    if (!Array.isArray(enemies)) {
      throw new TypeError('ProjectileSystem requires an enemy array');
    }
    if (typeof enemyDamageSystem?.applyDamage !== 'function') {
      throw new TypeError('ProjectileSystem requires an enemy damage system');
    }

    this.projectiles = projectiles;
    this.enemies = enemies;
    this.enemyDamageSystem = enemyDamageSystem;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return;

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.projectiles.length; readIndex += 1) {
      const projectile = this.projectiles[readIndex];
      if (!projectile || projectile.active !== true || projectile.remainingLife <= 0) {
        if (projectile) projectile.active = false;
        continue;
      }

      const effectiveDelta = Math.min(deltaSeconds, projectile.remainingLife);
      const hitEnemy = firstIntersectionParameter(projectile, this.enemies, effectiveDelta);
      if (hitEnemy) {
        this.enemyDamageSystem.applyDamage(hitEnemy, projectile.damage);
        projectile.active = false;
        continue;
      }

      projectile.x += projectile.vx * effectiveDelta;
      projectile.y += projectile.vy * effectiveDelta;
      projectile.remainingLife = Math.max(0, projectile.remainingLife - effectiveDelta);
      if (projectile.remainingLife <= 0) {
        projectile.active = false;
        continue;
      }

      this.projectiles[writeIndex] = projectile;
      writeIndex += 1;
    }

    this.projectiles.length = writeIndex;
  }
}
