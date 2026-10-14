import { getMapConfig } from '../config/mapConfig.js';
import { getRunMode, getProtocol, getChallenge } from '../config/runConfig.js';
import { getJourney, getDifficulty, getCharacter } from '../config/expeditionConfig.js';

export const EXPEDITION_SAVE_KEY = 'protocol-zero-expeditions-v1';
const EMPTY = Object.freeze({ version: 1, records: Object.freeze([]) });
const count = value => Number.isSafeInteger(value) && value >= 0;
const seconds = value => Number.isFinite(value) && value >= 0 && value <= 86400;
export function expeditionRecordKey({ journeyId = 'survival', mapId = 'laboratory', modeId = 'standard', protocolId = 'standard', challengeId = 'none', difficultyId = 'normal', characterId = 'zero' } = {}) {
  if (!getJourney(journeyId) || !(journeyId === 'campaign' || getMapConfig(mapId)) || !getRunMode(modeId)
    || !getProtocol(protocolId) || !getChallenge(challengeId) || !getDifficulty(difficultyId) || !getCharacter(characterId)) return null;
  return [journeyId, journeyId === 'campaign' ? 'campaign' : mapId, modeId, protocolId, challengeId, difficultyId, characterId].join('|');
}
function validKey(key) {
  if (typeof key !== 'string') return false;
  const [journeyId, mapId, modeId, protocolId, challengeId, difficultyId, characterId, extra] = key.split('|');
  return extra === undefined && expeditionRecordKey({ journeyId, mapId, modeId, protocolId, challengeId, difficultyId, characterId }) === key;
}
export function normalizeExpeditionRecords(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !Array.isArray(value.records)
    || value.records.length > 128 || new Set(value.records.map(record => record?.key)).size !== value.records.length) return null;
  const records = [];
  for (const record of value.records) {
    if (!record || !validKey(record.key) || !count(record.runs) || !count(record.wins) || record.wins > record.runs
      || !count(record.highestKillCount) || !count(record.maxStage) || record.maxStage > (record.key.startsWith('campaign|') ? 3 : 1)
      || !(record.bestVictorySeconds === null || seconds(record.bestVictorySeconds))
      || !seconds(record.bestEndlessSeconds) || !count(record.highestEndlessKills)) return null;
    records.push(Object.freeze({ key: record.key, runs: record.runs, wins: record.wins, highestKillCount: record.highestKillCount,
      maxStage: record.maxStage, bestVictorySeconds: record.bestVictorySeconds, bestEndlessSeconds: record.bestEndlessSeconds, highestEndlessKills: record.highestEndlessKills }));
  }
  return Object.freeze({ version: 1, records: Object.freeze(records) });
}
function storageDefault() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export class ExpeditionRecordStore {
  #storage; #snapshot = EMPTY; #blocked = false; #saved = true; #reason = 'ready';
  constructor({ storage = storageDefault() } = {}) {
    this.#storage = storage;
    try {
      const raw = storage?.getItem(EXPEDITION_SAVE_KEY);
      if (!raw) return;
      if (typeof raw !== 'string' || raw.length > 65536) throw new Error('Oversized records');
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) { this.#blocked = true; this.#saved = false; this.#reason = 'future-version'; return; }
      const normalized = normalizeExpeditionRecords(parsed);
      if (!normalized) throw new Error('Invalid records');
      this.#snapshot = normalized;
    } catch { this.#blocked = true; this.#saved = false; this.#reason = 'damaged'; }
  }
  getSnapshot() { return this.#snapshot; }
  getSaveStatus() { return Object.freeze({ saved: this.#saved, reason: this.#reason }); }
  getRecord(config) { return this.#snapshot.records.find(record => record.key === expeditionRecordKey(config)) ?? null; }
  replace(value) { const next = normalizeExpeditionRecords(value); if (!next) return false; this.#snapshot = next; return this.#persist(); }
  recordRun(result) {
    const key = expeditionRecordKey(result);
    if (!key || result.intermission || !['victory', 'defeat'].includes(result.outcome) || !count(result.killCount) || !seconds(result.elapsedSeconds)) return false;
    const records = [...this.#snapshot.records], index = records.findIndex(record => record.key === key);
    const previous = index < 0 ? { key, runs: 0, wins: 0, highestKillCount: 0, maxStage: 0, bestVictorySeconds: null, bestEndlessSeconds: 0, highestEndlessKills: 0 } : records.splice(index, 1)[0];
    const next = { ...previous };
    if (result.endless) {
      if (!seconds(result.endlessSeconds) || !count(result.endlessKills)) return false;
      next.bestEndlessSeconds = Math.max(next.bestEndlessSeconds, result.endlessSeconds);
      next.highestEndlessKills = Math.max(next.highestEndlessKills, result.endlessKills);
    } else {
      next.runs++; next.highestKillCount = Math.max(next.highestKillCount, result.killCount);
      next.maxStage = Math.max(next.maxStage, result.expedition?.completed ?? 0);
      if (result.outcome === 'victory') { next.wins++; next.bestVictorySeconds = next.bestVictorySeconds === null ? result.elapsedSeconds : Math.min(next.bestVictorySeconds, result.elapsedSeconds); }
    }
    records.push(next); if (records.length > 128) records.shift();
    const snapshot = normalizeExpeditionRecords({ version: 1, records });
    if (!snapshot) return false;
    this.#snapshot = snapshot; return this.#persist();
  }
  #persist() {
    if (this.#blocked) return false;
    try {
      if (!this.#storage?.setItem) throw new Error('Storage unavailable');
      this.#storage.setItem(EXPEDITION_SAVE_KEY, JSON.stringify(this.#snapshot)); this.#saved = true; this.#reason = 'ready'; return true;
    } catch { this.#saved = false; this.#reason = 'unavailable'; return false; }
  }
}
