import { getMapConfig } from './mapConfig.js';
export const RUN_MODE_CONFIG = Object.freeze([
  Object.freeze({ id: 'standard', name: '标准生存', weaponLimit: null }),
  Object.freeze({ id: 'tactical', name: '战术构筑', weaponLimit: 3 }),
]);
export function getRunMode(id) { return RUN_MODE_CONFIG.find(mode => mode.id === id) ?? null; }
const protocol = (id, name, description, values = {}) => Object.freeze({ id, name, description,
  damageMultiplier: 1, moveSpeedMultiplier: 1, maxHp: 100, startingShield: 0, explorationMultiplier: 1, pickupBonus: 0, ...values });
export const OPENING_PROTOCOLS = Object.freeze([
  protocol('standard', '标准协议', '原始属性，无额外收益或代价'),
  protocol('assault', '突击协议', '伤害 +18%，开局生命降至 80', { damageMultiplier: 1.18, maxHp: 80 }),
  protocol('recycle', '回收协议', '探索/事件经验 +50%、拾取 +8，伤害 -10%', { damageMultiplier: .9, explorationMultiplier: 1.5, pickupBonus: 8 }),
  protocol('guard', '守卫协议', '开局生命 120、护盾 15，移速 -8%', { maxHp: 120, startingShield: 15, moveSpeedMultiplier: .92 }),
]);
export const CHALLENGES = Object.freeze([
  Object.freeze({ id: 'none', name: '无挑战', description: '默认战场', spawnIntervalMultiplier: 1, killsPerDrop: 15, stationWindow: 25 }),
  Object.freeze({ id: 'pressure', name: '高压敌潮', description: '敌人生成间隔 -20%，上限仍为 100', spawnIntervalMultiplier: .8, killsPerDrop: 15, stationWindow: 25 }),
  Object.freeze({ id: 'scarce', name: '物资稀缺', description: '击杀补给需 24 敌，救援窗口缩至 18 秒', spawnIntervalMultiplier: 1, killsPerDrop: 24, stationWindow: 18 }),
  Object.freeze({ id: 'elite', name: '精英增援', description: '每 90 秒尝试增援干扰精英，最多一只', spawnIntervalMultiplier: 1, killsPerDrop: 15, stationWindow: 25 }),
]);
export const getProtocol = id => OPENING_PROTOCOLS.find(item => item.id === id) ?? null;
export const getChallenge = id => CHALLENGES.find(item => item.id === id) ?? null;
export function createRecordKey({ mapId = 'laboratory', modeId = 'standard', protocolId = 'standard', challengeId = 'none' } = {}) {
  return getMapConfig(mapId) && getRunMode(modeId) && getProtocol(protocolId) && getChallenge(challengeId)
    ? [mapId, modeId, protocolId, challengeId].join('|') : null;
}
