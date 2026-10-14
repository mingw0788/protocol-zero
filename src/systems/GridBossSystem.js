import { BossSystem } from './BossSystem.js';
import { BOSS_CONFIG, GRID_BOSS_CONFIG } from '../config/bossConfig.js';

export class GridBossSystem {
  #base;
  #stage = 1;
  #transition = 0;
  #cooldown = GRID_BOSS_CONFIG.stageOneInterval;
  #warnings = [];
  #hits = [];
  #contactDamage;
  constructor({ enemies, player, camera, world, config = BOSS_CONFIG, allowTuning = false, onWarning = null } = {}) {
    this.enemies = enemies; this.player = player; this.onWarning = onWarning;
    this.#contactDamage = config.contactDamage;
    this.#base = new BossSystem({ enemies, player, camera, world,
      allowTuning, config: { ...config, typeId: 'BOSS-02', name: '电网监护者', color: '#a6bbff' } });
  }
  update(deltaSeconds, elapsedSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Invalid grid boss step');
    this.#hits = [];
    if (deltaSeconds === 0) return false;
    const snapshot = this.#base.getSnapshot();
    if (!snapshot) return this.#base.update(deltaSeconds, elapsedSeconds);
    if (!snapshot.alive) { this.#warnings = []; return false; }
    const boss = this.enemies.find(enemy => enemy.id === snapshot.id);
    if (this.#stage === 1 && snapshot.hp <= snapshot.maxHp / 2) {
      this.#stage = 2; this.#transition = GRID_BOSS_CONFIG.transitionSeconds; this.#warnings = [];
      this.#base.cancelAttack();
      this.#cooldown = GRID_BOSS_CONFIG.stageTwoInterval;
      if (boss) boss.contactDamage = 0;
      this.#warn();
      return false;
    }
    if (this.#transition > 0) {
      this.#transition = Math.max(0, this.#transition - deltaSeconds);
      if (this.#transition <= 1e-9) { this.#transition = 0; if (boss) boss.contactDamage = this.#contactDamage; }
      return false;
    }
    this.#base.update(deltaSeconds, elapsedSeconds);
    for (const warning of this.#warnings) {
      warning.remaining = Math.max(0, warning.remaining - deltaSeconds);
      if (warning.remaining <= 1e-9 && this.player.alive
        && Math.hypot(this.player.x - warning.x, this.player.y - warning.y) <= warning.radius + this.player.radius) {
        this.#hits.push({ damage: GRID_BOSS_CONFIG.damage, sourceTypeId: 'BOSS-02' });
      }
    }
    this.#warnings = this.#warnings.filter(warning => warning.remaining > 1e-9);
    this.#cooldown = Math.max(0, this.#cooldown - deltaSeconds);
    if (this.#cooldown <= 1e-9 && this.#warnings.length === 0) {
      const offsets = this.#stage === 1 ? [0] : [-GRID_BOSS_CONFIG.spread, 0, GRID_BOSS_CONFIG.spread];
      this.#warnings = offsets.map(offset => ({ x: this.player.x + offset, y: this.player.y,
        radius: GRID_BOSS_CONFIG.radius, remaining: GRID_BOSS_CONFIG.warningSeconds }));
      this.#cooldown = this.#stage === 1 ? GRID_BOSS_CONFIG.stageOneInterval : GRID_BOSS_CONFIG.stageTwoInterval;
      this.#warn();
    }
    return false;
  }
  #warn() { try { this.onWarning?.(); } catch { /* Presentation is isolated from combat. */ } }
  getDamageCandidates() { return Object.freeze(this.#hits.map(hit => Object.freeze({ ...hit }))); }
  getSnapshot() {
    const snapshot = this.#base.getSnapshot();
    return snapshot ? Object.freeze({ ...snapshot, phase: this.#transition > 0 ? 'phase-transition' : snapshot.phase,
      combatStage: this.#stage, transitionRemaining: this.#transition,
      electricalWarnings: Object.freeze(this.#warnings.map(warning => Object.freeze({ ...warning }))) }) : null;
  }
  reset() { this.#base.reset(); this.#stage = 1; this.#transition = 0; this.#cooldown = GRID_BOSS_CONFIG.stageOneInterval; this.#warnings = []; this.#hits = []; }
}
