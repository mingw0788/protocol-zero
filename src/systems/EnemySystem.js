import { WORLD_MAP } from '../config/worldConfig.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function requireWorld(world) {
  if (!world || !Number.isFinite(world.width) || world.width <= 0
    || !Number.isFinite(world.height) || world.height <= 0) {
    throw new TypeError('EnemySystem requires valid world dimensions');
  }
}

export class EnemySystem {
  constructor({ enemies, player, world = WORLD_MAP } = {}) {
    if (!Array.isArray(enemies)) throw new TypeError('EnemySystem requires an enemy array');
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
      throw new TypeError('EnemySystem requires a player with finite coordinates');
    }
    requireWorld(world);

    this.enemies = enemies;
    this.player = player;
    this.world = world;
  }

  update(deltaSeconds, targetFor = null) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return false;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp <= 0 || enemy.category === 'boss') continue;

      const target = targetFor?.(enemy) ?? this.player;
      const deltaX = target.x - enemy.x;
      const deltaY = target.y - enemy.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance === 0) continue;

      const travelDistance = Math.min(enemy.speed * deltaSeconds, distance);
      const nextX = enemy.x + (deltaX / distance) * travelDistance;
      const nextY = enemy.y + (deltaY / distance) * travelDistance;
      enemy.x = clamp(nextX, enemy.radius, this.world.width - enemy.radius);
      enemy.y = clamp(nextY, enemy.radius, this.world.height - enemy.radius);
    }

    return true;
  }

  cleanup() {
    let removed = 0;
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (enemy.alive && enemy.hp > 0) continue;
      this.enemies.splice(index, 1);
      removed += 1;
    }
    return removed;
  }
}
