import { WAVE_CONFIG } from '../config/waveConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function copyPhases(config) {
  if (!config || typeof config !== 'object' || !Array.isArray(config.phases)
    || config.phases.length === 0) {
    throw new TypeError('WaveSystem requires at least one phase');
  }

  const ids = new Set();
  let previousEnd = 0;
  const phases = config.phases.map((phase, index) => {
    if (!phase || typeof phase !== 'object'
      || typeof phase.phaseId !== 'string' || phase.phaseId.trim().length === 0) {
      throw new TypeError('Each wave phase requires a non-empty phaseId');
    }
    if (ids.has(phase.phaseId)) throw new RangeError('Wave phase IDs must be unique');
    ids.add(phase.phaseId);

    if (!Number.isFinite(phase.startSeconds) || phase.startSeconds < 0
      || phase.startSeconds !== previousEnd) {
      throw new RangeError('Wave phases must be contiguous and begin at zero');
    }
    if (index === config.phases.length - 1) {
      if (phase.endSeconds !== null) {
        throw new RangeError('The final wave phase must have no end time');
      }
    } else if (!Number.isFinite(phase.endSeconds) || phase.endSeconds <= phase.startSeconds) {
      throw new RangeError('Every non-final wave phase must have a finite end after its start');
    }
    requirePositiveFinite(phase.spawnIntervalSeconds, 'spawnIntervalSeconds');

    if (!phase.enemyWeights || typeof phase.enemyWeights !== 'object'
      || Array.isArray(phase.enemyWeights)) {
      throw new TypeError('Each wave phase requires an enemyWeights object');
    }
    const weights = {};
    let totalWeight = 0;
    for (const [typeId, weight] of Object.entries(phase.enemyWeights)) {
      if (typeId.trim().length === 0) throw new TypeError('Enemy weight type IDs must be non-empty');
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError('Enemy weights must be non-negative finite numbers');
      }
      weights[typeId] = weight;
      totalWeight += weight;
    }
    if (Object.keys(weights).length === 0 || Math.abs(totalWeight - 1) > 1e-9) {
      throw new RangeError('Enemy weights in each phase must sum to 1');
    }

    previousEnd = phase.endSeconds;
    return Object.freeze({
      phaseId: phase.phaseId,
      startSeconds: phase.startSeconds,
      endSeconds: phase.endSeconds,
      spawnIntervalSeconds: phase.spawnIntervalSeconds,
      enemyWeights: Object.freeze(weights),
    });
  });

  if (phases[0].startSeconds !== 0) throw new RangeError('Wave phases must begin at zero');
  return Object.freeze(phases);
}

export class WaveSystem {
  #phases;

  constructor({ config = WAVE_CONFIG } = {}) {
    this.#phases = copyPhases(config);
  }

  getSnapshot(elapsedSeconds) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new RangeError('elapsedSeconds must be a non-negative finite number');
    }

    const phase = this.#phases.find((candidate) => elapsedSeconds >= candidate.startSeconds
      && (candidate.endSeconds === null || elapsedSeconds < candidate.endSeconds));
    if (!phase) throw new RangeError('No wave phase is configured for elapsedSeconds');

    return Object.freeze({
      phaseId: phase.phaseId,
      startSeconds: phase.startSeconds,
      endSeconds: phase.endSeconds,
      spawnIntervalSeconds: phase.spawnIntervalSeconds,
      enemyWeights: Object.freeze({ ...phase.enemyWeights }),
    });
  }
}
