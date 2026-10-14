export class DamageNumberSystem {
  #items = [];
  emit({ targetId, x, y, amount, kind = 'enemy' } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(amount) || amount <= 0 || !['enemy', 'player', 'shield'].includes(kind)) return false;
    const item = this.#items.findLast(item => item.targetId === targetId && item.kind === kind && item.age <= .08);
    if (item) { item.amount += amount; return true; }
    if (this.#items.length >= 48) this.#items.shift();
    this.#items.push({ targetId, x, y, amount, kind, age: 0, remaining: .65 });
    return true;
  }
  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid damage text step');
    this.#items = this.#items.map(item => ({ ...item, age: item.age + deltaSeconds, remaining: item.remaining - deltaSeconds })).filter(item => item.remaining > 0);
  }
  getSnapshot() { return Object.freeze(this.#items.map(item => Object.freeze({ ...item }))); }
  reset() { this.#items = []; }
}
