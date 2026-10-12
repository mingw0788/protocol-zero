import { describe, expect, it } from 'vitest';
import { PARTICLE_CONFIG } from '../src/config/particleConfig.js';
import { ParticleSystem } from '../src/systems/ParticleSystem.js';

const death = (id, overrides = {}) => Object.freeze({
  enemyId: id, typeId: 'EN-01', x: 100, y: 200, expDrop: 1, ...overrides,
});

describe('ParticleSystem', () => {
  it('creates deterministic immutable enemy-death and player-hurt bursts', () => {
    const first = new ParticleSystem();
    const second = new ParticleSystem();
    first.emitEnemyDeath(death('same-id'));
    second.emitEnemyDeath(death('same-id'));
    expect(first.getSnapshot()).toEqual(second.getSnapshot());
    expect(first.getSnapshot().length).toBeGreaterThan(0);
    expect(Object.isFrozen(first.getSnapshot())).toBe(true);
    expect(Object.isFrozen(first.getSnapshot()[0])).toBe(true);

    first.emitPlayerHit({ x: 10, y: 20 });
    expect(first.getSnapshot().length).toBeGreaterThan(second.getSnapshot().length);
  });

  it('emits death effects even when the enemy drops no experience', () => {
    const system = new ParticleSystem();
    system.emitEnemyDeath(death('boss-without-exp', { typeId: 'BOSS-01', expDrop: 0 }));
    expect(system.getSnapshot().length).toBeGreaterThan(0);
  });

  it('spreads the terminal player burst before the frozen world can update particles', () => {
    const system = new ParticleSystem();
    system.emitPlayerDeath({ x: 10, y: 20 });
    const particles = system.getSnapshot();
    expect(particles).toHaveLength(PARTICLE_CONFIG.playerDeathCount);
    expect(new Set(particles.map(({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`)).size).toBeGreaterThan(1);
    expect(particles.every((particle) => Object.isFrozen(particle))).toBe(true);
  });

  it('copies validated custom configuration so caller mutation cannot bypass the cap', () => {
    const customConfig = { ...PARTICLE_CONFIG, maxActive: 12 };
    const system = new ParticleSystem(customConfig);
    customConfig.maxActive = 1000;
    customConfig.enemyDeathCount = 100;

    system.emitEnemyDeath(death('first'));
    system.emitEnemyDeath(death('second'));
    expect(system.getSnapshot()).toHaveLength(12);
  });

  it('expires at configured lifetime and caps the active collection', () => {
    const system = new ParticleSystem();
    for (let index = 0; index < 100; index += 1) system.emitEnemyDeath(death(`death-${index}`));
    expect(PARTICLE_CONFIG.maxActive).toBe(320);
    expect(PARTICLE_CONFIG.lifetimeSeconds).toBe(0.45);
    expect(system.getSnapshot()).toHaveLength(320);
    system.update(0.44);
    expect(system.getSnapshot()).toHaveLength(320);
    system.update(0.01);
    expect(system.getSnapshot()).toHaveLength(0);
  });

  it('clears all run effects on reset', () => {
    const system = new ParticleSystem();
    system.emitPlayerDeath({ x: 10, y: 20 });
    system.reset();
    expect(system.getSnapshot()).toEqual([]);
  });
});
