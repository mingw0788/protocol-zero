import { LEVEL_CONFIG } from '../config/levelConfig.js';
import { GAME_STATES } from '../core/GameStateManager.js';

function requirePlayer(player) {
  if (!player || typeof player !== 'object') {
    throw new TypeError('LevelSystem requires a player');
  }
  if (!Number.isSafeInteger(player.level) || player.level < 1) {
    throw new RangeError('Player level must be a positive safe integer');
  }
  if (!Number.isFinite(player.exp) || player.exp < 0) {
    throw new RangeError('Player experience must be a non-negative finite number');
  }
}

function requireDependencies({ player, stateManager }) {
  requirePlayer(player);
  if (!stateManager || typeof stateManager.currentState !== 'string') {
    throw new TypeError('LevelSystem requires a game state manager');
  }
}

export function getExperienceToNextLevel(level) {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError('Level must be a positive safe integer');
  }

  return LEVEL_CONFIG.baseExperience
    + LEVEL_CONFIG.experienceStepPerLevel * (level - 1);
}

export class LevelSystem {
  #pendingLevelUps = 0;

  constructor({ player, stateManager } = {}) {
    requireDependencies({ player, stateManager });
    this.player = player;
    this.stateManager = stateManager;
  }

  get pendingLevelUps() {
    return this.#pendingLevelUps;
  }

  processExperience() {
    requirePlayer(this.player);

    let nextLevel = this.player.level;
    let remainingExperience = this.player.exp;
    let gainedLevels = 0;

    while (remainingExperience >= getExperienceToNextLevel(nextLevel)) {
      if (!Number.isSafeInteger(nextLevel + 1)) {
        throw new RangeError('Player level cannot exceed the safe integer range');
      }

      remainingExperience -= getExperienceToNextLevel(nextLevel);
      nextLevel += 1;
      gainedLevels += 1;
      if (!Number.isSafeInteger(this.#pendingLevelUps + gainedLevels)) {
        throw new RangeError('Pending level choices exceed the safe integer range');
      }
    }

    this.player.level = nextLevel;
    this.player.exp = remainingExperience;
    this.#pendingLevelUps += gainedLevels;
    return gainedLevels;
  }

  reset() {
    this.#pendingLevelUps = 0;
  }

  completePendingLevelUp() {
    if (this.stateManager.currentState !== GAME_STATES.LEVEL_UP || this.#pendingLevelUps === 0) {
      return false;
    }

    if (this.#pendingLevelUps === 1 && !this.stateManager.completeLevelUp()) {
      return false;
    }

    this.#pendingLevelUps -= 1;
    return true;
  }
}
