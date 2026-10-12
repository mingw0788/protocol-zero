export class EnemyDamageSystem {
  applyDamage(enemy, damage) {
    if (!Number.isFinite(damage) || damage <= 0) {
      throw new RangeError('damage must be a positive finite number');
    }
    if (!enemy || enemy.alive !== true || !Number.isFinite(enemy.hp) || enemy.hp <= 0) {
      return false;
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp === 0) enemy.alive = false;
    return true;
  }
}
