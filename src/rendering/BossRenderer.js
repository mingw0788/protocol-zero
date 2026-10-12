import { BOSS_CONFIG } from '../config/bossConfig.js';

const WARNING_COLOR = 'rgba(255, 65, 105, 0.28)';

export class BossRenderer {
  #warningWidthPadding;

  constructor({ warningWidthPadding = BOSS_CONFIG.warningWidthPadding } = {}) {
    if (!Number.isFinite(warningWidthPadding) || warningWidthPadding < 0) {
      throw new RangeError('warningWidthPadding must be a non-negative finite number');
    }
    this.#warningWidthPadding = warningWidthPadding;
  }

  render(context, camera, bossSnapshot = null) {
    if (!context || typeof context.stroke !== 'function'
      || typeof context.moveTo !== 'function' || typeof context.lineTo !== 'function') {
      throw new TypeError('BossRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('BossRenderer requires a camera with a logical viewport');
    }
    if (bossSnapshot?.alive !== true
      || (bossSnapshot.phase !== 'telegraph' && bossSnapshot.phase !== 'charging')
      || !Number.isFinite(bossSnapshot.x) || !Number.isFinite(bossSnapshot.y)
      || !Number.isFinite(bossSnapshot.radius) || bossSnapshot.radius <= 0
      || !Number.isFinite(bossSnapshot.chargeDirection?.x)
      || !Number.isFinite(bossSnapshot.chargeDirection?.y)
      || !Number.isFinite(bossSnapshot.chargeEnd?.x)
      || !Number.isFinite(bossSnapshot.chargeEnd?.y)) {
      return false;
    }

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
    context.lineWidth = bossSnapshot.radius * 2 + this.#warningWidthPadding;
    context.lineCap = 'butt';
    context.stroke();
    context.restore();
    return true;
  }
}
