import { ENEMY_CONFIG } from '../config/enemyConfig.js';
import { Enemy } from '../entities/Enemy.js';
import { WORLD_MAP } from '../config/worldConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function validateSpawnConfig(spawn) {
  if (!spawn || typeof spawn !== 'object') throw new TypeError('Spawn config is required');
  requirePositiveFinite(spawn.intervalSeconds, 'intervalSeconds');
  requirePositiveFinite(spawn.viewportClearance, 'viewportClearance');
  if (!Number.isInteger(spawn.maxActive) || spawn.maxActive < 1 || spawn.maxActive > 100) {
    throw new RangeError('maxActive must be an integer from 1 through 100');
  }
  if (!Number.isInteger(spawn.maxPositionAttempts) || spawn.maxPositionAttempts < 1) {
    throw new RangeError('maxPositionAttempts must be a positive integer');
  }
}

function validateWorld(world) {
  if (!world || !Number.isFinite(world.width) || world.width <= 0
    || !Number.isFinite(world.height) || world.height <= 0) {
    throw new TypeError('SpawnSystem requires valid world dimensions');
  }
}

function validateCamera(camera) {
  if (!camera
    || !Number.isFinite(camera.x)
    || !Number.isFinite(camera.y)
    || !Number.isFinite(camera.viewportWidth)
    || camera.viewportWidth <= 0
    || !Number.isFinite(camera.viewportHeight)
    || camera.viewportHeight <= 0) {
    throw new TypeError('SpawnSystem requires a camera with a finite logical viewport');
  }
}

export class SpawnSystem {
  #elapsedSeconds = 0;
  #nextId = 1;

  constructor({
    enemies,
    player,
    camera,
    random = Math.random,
    world = WORLD_MAP,
    enemyConfig = ENEMY_CONFIG,
  } = {}) {
    if (!Array.isArray(enemies)) throw new TypeError('SpawnSystem requires an enemy array');
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)
      || !Number.isFinite(player.radius) || player.radius < 0) {
      throw new TypeError('SpawnSystem requires a player with finite coordinates and radius');
    }
    if (typeof random !== 'function') throw new TypeError('random must be a function');
    validateWorld(world);
    validateCamera(camera);
    if (!enemyConfig?.EN01) throw new TypeError('SpawnSystem requires an EN01 enemy config');
    validateSpawnConfig(enemyConfig.spawn);

    this.enemies = enemies;
    this.player = player;
    this.camera = camera;
    this.random = random;
    this.world = world;
    this.enemyConfig = enemyConfig;
  }

  get elapsedSeconds() {
    return this.#elapsedSeconds;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return 0;

    const interval = this.enemyConfig.spawn.intervalSeconds;
    const totalElapsed = this.#elapsedSeconds + deltaSeconds;
    if (!Number.isFinite(totalElapsed)) throw new RangeError('Accumulated spawn time must be finite');

    const tolerance = Number.EPSILON * Math.max(Math.abs(totalElapsed), interval) * 8;
    const spawnTokens = Math.floor((totalElapsed + tolerance) / interval);
    const remainder = totalElapsed % interval;
    this.#elapsedSeconds = remainder <= tolerance || interval - remainder <= tolerance ? 0 : remainder;

    const attempts = Math.min(spawnTokens, this.enemyConfig.spawn.maxActive);
    for (let token = 0; token < attempts; token += 1) this.#trySpawn();
    return attempts;
  }

  reset() {
    this.#elapsedSeconds = 0;
  }

  #trySpawn() {
    const { spawn, EN01 } = this.enemyConfig;
    const activeCount = this.enemies.reduce(
      (count, enemy) => count + (enemy.alive && enemy.hp > 0 ? 1 : 0),
      0,
    );
    if (activeCount >= spawn.maxActive) return false;

    const segments = this.#getSpawnSegments(EN01.radius + spawn.viewportClearance);
    const totalLength = segments.reduce((length, segment) => length + segment.length, 0);
    if (totalLength <= 0) return false;

    for (let attempt = 0; attempt < spawn.maxPositionAttempts; attempt += 1) {
      const segment = this.#sampleSegment(segments, totalLength);
      const along = this.#randomValue() * segment.length;
      const x = segment.axis === 'x' ? segment.position : segment.start + along;
      const y = segment.axis === 'y' ? segment.position : segment.start + along;
      if (!this.#isValidPosition(x, y, EN01.radius, spawn.viewportClearance)) continue;

      const enemy = new Enemy({
        id: `enemy-${this.#nextId}`,
        x,
        y,
        config: EN01,
        worldWidth: this.world.width,
        worldHeight: this.world.height,
      });
      this.#nextId += 1;
      this.enemies.push(enemy);
      return true;
    }

    return false;
  }

  #getSpawnSegments(clearance) {
    const left = this.camera.x;
    const right = left + this.camera.viewportWidth;
    const top = this.camera.y;
    const bottom = top + this.camera.viewportHeight;
    const minX = this.enemyConfig.EN01.radius;
    const maxX = this.world.width - this.enemyConfig.EN01.radius;
    const minY = this.enemyConfig.EN01.radius;
    const maxY = this.world.height - this.enemyConfig.EN01.radius;

    return [
      this.#verticalSegment(left - clearance, top, bottom, minX, maxX, minY, maxY),
      this.#verticalSegment(right + clearance, top, bottom, minX, maxX, minY, maxY),
      this.#horizontalSegment(top - clearance, left, right, minX, maxX, minY, maxY),
      this.#horizontalSegment(bottom + clearance, left, right, minX, maxX, minY, maxY),
    ].filter((segment) => segment && segment.length > 0);
  }

  #verticalSegment(x, top, bottom, minX, maxX, minY, maxY) {
    if (x < minX || x > maxX) return null;
    const start = Math.max(top, minY);
    const end = Math.min(bottom, maxY);
    if (end <= start) return null;
    return { axis: 'x', position: x, start, length: end - start };
  }

  #horizontalSegment(y, left, right, minX, maxX, minY, maxY) {
    if (y < minY || y > maxY) return null;
    const start = Math.max(left, minX);
    const end = Math.min(right, maxX);
    if (end <= start) return null;
    return { axis: 'y', position: y, start, length: end - start };
  }

  #sampleSegment(segments, totalLength) {
    let position = this.#randomValue() * totalLength;
    for (const segment of segments) {
      if (position < segment.length) return segment;
      position -= segment.length;
    }
    return segments.at(-1);
  }

  #randomValue() {
    const value = this.random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('random must return a finite value in [0, 1)');
    }
    return value;
  }

  #isValidPosition(x, y, radius, viewportClearance) {
    if (!Number.isFinite(x) || !Number.isFinite(y)
      || x - radius < 0 || x + radius > this.world.width
      || y - radius < 0 || y + radius > this.world.height) {
      return false;
    }

    const left = this.camera.x;
    const right = left + this.camera.viewportWidth;
    const top = this.camera.y;
    const bottom = top + this.camera.viewportHeight;
    const dx = Math.max(left - x, 0, x - right);
    const dy = Math.max(top - y, 0, y - bottom);
    if (Math.hypot(dx, dy) < radius + viewportClearance) return false;

    const playerRadius = this.player.radius;
    return Math.hypot(x - this.player.x, y - this.player.y) >= radius + playerRadius;
  }
}
