import { ENEMY_ATTACK_CONFIG } from '../config/enemyAttackConfig.js';

function crossesPlayer(start, end, player, radius) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((player.x - start.x) * dx + (player.y - start.y) * dy) / lengthSquared));
  return Math.hypot(start.x + dx * t - player.x, start.y + dy * t - player.y) <= player.radius + radius;
}

export class EnemyAttackSystem {
  #states = new Map();
  #projectiles = [];
  #explosions = [];
  #nextId = 1;

  constructor({ player, enemies, onWarning = null, config = ENEMY_ATTACK_CONFIG } = {}) {
    if (!player || !Array.isArray(enemies) || (onWarning !== null && typeof onWarning !== 'function')) throw new TypeError('Invalid hostile attack dependencies');
    if (!config || Object.keys(ENEMY_ATTACK_CONFIG).some(key => !Number.isFinite(config[key]) || config[key] <= 0)
      || !Number.isSafeInteger(config.maxProjectiles) || config.maxProjectiles > 64
      || !Number.isSafeInteger(config.maxExplosions) || config.maxExplosions > 12
      || config.sniperWarning < .9 || config.bomberWarning < 1) throw new RangeError('Invalid hostile attack config');
    this.player = player; this.enemies = enemies; this.onWarning = onWarning;
    this.config = Object.freeze({ ...config });
  }

  update(deltaSeconds, targetFor = null) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid hostile attack time');
    if (deltaSeconds === 0 || !this.player.alive) return [];
    const hits = [];
    this.#explosions = this.#explosions.map(effect => ({ ...effect, remaining: effect.remaining - deltaSeconds })).filter(effect => effect.remaining > 0);
    this.#projectiles = this.#projectiles.filter(projectile => {
      const dt = Math.min(deltaSeconds, projectile.remaining);
      const end = { x: projectile.x + projectile.vx * dt, y: projectile.y + projectile.vy * dt };
      if (crossesPlayer(projectile, end, this.player, projectile.radius)) {
        hits.push({ damage: this.config.bulletDamage, sourceTypeId: projectile.sourceTypeId });
        return false;
      }
      projectile.x = end.x; projectile.y = end.y; projectile.remaining -= dt;
      return projectile.remaining > 1e-9;
    });
    const aliveIds = new Set(this.enemies.filter(enemy => enemy.alive && enemy.hp > 0).map(enemy => enemy.id));
    for (const id of this.#states.keys()) if (!aliveIds.has(id)) this.#states.delete(id);
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp <= 0) { enemy.attackLocked = false; continue; }
      if (enemy.behavior !== 'sniper' && enemy.behavior !== 'bomber') continue;
      let state = this.#states.get(enemy.id);
      if (!state) { state = { phase: 'cooldown', remaining: 0 }; this.#states.set(enemy.id, state); }
      if (state.phase === 'aiming') {
        state.remaining = Math.max(0, state.remaining - deltaSeconds);
        if (state.remaining > 1e-9) continue;
        if (this.#projectiles.length < this.config.maxProjectiles) {
          let dx = state.targetX - enemy.x, dy = state.targetY - enemy.y;
          const distance = Math.hypot(dx, dy);
          if (distance === 0) { dx = 1; dy = 0; } else { dx /= distance; dy /= distance; }
          this.#projectiles.push({ id: `hostile-${this.#nextId++}`, x: enemy.x, y: enemy.y,
            vx: dx * this.config.bulletSpeed, vy: dy * this.config.bulletSpeed,
            sourceTypeId: enemy.typeId, radius: this.config.bulletRadius, remaining: this.config.bulletLifetime });
        }
        state.phase = 'cooldown'; state.remaining = this.config.sniperCooldown; enemy.attackLocked = false;
        continue;
      }
      if (state.phase === 'fuse') {
        state.remaining = Math.max(0, state.remaining - deltaSeconds);
        if (state.remaining > 1e-9) continue;
        if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) <= this.config.blastRadius + this.player.radius) {
          hits.push({ damage: this.config.blastDamage, sourceTypeId: enemy.typeId });
        }
        enemy.hp = 0; enemy.alive = false; enemy.defeatedBySelf = true; enemy.attackLocked = false;
        this.#states.delete(enemy.id);
        if (this.#explosions.length >= this.config.maxExplosions) this.#explosions.shift();
        this.#explosions.push({ x: enemy.x, y: enemy.y, radius: this.config.blastRadius,
          remaining: this.config.blastVisualSeconds, lifetime: this.config.blastVisualSeconds });
        continue;
      }
      state.remaining = Math.max(0, state.remaining - deltaSeconds);
      const target = targetFor?.(enemy) ?? this.player;
      const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
      if (enemy.behavior === 'sniper' && state.remaining <= 1e-9 && distance <= this.config.sniperRange) {
        Object.assign(state, { phase: 'aiming', remaining: this.config.sniperWarning, targetX: target.x, targetY: target.y });
        enemy.attackLocked = true; this.onWarning?.();
      } else if (enemy.behavior === 'bomber' && distance <= this.config.bomberTriggerRadius) {
        Object.assign(state, { phase: 'fuse', remaining: this.config.bomberWarning });
        enemy.attackLocked = true; this.onWarning?.();
      }
    }
    return hits;
  }

  getSnapshot() {
    const aims = [], fuses = [];
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp <= 0) continue;
      const state = this.#states.get(enemy.id);
      if (state?.phase === 'aiming') aims.push(Object.freeze({ enemyId: enemy.id, x1: enemy.x, y1: enemy.y, x2: state.targetX, y2: state.targetY, remaining: state.remaining }));
      if (state?.phase === 'fuse') fuses.push(Object.freeze({ enemyId: enemy.id, x: enemy.x, y: enemy.y,
        radius: this.config.blastRadius, remaining: state.remaining, progress: 1 - state.remaining / this.config.bomberWarning }));
    }
    return Object.freeze({ aims: Object.freeze(aims), fuses: Object.freeze(fuses),
      projectiles: Object.freeze(this.#projectiles.map(projectile => Object.freeze({ ...projectile }))),
      explosions: Object.freeze(this.#explosions.map(effect => Object.freeze({ ...effect }))) });
  }

  reset() {
    this.#states.clear(); this.#projectiles = []; this.#explosions = []; this.#nextId = 1;
    for (const enemy of this.enemies) enemy.attackLocked = false;
  }
}
