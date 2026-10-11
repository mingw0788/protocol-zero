const NEUTRAL_DIRECTION = Object.freeze({ x: 0, y: 0 });

export class PlayerSystem {
  constructor({ player, inputController = null } = {}) {
    if (!player || typeof player.update !== 'function') {
      throw new TypeError('PlayerSystem requires a player with an update method');
    }
    if (inputController && typeof inputController.getMovementVector !== 'function') {
      throw new TypeError('PlayerSystem input must provide a movement vector');
    }

    this.player = player;
    this.inputController = inputController;
  }

  update(deltaSeconds) {
    const direction = this.inputController?.getMovementVector() ?? NEUTRAL_DIRECTION;
    return this.player.update(direction, deltaSeconds);
  }

  reset() {
    this.player.reset();
    this.inputController?.clear();
  }
}
