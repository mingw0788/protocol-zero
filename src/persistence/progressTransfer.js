import { normalizeProgress, SAVE_VERSION } from './LocalProgressStore.js';
import { normalizeFeedback } from '../systems/FeedbackSettingsSystem.js';
import { DISCOVERY_IDS } from '../config/progressConfig.js';
export function parseProgressExport(raw) {
  if (typeof raw !== 'string' || raw.length > 65536 || new TextEncoder().encode(raw).byteLength > 65536) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.game !== 'protocol-zero' || value.version !== 1 || ![1, SAVE_VERSION].includes(value.progress?.version)) return null;
    if (value.progress.version === SAVE_VERSION
      && (!['records', 'discoveries', 'achievements', 'cosmeticId'].every(key => Object.hasOwn(value.progress, key))
        || !value.progress.discoveries
        || !Object.keys(DISCOVERY_IDS).every(key => Object.hasOwn(value.progress.discoveries, key)))) return null;
    const progress = normalizeProgress(value.progress), feedback = normalizeFeedback(value.feedback);
    return progress && feedback ? Object.freeze({ progress, feedback }) : null;
  } catch { return null; }
}
