export class CharacterSkillSystem {
  #cooldown = 0; #effect = null;
  constructor({ player, enemies, enemyDamageSystem, statusEffectSystem }) {
    this.player = player; this.enemies = enemies; this.enemyDamageSystem = enemyDamageSystem; this.statusEffectSystem = statusEffectSystem;
  }
  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid skill step');
    this.#cooldown = Math.max(0, this.#cooldown - deltaSeconds);
    if (this.#effect) { this.#effect.remaining -= deltaSeconds; if (this.#effect.remaining <= 0) this.#effect = null; }
  }
  use(character, damageMultiplier = 1) {
    if (!this.player.alive || this.#cooldown > 1e-9) return false;
    const targets = this.enemies.filter(enemy => enemy.alive && enemy.hp > 0 && Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= character.range + enemy.radius);
    if (character.id === 'bastion') {
      if (this.player.shield >= 50) return false;
      this.player.shield = Math.min(50, this.player.shield + 25);
    } else {
      if (!targets.length) return false;
      if (character.id === 'zero') for (const enemy of targets) this.enemyDamageSystem.applyDamage(enemy, 40 * damageMultiplier, 'character-pulse');
      else if (!targets.reduce((count, enemy) => count + Number(this.statusEffectSystem.applySlow(enemy, { sourceId: 'character-freeze', factor: .4, duration: 3 })), 0)) return false;
    }
    this.#cooldown = character.cooldown;
    this.#effect = { x: this.player.x, y: this.player.y, radius: character.range, color: character.color, remaining: .35 };
    return true;
  }
  getSnapshot(character) { return Object.freeze({ name: character.skillName, cooldown: character.cooldown, cooldownRemaining: this.#cooldown, effect: this.#effect ? Object.freeze({ ...this.#effect }) : null }); }
  reset() { this.#cooldown = 0; this.#effect = null; }
}
