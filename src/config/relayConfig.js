export const RELAY_CONFIG = Object.freeze({
  radius: 64, channelSeconds: 2, healing: 15, pulseRadius: 180,
  damage: 60, bossDamage: 30, visualSeconds: .45, energyCap: 100, killEnergy: 25, energyRadius: 260, batteryRange: 560,
  firepowerBonus: .25, firepowerSeconds: 10,
  stations: Object.freeze([
    Object.freeze({ id: 'medical', name: '医疗广场', effect: 'medical', x: 620, y: 360 }),
    Object.freeze({ id: 'power', name: '变电庭院', effect: 'firepower', x: 1780, y: 360 }),
    Object.freeze({ id: 'evacuation', name: '疏散集结区', effect: 'medical', x: 1200, y: 1050 }),
  ]),
});
