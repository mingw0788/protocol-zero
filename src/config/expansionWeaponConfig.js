const common = { maxLevel: 5, maxTargets: 3, damageBonusPerLevel: .12, visualSeconds: .14 };
export const ARC_COIL_CONFIG = Object.freeze({ ...common, id: 'arc-coil', damage: 16,
  fireIntervalSeconds: 1.1, range: 360, jumpRange: 150, falloff: .7, color: '#a796ff' });
export const RAILGUN_CONFIG = Object.freeze({ ...common, id: 'railgun', damage: 28,
  fireIntervalSeconds: 1.2, range: 800, color: '#ffcc77' });
export const CRYO_CONFIG = Object.freeze({ ...common, id: 'cryo-sprayer', damage: 9,
  fireIntervalSeconds: .45, range: 180, halfAngle: Math.PI / 5, slowFactor: .55, slowDuration: 2, visualSeconds: .18, color: '#8af5f6' });
export const DRONE_CONFIG = Object.freeze({ ...common, id: 'drone-swarm', damage: 10,
  fireIntervalSeconds: 1, range: 360, orbitRadius: 48, maxProjectiles: 24, projectileSpeed: 650,
  projectileRadius: 3, projectileLifetime: .8, color: '#b4f09c' });
