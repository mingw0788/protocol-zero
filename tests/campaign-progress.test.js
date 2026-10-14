import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { DEFAULT_PROGRESS, SAVE_KEY } from '../src/persistence/LocalProgressStore.js';
import { expeditionRecordKey } from '../src/persistence/ExpeditionRecordStore.js';

afterEach(() => vi.unstubAllGlobals());
function storage(initial = {}) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  return data;
}
function failRun(game) {
  game.startGame(); game.world.spawnSystem.update = () => 0; game.world.player.hp = 1;
  game.world.enemies.push(new Enemy({ id: 'loss', x: game.world.player.x, y: game.world.player.y, config: ENEMY_CONFIG.EN01 }));
  game.world.update(1 / 60);
}
describe('extended configuration archives', () => {
  it('keeps a full supported archive export within the 64KiB import limit', () => {
    const data = storage(), records = [], extensions = [], value = 1e9;
    for (const mapId of ['laboratory', 'east-city', 'energy-hub']) for (const modeId of ['standard', 'tactical'])
      for (const protocolId of ['standard', 'assault', 'recycle', 'guard']) for (const challengeId of ['none', 'pressure', 'scarce', 'elite'])
        records.push({ key: [mapId, modeId, protocolId, challengeId].join('|'), runs: value, wins: value, highestKillCount: value,
          bestVictorySeconds: 86400, bestEndlessSeconds: 86400, highestEndlessKills: value, maxTerminals: 3 });
    for (const modeId of ['standard', 'tactical']) for (const protocolId of ['standard', 'assault', 'recycle', 'guard'])
      for (const challengeId of ['none', 'pressure', 'scarce', 'elite']) for (const difficultyId of ['normal', 'hard', 'nightmare']) for (const characterId of ['zero', 'veil', 'bastion'])
        if (extensions.length < 128) extensions.push({ key: expeditionRecordKey({ journeyId: 'campaign', modeId, protocolId, challengeId, difficultyId, characterId }),
          runs: Number.MAX_SAFE_INTEGER, wins: Number.MAX_SAFE_INTEGER, highestKillCount: Number.MAX_SAFE_INTEGER, maxStage: 3, bestVictorySeconds: 86400, bestEndlessSeconds: 86400, highestEndlessKills: Number.MAX_SAFE_INTEGER });
    data.set(SAVE_KEY, JSON.stringify({ ...DEFAULT_PROGRESS, records }));
    data.set('protocol-zero-expeditions-v1', JSON.stringify({ version: 1, records: extensions }));
    const game = new Game(), raw = game.exportProgress();
    expect(game.getProgressSnapshot().records).toHaveLength(96);
    expect(game.getExpeditionRecords().records).toHaveLength(128);
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThanOrEqual(65536);
    expect(game.previewProgressImport(raw)).not.toBeNull(); game.stop();
  });
  it('separates difficulty and characters from original records and from each other', () => {
    storage(); const game = new Game();
    expect(game.configureExpedition).toBeTypeOf('function');
    game.configureExpedition({ difficultyId: 'hard', characterId: 'veil' }); failRun(game);
    expect(game.getProgressSnapshot().records).toHaveLength(0);
    expect(game.getExpeditionRecords().records).toHaveLength(1);
    game.returnToMenu(); game.configureExpedition({ difficultyId: 'normal', characterId: 'zero' }); failRun(game);
    expect(game.getProgressSnapshot().records).toHaveLength(1);
    expect(game.getExpeditionRecords().records).toHaveLength(2);
    game.stop();
  });
  it('exports and restores extension records while accepting old archives without clearing them', () => {
    storage(); const game = new Game();
    expect(game.configureExpedition).toBeTypeOf('function');
    game.configureExpedition({ journeyId: 'campaign' }); failRun(game); game.returnToMenu();
    const raw = JSON.parse(game.exportProgress()); expect(raw.expeditions.records).toHaveLength(1);
    delete raw.expeditions; expect(game.importProgress(JSON.stringify(raw)).ok).toBe(true);
    expect(game.getExpeditionRecords().records).toHaveLength(1);
    const backup = game.exportProgress(); game.configureExpedition({ characterId: 'bastion' }); failRun(game); game.returnToMenu();
    expect(game.getExpeditionRecords().records).toHaveLength(2);
    expect(game.importProgress(backup).ok).toBe(true); expect(game.getExpeditionRecords().records).toHaveLength(1);
    game.stop();
  });
  it.each([null, [], { version: 99, records: [] }, { version: 1, records: [{ key: 'invalid' }] }])('rejects malformed extension data before changing either archive: %j', invalid => {
    storage(); const game = new Game(); expect(game.getExpeditionRecords).toBeTypeOf('function');
    const before = game.getProgressSnapshot(), extension = game.getExpeditionRecords();
    const raw = JSON.parse(game.exportProgress()); raw.expeditions = invalid;
    expect(game.importProgress(JSON.stringify(raw)).ok).toBe(false);
    expect(game.getProgressSnapshot()).toBe(before); expect(game.getExpeditionRecords()).toBe(extension); game.stop();
  });
  it('preserves an unknown stored extension version and reports unsaved new scores', () => {
    const data = storage({ 'protocol-zero-expeditions-v1': JSON.stringify({ version: 'future', records: [] }) });
    const original = data.get('protocol-zero-expeditions-v1'); const game = new Game();
    expect(game.configureExpedition).toBeTypeOf('function'); game.configureExpedition({ difficultyId: 'hard' }); failRun(game);
    expect(data.get('protocol-zero-expeditions-v1')).toBe(original);
    expect(game.getProgressSaveStatus().saved).toBe(false); game.stop();
  });
});
