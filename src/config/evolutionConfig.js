export const EVOLUTION_CONFIG = Object.freeze([
  Object.freeze({ id: 'EV-01', name: '裂隙脉冲', weaponId: 'pulse-gun',
    description: '命中后向附近最多两个其他敌人分裂一次，子弹造成 50% 伤害',
    requirements: Object.freeze({ 'UP-03': 2, 'UP-01': 3 }), requirementText: '多重脉冲 2 + 火力强化 3' }),
  Object.freeze({ id: 'EV-02', name: '磁暴轨道', weaponId: 'orbital-blade',
    description: '每 2 秒触发一次外扩扫击，覆盖 140 范围',
    requirements: Object.freeze({ 'UP-04': 5, 'UP-06': 2 }), requirementText: '轨道刃 5 + 纳米装甲 2' }),
  Object.freeze({ id: 'EV-03', name: '雷暴网络', weaponId: 'arc-coil',
    description: '每次连锁末端触发一次范围电爆，不再连锁', scannerStacks: 1,
    requirements: Object.freeze({ 'UP-07': 5 }), requirementText: '弧光线圈 5 + 回收扫描器 1 层' }),
  Object.freeze({ id: 'EV-04', name: '裂城磁轨', weaponId: 'railgun',
    description: '贯穿射击留下短时能量带，每个敌人限频受伤',
    requirements: Object.freeze({ 'UP-08': 5, 'UP-01': 3 }), requirementText: '磁轨炮 5 + 火力强化 3' }),
]);

export const PULSE_EVOLUTION_CONFIG = Object.freeze({ splitTargets: 2, splitRange: 200, damageRatio: .5,
  speed: 500, radius: 3, lifetime: .65, maxProjectiles: 128 });
export const ORBITAL_EVOLUTION_CONFIG = Object.freeze({ sweepRadius: 140, sweepDamage: 24, sweepInterval: 2, visualSeconds: .3 });
export const ARC_EVOLUTION_CONFIG = Object.freeze({ radius: 75, damage: 12, visualSeconds: .22 });
export const RAIL_EVOLUTION_CONFIG = Object.freeze({ lifetime: 1.2, halfWidth: 16, damage: 8, hitInterval: .4, maxFields: 2 });
