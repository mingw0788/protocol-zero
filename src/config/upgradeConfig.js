export const UPGRADE_CONFIG = Object.freeze([
  Object.freeze({
    id: 'UP-01',
    name: '火力强化',
    description: '全武器基础伤害 +15%',
    maxLevel: 5,
  }),
  Object.freeze({
    id: 'UP-02',
    weaponId: 'pulse-gun',
    name: '极速装填',
    description: '脉冲枪攻击速度 +12%',
    maxLevel: 5,
  }),
  Object.freeze({
    id: 'UP-03',
    weaponId: 'pulse-gun',
    name: '多重脉冲',
    description: '每次脉冲攻击额外增加 1 枚弹丸',
    maxLevel: 2,
  }),
  Object.freeze({
    id: 'UP-04',
    weaponId: 'orbital-blade', unlocksWeapon: true,
    name: '轨道刃模块',
    description: '首次解锁轨道刃，其后强化轨道刃效果',
    maxLevel: 5,
  }),
  Object.freeze({
    id: 'UP-05',
    name: '机动优化',
    description: '移动速度 +8%',
    maxLevel: 5,
  }),
  Object.freeze({
    id: 'UP-06',
    name: '纳米装甲',
    description: '最大生命 +20，并恢复 20 点生命',
    maxLevel: 5,
  }),
  Object.freeze({ id: 'UP-07', weaponId: 'arc-coil', unlocksWeapon: true, name: '弧光线圈模块', description: '首次解锁连锁电击；后续每级伤害 +12%，3/5 级多连锁一个目标', maxLevel: 5 }),
  Object.freeze({ id: 'UP-08', weaponId: 'railgun', unlocksWeapon: true, name: '磁轨炮模块', description: '首次解锁贯穿光束；后续每级伤害 +12%，3/5 级多贯穿一个目标', maxLevel: 5 }),
]);
