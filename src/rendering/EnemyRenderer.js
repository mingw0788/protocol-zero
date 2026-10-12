import { drawPixelPattern, SPRITE_PALETTES, SPRITE_PATTERNS } from './spritePatterns.js';

export class EnemyRenderer {
  render(context, camera, enemies = [], effectiveTime = 0) {
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

      const patterns = SPRITE_PATTERNS.enemies[enemy.typeId] ?? SPRITE_PATTERNS.enemies.fallback;
      const phase = stablePhase(enemy.id);
      const frame = Math.floor(effectiveTime * 4 + phase) % patterns.length;
      const palette = SPRITE_PALETTES[enemy.typeId] ?? SPRITE_PALETTES.fallback;
      drawPixelPattern(context, patterns[frame], palette, x, y, diameter);
    }

    context.restore();
  }
}

function stablePhase(id) {
  const value = String(id ?? 'enemy');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash % 2);
}
