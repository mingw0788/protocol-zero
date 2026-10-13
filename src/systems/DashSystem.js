import { TACTICAL_CONFIG } from '../config/tacticalConfig.js';

export class DashSystem {
  #remaining = 0;
  #cooldown = 0;
  #direction = { x: 0, y: -1 };

  constructor({ player, config = TACTICAL_CONFIG, onDash = null }) {
    this.player = player;
    this.config = config;
    this.onDash = onDash;
  }

  update(deltaSeconds, direction, requested) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid dash time');
    if (deltaSeconds === 0) return false;
    this.#cooldown = Math.max(0, this.#cooldown - deltaSeconds);
    this.player.dashRemaining = 0;
    if (!this.player.alive) return false;
    if (requested && this.#cooldown <= 1e-9 && this.#remaining === 0) {
      const x = direction?.x || 0, y = direction?.y || 0;
      const length = Math.hypot(x, y);
      this.#direction = length > 0 ? { x: x / length, y: y / length }
        : { x: this.player.facingX, y: this.player.facingY };
      this.#remaining = this.config.dashSeconds;
      this.#cooldown = this.config.dashCooldown;
      this.onDash?.();
    }
    if (this.#remaining <= 0) return false;
    const active = Math.min(deltaSeconds, this.#remaining);
    // Retain protection for the fixed step containing the last part of a dash.
    this.player.dashRemaining = this.#remaining;
    this.player.update(this.#direction, active * this.config.dashSpeedMultiplier);
    this.#remaining = Math.max(0, this.#remaining - active);
    if (deltaSeconds > active) this.player.update(direction, deltaSeconds - active);
    return true;
  }

  getSnapshot() {
    return Object.freeze({ remaining: this.#remaining, cooldownRemaining: this.#cooldown, cooldown: this.config.dashCooldown });
  }

  reset() {
    this.#remaining = 0;
    this.#cooldown = 0;
    this.player.dashRemaining = 0;
    this.#direction = { x: 0, y: -1 };
  }
}
