import { LEVEL_CONFIG } from '../config/levelConfig.js';
import { GAME_STATES } from '../core/GameStateManager.js';

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const BASE_EXPERIENCE = BigInt(LEVEL_CONFIG.baseExperience);
const EXPERIENCE_STEP = BigInt(LEVEL_CONFIG.experienceStepPerLevel);
const MAX_LEVEL_WITH_EXACT_THRESHOLD = (MAX_SAFE_INTEGER_BIGINT - BASE_EXPERIENCE)
  / EXPERIENCE_STEP + 1n;

function getExactThreshold(level) {
  return BASE_EXPERIENCE + EXPERIENCE_STEP * (level - 1n);
}

function getCumulativeThreshold(level, levelsCrossed) {
  const firstThreshold = getExactThreshold(level);
  return levelsCrossed * firstThreshold
    + EXPERIENCE_STEP * levelsCrossed * (levelsCrossed - 1n) / 2n;
}

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

  const exactThreshold = getExactThreshold(BigInt(level));
  if (exactThreshold > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError('Experience threshold exceeds the exact integer range');
  }

  return Number(exactThreshold);
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

    const startingLevel = BigInt(this.player.level);
    if (startingLevel > MAX_LEVEL_WITH_EXACT_THRESHOLD) {
      throw new RangeError('Player level exceeds the exact experience threshold range');
    }

    const wholeExperience = BigInt(Math.trunc(this.player.exp));
    const fractionalExperience = this.player.exp - Math.trunc(this.player.exp);
    const maxCrossings = MAX_LEVEL_WITH_EXACT_THRESHOLD - startingLevel;
    const firstUnrepresentableResult = maxCrossings + 1n;

    if (wholeExperience >= getCumulativeThreshold(startingLevel, firstUnrepresentableResult)) {
      throw new RangeError('Experience exceeds the exact level progression range');
    }

    let lower = 0n;
    let upper = firstUnrepresentableResult;
    while (upper - lower > 1n) {
      const middle = (lower + upper) / 2n;
      if (getCumulativeThreshold(startingLevel, middle) <= wholeExperience) {
        lower = middle;
      } else {
        upper = middle;
      }
    }

    const pendingLevelUps = BigInt(this.#pendingLevelUps) + lower;
    if (pendingLevelUps > MAX_SAFE_INTEGER_BIGINT) {
      throw new RangeError('Pending level choices exceed the safe integer range');
    }

    const spentExperience = getCumulativeThreshold(startingLevel, lower);
    const remainingExperience = Number(wholeExperience - spentExperience) + fractionalExperience;

    this.player.level = Number(startingLevel + lower);
    this.player.exp = remainingExperience;
    this.#pendingLevelUps = Number(pendingLevelUps);
    return Number(lower);
  }

  reset() {
    this.#pendingLevelUps = 0;
  }

  completePendingLevelUp() {
    if (this.stateManager.currentState !== GAME_STATES.LEVEL_UP || this.#pendingLevelUps === 0) {
      return false;
    }

    if (this.#pendingLevelUps === 1) {
      this.#pendingLevelUps = 0;
      if (!this.stateManager.completeLevelUp()) {
        this.#pendingLevelUps = 1;
        return false;
      }
      return true;
    }

    this.#pendingLevelUps -= 1;
    return true;
  }
}
