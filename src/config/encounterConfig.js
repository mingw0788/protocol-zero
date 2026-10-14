const points = values => Object.freeze(values.map(([x, y]) => Object.freeze({ x, y })));
export const ENCOUNTER_CONFIG = Object.freeze({
  schedule: Object.freeze([60, 165]),
  stopStartingAt: 240,
  minimumDistance: 180,
  clearance: 32,
  transportSpeed: 65,
  transportDistance: 1500,
  types: Object.freeze([
    Object.freeze({ id: 'defense', name: '防守数据链路', radius: 72, channelSeconds: 15, duration: 35, experience: 12, reward: 'shield' }),
    Object.freeze({ id: 'transport', name: '追赶运输无人机', radius: 96, channelSeconds: 5, duration: 40, experience: 10, reward: 'scanner' }),
    Object.freeze({ id: 'elite', name: '清除物资守卫', radius: 64, channelSeconds: 1, duration: 40, experience: 16, reward: 'overclock' }),
  ]),
  maps: Object.freeze({
    laboratory: points([[240, 430], [2160, 180], [280, 1160], [2180, 1160], [1200, 180], [2160, 700], [280, 700]]),
    'east-city': points([[240, 430], [2160, 180], [320, 1180], [2180, 1160], [1200, 180], [2160, 700], [280, 700]]),
  }),
  elite: Object.freeze({ typeId: 'EN-EVENT', name: '物资守卫', category: 'normal',
    hp: 160, maxHp: 160, speed: 55, radius: 24, contactDamage: 18, expDrop: 6, color: '#ffc277' }),
});
