export class EnemyDamageSystem {
  constructor({ onDamage = null } = {}) {
    if (onDamage !== null && typeof onDamage !== 'function') {
      throw new TypeError('onDamage must be a function or null');
    }
    this.onDamage = onDamage;
  }

  applyDamage(enemy, damage, sourceId = 'unknown') {
    if (!Number.isFinite(damage) || damage <= 0) {
      throw new RangeError('damage must be a positive finite number');
    }
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0) {
      throw new TypeError('sourceId must be a non-empty string');
    }
    if (!enemy || enemy.alive !== true || !Number.isFinite(enemy.hp) || enemy.hp <= 0) {
      return false;
    }

    const previousHp = enemy.hp;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.lastDamageSourceId = sourceId;
    enemy.hitFlashRemaining = 0.09;
    if (enemy.hp === 0) enemy.alive = false;
    try {
      this.onDamage?.(Object.freeze({
        enemyId: enemy.id,
        targetTypeId: enemy.typeId ?? 'unknown',
        category: enemy.category ?? 'normal',
        sourceId,
        x: enemy.x,
        y: enemy.y,
        damage,
        actualDamage: Math.min(previousHp, damage),
        lethal: enemy.hp === 0,
      }));
    } catch {
      // Observers must not interrupt an already-applied damage transition.
    }
    return true;
  }
}
