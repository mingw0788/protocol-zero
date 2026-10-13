import { EXPLORATION_CONFIG, TACTICAL_CONFIG } from '../config/tacticalConfig.js';

export class ExplorationSystem {
  #terminals = [];
  #completionAwarded = false;

  constructor({ player, onReward, onComplete, config = TACTICAL_CONFIG }) {
    this.player = player;
    this.onReward = onReward;
    this.onComplete = onComplete;
    this.config = config;
    this.reset('laboratory');
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Invalid exploration time');
    if (!this.player.alive || deltaSeconds === 0) return;
    for (const terminal of this.#terminals) {
      if (terminal.completed) continue;
      if (Math.hypot(this.player.x - terminal.x, this.player.y - terminal.y) > this.config.terminalRadius) {
        terminal.charge = 0;
        continue;
      }
      terminal.charge = Math.min(this.config.terminalSeconds, terminal.charge + deltaSeconds);
      if (terminal.charge + 1e-9 < this.config.terminalSeconds) continue;
      terminal.completed = true;
      this.player.exp += this.config.terminalExperience;
      this.onReward?.(Object.freeze({ ...terminal }));
    }
    if (!this.#completionAwarded && this.#terminals.length > 0 && this.#terminals.every(t => t.completed)) {
      this.#completionAwarded = true;
      this.player.exp += this.config.completionExperience;
      this.onComplete?.();
    }
  }

  getSnapshot() {
    return Object.freeze({ completed: this.#terminals.filter(t => t.completed).length,
      total: this.#terminals.length,
      terminals: Object.freeze(this.#terminals.map(t => Object.freeze({ ...t,
        radius: this.config.terminalRadius, channelSeconds: this.config.terminalSeconds,
        experienceReward: this.config.terminalExperience,
        progress: Math.min(1, t.charge / this.config.terminalSeconds) }))) });
  }

  reset(mapId = 'laboratory') {
    this.#terminals = (EXPLORATION_CONFIG[mapId] ?? []).map(t => ({ ...t, charge: 0, completed: false }));
    this.#completionAwarded = false;
  }
}
