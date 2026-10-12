import { PARTICLE_CONFIG } from '../config/particleConfig.js';

function requirePosition(value, name) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${name} requires finite x and y coordinates`);
  }
}

function stableHash(value) {
  const source = String(value ?? 'visual-effect');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class ParticleSystem {
  #config;
  #particles = [];
  #nextId = 1;

  constructor(config = PARTICLE_CONFIG) {
    if (!config || !Number.isSafeInteger(config.maxActive) || config.maxActive <= 0
      || !Number.isFinite(config.lifetimeSeconds) || config.lifetimeSeconds <= 0
      || !Number.isSafeInteger(config.enemyDeathCount) || config.enemyDeathCount <= 0
      || !Number.isSafeInteger(config.playerHitCount) || config.playerHitCount <= 0
      || !Number.isSafeInteger(config.playerDeathCount) || config.playerDeathCount <= 0
      || !Number.isFinite(config.minimumSpeed) || config.minimumSpeed <= 0
      || !Number.isFinite(config.maximumSpeed) || config.maximumSpeed < config.minimumSpeed
      || !Number.isFinite(config.radius) || config.radius <= 0) {
      throw new RangeError('ParticleSystem configuration contains invalid limits');
    }
    this.#config = config;
  }

  emitEnemyDeath(event) {
    requirePosition(event, 'Enemy death effect');
    this.#emit(event, this.#config.enemyDeathCount, this.#config.enemyDeathColor, event.enemyId);
  }

  emitPlayerHit(player) {
    requirePosition(player, 'Player hit effect');
    this.#emit(player, this.#config.playerHitCount, this.#config.playerHitColor, 'player-hit');
  }

  emitPlayerDeath(player) {
    requirePosition(player, 'Player death effect');
    this.#emit(player, this.#config.playerDeathCount, this.#config.playerDeathColor, 'player-death');
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Particle delta must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return;
    for (const particle of this.#particles) {
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.remainingSeconds = Math.max(0, particle.remainingSeconds - deltaSeconds);
    }
    this.#particles = this.#particles.filter((particle) => particle.remainingSeconds > Number.EPSILON);
  }

  getSnapshot() {
    return Object.freeze(this.#particles.map((particle) => Object.freeze({ ...particle })));
  }

  reset() {
    this.#particles.length = 0;
    this.#nextId = 1;
  }

  #emit(position, count, color, seed) {
    const offset = (stableHash(seed) / 0x100000000) * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = offset + (index / count) * Math.PI * 2;
      const speedRange = this.#config.maximumSpeed - this.#config.minimumSpeed;
      const speed = this.#config.minimumSpeed + speedRange * ((index % 4) / 3);
      this.#particles.push({
        id: `particle-${this.#nextId++}`,
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: this.#config.radius,
        color,
        lifetimeSeconds: this.#config.lifetimeSeconds,
        remainingSeconds: this.#config.lifetimeSeconds,
      });
    }
    const overflow = this.#particles.length - this.#config.maxActive;
    if (overflow > 0) this.#particles.splice(0, overflow);
  }
}
