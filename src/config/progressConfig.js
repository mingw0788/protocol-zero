export const DISCOVERY_IDS = Object.freeze({
  enemies: Object.freeze(['EN-01', 'EN-02', 'EN-03', 'EN-04', 'EN-05', 'EN-06', 'EN-EVENT', 'BOSS-01', 'BOSS-02']),
  weapons: Object.freeze(['pulse-gun', 'orbital-blade', 'arc-coil', 'railgun', 'cryo-sprayer', 'drone-swarm']),
  evolutions: Object.freeze(['EV-01', 'EV-02', 'EV-03', 'EV-04']),
  events: Object.freeze(['defense', 'transport', 'elite']), maps: Object.freeze(['laboratory', 'east-city', 'energy-hub']),
});
export const ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: 'first-victory', name: '零号幸存者', description: '完成任一地图胜利 · 解锁琥珀外观' }),
  Object.freeze({ id: 'field-technician', name: '现场工程师', description: '同一局上传全部三个终端' }),
  Object.freeze({ id: 'evolution-engineer', name: '进化工程师', description: '发现全部四种武器进化 · 解锁紫晶外观' }),
  Object.freeze({ id: 'event-specialist', name: '战地专家', description: '完成全部三类可选事件' }),
  Object.freeze({ id: 'arsenal', name: '武器专家', description: '解锁全部六种武器' }),
  Object.freeze({ id: 'city-savior', name: '失控终结者', description: '三张地图各胜利一次 · 解锁翡翠外观' }),
  Object.freeze({ id: 'challenge-breaker', name: '协议挑战者', description: '携带挑战词条取得胜利' }),
  Object.freeze({ id: 'endless-survivor', name: '加时幸存者', description: '胜利后再坚持十分钟' }),
]);
export const COSMETICS = Object.freeze([
  Object.freeze({ id: 'cyan', name: '零号青', color: '#77e7ef', achievement: null }),
  Object.freeze({ id: 'amber', name: '幸存琥珀', color: '#ffd07d', achievement: 'first-victory' }),
  Object.freeze({ id: 'violet', name: '进化紫晶', color: '#c5a0ff', achievement: 'evolution-engineer' }),
  Object.freeze({ id: 'mint', name: '城市翡翠', color: '#96edbe', achievement: 'city-savior' }),
]);
export function deriveAchievements(progress) {
  const won = progress.records.filter(record => record.wins > 0);
  const conditions = {
    'first-victory': won.length > 0 || progress.bestVictorySeconds !== null,
    'field-technician': progress.records.some(record => record.maxTerminals >= 3),
    'evolution-engineer': progress.discoveries.evolutions.length === 4,
    'event-specialist': progress.discoveries.events.length === 3, arsenal: progress.discoveries.weapons.length === 6,
    'city-savior': new Set(won.map(record => record.key.split('|')[0])).size === 3,
    'challenge-breaker': won.some(record => record.key.split('|')[3] !== 'none'),
    'endless-survivor': progress.records.some(record => record.bestEndlessSeconds >= 600),
  };
  return Object.freeze(ACHIEVEMENTS.filter(item => progress.achievements.includes(item.id) || conditions[item.id]).map(item => item.id));
}
