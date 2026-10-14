import { describe, expect, it } from 'vitest';
import { WAVE_CONFIG } from '../src/config/waveConfig.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';

function createWaveConfig(phases = WAVE_CONFIG.phases) {
  return {
    phases: phases.map((phase) => ({
      ...phase,
      enemyWeights: { ...phase.enemyWeights },
    })),
  };
}

describe('WaveSystem effective-time profiles', () => {
  it.each([
    [0, 'opening', 1, { 'EN-01': 1, 'EN-02': 0, 'EN-03': 0 }],
    [59.999, 'opening', 1, { 'EN-01': 1, 'EN-02': 0, 'EN-03': 0 }],
    [60, 'swift-intro', 0.9, { 'EN-01': 0.58, 'EN-02': 0.25, 'EN-03': 0, 'EN-04': 0.17, 'EN-05': 0, 'EN-06': 0 }],
    [120, 'heavy-intro', 0.8, { 'EN-01': 0.4, 'EN-02': 0.22, 'EN-03': 0.16, 'EN-04': 0.1, 'EN-05': 0.1, 'EN-06': 0.02 }],
    [180, 'mixed-pressure', 0.65, { 'EN-01': 0.32, 'EN-02': 0.25, 'EN-03': 0.18, 'EN-04': 0.12, 'EN-05': 0.1, 'EN-06': 0.03 }],
    [240, 'high-pressure', 0.55, { 'EN-01': 0.25, 'EN-02': 0.28, 'EN-03': 0.2, 'EN-04': 0.13, 'EN-05': 0.1, 'EN-06': 0.04 }],
    [270, 'boss-approach', 0.55, { 'EN-01': 0.25, 'EN-02': 0.28, 'EN-03': 0.2, 'EN-04': 0.13, 'EN-05': 0.1, 'EN-06': 0.04 }],
    [500, 'boss-approach', 0.55, { 'EN-01': 0.25, 'EN-02': 0.28, 'EN-03': 0.2, 'EN-04': 0.13, 'EN-05': 0.1, 'EN-06': 0.04 }],
  ])('uses the configured profile at effective time %s', (elapsedSeconds, phaseId, interval, weights) => {
    const system = new WaveSystem();

    expect(system.getSnapshot(elapsedSeconds)).toMatchObject({
      phaseId,
      spawnIntervalSeconds: interval,
      enemyWeights: weights,
    });
  });

  it('returns independent frozen profile snapshots with frozen weights', () => {
    const system = new WaveSystem();
    const first = system.getSnapshot(60);
    const second = system.getSnapshot(60);

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.enemyWeights)).toBe(true);
    expect(() => { first.enemyWeights['EN-02'] = 0; }).toThrow(TypeError);
    expect(system.getSnapshot(60).enemyWeights['EN-02']).toBe(0.25);
  });

  it('rejects invalid elapsed values and malformed contiguous weighted phases', () => {
    const system = new WaveSystem();
    for (const elapsedSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => system.getSnapshot(elapsedSeconds)).toThrow(RangeError);
    }

    const gap = createWaveConfig();
    gap.phases[1].startSeconds += 1;
    const badWeights = createWaveConfig();
    badWeights.phases[0].enemyWeights['EN-01'] = 0.8;
    const noFinalPhase = createWaveConfig();
    noFinalPhase.phases.at(-1).endSeconds = 900;
    const duplicateIds = createWaveConfig();
    duplicateIds.phases[1].phaseId = duplicateIds.phases[0].phaseId;

    expect(() => new WaveSystem({ config: gap })).toThrow(RangeError);
    expect(() => new WaveSystem({ config: badWeights })).toThrow(RangeError);
    expect(() => new WaveSystem({ config: noFinalPhase })).toThrow(RangeError);
    expect(() => new WaveSystem({ config: duplicateIds })).toThrow(RangeError);
    expect(() => new WaveSystem({ config: { phases: [] } })).toThrow(TypeError);
  });

  it('copies injected phase data instead of retaining caller-owned weight maps', () => {
    const config = createWaveConfig();
    const system = new WaveSystem({ config });
    config.phases[1].enemyWeights['EN-02'] = 0;

    expect(system.getSnapshot(60).enemyWeights['EN-02']).toBe(0.25);
  });
});
