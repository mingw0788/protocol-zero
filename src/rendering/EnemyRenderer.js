import { ENEMY_CONFIG } from '../config/enemyConfig.js';

export class EnemyRenderer {
  render(context, camera, enemies = []) {
    if (!context || typeof context.fillRect !== 'function') {
      throw new TypeError('EnemyRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('EnemyRenderer requires a camera with a logical viewport');
    }
    if (!Array.isArray(enemies)) throw new TypeError('EnemyRenderer requires an enemy array');

    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();

    for (const enemy of enemies) {
      if (!enemy.alive || enemy.hp <= 0) continue;
      const position = camera.worldToScreen(enemy.x, enemy.y);
      const diameter = enemy.radius * 2;
      const x = position.x - enemy.radius;
      const y = position.y - enemy.radius;
      if (x + diameter <= 0 || y + diameter <= 0
        || x >= camera.viewportWidth || y >= camera.viewportHeight) continue;

      context.fillStyle = enemy.color ?? ENEMY_CONFIG.EN01.color;
      context.fillRect(x, y, diameter, diameter);
    }

    context.restore();
  }
}
