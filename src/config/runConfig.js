export const RUN_MODE_CONFIG = Object.freeze([
  Object.freeze({ id: 'standard', name: '标准生存', weaponLimit: null }),
  Object.freeze({ id: 'tactical', name: '战术构筑', weaponLimit: 3 }),
]);
export function getRunMode(id) { return RUN_MODE_CONFIG.find(mode => mode.id === id) ?? null; }
