export class EnemyDamageSystem {
  constructor({ onDamage = null } = {}) {
    if (onDamage !== null && typeof onDamage !== 'function') {
      throw new TypeError('onDamage must be a function or null');
    }
    this.onDamage = onDamage;
  }

  applyDamage(enemy, damage) {
    if (!Number.isFinite(damage) || damage <= 0) {
      throw new RangeError('damage must be a positive finite number');
    }
    if (!enemy || enemy.alive !== true || !Number.isFinite(enemy.hp) || enemy.hp <= 0) {
      return false;
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlashRemaining = 0.09;
    if (enemy.hp === 0) enemy.alive = false;
    try {
      this.onDamage?.(Object.freeze({ enemyId: enemy.id, x: enemy.x, y: enemy.y, damage, lethal: enemy.hp === 0 }));
    } catch {
      // Observers must not interrupt an already-applied damage transition.
    }
    return true;
  }
}
