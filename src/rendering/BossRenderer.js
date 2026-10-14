import { BOSS_CONFIG } from '../config/bossConfig.js';
import { drawPixelPattern, SPRITE_PALETTES, SPRITE_PATTERNS } from './spritePatterns.js';

const WARNING_COLOR = '#ff4169';

export class BossRenderer {
  #warningWidthPadding;

  constructor({ warningWidthPadding = BOSS_CONFIG.warningWidthPadding } = {}) {
    if (!Number.isFinite(warningWidthPadding) || warningWidthPadding < 0) {
      throw new RangeError('warningWidthPadding must be a non-negative finite number');
    }
    this.#warningWidthPadding = warningWidthPadding;
  }

  render(context, camera, bossSnapshot = null, effectiveTime = 0) {
    if (!context || typeof context.stroke !== 'function'
      || typeof context.moveTo !== 'function' || typeof context.lineTo !== 'function'
      || typeof context.fillRect !== 'function') {
      throw new TypeError('BossRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('BossRenderer requires a camera with a logical viewport');
    }
    if (bossSnapshot?.alive !== true
      || !Number.isFinite(bossSnapshot.x) || !Number.isFinite(bossSnapshot.y)
      || !Number.isFinite(bossSnapshot.radius) || bossSnapshot.radius <= 0) {
      return false;
    }
    const warningActive = bossSnapshot.phase === 'telegraph' || bossSnapshot.phase === 'charging';
    if (bossSnapshot.electricalWarnings?.length) {
      context.save(); context.beginPath(); context.rect(0, 0, camera.viewportWidth, camera.viewportHeight); context.clip();
      for (const warning of bossSnapshot.electricalWarnings) {
        const point = camera.worldToScreen(warning.x, warning.y);
        context.strokeStyle = '#f4b46b'; context.lineWidth = 3;
        context.fillStyle = '#f4b46b22'; context.beginPath(); context.arc(point.x, point.y, warning.radius, 0, Math.PI * 2); context.fill(); context.stroke();
        context.beginPath(); context.moveTo(point.x - 12, point.y); context.lineTo(point.x + 12, point.y);
        context.moveTo(point.x, point.y - 12); context.lineTo(point.x, point.y + 12); context.stroke();
      }
      context.restore();
    }
    if (warningActive) this.#drawWarning(context, camera, bossSnapshot, effectiveTime);
    const position = camera.worldToScreen(bossSnapshot.x, bossSnapshot.y);
    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      const diameter = bossSnapshot.radius * 2;
      if (position.x + bossSnapshot.radius > 0 && position.y + bossSnapshot.radius > 0
        && position.x - bossSnapshot.radius < camera.viewportWidth
        && position.y - bossSnapshot.radius < camera.viewportHeight) {
        context.save();
        context.beginPath();
        context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
        context.clip();
        drawPixelPattern(
          context,
          SPRITE_PATTERNS.boss,
          bossSnapshot.hitFlashRemaining > 0 ? { ...SPRITE_PALETTES.boss, B: '#ffffff' }
            : bossSnapshot.typeId === 'BOSS-02' ? { ...SPRITE_PALETTES.boss, B: '#a6bbff', C: '#7cd1df' } : SPRITE_PALETTES.boss,
          position.x - bossSnapshot.radius,
          position.y - bossSnapshot.radius,
          diameter,
        );
        if (bossSnapshot.combatStage) {
          context.strokeStyle = bossSnapshot.combatStage === 2 ? '#ffd482' : '#a6bbff'; context.lineWidth = 3;
          context.beginPath(); context.arc(position.x, position.y, bossSnapshot.radius + 9, 0, Math.PI * 2); context.stroke();
          context.fillStyle = '#e1e9ff'; context.font = 'bold 13px "Microsoft YaHei", sans-serif'; context.textAlign = 'center';
          context.fillText(bossSnapshot.transitionRemaining > 0 ? '电网重构 · 安全预警' : `电网阶段 ${bossSnapshot.combatStage}`, position.x, position.y - bossSnapshot.radius - 18);
        }
        context.restore();
      }
    }
    return warningActive;
  }

  #drawWarning(context, camera, bossSnapshot, effectiveTime) {
    if (!Number.isFinite(bossSnapshot.chargeDirection?.x)
      || !Number.isFinite(bossSnapshot.chargeDirection?.y)
      || !Number.isFinite(bossSnapshot.chargeEnd?.x)
      || !Number.isFinite(bossSnapshot.chargeEnd?.y)) return;
    const start = camera.worldToScreen(bossSnapshot.x, bossSnapshot.y);
    const end = camera.worldToScreen(bossSnapshot.chargeEnd.x, bossSnapshot.chargeEnd.y);
    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = WARNING_COLOR;
    context.globalAlpha = 0.16 + (Math.sin(effectiveTime * 12) + 1) * 0.07;
    context.lineWidth = bossSnapshot.radius * 2 + this.#warningWidthPadding;
    context.lineCap = 'butt';
    context.setLineDash?.([24, 16]);
    context.stroke();
    context.restore();
  }
}
