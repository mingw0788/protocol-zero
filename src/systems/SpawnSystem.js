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

function copyEnemyConfigs(enemyConfig) {
  if (!enemyConfig || typeof enemyConfig !== 'object' || !enemyConfig.EN01) {
    throw new TypeError('SpawnSystem requires an EN01 enemy config');
  }

  const configByTypeId = new Map();
  const copiedConfigs = {};
  for (const [key, config] of Object.entries(enemyConfig)) {
    if (key === 'spawn') continue;
    if (!config || typeof config !== 'object'
      || typeof config.typeId !== 'string' || config.typeId.trim().length === 0) {
      throw new TypeError(`Enemy config ${key} must provide a typeId`);
    }
    if (configByTypeId.has(config.typeId)) throw new RangeError('Enemy type IDs must be unique');
    const category = config.category ?? 'normal';
    if (category !== 'normal' && category !== 'boss') {
      throw new TypeError(`Enemy config ${key} has an invalid category`);
    }
    const copied = Object.freeze({ ...config, category });
    configByTypeId.set(copied.typeId, copied);
    copiedConfigs[key] = copied;
  }
  if (!configByTypeId.has(enemyConfig.EN01.typeId)) {
    throw new TypeError('SpawnSystem requires its EN01 config to be available by typeId');
  }

  return { configByTypeId, copiedConfigs: Object.freeze(copiedConfigs) };
}

function validateWaveSnapshot(waveSnapshot, configByTypeId) {
  if (!waveSnapshot || typeof waveSnapshot !== 'object') {
    throw new TypeError('SpawnSystem requires a wave profile');
  }
  if (typeof waveSnapshot.phaseId !== 'string' || waveSnapshot.phaseId.trim().length === 0) {
    throw new TypeError('Wave profile requires a non-empty phaseId');
  }
  requirePositiveFinite(waveSnapshot.spawnIntervalSeconds, 'spawnIntervalSeconds');
  if (!waveSnapshot.enemyWeights || typeof waveSnapshot.enemyWeights !== 'object'
    || Array.isArray(waveSnapshot.enemyWeights)) {
    throw new TypeError('Wave profile requires an enemyWeights object');
  }

  const weightedConfigs = [];
  let totalWeight = 0;
  for (const [typeId, weight] of Object.entries(waveSnapshot.enemyWeights)) {
    const config = configByTypeId.get(typeId);
    if (!config) throw new RangeError(`Wave profile references unknown enemy type ${typeId}`);
    if (config.category !== 'normal') {
      throw new RangeError('Wave profiles may only spawn normal enemy categories');
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError('Enemy weights must be non-negative finite numbers');
    }
    totalWeight += weight;
    if (weight > 0) weightedConfigs.push({ config, weight });
  }
  if (weightedConfigs.length === 0 || Math.abs(totalWeight - 1) > 1e-9) {
    throw new RangeError('Wave profile enemy weights must sum to 1 and include a positive weight');
  }
  return weightedConfigs;
}

export class SpawnSystem {
  #enemyConfig;
  #enemyConfigsByTypeId;
  #defaultWaveSnapshot;
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
    const { configByTypeId, copiedConfigs } = copyEnemyConfigs(enemyConfig);
    validateSpawnConfig(enemyConfig.spawn);

    this.enemies = enemies;
    this.player = player;
    this.camera = camera;
    this.random = random;
    this.world = world;
    this.#enemyConfigsByTypeId = configByTypeId;
    this.#enemyConfig = Object.freeze({
      ...copiedConfigs,
      spawn: Object.freeze({ ...enemyConfig.spawn }),
    });
    this.#defaultWaveSnapshot = Object.freeze({
      phaseId: 'default',
      startSeconds: 0,
      endSeconds: null,
      spawnIntervalSeconds: this.#enemyConfig.spawn.intervalSeconds,
      enemyWeights: Object.freeze({ [this.#enemyConfig.EN01.typeId]: 1 }),
    });
  }

  get elapsedSeconds() {
    return this.#elapsedSeconds;
  }

  update(deltaSeconds, waveSnapshot = this.#defaultWaveSnapshot) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return 0;

    const weightedConfigs = validateWaveSnapshot(waveSnapshot, this.#enemyConfigsByTypeId);
    const hpMultiplier = waveSnapshot.hpMultiplier ?? 1;
    if (!Number.isFinite(hpMultiplier) || hpMultiplier < 1 || hpMultiplier > 3) throw new RangeError('Invalid spawn health multiplier');
    const interval = waveSnapshot.spawnIntervalSeconds;
    const totalElapsed = this.#elapsedSeconds + deltaSeconds;
    if (!Number.isFinite(totalElapsed)) throw new RangeError('Accumulated spawn time must be finite');

    const tolerance = Number.EPSILON * Math.max(Math.abs(totalElapsed), interval) * 8;
    const spawnTokens = Math.floor((totalElapsed + tolerance) / interval);
    const remainder = totalElapsed % interval;
    this.#elapsedSeconds = remainder <= tolerance || interval - remainder <= tolerance ? 0 : remainder;

    const attempts = Math.min(spawnTokens, this.#enemyConfig.spawn.maxActive);
    for (let token = 0; token < attempts; token += 1) this.#trySpawn(weightedConfigs, hpMultiplier);
    return attempts;
  }

  reset() {
    this.#elapsedSeconds = 0;
  }

  spawnEncounterElite({ x, y, config, encounterId } = {}) {
    const aliveNormal = this.enemies.filter(enemy => enemy.alive && enemy.hp > 0 && enemy.category === 'normal');
    if (aliveNormal.length >= this.#enemyConfig.spawn.maxActive || aliveNormal.some(enemy => enemy.elite)) return null;
    if (!config || !this.#isValidPosition(x, y, config.radius, this.#enemyConfig.spawn.viewportClearance)) return null;
    const enemy = new Enemy({ id: `enemy-${this.#nextId++}`, x, y, config,
      worldWidth: this.world.width, worldHeight: this.world.height });
    enemy.elite = true;
    enemy.encounterId = encounterId;
    this.enemies.push(enemy);
    return enemy;
  }

  #trySpawn(weightedConfigs, hpMultiplier = 1) {
    const { spawn } = this.#enemyConfig;
    const activeCount = this.enemies.reduce(
      (count, enemy) => count + (enemy.category === 'normal' && enemy.alive && enemy.hp > 0 ? 1 : 0),
      0,
    );
    if (activeCount >= spawn.maxActive) return false;

    let enemyConfig = this.#selectEnemyConfig(weightedConfigs);
    if (enemyConfig.elite && this.enemies.some(enemy => enemy.elite && enemy.alive && enemy.hp > 0)) enemyConfig = this.#enemyConfig.EN01;
    const segments = this.#getSpawnSegments(
      enemyConfig.radius + spawn.viewportClearance,
      enemyConfig.radius,
    );
    const totalLength = segments.reduce((length, segment) => length + segment.length, 0);
    if (totalLength <= 0) return false;

    for (let attempt = 0; attempt < spawn.maxPositionAttempts; attempt += 1) {
      const segment = this.#sampleSegment(segments, totalLength);
      const along = this.#randomValue() * segment.length;
      const x = segment.axis === 'x' ? segment.position : segment.start + along;
      const y = segment.axis === 'y' ? segment.position : segment.start + along;
      if (!this.#isValidPosition(x, y, enemyConfig.radius, spawn.viewportClearance)) continue;

      const enemy = new Enemy({
        id: `enemy-${this.#nextId}`,
        x,
        y,
        config: hpMultiplier === 1 ? enemyConfig : { ...enemyConfig, hp: enemyConfig.hp * hpMultiplier, maxHp: enemyConfig.maxHp * hpMultiplier },
        worldWidth: this.world.width,
        worldHeight: this.world.height,
      });
      this.#nextId += 1;
      this.enemies.push(enemy);
      return true;
    }

    return false;
  }

  #selectEnemyConfig(weightedConfigs) {
    if (weightedConfigs.length === 1) return weightedConfigs[0].config;

    let selection = this.#randomValue();
    for (const { config, weight } of weightedConfigs) {
      if (selection < weight) return config;
      selection -= weight;
    }
    return weightedConfigs.at(-1).config;
  }

  #getSpawnSegments(clearance, radius) {
    const left = this.camera.x;
    const right = left + this.camera.viewportWidth;
    const top = this.camera.y;
    const bottom = top + this.camera.viewportHeight;
    const minX = radius;
    const maxX = this.world.width - radius;
    const minY = radius;
    const maxY = this.world.height - radius;

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
