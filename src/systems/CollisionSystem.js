function requireGeometry(entity, name) {
  if (!entity || typeof entity !== 'object') {
    throw new TypeError(`${name} is required`);
  }
  if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
    throw new RangeError(`${name} position must have finite x and y coordinates`);
  }
  if (!Number.isFinite(entity.radius) || entity.radius <= 0) {
    throw new RangeError(`${name} radius must be a positive finite number`);
  }
}

export class CollisionSystem {
  #player;
  #enemies;

  constructor({ player, enemies } = {}) {
    if (!player || typeof player !== 'object') {
      throw new TypeError('CollisionSystem requires a player');
    }
    if (!Array.isArray(enemies)) {
      throw new TypeError('CollisionSystem requires an enemy array');
    }

    requireGeometry(player, 'Player');
    this.#player = player;
    this.#enemies = enemies;

    for (const enemy of enemies) {
      if (!enemy || enemy.alive !== true || !(enemy.hp > 0)) continue;
      requireGeometry(enemy, 'Enemy');
    }
  }

  getPlayerContacts() {
    requireGeometry(this.#player, 'Player');

    const contacts = [];
    for (const enemy of this.#enemies) {
      if (!enemy || enemy.alive !== true || !(enemy.hp > 0)) continue;
      requireGeometry(enemy, 'Enemy');

      const deltaX = enemy.x - this.#player.x;
      const deltaY = enemy.y - this.#player.y;
      const radiusSum = enemy.radius + this.#player.radius;
      if (deltaX * deltaX + deltaY * deltaY <= radiusSum * radiusSum) {
        contacts.push(enemy);
      }
    }

    return contacts;
  }
}
