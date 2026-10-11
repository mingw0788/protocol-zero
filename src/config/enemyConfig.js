export const ENEMY_CONFIG = Object.freeze({
  EN01: Object.freeze({
    typeId: 'EN-01',
    name: '普通感染体',
    maxHp: 30,
    hp: 30,
    speed: 80,
    radius: 16,
    contactDamage: 10,
    expDrop: 1,
    color: '#ff5e70',
  }),
  spawn: Object.freeze({
    intervalSeconds: 1,
    viewportClearance: 32,
    maxActive: 100,
    maxPositionAttempts: 16,
  }),
});
