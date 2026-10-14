const freeze = value => Object.freeze(value);
export const JOURNEYS = freeze([freeze({ id: 'survival', name: '单图生存' }), freeze({ id: 'campaign', name: '三关战役' })]);
export const DIFFICULTIES = freeze([
  freeze({ id: 'normal', name: '普通', hpMultiplier: 1, intervalMultiplier: 1, damageMultiplier: 1 }),
  freeze({ id: 'hard', name: '困难', hpMultiplier: 1.25, intervalMultiplier: .9, damageMultiplier: 1.15 }),
  freeze({ id: 'nightmare', name: '噩梦', hpMultiplier: 1.6, intervalMultiplier: .8, damageMultiplier: 1.3 }),
]);
export const CHARACTERS = freeze([
  freeze({ id: 'zero', name: 'ZERO · 平衡机体', hpBonus: 0, damageMultiplier: 1, moveMultiplier: 1, color: '#4cf3ff', skillName: '电磁脉冲', cooldown: 14, range: 200 }),
  freeze({ id: 'veil', name: 'VEIL · 侦察机体', hpBonus: -15, damageMultiplier: 1, moveMultiplier: 1.12, color: '#ae9aff', skillName: '冷凝封锁', cooldown: 16, range: 260 }),
  freeze({ id: 'bastion', name: 'BASTION · 重装机体', hpBonus: 20, damageMultiplier: 1, moveMultiplier: .94, color: '#ffcc77', skillName: '屏障重构', cooldown: 20, range: 48 }),
]);
export const EQUIPMENT_MODULES = freeze([
  freeze({ id: 'reactor', name: '火力核心', description: '所有伤害 +12%', damageBonus: .12, hpBonus: 0, moveBonus: 0 }),
  freeze({ id: 'armor', name: '纳米护甲', description: '最大生命 +15，立即恢复15', damageBonus: 0, hpBonus: 15, moveBonus: 0 }),
  freeze({ id: 'mobility', name: '机动模块', description: '移动速度 +8%', damageBonus: 0, hpBonus: 0, moveBonus: .08 }),
]);
export const CAMPAIGN_STAGES = freeze([
  freeze({ mapId: 'laboratory', name: '突破封锁', durationSeconds: 180, bossTime: 150, bossHp: 1200, hpMultiplier: 1, intervalMultiplier: 1, damageMultiplier: 1 }),
  freeze({ mapId: 'east-city', name: '穿越疏散线', durationSeconds: 180, bossTime: 150, bossHp: 2000, hpMultiplier: 1.45, intervalMultiplier: .85, damageMultiplier: 1.15 }),
  freeze({ mapId: 'energy-hub', name: '终止失控', durationSeconds: 240, bossTime: 210, bossHp: 2800, hpMultiplier: 1.9, intervalMultiplier: .7, damageMultiplier: 1.3 }),
]);
export const getJourney = id => JOURNEYS.find(item => item.id === id) ?? null;
export const getDifficulty = id => DIFFICULTIES.find(item => item.id === id) ?? null;
export const getCharacter = id => CHARACTERS.find(item => item.id === id) ?? null;
export const getEquipmentModule = id => EQUIPMENT_MODULES.find(item => item.id === id) ?? null;
