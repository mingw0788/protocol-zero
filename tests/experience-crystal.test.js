import { describe, expect, it } from 'vitest';

async function loadCrystalApi() {
  const [configModule, crystalModule] = await Promise.all([
    import('../src/config/experienceCrystalConfig.js').catch(() => undefined),
    import('../src/entities/ExperienceCrystal.js').catch(() => undefined),
  ]);
  expect(configModule, 'experience crystal config module exists').toBeDefined();
  expect(crystalModule, 'experience crystal entity module exists').toBeDefined();
  return {
    EXPERIENCE_CRYSTAL_CONFIG: configModule.EXPERIENCE_CRYSTAL_CONFIG,
    ExperienceCrystal: crystalModule.ExperienceCrystal,
  };
}

describe('ExperienceCrystal configuration', () => {
  it('uses the approved frozen crystal defaults', async () => {
    const { EXPERIENCE_CRYSTAL_CONFIG } = await loadCrystalApi();

    expect(EXPERIENCE_CRYSTAL_CONFIG).toEqual({
      pickupRadius: 12,
      lifetimeSeconds: 120,
      renderSize: 8,
      color: '#ffbf47',
    });
    expect(Object.isFrozen(EXPERIENCE_CRYSTAL_CONFIG)).toBe(true);
  });
});

describe('ExperienceCrystal', () => {
  it('copies valid crystal data and starts active', async () => {
    const { ExperienceCrystal } = await loadCrystalApi();
    const crystal = new ExperienceCrystal({
      id: 'experience-crystal-1',
      x: 50,
      y: 75,
      expValue: 3,
    });

    expect(crystal).toMatchObject({
      id: 'experience-crystal-1',
      x: 50,
      y: 75,
      expValue: 3,
      pickupRadius: 12,
      remainingLifetime: 120,
      active: true,
    });
  });

  it.each([
    [{ id: '' }, TypeError],
    [{ id: null }, TypeError],
    [{ x: Number.NaN }, TypeError],
    [{ y: Number.POSITIVE_INFINITY }, TypeError],
    [{ expValue: 0 }, RangeError],
    [{ expValue: Number.NaN }, RangeError],
    [{ pickupRadius: -1 }, RangeError],
    [{ pickupRadius: Number.POSITIVE_INFINITY }, RangeError],
    [{ lifetimeSeconds: 0 }, RangeError],
    [{ lifetimeSeconds: Number.NaN }, RangeError],
  ])('rejects invalid identity geometry value and lifetime %o', async (override, errorType) => {
    const { ExperienceCrystal } = await loadCrystalApi();
    const profile = {
      id: 'experience-crystal-1',
      x: 50,
      y: 75,
      expValue: 1,
      pickupRadius: 12,
      lifetimeSeconds: 120,
      ...override,
    };

    expect(() => new ExperienceCrystal(profile)).toThrow(errorType);
  });
});
