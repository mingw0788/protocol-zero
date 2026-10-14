import { describe, expect, it } from 'vitest';
import { LocalProgressSystem } from '../src/systems/LocalProgressSystem.js';
import { LocalProgressStore, SAVE_KEY, SAVE_VERSION, DEFAULT_PROGRESS } from '../src/persistence/LocalProgressStore.js';

function createStorage({ failWrites = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (failWrites) throw new Error('quota exceeded');
      data.set(key, String(value));
    },
  };
}

const initial = DEFAULT_PROGRESS;

describe('LocalProgressSystem', () => {
  it('updates highest kills for any finished run but only sets best time for victories', () => {
    const storage = createStorage();
    const system = new LocalProgressSystem({ store: new LocalProgressStore({ storage }) });
    expect(system.recordRun({ outcome: 'defeat', killCount: 30, elapsedSeconds: 80 })).toBe(true);
    expect(system.getSnapshot()).toMatchObject({ highestKillCount: 30, bestVictorySeconds: null });
    expect(system.recordRun({ outcome: 'victory', killCount: 20, elapsedSeconds: 340 })).toBe(true);
    expect(system.getSnapshot()).toMatchObject({ highestKillCount: 30, bestVictorySeconds: 340 });
    expect(system.recordRun({ outcome: 'victory', killCount: 32, elapsedSeconds: 325 })).toBe(true);
    expect(system.getSnapshot()).toMatchObject({ highestKillCount: 32, bestVictorySeconds: 325 });
    expect(system.recordRun({ outcome: 'victory', killCount: 1, elapsedSeconds: 400 })).toBe(true);
    expect(system.getSnapshot()).toMatchObject({ highestKillCount: 32, bestVictorySeconds: 325 });
    expect(Object.isFrozen(system.getSnapshot())).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY))).toMatchObject({ highestKillCount: 32, bestVictorySeconds: 325 });
  });

  it('rejects invalid run results and audio settings without changing stored values', () => {
    const storage = createStorage();
    const system = new LocalProgressSystem({ store: new LocalProgressStore({ storage }) });
    expect(system.recordRun({ outcome: 'victory', killCount: -1, elapsedSeconds: 300 })).toBe(false);
    expect(system.updateAudioPreferences({ soundEnabled: 'false' })).toBe(false);
    expect(system.updateAudioPreferences({ soundVolume: 1.1 })).toBe(false);
    expect(system.getSnapshot()).toEqual(initial);
    expect(storage.data.size).toBe(0);
  });

  it('retains in-memory updates if local storage refuses writes', () => {
    const system = new LocalProgressSystem({ store: new LocalProgressStore({ storage: createStorage({ failWrites: true }) }) });
    expect(system.updateAudioPreferences({ soundEnabled: false, soundVolume: 0.3 })).toBe(false);
    expect(system.getSnapshot()).toMatchObject({ soundEnabled: false, soundVolume: 0.3 });
    expect(system.recordRun({ outcome: 'defeat', killCount: 2, elapsedSeconds: 20 })).toBe(false);
    expect(system.getSnapshot().highestKillCount).toBe(2);
  });

  it('loads prior audio settings and makes settings changes immediately persistent', () => {
    const storage = createStorage();
    const store = new LocalProgressStore({ storage });
    store.save({ ...initial, soundEnabled: false, soundVolume: 0.25 });
    const system = new LocalProgressSystem({ store });
    expect(system.getSnapshot()).toMatchObject({ soundEnabled: false, soundVolume: 0.25 });
    expect(system.updateAudioPreferences({ soundEnabled: true })).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY))).toMatchObject({ soundEnabled: true, soundVolume: 0.25 });
  });
});
