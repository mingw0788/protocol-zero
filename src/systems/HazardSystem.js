import { HAZARD_CONFIG } from '../config/hazardConfig.js';

export class HazardSystem {
  #mapId = 'laboratory';
  #barrels = [];
  #zones = [];
  #effects = [];

  constructor({ player, enemies, enemyDamageSystem, onBlast = null, config = HAZARD_CONFIG } = {}) {
    if (!player || !Array.isArray(enemies) || typeof enemyDamageSystem?.applyDamage !== 'function'
      || (onBlast !== null && typeof onBlast !== 'function')) throw new TypeError('Invalid hazard dependencies');
    for (const key of Object.keys(HAZARD_CONFIG).filter(key => key !== 'barrels' && key !== 'zones')) {
      if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError(`Invalid hazard ${key}`);
    }
    if (!Number.isSafeInteger(config.maxChain) || config.maxChain > 4 || !Number.isSafeInteger(config.maxEffects) || config.maxEffects > 12
      || config.warningSeconds < 1 || config.warningSeconds + config.activeSeconds > config.cycleSeconds) throw new RangeError('Invalid hazard limits');
    const copyMaps = (maps, isZone) => Object.freeze(Object.fromEntries(Object.entries(maps ?? {}).map(([id, entries]) => {
      if (!Array.isArray(entries) || entries.length > 16 || new Set(entries.map(entry => entry.id)).size !== entries.length
        || entries.some(entry => !entry.id || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)
          || (isZone && (!Number.isFinite(entry.width) || entry.width <= 0 || !Number.isFinite(entry.height) || entry.height <= 0
            || !Number.isFinite(entry.offset) || entry.offset < 0)))) throw new RangeError('Invalid hazard map entries');
      return [id, Object.freeze(entries.map(entry => Object.freeze({ ...entry })))];
    })));
    this.player = player; this.enemies = enemies; this.enemyDamageSystem = enemyDamageSystem; this.onBlast = onBlast;
    this.config = Object.freeze({ ...config, barrels: copyMaps(config.barrels, false), zones: copyMaps(config.zones, true) });
    this.reset();
  }

  getAttackTargets(range = Infinity) {
    if (!(range > 0)) throw new RangeError('Invalid object target range');
    return Object.freeze(this.#barrels.filter(barrel => barrel.alive
      && Math.hypot(barrel.x - this.player.x, barrel.y - this.player.y) <= range).map(barrel => Object.freeze({ ...barrel })));
  }

  damageBarrel(id, damage) {
    if (!Number.isFinite(damage) || damage <= 0) throw new RangeError('Invalid barrel damage');
    const barrel = this.#barrels.find(item => item.id === id && item.alive);
    if (!barrel) return false;
    barrel.hp = Math.max(0, barrel.hp - damage);
    if (barrel.hp > 0) return true;
    barrel.alive = false;
    const queue = [barrel];
    let processed = 0;
    while (queue.length > 0 && processed < this.config.maxChain) {
      const current = queue.shift(); processed++;
      if (this.#effects.length >= this.config.maxEffects) this.#effects.shift();
      this.#effects.push({ x: current.x, y: current.y, radius: this.config.explosionRadius,
        remaining: this.config.visualSeconds, lifetime: this.config.visualSeconds });
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.hp > 0 && Math.hypot(enemy.x - current.x, enemy.y - current.y) <= this.config.explosionRadius + enemy.radius) {
          this.enemyDamageSystem.applyDamage(enemy, enemy.category === 'boss' ? this.config.explosionBossDamage : this.config.explosionDamage, 'capacitor-barrel');
        }
      }
      for (const next of this.#barrels) {
        if (!next.alive || processed + queue.length >= this.config.maxChain
          || Math.hypot(next.x - current.x, next.y - current.y) > this.config.explosionRadius + next.radius) continue;
        next.hp = 0; next.alive = false; queue.push(next);
      }
    }
    try {
      this.onBlast?.();
    } catch {
      // A failed presentation observer cannot interrupt settled object damage.
    }
    return true;
  }

  update(deltaSeconds, elapsedSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Invalid hazard time');
    if (deltaSeconds === 0) return [];
    this.#effects = this.#effects.map(effect => ({ ...effect, remaining: effect.remaining - deltaSeconds })).filter(effect => effect.remaining > 0);
    const hits = [];
    for (const zone of this.#zones) {
      const phaseTime = ((elapsedSeconds - zone.offset) % this.config.cycleSeconds + this.config.cycleSeconds) % this.config.cycleSeconds;
      zone.phase = zone.disabled ? 'safe' : phaseTime < this.config.warningSeconds ? 'warning'
        : phaseTime < this.config.warningSeconds + this.config.activeSeconds ? 'active' : 'safe';
      if (zone.phase !== 'active' || !this.player.alive) continue;
      const dx = Math.max(zone.x - this.player.x, 0, this.player.x - zone.x - zone.width);
      const dy = Math.max(zone.y - this.player.y, 0, this.player.y - zone.y - zone.height);
      if (Math.hypot(dx, dy) <= this.player.radius) hits.push({ damage: this.config.arcDamage, sourceTypeId: 'hazard:arc' });
    }
    return hits;
  }

  disableZone(id) {
    const zone = this.#zones.find(zone => zone.id === id && !zone.disabled);
    if (!zone) return false;
    zone.disabled = true; zone.phase = 'safe';
    return true;
  }

  getBlockedPoints() {
    return this.#zones.filter(zone => !zone.disabled).map(zone => ({ x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2, radius: Math.hypot(zone.width, zone.height) / 2 }));
  }

  getSnapshot() {
    return Object.freeze({ barrels: Object.freeze(this.#barrels.map(barrel => Object.freeze({ ...barrel }))),
      zones: Object.freeze(this.#zones.map(zone => Object.freeze({ ...zone }))),
      effects: Object.freeze(this.#effects.map(effect => Object.freeze({ ...effect }))) });
  }

  reset(mapId = this.#mapId) {
    this.#mapId = mapId;
    this.#barrels = (this.config.barrels[mapId] ?? []).map(barrel => ({ ...barrel, kind: 'barrel',
      hp: this.config.barrelHp, radius: this.config.barrelRadius, alive: true }));
    this.#zones = (this.config.zones[mapId] ?? []).map(zone => ({ ...zone, phase: 'safe', disabled: false }));
    this.#effects = [];
  }
}
