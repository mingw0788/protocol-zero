export const SUPPLY_CONFIG = Object.freeze({
  schedule: Object.freeze([
    Object.freeze({ time: 45, x: 360, y: 360 }),
    Object.freeze({ time: 135, x: 2040, y: 360 }),
    Object.freeze({ time: 225, x: 1200, y: 1110 }),
  ]),
  windowSeconds: 25, channelSeconds: 1.5, stationRadius: 56,
  pickupRadius: 12, pickupLifetime: 60,
  overclockSeconds: 8, fireRateBonus: .3,
  decoySeconds: 5, decoyRadius: 420, scannerBonus: 8, scannerCap: 3,
  rewards: Object.freeze(['overclock', 'decoy', 'scanner']),
});
