export const SAVE_KEY = 'protocol-zero.save';
export const SAVE_VERSION = 1;

export const DEFAULT_PROGRESS = Object.freeze({
  version: SAVE_VERSION,
  highestKillCount: 0,
  bestVictorySeconds: null,
  soundEnabled: true,
  soundVolume: 0.65,
});

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.version !== SAVE_VERSION
    || !Number.isSafeInteger(value.highestKillCount) || value.highestKillCount < 0
    || !(value.bestVictorySeconds === null
      || (Number.isFinite(value.bestVictorySeconds) && value.bestVictorySeconds >= 0))
    || typeof value.soundEnabled !== 'boolean'
    || !Number.isFinite(value.soundVolume) || value.soundVolume < 0 || value.soundVolume > 1) {
    return null;
  }
  return Object.freeze({
    version: SAVE_VERSION,
    highestKillCount: value.highestKillCount,
    bestVictorySeconds: value.bestVictorySeconds,
    soundEnabled: value.soundEnabled,
    soundVolume: value.soundVolume,
  });
}

export class LocalProgressStore {
  #storage;
  #key;

  constructor({ storage = getDefaultStorage(), key = SAVE_KEY } = {}) {
    if (storage !== null && typeof storage !== 'object') {
      throw new TypeError('Progress storage must be an object or null');
    }
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new TypeError('Progress storage key must be a non-empty string');
    }
    this.#storage = storage;
    this.#key = key;
  }

  load() {
    try {
      if (!this.#storage || typeof this.#storage.getItem !== 'function') return DEFAULT_PROGRESS;
      const raw = this.#storage.getItem(this.#key);
      if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_PROGRESS;
      return normalizeProgress(JSON.parse(raw)) ?? DEFAULT_PROGRESS;
    } catch {
      return DEFAULT_PROGRESS;
    }
  }

  save(progress) {
    const normalized = normalizeProgress(progress);
    if (!normalized || !this.#storage || typeof this.#storage.setItem !== 'function') return false;
    try {
      this.#storage.setItem(this.#key, JSON.stringify(normalized));
      return true;
    } catch {
      return false;
    }
  }
}
