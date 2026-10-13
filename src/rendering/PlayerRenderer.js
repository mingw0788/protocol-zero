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
    const weaponIds = new Set(player.weaponStates?.map(({ id }) => id) ?? []);
    const firing = (id) => player.weaponStates.find(w => w.id === id)?.fireFlashRemaining > 0;
    if (weaponIds.has('pulse-gun')) this.#drawPulseGun(context, screenPosition, this.#weaponAngle(player, 'pulse-gun'), firing('pulse-gun'));
    if (weaponIds.has('arc-coil')) this.#drawArcCoil(context, screenPosition);
    if (weaponIds.has('railgun')) this.#drawRailgun(context, screenPosition, this.#weaponAngle(player, 'railgun'), firing('railgun'));
  }

  #weaponAngle(player, id) {
    const angle = player.weaponStates.find((state) => state.id === id)?.aimAngle;
    return Number.isFinite(angle) ? angle : Math.atan2(player.facingY ?? -1, player.facingX ?? 0);
  }

  #drawPulseGun(context, center, angle, firing) {
    context.save();
    context.translate(center.x + Math.cos(angle) * 5, center.y + Math.sin(angle) * 5);
    context.rotate(angle);
    if (firing) context.translate(-3, 0);
    context.fillStyle = '#143844';
    context.fillRect(0, -4, 18, 8);
    context.fillStyle = '#65e8ff';
    context.fillRect(3, -3, 12, 6);
    context.fillStyle = '#e6ffff';
    context.fillRect(14, -2, 5, 4);
    if (firing) {
      context.fillStyle = '#b7f8ff';
      context.fillRect(21, -5, 7, 10);
      context.fillStyle = '#ffffff';
      context.fillRect(19, -2, 14, 4);
    }
    context.restore();
  }

  #drawArcCoil(context, center) {
    const x = center.x - 11, y = center.y + 9;
    context.fillStyle = '#30254c';
    context.fillRect(x - 6, y - 5, 13, 11);
    context.strokeStyle = '#b891ff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 6, -Math.PI / 2, Math.PI / 2);
    context.stroke();
    context.fillStyle = '#b891ff';
    context.fillRect(x - 5, y - 2, 2, 4);
    context.beginPath();
    context.arc(x + 2, y, 3, Math.PI / 2, Math.PI * 1.5);
    context.stroke();
    context.fillStyle = '#eadfff';
    context.fillRect(x - 1, y - 2, 3, 4);
  }

  #drawRailgun(context, center, angle, firing) {
    const x = center.x + 8, y = center.y + 8;
    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI / 2);
    if (firing) context.translate(0, 4);
    context.fillStyle = '#594326';
    context.fillRect(-3, -9, 7, 22);
    context.fillStyle = '#ffc65e';
    context.fillRect(-2, -12, 5, 21);
    context.fillStyle = '#fff0c7';
    context.fillRect(-1, -13, 3, 4);
    if (firing) {
      context.fillStyle = '#ffd07d';
      context.fillRect(-6, -23, 12, 7);
      context.fillStyle = '#ffffff';
      context.fillRect(-2, -30, 4, 15);
    }
    context.restore();
  }
}
