import { EXPERIENCE_CRYSTAL_CONFIG } from '../config/experienceCrystalConfig.js';

export class ExperienceCrystalRenderer {
  render(context, camera, crystals = []) {
    if (!context || typeof context.fillRect !== 'function') {
      throw new TypeError('ExperienceCrystalRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('ExperienceCrystalRenderer requires a camera with a logical viewport');
    }
    if (!Array.isArray(crystals)) {
      throw new TypeError('ExperienceCrystalRenderer requires a crystal array');
    }

    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();

    const size = EXPERIENCE_CRYSTAL_CONFIG.renderSize;
    const halfSize = size / 2;
    for (const crystal of crystals) {
      if (crystal?.active !== true
        || !Number.isFinite(crystal.x)
        || !Number.isFinite(crystal.y)) {
        continue;
      }

      const position = camera.worldToScreen(crystal.x, crystal.y);
      const x = position.x - halfSize;
      const y = position.y - halfSize;
      if (x + size <= 0 || y + size <= 0
        || x >= camera.viewportWidth || y >= camera.viewportHeight) {
        continue;
      }

      const cell = size / 4;
      context.fillStyle = EXPERIENCE_CRYSTAL_CONFIG.color;
      context.fillRect(x + cell, y, cell * 2, cell);
      context.fillRect(x, y + cell, cell * 4, cell * 2);
      context.fillRect(x + cell, y + cell * 3, cell * 2, cell);
      context.fillStyle = '#fff1b8';
      context.fillRect(x + cell * 1.5, y + cell * 0.5, cell, cell * 2);
    }

    context.restore();
  }
}
