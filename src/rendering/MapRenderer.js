import { WORLD_MAP } from '../config/worldConfig.js';

export class MapRenderer {
  constructor(map = WORLD_MAP) {
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

    context.strokeStyle = this.map.borderColor;
    context.lineWidth = 4;
    context.strokeRect(0, 0, width, height);
    context.restore();
  }
}
