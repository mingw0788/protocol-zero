import { Projectile } from '../entities/Projectile.js';
import { PULSE_EVOLUTION_CONFIG } from '../config/evolutionConfig.js';

function requireCircleEnemy(enemy) {
  return enemy?.alive === true
    && Number.isFinite(enemy.hp)
    && enemy.hp > 0
    && Number.isFinite(enemy.x)
    && Number.isFinite(enemy.y)
    && Number.isFinite(enemy.radius)
    && enemy.radius > 0;
}

function firstIntersectionParameter(projectile, enemies, deltaSeconds) {
  const moveX = projectile.vx * deltaSeconds;
  const moveY = projectile.vy * deltaSeconds;
  const moveLengthSquared = moveX * moveX + moveY * moveY;
  let firstT = Number.POSITIVE_INFINITY;
  let firstEnemy = null;

  for (const enemy of enemies) {
    if (!requireCircleEnemy(enemy)) continue;
    if (enemy.id === projectile.ignoreEnemyId) continue;

    const radius = projectile.radius + enemy.radius;
    const offsetX = projectile.x - enemy.x;
    const offsetY = projectile.y - enemy.y;
    const startDistanceSquared = offsetX * offsetX + offsetY * offsetY;
    const radiusSquared = radius * radius;

    if (startDistanceSquared <= radiusSquared) {
      if (0 < firstT) {
        firstT = 0;
        firstEnemy = enemy;
      }
      continue;
    }
    if (moveLengthSquared === 0) continue;

    const along = offsetX * moveX + offsetY * moveY;
    const discriminant = (along * along)
      - (moveLengthSquared * (startDistanceSquared - radiusSquared));
    if (discriminant < 0) continue;

    const t = (-along - Math.sqrt(discriminant)) / moveLengthSquared;
    if (t >= 0 && t <= 1 && t < firstT) {
      firstT = t;
      firstEnemy = enemy;
    }
  }

  return firstEnemy ? { enemy: firstEnemy, t: firstT } : null;
}

export class ProjectileSystem {
  #nextSplitId = 1;
  constructor({ projectiles, enemies, enemyDamageSystem, getObjects = null, applyObjectDamage = null } = {}) {
    if (!Array.isArray(projectiles)) {
      throw new TypeError('ProjectileSystem requires a projectile array');
    }
    if (!Array.isArray(enemies)) {
      throw new TypeError('ProjectileSystem requires an enemy array');
    }
    if (typeof enemyDamageSystem?.applyDamage !== 'function') {
      throw new TypeError('ProjectileSystem requires an enemy damage system');
    }
    if ((getObjects !== null || applyObjectDamage !== null)
      && (typeof getObjects !== 'function' || typeof applyObjectDamage !== 'function')) throw new TypeError('Object hit callbacks must both be functions');

    this.projectiles = projectiles;
    this.enemies = enemies;
    this.enemyDamageSystem = enemyDamageSystem;
    this.getObjects = getObjects;
    this.applyObjectDamage = applyObjectDamage;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a non-negative finite number');
    }
    if (deltaSeconds === 0) return;

    let writeIndex = 0;
    const children = [];
    for (let readIndex = 0; readIndex < this.projectiles.length; readIndex += 1) {
      const projectile = this.projectiles[readIndex];
      if (!projectile || projectile.active !== true || projectile.remainingLife <= 0) {
        if (projectile) projectile.active = false;
        continue;
      }

      const effectiveDelta = Math.min(deltaSeconds, projectile.remainingLife);
      const intersection = firstIntersectionParameter(projectile, [...this.enemies, ...(this.getObjects?.() ?? [])], effectiveDelta);
      const hitEnemy = intersection?.enemy;
      if (hitEnemy) {
        if (hitEnemy.kind === 'barrel') this.applyObjectDamage?.(hitEnemy.id, projectile.damage);
        else {
          const applied = this.enemyDamageSystem.applyDamage(hitEnemy, projectile.damage, projectile.weaponId);
          if (applied && projectile.canSplit) this.#split(projectile, hitEnemy, effectiveDelta * intersection.t, children);
        }
        projectile.active = false;
        continue;
      }

      projectile.x += projectile.vx * effectiveDelta;
      projectile.y += projectile.vy * effectiveDelta;
      projectile.remainingLife = Math.max(0, projectile.remainingLife - effectiveDelta);
      if (projectile.remainingLife <= 0) {
        projectile.active = false;
        continue;
      }

      this.projectiles[writeIndex] = projectile;
      writeIndex += 1;
    }

    this.projectiles.length = writeIndex;
    this.projectiles.push(...children.slice(0, Math.max(0, PULSE_EVOLUTION_CONFIG.maxProjectiles - writeIndex)));
  }

  #split(projectile, original, travelSeconds, children) {
    const config = PULSE_EVOLUTION_CONFIG;
    const origin = { x: projectile.x + projectile.vx * travelSeconds, y: projectile.y + projectile.vy * travelSeconds };
    const targets = this.enemies.filter(enemy => requireCircleEnemy(enemy) && enemy.id !== original.id
      && Math.hypot(enemy.x - original.x, enemy.y - original.y) <= config.splitRange)
      .sort((a, b) => Math.hypot(a.x - original.x, a.y - original.y) - Math.hypot(b.x - original.x, b.y - original.y)
        || String(a.id).localeCompare(String(b.id))).slice(0, config.splitTargets);
    for (const target of targets) {
      const dx = target.x - origin.x, dy = target.y - origin.y, distance = Math.hypot(dx, dy) || 1;
      children.push(new Projectile({ id: `pulse-split-${this.#nextSplitId++}`, ownerId: projectile.ownerId, weaponId: projectile.weaponId,
        x: origin.x, y: origin.y, vx: dx / distance * config.speed, vy: dy / distance * config.speed,
        radius: config.radius, damage: projectile.damage * config.damageRatio, lifetimeSeconds: config.lifetime,
        canSplit: false, ignoreEnemyId: original.id }));
    }
  }

  reset() { this.#nextSplitId = 1; }
}
