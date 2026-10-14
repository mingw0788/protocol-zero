import { DEFAULT_PROGRESS, LocalProgressStore, normalizeProgress } from '../persistence/LocalProgressStore.js';
import { parseProgressExport } from '../persistence/progressTransfer.js';
import { DEFAULT_FEEDBACK, normalizeFeedback } from './FeedbackSettingsSystem.js';
import { createRecordKey } from '../config/runConfig.js';
import { DISCOVERY_IDS, COSMETICS } from '../config/progressConfig.js';
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
export class LocalProgressSystem {
  #store; #snapshot = DEFAULT_PROGRESS; #saved = true;
  constructor({ store = new LocalProgressStore() } = {}) {
    if (!store || typeof store.load !== 'function' || typeof store.save !== 'function') throw new TypeError('LocalProgressSystem requires a progress store');
    this.#store = store;
    try { this.#snapshot = normalizeProgress(store.load()) ?? DEFAULT_PROGRESS; this.#saved = ['ready', undefined].includes(store.getStatus?.()); }
    catch { this.#snapshot = DEFAULT_PROGRESS; this.#saved = false; }
  }
  getSnapshot() { return this.#snapshot; }
  getSaveStatus() { return Object.freeze({ saved: this.#saved, reason: this.#store.getStatus?.() ?? (this.#saved ? 'ready' : 'unavailable') }); }
  getRecord(config) { const key = createRecordKey(config); return this.#snapshot.records.find(record => record.key === key) ?? null; }
  updateAudioPreferences({ soundEnabled = this.#snapshot.soundEnabled, soundVolume = this.#snapshot.soundVolume } = {}) {
    const next = normalizeProgress({ ...this.#snapshot, soundEnabled, soundVolume });
    if (!next) return false; this.#snapshot = next; return this.#persist();
  }
  #mergeDiscoveries(input = {}) {
    if (!input || typeof input !== 'object') return null;
    const result = {};
    for (const [key, allowed] of Object.entries(DISCOVERY_IDS)) {
      const values = input[key] ?? [];
      if (!Array.isArray(values) || values.length > allowed.length || values.some(id => !allowed.includes(id))) return null;
      const set = new Set([...this.#snapshot.discoveries[key], ...values]); result[key] = allowed.filter(id => set.has(id));
    }
    return result;
  }
  recordDiscoveries(input) {
    const discoveries = this.#mergeDiscoveries(input);
    if (!discoveries) return false;
    const next = normalizeProgress({ ...this.#snapshot, discoveries });
    if (!next) return false;
    if (JSON.stringify(next) === JSON.stringify(this.#snapshot)) return true;
    this.#snapshot = next; return this.#persist();
  }
  recordRun(result) {
    if (!result || !['victory', 'defeat'].includes(result.outcome) || !nonnegative(result.killCount)
      || !Number.isFinite(result.elapsedSeconds) || result.elapsedSeconds < 0 || result.elapsedSeconds > 86400) return false;
    const key = createRecordKey(result);
    if (!key) return false;
    const records = [...this.#snapshot.records], index = records.findIndex(record => record.key === key);
    const record = index < 0 ? { key, highestKillCount: 0, bestVictorySeconds: null, wins: 0, runs: 0,
      bestEndlessSeconds: 0, highestEndlessKills: 0, maxTerminals: 0 } : { ...records[index] };
    const discoveries = this.#mergeDiscoveries(result.discoveries);
    if (!discoveries) return false;
    if (result.endless === true) {
      if (record.bestVictorySeconds === null || !Number.isFinite(result.endlessSeconds) || result.endlessSeconds < 0
        || result.endlessSeconds > 86400 || !nonnegative(result.endlessKills)) return false;
      record.bestEndlessSeconds = Math.max(record.bestEndlessSeconds, result.endlessSeconds);
      record.highestEndlessKills = Math.max(record.highestEndlessKills, result.endlessKills);
    } else {
      record.runs++; record.highestKillCount = Math.max(record.highestKillCount, result.killCount);
      const terminals = result.exploration?.completed ?? 0;
      if (!Number.isSafeInteger(terminals) || terminals < 0 || terminals > 3) return false;
      record.maxTerminals = Math.max(record.maxTerminals, terminals);
      if (result.outcome === 'victory') {
        record.wins++;
        record.bestVictorySeconds = record.bestVictorySeconds === null ? result.elapsedSeconds : Math.min(record.bestVictorySeconds, result.elapsedSeconds);
      }
    }
    if (index < 0) records.push(record); else records[index] = record;
    const legacyEligible = !result.endless && ['laboratory', 'east-city', undefined].includes(result.mapId)
      && (result.modeId ?? 'standard') === 'standard' && (result.protocolId ?? 'standard') === 'standard' && (result.challengeId ?? 'none') === 'none';
    const bestVictorySeconds = legacyEligible && result.outcome === 'victory'
      ? this.#snapshot.bestVictorySeconds === null ? result.elapsedSeconds : Math.min(this.#snapshot.bestVictorySeconds, result.elapsedSeconds) : this.#snapshot.bestVictorySeconds;
    const next = normalizeProgress({ ...this.#snapshot, records, discoveries, bestVictorySeconds,
      highestKillCount: legacyEligible ? Math.max(this.#snapshot.highestKillCount, result.killCount) : this.#snapshot.highestKillCount });
    if (!next) return false;
    this.#snapshot = next; return this.#persist();
  }
  updateCosmetic(id) {
    const cosmetic = COSMETICS.find(item => item.id === id);
    if (!cosmetic || cosmetic.achievement && !this.#snapshot.achievements.includes(cosmetic.achievement)) return false;
    this.#snapshot = normalizeProgress({ ...this.#snapshot, cosmeticId: id }); return this.#persist();
  }
  exportProgress(feedback = DEFAULT_FEEDBACK) {
    const preferences = normalizeFeedback(feedback);
    if (!preferences) return null;
    return JSON.stringify({ game: 'protocol-zero', version: 1, progress: this.#snapshot, feedback: preferences }, null, 2);
  }
  previewImport(raw) { return parseProgressExport(raw); }
  importProgress(raw) {
    const parsed = parseProgressExport(raw);
    if (!parsed) return Object.freeze({ ok: false, reason: '文件无效、版本不支持或超过64KiB，当前档案未改变。' });
    this.#snapshot = parsed.progress;
    const saved = this.#persist();
    return Object.freeze({ ok: true, saved, feedback: parsed.feedback });
  }
  #persist() { try { this.#saved = this.#store.save(this.#snapshot) === true; } catch { this.#saved = false; } return this.#saved; }
}
