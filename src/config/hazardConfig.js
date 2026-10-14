const barrels = (prefix, points) => Object.freeze(points.map(([x, y], index) => Object.freeze({ id: `${prefix}-${index}`, x, y })));
export const HAZARD_CONFIG = Object.freeze({
  barrelHp: 20, barrelRadius: 14, targetRange: 360,
  explosionRadius: 150, explosionDamage: 60, explosionBossDamage: 30,
  maxChain: 4, maxEffects: 12, visualSeconds: .35,
  cycleSeconds: 9, warningSeconds: 1, activeSeconds: 2, arcDamage: 10,
  barrels: Object.freeze({
    laboratory: barrels('lab-cap', [[360, 650], [420, 650], [1000, 250], [1450, 1100], [2080, 710], [2020, 710]]),
    'east-city': barrels('city-cap', [[330, 650], [390, 650], [1080, 300], [1430, 1040], [2070, 650], [2130, 650]]),
    'energy-hub': barrels('hub-cap', [[420, 450], [470, 450], [960, 1100], [1450, 230], [2010, 740], [2060, 740]]),
  }),
  zones: Object.freeze({
    'energy-hub': Object.freeze([
      Object.freeze({ id: 'arc-a', name: '西侧电弧走廊', x: 600, y: 310, width: 190, height: 730, offset: 0 }),
      Object.freeze({ id: 'arc-b', name: '中央电弧走廊', x: 1110, y: 150, width: 180, height: 1050, offset: 3 }),
      Object.freeze({ id: 'arc-c', name: '东侧电弧走廊', x: 1620, y: 310, width: 190, height: 730, offset: 6 }),
    ]),
  }),
});
