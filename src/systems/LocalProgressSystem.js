import {
  DEFAULT_PROGRESS,
  LocalProgressStore,
  normalizeProgress,
} from '../persistence/LocalProgressStore.js';

export class LocalProgressSystem {
  #store;
  #snapshot = DEFAULT_PROGRESS;

  constructor({ store = new LocalProgressStore() } = {}) {
    if (!store || typeof store.load !== 'function' || typeof store.save !== 'function') {
      throw new TypeError('LocalProgressSystem requires a progress store');
    }
    this.#store = store;
    try {
      this.#snapshot = normalizeProgress(store.load()) ?? DEFAULT_PROGRESS;
    } catch {
      this.#snapshot = DEFAULT_PROGRESS;
    }
  }

  getSnapshot() {
    return this.#snapshot;
  }

  updateAudioPreferences({ soundEnabled = this.#snapshot.soundEnabled, soundVolume = this.#snapshot.soundVolume } = {}) {
    const next = normalizeProgress({ ...this.#snapshot, soundEnabled, soundVolume });
    if (!next) return false;
    this.#snapshot = next;
    return this.#persist();
  }

  recordRun(result) {
    if (result?.mapId === 'energy-hub') return false;
    if (result?.modeId !== undefined && result.modeId !== 'standard') return false;
    if (!result || !['victory', 'defeat'].includes(result.outcome)
      || !Number.isSafeInteger(result.killCount) || result.killCount < 0
      || !Number.isFinite(result.elapsedSeconds) || result.elapsedSeconds < 0) return false;

    const bestVictorySeconds = result.outcome === 'victory'
      && (this.#snapshot.bestVictorySeconds === null
        || result.elapsedSeconds < this.#snapshot.bestVictorySeconds)
      ? result.elapsedSeconds
      : this.#snapshot.bestVictorySeconds;
    const next = normalizeProgress({
      ...this.#snapshot,
      highestKillCount: Math.max(this.#snapshot.highestKillCount, result.killCount),
      bestVictorySeconds,
    });
    if (!next) return false;
    const changed = next.highestKillCount !== this.#snapshot.highestKillCount
      || next.bestVictorySeconds !== this.#snapshot.bestVictorySeconds;
    this.#snapshot = next;
    return changed ? this.#persist() : true;
  }

  #persist() {
    try {
      return this.#store.save(this.#snapshot) === true;
    } catch {
      return false;
    }
  }
}
