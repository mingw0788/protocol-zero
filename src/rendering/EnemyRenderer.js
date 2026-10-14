import { drawPixelPattern, SPRITE_PALETTES, SPRITE_PATTERNS } from './spritePatterns.js';

export class EnemyRenderer {
  render(context, camera, enemies = [], effectiveTime = 0, feedback = {}) {
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
      if (!enemy.alive || enemy.hp <= 0 || enemy.category === 'boss') continue;
      const position = camera.worldToScreen(enemy.x, enemy.y);
      const diameter = enemy.radius * 2;
      const x = position.x - enemy.radius;
      const y = position.y - enemy.radius;
      if (x + diameter <= 0 || y + diameter <= 0
        || x >= camera.viewportWidth || y >= camera.viewportHeight) continue;

      const patterns = SPRITE_PATTERNS.enemies[enemy.typeId] ?? SPRITE_PATTERNS.enemies.fallback;
      const phase = stablePhase(enemy.id);
      const frame = Math.floor(effectiveTime * 4 + phase) % patterns.length;
      const base = SPRITE_PALETTES[enemy.typeId] ?? SPRITE_PALETTES.fallback;
      const palette = !feedback.reducedFlash && enemy.hitFlashRemaining > 0 ? { ...base, B: '#ffffff', X: '#ffffff' } : base;
      drawPixelPattern(context, patterns[frame], palette, x, y, diameter);
      if (feedback.reducedFlash && enemy.hitFlashRemaining > 0) {
        context.fillStyle = '#e7a29d'; context.fillRect(x, y - 3, diameter, 2);
      }
      if ((enemy.slowMultiplier ?? 1) < 1) {
        context.fillStyle = '#8af5f6';
        context.fillRect(x - 3, y, 3, 7); context.fillRect(x + diameter, y + diameter - 7, 3, 7);
      }
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
