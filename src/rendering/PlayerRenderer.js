import { drawPixelPattern, SPRITE_PALETTES, SPRITE_PATTERNS } from './spritePatterns.js';

export class PlayerRenderer {
  render(context, camera, player, effectiveTime = 0) {
    const screenPosition = camera.worldToScreen(player.x, player.y);
    const diameter = player.radius * 2;
    const frame = player.moving ? Math.floor(effectiveTime * 8) % 2 : Math.floor(effectiveTime * 5) % 2;
    const palette = player.invulnerabilityRemaining > 0
      && Math.floor(player.invulnerabilityRemaining / 0.08) % 2 === 0
      ? { ...SPRITE_PALETTES.player, B: '#ffffff', C: '#ffffff' }
      : SPRITE_PALETTES.player;
    drawPixelPattern(
      context,
      SPRITE_PATTERNS.player[frame],
      palette,
      screenPosition.x - player.radius,
      screenPosition.y - player.radius,
      diameter,
    );
    const facingLength = Math.hypot(player.facingX ?? 0, player.facingY ?? -1) || 1;
    const markerSize = diameter / 8;
    context.fillStyle = '#f4ffff';
    context.fillRect(
      screenPosition.x + ((player.facingX ?? 0) / facingLength) * player.radius * 0.3 - markerSize / 2,
      screenPosition.y + ((player.facingY ?? -1) / facingLength) * player.radius * 0.3 - markerSize / 2,
      markerSize,
      markerSize,
    );
  }
}
