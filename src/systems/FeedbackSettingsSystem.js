export const FEEDBACK_STORAGE_KEY = 'protocol-zero.feedback.v1';
export const DEFAULT_FEEDBACK = Object.freeze({ version: 1, showDamageNumbers: true, reducedFlash: false, strongDanger: true, showTutorial: true, musicVolume: .2 });
function storageOrNull() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function normalizeFeedback(value) {
  if (!value || value.version !== 1 || !['showDamageNumbers', 'reducedFlash', 'strongDanger', 'showTutorial'].every(key => typeof value[key] === 'boolean')
    || !Number.isFinite(value.musicVolume) || value.musicVolume < 0 || value.musicVolume > 1) return null;
  return Object.freeze(Object.fromEntries(Object.keys(DEFAULT_FEEDBACK).map(key => [key, value[key]])));
}
export class FeedbackSettingsSystem {
  #snapshot = DEFAULT_FEEDBACK;
  #blocked = false;
  constructor({ storage = storageOrNull() } = {}) {
    this.storage = storage;
    try {
      const raw = storage?.getItem(FEEDBACK_STORAGE_KEY);
      if (raw && raw.length <= 2048) {
        const value = JSON.parse(raw); this.#blocked = value?.version !== 1;
        this.#snapshot = normalizeFeedback(value) ?? DEFAULT_FEEDBACK;
      } else if (raw) this.#blocked = true;
    } catch { /* Missing or damaged settings use defaults. */ }
  }
  getSnapshot() { return this.#snapshot; }
  update(patch) {
    if (!patch || typeof patch !== 'object' || Object.keys(patch).some(key => !Object.hasOwn(DEFAULT_FEEDBACK, key) || key === 'version')) return false;
    const next = normalizeFeedback({ ...this.#snapshot, ...patch });
    if (!next) return false;
    this.#snapshot = next;
    if (this.#blocked || !this.storage) return false;
    try { this.storage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next)); return true; } catch { return false; }
  }
}
