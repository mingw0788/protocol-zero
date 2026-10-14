export const EVOLUTION_CONFIG = Object.freeze([
  Object.freeze({ id: 'EV-01', name: '裂隙脉冲', weaponId: 'pulse-gun',
    description: '命中后向附近最多两个其他敌人分裂一次，子弹造成 50% 伤害',
    requirements: Object.freeze({ 'UP-03': 2, 'UP-01': 3 }), requirementText: '多重脉冲 2 + 火力强化 3' }),
  Object.freeze({ id: 'EV-02', name: '磁暴轨道', weaponId: 'orbital-blade',
    description: '每 2 秒触发一次外扩扫击，覆盖 140 范围',
    requirements: Object.freeze({ 'UP-04': 5, 'UP-06': 2 }), requirementText: '轨道刃 5 + 纳米装甲 2' }),
]);

export const PULSE_EVOLUTION_CONFIG = Object.freeze({ splitTargets: 2, splitRange: 200, damageRatio: .5,
  speed: 500, radius: 3, lifetime: .65, maxProjectiles: 128 });
export const ORBITAL_EVOLUTION_CONFIG = Object.freeze({ sweepRadius: 140, sweepDamage: 24, sweepInterval: 2, visualSeconds: .3 });
