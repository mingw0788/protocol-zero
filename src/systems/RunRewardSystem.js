export class RunRewardSystem {
  #granted = new Set();
  #pending = [];

  constructor({ player, supplySystem } = {}) {
    if (!player || typeof supplySystem?.addPickup !== 'function' || !Array.isArray(supplySystem.config?.rewards)) {
      throw new TypeError('RunRewardSystem requires player and supply interfaces');
    }
    this.player = player;
    this.supplySystem = supplySystem;
  }

  grant({ id, experience, items = [], x, y } = {}) {
    if (typeof id !== 'string' || !id || !Array.isArray(items)
      || !Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Invalid reward identity, items or position');
    if (!Number.isSafeInteger(experience) || experience < 0
      || !Number.isSafeInteger(this.player.exp + experience)) throw new RangeError('Invalid reward experience');
    if (items.some(item => !this.supplySystem.config.rewards.includes(item))) throw new RangeError('Unknown reward item');
    if (this.#granted.has(id)) return false;
    if (this.#granted.size >= 32 || this.#pending.length + items.length > 32) throw new RangeError('Run reward capacity exceeded');
    this.#granted.add(id);
    this.player.exp += experience;
    this.#pending.push(...items.map(type => ({ type, x, y })));
    this.update();
    return true;
  }

  update() {
    this.#pending = this.#pending.filter(item => !this.supplySystem.addPickup(item.type, item.x, item.y));
  }

  getSnapshot() {
    return Object.freeze({ grantedCount: this.#granted.size, pendingItems: this.#pending.length });
  }

  reset() { this.#granted.clear(); this.#pending = []; }
}
