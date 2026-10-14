import { BOSS_CONFIG } from '../config/bossConfig.js';
import { Enemy } from '../entities/Enemy.js';
import { WORLD_MAP } from '../config/worldConfig.js';

const POSITIVE_FIELDS = Object.freeze([
  'hp',
  'maxHp',
  'speed',
  'radius',
  'contactDamage',
  'spawnTimeSeconds',
  'spawnClearance',
  'initialAttackDelaySeconds',
  'telegraphSeconds',
  'chargeSpeed',
  'chargeDurationSeconds',
  'recoverySeconds',
  'attackCooldownSeconds',
]);
const REQUIRED_HP = 1800;
const REQUIRED_SPAWN_TIME_SECONDS = 270;
const MIN_TELEGRAPH_SECONDS = 0.7;

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function validateConfig(config, allowTuning = false) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('BossSystem requires a Boss config');
  }
  for (const field of POSITIVE_FIELDS) requirePositiveFinite(config[field], field);
  if (!allowTuning && (config.hp !== REQUIRED_HP || config.maxHp !== REQUIRED_HP)) {
    throw new RangeError(`Boss hp and maxHp must remain ${REQUIRED_HP}`);
  }
  if (!allowTuning && config.spawnTimeSeconds !== REQUIRED_SPAWN_TIME_SECONDS) {
    throw new RangeError(`Boss spawnTimeSeconds must remain ${REQUIRED_SPAWN_TIME_SECONDS}`);
  }
  if (config.telegraphSeconds < MIN_TELEGRAPH_SECONDS) {
    throw new RangeError(`Boss telegraphSeconds must be at least ${MIN_TELEGRAPH_SECONDS}`);
  }
  if (!Number.isFinite(config.expDrop) || config.expDrop !== 0) {
    throw new RangeError('Boss expDrop must be zero');
  }
  if (!Number.isFinite(config.warningWidthPadding) || config.warningWidthPadding < 0) {
    throw new RangeError('warningWidthPadding must be a non-negative finite number');
  }
  if (config.hp > config.maxHp) throw new RangeError('Boss hp cannot exceed maxHp');
  if (config.category !== 'boss') throw new TypeError('Boss category must be boss');
  if (typeof config.typeId !== 'string' || config.typeId.trim().length === 0
    || typeof config.name !== 'string' || config.name.trim().length === 0
    || typeof config.color !== 'string' || config.color.trim().length === 0) {
    throw new TypeError('Boss config requires a typeId, name, and color');
  }
}

function validateWorld(world) {
  if (!world || !Number.isFinite(world.width) || world.width <= 0
    || !Number.isFinite(world.height) || world.height <= 0) {
    throw new TypeError('BossSystem requires valid world dimensions');
  }
}

function validatePlayer(player) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)
    || !Number.isFinite(player.radius) || player.radius <= 0) {
    throw new TypeError('BossSystem requires a player with finite position and radius');
  }
}

function validateCamera(camera) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y)
    || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
    || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
    throw new TypeError('BossSystem requires a camera with a finite logical viewport');
  }
}

function distanceToView(camera, x, y) {
  const dx = Math.max(camera.x - x, 0, x - (camera.x + camera.viewportWidth));
  const dy = Math.max(camera.y - y, 0, y - (camera.y + camera.viewportHeight));
  return Math.hypot(dx, dy);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class BossSystem {
  #config;
  #enemies;
  #player;
  #camera;
  #world;
  #boss = null;
  #spawned = false;
  #phase = 'approach';
  #phaseRemaining = 0;
  #chargeDirection = null;
  #chargeEnd = null;
  #chargeDistanceRemaining = 0;
  #lastDirection = Object.freeze({ x: 1, y: 0 });

  constructor({
    enemies,
    player,
    camera,
    world = WORLD_MAP,
    config = BOSS_CONFIG,
    allowTuning = false,
  } = {}) {
    if (!Array.isArray(enemies)) throw new TypeError('BossSystem requires an enemy array');
    validatePlayer(player);
    validateCamera(camera);
    validateWorld(world);
    if (typeof allowTuning !== 'boolean') throw new TypeError('Boss tuning flag must be boolean');
    validateConfig(config, allowTuning);
    if (world.width < 2 * (config.radius + config.spawnClearance)
      || world.height < 2 * (config.radius + config.spawnClearance)) {
      throw new RangeError('World must fit a Boss plus its spawn clearance');
    }

    this.#config = Object.freeze({ ...config });
    this.#enemies = enemies;
    this.#player = player;
    this.#camera = camera;
    this.#world = world;
    this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
  }

  update(deltaSeconds, effectiveEndSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (!Number.isFinite(effectiveEndSeconds) || effectiveEndSeconds < 0) {
      throw new RangeError('effectiveEndSeconds must be a non-negative finite number');
    }

    if (!this.#spawned && effectiveEndSeconds >= this.#config.spawnTimeSeconds) {
      const position = this.#findSpawnPosition();
      const boss = new Enemy({
        id: 'boss-t01',
        x: position.x,
        y: position.y,
        config: this.#config,
        worldWidth: this.#world.width,
        worldHeight: this.#world.height,
      });
      this.#boss = boss;
      this.#enemies.push(boss);
      this.#spawned = true;
      this.#phase = 'approach';
      this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
      return true;
    }

    if (!this.#boss || deltaSeconds === 0 || !this.#boss.alive || this.#boss.hp <= 0) return false;
    this.#updatePhase(deltaSeconds);
    return false;
  }

  getSnapshot() {
    if (!this.#boss) return null;
    const warningActive = this.#phase === 'telegraph' || this.#phase === 'charging';
    return Object.freeze({
      id: this.#boss.id,
      typeId: this.#boss.typeId,
      name: this.#boss.name,
      x: this.#boss.x,
      y: this.#boss.y,
      radius: this.#boss.radius,
      hp: this.#boss.hp,
      maxHp: this.#boss.maxHp,
        hitFlashRemaining: this.#boss.hitFlashRemaining ?? 0,
      alive: this.#boss.alive && this.#boss.hp > 0,
      phase: this.#phase,
      phaseRemaining: this.#phaseRemaining,
      chargeDirection: warningActive ? Object.freeze({ ...this.#chargeDirection }) : null,
      chargeEnd: warningActive ? Object.freeze({ ...this.#chargeEnd }) : null,
    });
  }

  reset() {
    this.#boss = null;
    this.#spawned = false;
    this.#phase = 'approach';
    this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
    this.#chargeDirection = null;
    this.#chargeEnd = null;
    this.#chargeDistanceRemaining = 0;
    this.#lastDirection = Object.freeze({ x: 1, y: 0 });
  }

  cancelAttack() {
    this.#phase = 'approach'; this.#phaseRemaining = this.#config.initialAttackDelaySeconds;
    this.#chargeDirection = null; this.#chargeEnd = null; this.#chargeDistanceRemaining = 0;
  }

  #updatePhase(deltaSeconds) {
    if (this.#phase === 'approach') {
      this.#moveTowardPlayer(deltaSeconds, this.#config.speed);
      if (this.#countdown(deltaSeconds)) this.#beginTelegraph();
      return;
    }

    if (this.#phase === 'telegraph') {
      if (this.#countdown(deltaSeconds)) {
        this.#phase = 'charging';
        this.#phaseRemaining = this.#config.chargeDurationSeconds;
        this.#chargeDistanceRemaining = this.#config.chargeSpeed * this.#config.chargeDurationSeconds;
      }
      return;
    }

    if (this.#phase === 'charging') {
      this.#moveAlongCharge(deltaSeconds);
      const timerFinished = this.#countdown(deltaSeconds);
      const distanceTolerance = Number.EPSILON * Math.max(1, this.#config.chargeSpeed) * 16;
      if (timerFinished || this.#chargeDistanceRemaining <= distanceTolerance) {
        this.#phase = 'recovery';
        this.#phaseRemaining = this.#config.recoverySeconds;
      }
      return;
    }

    if (this.#phase === 'recovery' && this.#countdown(deltaSeconds)) {
      this.#phase = 'approach';
      this.#phaseRemaining = this.#config.attackCooldownSeconds;
      this.#chargeDirection = null;
      this.#chargeEnd = null;
      this.#chargeDistanceRemaining = 0;
    }
  }

  #moveTowardPlayer(deltaSeconds, speed) {
    const deltaX = this.#player.x - this.#boss.x;
    const deltaY = this.#player.y - this.#boss.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) return;

    const direction = { x: deltaX / distance, y: deltaY / distance };
    this.#lastDirection = direction;
    const travel = Math.min(speed * (this.#boss.slowMultiplier ?? 1) * deltaSeconds, distance);
    this.#boss.x = clamp(
      this.#boss.x + direction.x * travel,
      this.#boss.radius,
      this.#world.width - this.#boss.radius,
    );
    this.#boss.y = clamp(
      this.#boss.y + direction.y * travel,
      this.#boss.radius,
      this.#world.height - this.#boss.radius,
    );
  }

  #moveAlongCharge(deltaSeconds) {
    const requestedDistance = Math.min(
      this.#config.chargeSpeed * (this.#boss.slowMultiplier ?? 1) * deltaSeconds,
      this.#chargeDistanceRemaining,
    );
    const previousX = this.#boss.x;
    const previousY = this.#boss.y;
    this.#boss.x = clamp(
      previousX + this.#chargeDirection.x * requestedDistance,
      this.#boss.radius,
      this.#world.width - this.#boss.radius,
    );
    this.#boss.y = clamp(
      previousY + this.#chargeDirection.y * requestedDistance,
      this.#boss.radius,
      this.#world.height - this.#boss.radius,
    );
    const actualDistance = Math.hypot(this.#boss.x - previousX, this.#boss.y - previousY);
    this.#chargeDistanceRemaining = Math.max(0, this.#chargeDistanceRemaining - actualDistance);
  }

  #countdown(deltaSeconds) {
    const remaining = this.#phaseRemaining - deltaSeconds;
    const phaseScale = Math.max(
      this.#config.initialAttackDelaySeconds,
      this.#config.telegraphSeconds,
      this.#config.chargeDurationSeconds,
      this.#config.recoverySeconds,
      this.#config.attackCooldownSeconds,
      deltaSeconds,
    );
    const tolerance = Number.EPSILON * phaseScale * 32;
    this.#phaseRemaining = remaining <= tolerance ? 0 : remaining;
    return this.#phaseRemaining === 0;
  }

  #beginTelegraph() {
    const deltaX = this.#player.x - this.#boss.x;
    const deltaY = this.#player.y - this.#boss.y;
    const distance = Math.hypot(deltaX, deltaY);
    const direction = distance > 0
      ? { x: deltaX / distance, y: deltaY / distance }
      : this.#lastDirection;
    this.#chargeDirection = Object.freeze({ ...direction });
    this.#chargeEnd = Object.freeze({
      x: clamp(
        this.#boss.x + direction.x * this.#config.chargeSpeed * this.#config.chargeDurationSeconds,
        this.#boss.radius,
        this.#world.width - this.#boss.radius,
      ),
      y: clamp(
        this.#boss.y + direction.y * this.#config.chargeSpeed * this.#config.chargeDurationSeconds,
        this.#boss.radius,
        this.#world.height - this.#boss.radius,
      ),
    });
    this.#phase = 'telegraph';
    this.#phaseRemaining = this.#config.telegraphSeconds;
  }

  #findSpawnPosition() {
    const inset = this.#config.radius + this.#config.spawnClearance;
    const candidates = [
      { x: inset, y: inset },
      { x: this.#world.width - inset, y: inset },
      { x: inset, y: this.#world.height - inset },
      { x: this.#world.width - inset, y: this.#world.height - inset },
    ].filter((point) => this.#isPositionSafe(point));

    if (candidates.length === 0) {
      throw new RangeError('No legal map corner is available for the Boss');
    }

    const offView = candidates.filter((point) => distanceToView(this.#camera, point.x, point.y)
      >= this.#config.radius + this.#config.spawnClearance);
    const pool = offView.length > 0 ? offView : candidates;
    let farthest = pool[0];
    let greatestDistanceSquared = -1;
    for (const candidate of pool) {
      const dx = candidate.x - this.#player.x;
      const dy = candidate.y - this.#player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > greatestDistanceSquared) {
        farthest = candidate;
        greatestDistanceSquared = distanceSquared;
      }
    }
    return farthest;
  }

  #isPositionSafe(point) {
    if (point.x < this.#config.radius || point.x > this.#world.width - this.#config.radius
      || point.y < this.#config.radius || point.y > this.#world.height - this.#config.radius) {
      return false;
    }
    return Math.hypot(point.x - this.#player.x, point.y - this.#player.y)
      >= this.#config.radius + this.#player.radius;
  }
}
