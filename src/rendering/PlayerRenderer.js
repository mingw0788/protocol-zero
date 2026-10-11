import { PLAYER_CONFIG } from '../config/playerConfig.js';

export class PlayerRenderer {
  render(context, camera, player) {
    const screenPosition = camera.worldToScreen(player.x, player.y);
    const diameter = player.radius * 2;

    context.fillStyle = PLAYER_CONFIG.color;
    context.fillRect(
      screenPosition.x - player.radius,
      screenPosition.y - player.radius,
      diameter,
      diameter,
    );
  }
}
