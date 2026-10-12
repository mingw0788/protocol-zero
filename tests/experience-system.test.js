import { describe, expect, it } from 'vitest';
import { EXPERIENCE_CRYSTAL_CONFIG } from '../src/config/experienceCrystalConfig.js';

async function loadExperienceSystem() {
  const module = await import('../src/systems/ExperienceSystem.js').catch(() => undefined);
  expect(module, 'experience system module exists').toBeDefined();
  return module.ExperienceSystem;
}

function createPlayer(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 16,
    exp: 0,
    alive: true,
    ...overrides,
  };
}

async function createHarness({ config = EXPERIENCE_CRYSTAL_CONFIG, player = createPlayer() } = {}) {
  const ExperienceSystem = await loadExperienceSystem();
  const crystals = [];
  const listeners = [];
  const subscribeEnemyDeath = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  };
  const system = new ExperienceSystem({ crystals, player, subscribeEnemyDeath, config });
  return {
    system,
    crystals,
    listeners,
    player,
    emit(snapshot) {
      for (const listener of [...listeners]) listener(snapshot);
    },
  };
}

function makeDeathSnapshot(overrides = {}) {
  return Object.freeze({
    enemyId: 'enemy-1',
    typeId: 'EN-01',
    x: 45,
    y: 62,
    expDrop: 3,
    ...overrides,
  });
}

function update(system, deltaSeconds) {
  expect(system.update, 'ExperienceSystem.update exists').toBeTypeOf('function');
  return system.update(deltaSeconds);
}

describe('ExperienceSystem death drops', () => {
  it('creates one crystal from a positive frozen death snapshot', async () => {
    const harness = await createHarness();
    const snapshot = makeDeathSnapshot();

    harness.emit(snapshot);

    expect(harness.crystals).toHaveLength(1);
    expect(harness.crystals[0]).toMatchObject({
      id: 'experience-crystal-1',
      x: 45,
      y: 62,
      expValue: 3,
      pickupRadius: 12,
      remainingLifetime: 120,
      active: true,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toEqual({
      enemyId: 'enemy-1', typeId: 'EN-01', x: 45, y: 62, expDrop: 3,
    });
  });

  it('ignores zero experience drops', async () => {
    const harness = await createHarness();

    harness.emit(makeDeathSnapshot({ expDrop: 0 }));

    expect(harness.crystals).toEqual([]);
  });

  it('subscribes once and keeps the listener across reset', async () => {
    const harness = await createHarness();
    const sharedArray = harness.crystals;
    harness.emit(makeDeathSnapshot());
    const firstCrystal = harness.crystals[0];

    harness.system.reset();

    expect(harness.crystals).toBe(sharedArray);
    expect(harness.crystals).toEqual([]);
    expect(firstCrystal.active).toBe(false);
    expect(harness.listeners).toHaveLength(1);

    harness.emit(makeDeathSnapshot({ enemyId: 'enemy-2' }));

    expect(harness.crystals).toHaveLength(1);
    expect(harness.crystals[0].id).toBe('experience-crystal-2');
  });

  it('rejects invalid pickup and lifetime configuration', async () => {
    const ExperienceSystem = await loadExperienceSystem();
    const player = createPlayer();
    const subscribeEnemyDeath = () => () => {};

    for (const pickupRadius of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new ExperienceSystem({
        crystals: [],
        player,
        subscribeEnemyDeath,
        config: { pickupRadius, lifetimeSeconds: 120 },
      })).toThrow(RangeError);
    }
    for (const lifetimeSeconds of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new ExperienceSystem({
        crystals: [],
        player,
        subscribeEnemyDeath,
        config: { pickupRadius: 12, lifetimeSeconds },
      })).toThrow(RangeError);
    }
  });

  it('requires a crystal array player and death subscription source', async () => {
    const ExperienceSystem = await loadExperienceSystem();
    const player = createPlayer();
    const subscribeEnemyDeath = () => () => {};

    expect(() => new ExperienceSystem({ player, subscribeEnemyDeath })).toThrow(TypeError);
    expect(() => new ExperienceSystem({ crystals: [], subscribeEnemyDeath })).toThrow(TypeError);
    expect(() => new ExperienceSystem({ crystals: [], player })).toThrow(TypeError);
    expect(() => new ExperienceSystem({
      crystals: [],
      player: { ...player, x: Number.NaN },
      subscribeEnemyDeath,
    })).toThrow(TypeError);
  });

  it('picks up at tangency only once', async () => {
    const harness = await createHarness();
    harness.emit(makeDeathSnapshot({ x: 28, y: 0 }));
    const crystal = harness.crystals[0];
    const crystalsArray = harness.crystals;

    update(harness.system, 1 / 60);
    update(harness.system, 1 / 60);

    expect(harness.player.exp).toBe(3);
    expect(crystal.active).toBe(false);
    expect(harness.crystals).toBe(crystalsArray);
    expect(harness.crystals).toEqual([]);
  });

  it('does not pick up outside the radius or for a dead player', async () => {
    const outside = await createHarness();
    outside.emit(makeDeathSnapshot({ x: 28.001, y: 0 }));
    update(outside.system, 0.25);
    expect(outside.player.exp).toBe(0);
    expect(outside.crystals).toHaveLength(1);

    const deadPlayer = createPlayer({ alive: false });
    const dead = await createHarness({ player: deadPlayer });
    dead.emit(makeDeathSnapshot({ x: 0, y: 0 }));
    update(dead.system, 0.25);
    expect(dead.player.exp).toBe(0);
    expect(dead.crystals).toHaveLength(1);
    expect(dead.crystals[0].remainingLifetime).toBe(119.75);
  });

  it('picks up before expiring at the exact lifetime boundary', async () => {
    const harness = await createHarness({
      config: { pickupRadius: 12, lifetimeSeconds: 0.5 },
    });
    harness.emit(makeDeathSnapshot({ x: 28, y: 0 }));

    update(harness.system, 0.5);

    expect(harness.player.exp).toBe(3);
    expect(harness.crystals).toEqual([]);
  });

  it('expires silently after its active lifetime', async () => {
    const harness = await createHarness({
      config: { pickupRadius: 12, lifetimeSeconds: 0.5 },
    });
    harness.emit(makeDeathSnapshot({ x: 100, y: 0, expDrop: 1 }));
    const crystal = harness.crystals[0];

    update(harness.system, 0.25);
    expect(crystal.remainingLifetime).toBe(0.25);
    expect(harness.crystals).toHaveLength(1);

    update(harness.system, 0.25);

    expect(harness.crystals).toEqual([]);
    expect(crystal.active).toBe(false);
    expect(harness.player.exp).toBe(0);
  });

  it('validates delta and leaves state unchanged for zero', async () => {
    const harness = await createHarness();
    harness.emit(makeDeathSnapshot({ x: 100, y: 0 }));
    const crystal = harness.crystals[0];
    const before = { ...crystal };

    update(harness.system, 0);

    expect(crystal).toEqual(before);
    expect(harness.player.exp).toBe(0);
    for (const deltaSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => update(harness.system, deltaSeconds)).toThrow(RangeError);
    }
    expect(crystal).toEqual(before);
  });
});
