import { WORLD_MAP } from '../config/worldConfig.js';

export class MapRenderer {
  constructor(map = WORLD_MAP) {
    this.map = map;
  }

  setMap(map) {
    this.map = map;
  }

  render(context, camera) {
    const { width, height, gridSpacing } = this.map;

    context.save();
    context.fillStyle = this.map.outsideColor;
    context.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();
    context.translate(-camera.x, -camera.y);

    context.fillStyle = this.map.backgroundColor;
    context.fillRect(0, 0, width, height);

    if (this.map.theme === 'city') {
      context.fillStyle = '#202c39';
      context.fillRect(0, 535, width, 280);
      context.fillRect(1040, 0, 320, height);
      context.fillStyle = '#96834b';
      for (let x = 24; x < width; x += 96) context.fillRect(x, 671, 48, 6);
      for (let y = 24; y < height; y += 96) context.fillRect(1197, y, 6, 48);
      context.fillStyle = '#284a50';
      for (let x = 120; x < width; x += 480) {
        for (const y of [160, 980]) {
          context.fillRect(x, y, 180, 80);
          context.fillStyle = '#5a9393';
          context.fillRect(x + 12, y + 12, 80, 4);
          context.fillStyle = '#284a50';
        }
      }
    }

    context.beginPath();
    for (let x = 0; x < width; x += gridSpacing) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSpacing) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.strokeStyle = this.map.gridColor;
    context.lineWidth = 1;
    context.stroke();

    context.save();
    context.beginPath();
    for (let y = 96; y < height - 32; y += 192) {
      for (let x = 96; x < width - 32; x += 192) {
        const variant = (Math.floor(x / 192) * 7 + Math.floor(y / 192) * 3) % 3;
        if (variant === 0) {
          context.moveTo(x, y);
          context.lineTo(x + 20, y);
          context.lineTo(x + 20, y + 12);
          context.moveTo(x + 3, y + 5);
          context.lineTo(x + 10, y + 5);
        } else if (variant === 1) {
          context.moveTo(x, y);
          context.lineTo(x, y + 18);
          context.lineTo(x + 14, y + 18);
        }
      }
    }
    context.strokeStyle = '#25445a';
    context.lineWidth = 1.5;
    context.globalAlpha = 0.62;
    context.stroke();
    context.restore();

    context.strokeStyle = this.map.borderColor;
    context.lineWidth = 4;
    context.strokeRect(0, 0, width, height);
    context.restore();
  }
}
