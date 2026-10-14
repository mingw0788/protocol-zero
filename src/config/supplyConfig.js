export const SUPPLY_CONFIG = Object.freeze({
  schedule: Object.freeze([
    Object.freeze({ time: 45, x: 360, y: 360 }),
    Object.freeze({ time: 135, x: 2040, y: 360 }),
    Object.freeze({ time: 225, x: 1200, y: 1110 }),
  ]),
  windowSeconds: 25, channelSeconds: 1.5, stationRadius: 56,
  pickupRadius: 12, pickupLifetime: 60, exchangeRadius: 64,
  overclockSeconds: 8, fireRateBonus: .3,
  decoySeconds: 5, decoyRadius: 420, scannerBonus: 8, scannerCap: 3,
  medkitHealing: 30, empRadius: 220, empDamage: 40, empBossDamage: 20, empVisualSeconds: .4,
  stationRewards: Object.freeze(['overclock', 'decoy', 'scanner', 'medkit', 'emp-charge', 'relay-cell', 'shield', 'magnet']),
  rewards: Object.freeze(['overclock', 'decoy', 'scanner', 'medkit', 'emp-charge', 'relay-cell', 'shield', 'magnet',
    'cryo-grenade', 'turret-kit', 'healing-field', 'relay-amplifier']),
});

export const SUPPLY_NAMES = Object.freeze({ overclock: '过载电池', decoy: '诱饵信标', scanner: '回收扫描器',
  medkit: '修复凝胶', 'emp-charge': 'EMP 电荷', 'relay-cell': '中继电芯', shield: '相位护盾', magnet: '回收磁铁',
  'cryo-grenade': '冷凝炸弹', 'turret-kit': '自动炮台', 'healing-field': '纳米维修场', 'relay-amplifier': '协议增幅器' });

export const ACTIVE_ITEM_TYPES = Object.freeze(['decoy', 'emp-charge', 'relay-cell', 'cryo-grenade', 'turret-kit', 'healing-field']);
export const DEPLOYABLE_CONFIG = Object.freeze({ grenadeRadius: 240, slowFactor: .4, slowSeconds: 3, grenadeVisualSeconds: .45,
  turretCap: 2, turretSeconds: 12, turretRange: 420, turretDamage: 12, turretInterval: .6, beamSeconds: .12, beamCap: 12,
  fieldCap: 1, fieldRadius: 96, fieldSeconds: 8, healingPerSecond: 5 });
