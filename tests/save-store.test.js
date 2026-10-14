import { describe, expect, it } from 'vitest';
import { LocalProgressStore, SAVE_KEY, SAVE_VERSION, DEFAULT_PROGRESS } from '../src/persistence/LocalProgressStore.js';

function createStorage(initialEntries = []) {
  const data = new Map(initialEntries);
  return {
    data,
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const valid = Object.freeze({
  ...DEFAULT_PROGRESS,
  version: SAVE_VERSION,
  highestKillCount: 42,
  bestVictorySeconds: 321.5,
  soundEnabled: false,
  soundVolume: 0.4,
  achievements: Object.freeze(['first-victory']),
});

describe('LocalProgressStore', () => {
  it('uses an immutable safe default when the key is missing', () => {
    const store = new LocalProgressStore({ storage: createStorage() });
    expect(SAVE_KEY).toBe('protocol-zero.save');
    expect(store.load()).toEqual(DEFAULT_PROGRESS);
    expect(Object.isFrozen(store.load())).toBe(true);
  });

  it('round-trips validated versioned progress without exposing mutable data', () => {
    const storage = createStorage();
    const store = new LocalProgressStore({ storage });
    expect(store.save(valid)).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY))).toEqual(valid);
    expect(store.load()).toEqual(valid);
    expect(Object.isFrozen(store.load())).toBe(true);
  });

  it.each([
    ['invalid JSON', '{not-json'],
    ['unknown version', JSON.stringify({ ...valid, version: SAVE_VERSION + 1 })],
    ['negative kills', JSON.stringify({ ...valid, highestKillCount: -1 })],
    ['unsafe kills', JSON.stringify({ ...valid, highestKillCount: Number.MAX_SAFE_INTEGER + 1 })],
    ['invalid time', JSON.stringify({ ...valid, bestVictorySeconds: '300' })],
    ['invalid audio toggle', JSON.stringify({ ...valid, soundEnabled: 1 })],
    ['out-of-range volume', JSON.stringify({ ...valid, soundVolume: 2 })],
  ])('falls back to defaults for %s', (_label, raw) => {
    const storage = createStorage([[SAVE_KEY, raw]]);
    const store = new LocalProgressStore({ storage });
    expect(store.load()).toMatchObject({ highestKillCount: 0, bestVictorySeconds: null, soundEnabled: true, soundVolume: 0.65 });
  });

  it('falls back when storage access throws and returns false for failed writes', () => {
    const unreadable = new LocalProgressStore({
      storage: { get getItem() { throw new Error('security error'); } },
    });
    expect(unreadable.load().highestKillCount).toBe(0);

    const unwritable = new LocalProgressStore({
      storage: { getItem: () => null, setItem() { throw new Error('quota exceeded'); } },
    });
    expect(unwritable.save(valid)).toBe(false);
  });

  it('rejects invalid snapshots without touching the storage adapter', () => {
    const storage = createStorage();
    const store = new LocalProgressStore({ storage });
    expect(store.save({ ...valid, bestVictorySeconds: Infinity })).toBe(false);
    expect(storage.data.size).toBe(0);
  });
});
