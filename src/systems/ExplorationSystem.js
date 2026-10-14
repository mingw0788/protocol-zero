import { EXPLORATION_CONFIG, TACTICAL_CONFIG } from '../config/tacticalConfig.js';

export class ExplorationSystem {
  #terminals = [];
  #completionAwarded = false;

  constructor({ player, onReward, onComplete, config = TACTICAL_CONFIG, getExperienceMultiplier = () => 1 }) {
    this.player = player;
    this.onReward = onReward;
    this.onComplete = onComplete;
    this.config = config;
    this.getExperienceMultiplier = getExperienceMultiplier;
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
      const experienceReward = Math.round(this.config.terminalExperience * this.getExperienceMultiplier());
      this.player.exp += experienceReward;
      this.onReward?.(Object.freeze({ ...terminal, experienceReward }));
    }
    if (!this.#completionAwarded && this.#terminals.length > 0 && this.#terminals.every(t => t.completed)) {
      this.#completionAwarded = true;
      const experienceReward = Math.round(this.config.completionExperience * this.getExperienceMultiplier());
      this.player.exp += experienceReward;
      this.onComplete?.(experienceReward);
    }
  }

  getSnapshot() {
    return Object.freeze({ completed: this.#terminals.filter(t => t.completed).length,
      total: this.#terminals.length,
      terminals: Object.freeze(this.#terminals.map(t => Object.freeze({ ...t,
        radius: this.config.terminalRadius, channelSeconds: this.config.terminalSeconds,
        experienceReward: Math.round(this.config.terminalExperience * this.getExperienceMultiplier()),
        progress: Math.min(1, t.charge / this.config.terminalSeconds) }))) });
  }

  reset(mapId = 'laboratory', terminals = null) {
    this.#terminals = (terminals ?? EXPLORATION_CONFIG[mapId] ?? []).map(t => ({ ...t, charge: 0, completed: false }));
    this.#completionAwarded = false;
  }
}
