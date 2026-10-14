export class StatusEffectSystem {
  #effects = new Map();
  constructor({ enemies } = {}) {
    if (!Array.isArray(enemies)) throw new TypeError('Status effects require enemies');
    this.enemies = enemies;
  }

  applySlow(enemy, { sourceId, factor, duration } = {}) {
    if (typeof sourceId !== 'string' || !sourceId || !Number.isFinite(factor) || factor < .1 || factor > 1
      || !Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid slow effect');
    if (!enemy?.alive || enemy.hp <= 0 || !this.enemies.includes(enemy)) return false;
    const effects = this.#effects.get(enemy.id) ?? new Map();
    if (!effects.has(sourceId) && effects.size >= 4) return false;
    const boss = enemy.category === 'boss';
    effects.set(sourceId, { factor: boss ? Math.max(.85, factor) : factor, remaining: boss ? Math.min(1.2, duration) : duration });
    this.#effects.set(enemy.id, effects);
    enemy.slowMultiplier = Math.min(1, ...[...effects.values()].map(effect => effect.factor));
    return true;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid status step');
    const live = new Map(this.enemies.filter(enemy => enemy.alive && enemy.hp > 0).map(enemy => [enemy.id, enemy]));
    for (const [id, effects] of this.#effects) {
      const enemy = live.get(id);
      if (!enemy) { this.#effects.delete(id); continue; }
      for (const [source, effect] of effects) {
        effect.remaining = Math.max(0, effect.remaining - deltaSeconds);
        if (effect.remaining <= 1e-9) effects.delete(source);
      }
      enemy.slowMultiplier = Math.min(1, ...[...effects.values()].map(effect => effect.factor));
      if (!effects.size) this.#effects.delete(id);
    }
  }

  reset() { this.#effects.clear(); for (const enemy of this.enemies) enemy.slowMultiplier = 1; }
}
