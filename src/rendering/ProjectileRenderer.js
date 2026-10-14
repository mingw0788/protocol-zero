import { PULSE_GUN_CONFIG } from '../config/weaponConfig.js';

export class ProjectileRenderer {
  render(context, camera, projectiles = []) {
    if (!context || typeof context.fillRect !== 'function') {
      throw new TypeError('ProjectileRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('ProjectileRenderer requires a camera with a logical viewport');
    }
    if (!Array.isArray(projectiles)) {
      throw new TypeError('ProjectileRenderer requires a projectile array');
    }

    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();

    for (const projectile of projectiles) {
      if (projectile?.active !== true
        || !Number.isFinite(projectile.x)
        || !Number.isFinite(projectile.y)
        || !Number.isFinite(projectile.radius)
        || projectile.radius <= 0) {
        continue;
      }

      const position = camera.worldToScreen(projectile.x, projectile.y);
      const diameter = projectile.radius * 2;
      const x = position.x - projectile.radius;
      const y = position.y - projectile.radius;
      if (x + diameter <= 0 || y + diameter <= 0
        || x >= camera.viewportWidth || y >= camera.viewportHeight) {
        continue;
      }

      context.fillStyle = projectile.canSplit ? '#ffe19a' : projectile.ignoreEnemyId !== null && projectile.ignoreEnemyId !== undefined ? '#ffbd83' : PULSE_GUN_CONFIG.projectileColor;
      context.fillRect(x, y, diameter, diameter);
      context.fillStyle = '#e9ffff';
      const core = diameter * 0.5;
      context.fillRect(position.x - core / 2, position.y - core / 2, core, core);
    }

    context.restore();
  }
}
