import { describe, expect, it } from 'vitest';
import { PULSE_GUN_CONFIG } from '../src/config/weaponConfig.js';

describe('pulse gun configuration', () => {
  it('uses the approved immutable pulse gun profile', () => {
    expect(PULSE_GUN_CONFIG).toMatchObject({
      id: 'pulse-gun',
      damage: 20,
      fireIntervalSeconds: 0.8,
      range: 640,
      projectileSpeed: 500,
      projectileRadius: 4,
      projectileLifetimeSeconds: 1.28,
      projectileColor: '#4cf3ff',
    });
    expect(Object.isFrozen(PULSE_GUN_CONFIG)).toBe(true);
  });
});
