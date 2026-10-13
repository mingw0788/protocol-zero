const common = { maxLevel: 5, maxTargets: 3, damageBonusPerLevel: .12, visualSeconds: .14 };
export const ARC_COIL_CONFIG = Object.freeze({ ...common, id: 'arc-coil', damage: 16,
  fireIntervalSeconds: 1.1, range: 360, jumpRange: 150, falloff: .7, color: '#a796ff' });
export const RAILGUN_CONFIG = Object.freeze({ ...common, id: 'railgun', damage: 28,
  fireIntervalSeconds: 1.2, range: 800, color: '#ffcc77' });
