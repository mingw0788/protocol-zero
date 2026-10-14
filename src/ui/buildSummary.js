import { UPGRADE_CONFIG } from '../config/upgradeConfig.js';
import { SUPPLY_NAMES } from '../config/supplyConfig.js';
export const WEAPON_NAMES = Object.freeze({ 'pulse-gun': '脉冲枪', 'orbital-blade': '轨道刃', 'arc-coil': '弧光线圈', railgun: '磁轨炮', 'cryo-sprayer': '冷凝喷射器', 'drone-swarm': '蜂群无人机' });
const SOURCES = Object.freeze({ ...WEAPON_NAMES, ...SUPPLY_NAMES, 'character-pulse': '角色电磁脉冲', 'relay-pulse': '中继冲击', 'capacitor-barrel': '电容桶', unknown: '其他来源' });
export function sourceName(id, build) { return build?.evolutions?.find(evolution => evolution.weaponId === id && evolution.evolved)?.name ?? SOURCES[id] ?? id; }
export function formatBuildSummary(data) {
  const build = data?.build;
  const weapons = (build?.weaponIds ?? []).map(id => sourceName(id, build)).join(' / ') || '脉冲枪';
  const upgrades = (data?.upgrades ?? []).filter(upgrade => upgrade.level > 0).map(upgrade => `${UPGRADE_CONFIG.find(config => config.id === upgrade.id)?.name ?? upgrade.id} ${upgrade.level}/${upgrade.maxLevel}`).join(' · ') || '尚未升级';
  const buffs = [];
  if (data?.supply?.overclockRemaining > 0) buffs.push(`过载 ${Math.ceil(data.supply.overclockRemaining)}s`);
  if (data?.relayBuff?.remaining > 0) buffs.push(`中继火力 ${Math.ceil(data.relayBuff.remaining)}s`);
  if (data?.supply?.amplifierArmed) buffs.push('中继增幅待用 ×1.5');
  for (const turret of data?.deployables?.turrets ?? []) buffs.push(`炮台 ${Math.ceil(turret.remaining)}s`);
  for (const field of data?.deployables?.healingFields ?? []) buffs.push(`维修场 ${Math.ceil(field.remaining)}s`);
  return Object.freeze({ weapons, upgrades, buffs: buffs.join(' · ') || '无临时增益' });
}
export function formatCombatSummary(result, build) {
  const stats = result?.statistics;
  if (!stats) return null;
  const damage = new Map(stats.damageBySource.map(row => [row.sourceId, row.damage]));
  const kills = new Map(stats.killsBySource.map(row => [row.sourceId, row.kills]));
  const ids = [...new Set([...damage.keys(), ...kills.keys()])];
  return Object.freeze({ total: stats.totalDamageDealt, dps: result.elapsedSeconds > 0 ? stats.totalDamageDealt / result.elapsedSeconds : 0,
    received: stats.totalDamageReceived, shield: stats.totalShieldAbsorbed,
    rows: Object.freeze(ids.map(id => Object.freeze({ id, name: sourceName(id, build), damage: damage.get(id) ?? 0,
      kills: kills.get(id) ?? 0, share: stats.totalDamageDealt > 0 ? (damage.get(id) ?? 0) / stats.totalDamageDealt * 100 : 0 })).sort((a, b) => b.damage - a.damage)) });
}
