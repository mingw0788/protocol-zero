import { createRecordKey } from '../config/runConfig.js';
import { DISCOVERY_IDS, ACHIEVEMENTS, COSMETICS, deriveAchievements } from '../config/progressConfig.js';
export const SAVE_KEY = 'protocol-zero.save';
export const SAVE_VERSION = 2;
const emptyDiscoveries = Object.freeze(Object.fromEntries(Object.keys(DISCOVERY_IDS).map(key => [key, Object.freeze([])])));
export const DEFAULT_PROGRESS = Object.freeze({ version: SAVE_VERSION, highestKillCount: 0, bestVictorySeconds: null,
  soundEnabled: true, soundVolume: .65, records: Object.freeze([]), discoveries: emptyDiscoveries, achievements: Object.freeze([]), cosmeticId: 'cyan' });
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e9;
const time = value => Number.isFinite(value) && value >= 0 && value <= 86400;
const ids = (values, allowed) => Array.isArray(values) && values.length <= allowed.length
  && new Set(values).size === values.length && values.every(value => allowed.includes(value));
export function normalizeProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, SAVE_VERSION].includes(value.version)
    || !count(value.highestKillCount) || !(value.bestVictorySeconds === null || time(value.bestVictorySeconds))
    || typeof value.soundEnabled !== 'boolean' || !Number.isFinite(value.soundVolume) || value.soundVolume < 0 || value.soundVolume > 1) return null;
  const legacy = value.version === 1;
  const records = legacy || value.records === undefined ? [] : value.records;
  if (!Array.isArray(records) || records.length > 96 || new Set(records.map(record => record?.key)).size !== records.length) return null;
  const normalizedRecords = [];
  for (const record of records) {
    if (!record || typeof record.key !== 'string') return null;
    const [mapId, modeId, protocolId, challengeId, extra] = record.key.split('|');
    if (extra !== undefined || createRecordKey({ mapId, modeId, protocolId, challengeId }) !== record.key
      || !['highestKillCount', 'runs', 'wins', 'highestEndlessKills', 'maxTerminals'].every(key => count(record[key]))
      || record.wins > record.runs || record.maxTerminals > 3 || !(record.bestVictorySeconds === null || time(record.bestVictorySeconds))
      || !time(record.bestEndlessSeconds)) return null;
    normalizedRecords.push(Object.freeze({ key: record.key, highestKillCount: record.highestKillCount,
      runs: record.runs, wins: record.wins, bestVictorySeconds: record.bestVictorySeconds,
      bestEndlessSeconds: record.bestEndlessSeconds, highestEndlessKills: record.highestEndlessKills, maxTerminals: record.maxTerminals }));
  }
  const discoveryInput = legacy || value.discoveries === undefined ? emptyDiscoveries : value.discoveries;
  if (!discoveryInput || typeof discoveryInput !== 'object' || Array.isArray(discoveryInput)) return null;
  const discoveries = {};
  for (const [key, allowed] of Object.entries(DISCOVERY_IDS)) {
    const list = discoveryInput[key] === undefined ? [] : discoveryInput[key];
    if (!ids(list, allowed)) return null;
    discoveries[key] = Object.freeze([...list]);
  }
  const achievements = legacy || value.achievements === undefined ? [] : value.achievements;
  if (!ids(achievements, ACHIEVEMENTS.map(item => item.id))) return null;
  const progress = { version: SAVE_VERSION, highestKillCount: value.highestKillCount, bestVictorySeconds: value.bestVictorySeconds,
    soundEnabled: value.soundEnabled, soundVolume: value.soundVolume, records: Object.freeze(normalizedRecords),
    discoveries: Object.freeze(discoveries), achievements: Object.freeze([...achievements]), cosmeticId: legacy || value.cosmeticId === undefined ? 'cyan' : value.cosmeticId };
  progress.achievements = deriveAchievements(progress);
  const cosmetic = COSMETICS.find(item => item.id === progress.cosmeticId);
  if (!cosmetic || cosmetic.achievement && !progress.achievements.includes(cosmetic.achievement)) return null;
  return Object.freeze(progress);
}
function getDefaultStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export class LocalProgressStore {
  #storage; #key; #blocked = false; #status = 'ready';
  constructor({ storage = getDefaultStorage(), key = SAVE_KEY } = {}) {
    if (storage !== null && typeof storage !== 'object') throw new TypeError('Progress storage must be an object or null');
    if (typeof key !== 'string' || !key.trim()) throw new TypeError('Progress storage key must be a nonempty string');
    this.#storage = storage; this.#key = key;
  }
  getStatus() { return this.#status; }
  load() {
    try {
      if (!this.#storage || typeof this.#storage.getItem !== 'function') { this.#status = 'unavailable'; return DEFAULT_PROGRESS; }
      const raw = this.#storage.getItem(this.#key);
      if (!raw) return DEFAULT_PROGRESS;
      if (typeof raw !== 'string' || raw.length > 65536) { this.#blocked = true; this.#status = 'damaged'; return DEFAULT_PROGRESS; }
      const parsed = JSON.parse(raw);
      if (parsed && Object.hasOwn(parsed, 'version') && ![1, SAVE_VERSION].includes(parsed.version)) { this.#blocked = true; this.#status = 'future-version'; return DEFAULT_PROGRESS; }
      const progress = normalizeProgress(parsed);
      if (!progress) { this.#status = 'damaged'; return DEFAULT_PROGRESS; }
      if (parsed.version === 1) this.save(progress);
      return progress;
    } catch { this.#status = 'damaged'; return DEFAULT_PROGRESS; }
  }
  save(progress) {
    const normalized = normalizeProgress(progress);
    if (!normalized || this.#blocked) return false;
    if (!this.#storage || typeof this.#storage.setItem !== 'function') { this.#status = 'unavailable'; return false; }
    try { this.#storage.setItem(this.#key, JSON.stringify(normalized)); this.#status = 'ready'; return true; }
    catch { this.#status = 'unavailable'; return false; }
  }
}
