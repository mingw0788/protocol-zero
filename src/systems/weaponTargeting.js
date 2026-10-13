export function liveTargets(enemies) {
  const seen = new Set();
  return enemies.filter((enemy) => {
    if (enemy?.alive !== true || !Number.isFinite(enemy.hp) || enemy.hp <= 0
      || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) || !Number.isFinite(enemy.radius) || enemy.radius <= 0
      || !((typeof enemy.id === 'string' && enemy.id.length > 0) || Number.isFinite(enemy.id)) || seen.has(enemy.id)) return false;
    seen.add(enemy.id);
    return true;
  });
}

export function nearest(origin, enemies, range, excluded = new Set()) {
  let result = null, distance = Infinity;
  for (const enemy of enemies) {
    if (excluded.has(enemy.id)) continue;
    const next = Math.hypot(enemy.x - origin.x, enemy.y - origin.y);
    if (next <= range && next < distance) { distance = next; result = enemy; }
  }
  return result;
}

export function initializeWeapon(system, { player, enemies, enemyDamageSystem, config }) {
  if (!player || !Array.isArray(player.weaponStates) || !Array.isArray(enemies)
    || typeof enemyDamageSystem?.applyDamage !== 'function') throw new TypeError('Invalid weapon dependencies');
  for (const key of ['damage', 'fireIntervalSeconds', 'range', 'maxTargets', 'maxLevel', 'damageBonusPerLevel', 'visualSeconds']) {
    if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError('Invalid weapon setting: ' + key);
  }
  if (!Number.isSafeInteger(config.maxLevel) || !Number.isSafeInteger(config.maxTargets)
    || typeof config.id !== 'string' || !config.id || typeof config.color !== 'string' || !config.color) throw new RangeError('Invalid weapon configuration');
  Object.assign(system, { player, enemies, enemyDamageSystem, config: Object.freeze({ ...config }), visuals: [] });
}

export function prepareShot(system, { deltaSeconds, level = 0, damageMultiplier = 1, fireRateMultiplier = 1 } = {}) {
  const { config, player } = system;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isSafeInteger(level) || level < 0 || level > config.maxLevel
    || !Number.isFinite(damageMultiplier) || damageMultiplier <= 0 || !Number.isFinite(fireRateMultiplier) || fireRateMultiplier <= 0
    || !Number.isFinite(player.x) || !Number.isFinite(player.y)) throw new RangeError('Invalid weapon step');
  if (deltaSeconds === 0) return null;
  system.visuals = system.visuals.map((line) => ({ ...line, remaining: line.remaining - deltaSeconds })).filter((line) => line.remaining > 0);
  const state = player.weaponStates.find((weapon) => weapon.id === config.id);
  if (!state || level === 0) return null;
  if (!Number.isFinite(state.cooldownRemaining) || state.cooldownRemaining < 0) throw new RangeError('Invalid weapon cooldown');
  state.cooldownRemaining = Math.max(0, state.cooldownRemaining - deltaSeconds);
  if (state.cooldownRemaining > 1e-9) return null;
  const targets = liveTargets(system.enemies);
  const target = nearest(player, targets, config.range);
  if (!target) return null;
  const damage = config.damage * (1 + config.damageBonusPerLevel * (level - 1)) * damageMultiplier;
  const interval = config.fireIntervalSeconds / fireRateMultiplier;
  if (!Number.isFinite(damage) || damage <= 0 || !Number.isFinite(interval) || interval <= 0) throw new RangeError('Invalid derived weapon values');
  state.cooldownRemaining = interval;
  return { targets, target, damage, maxTargets: config.maxTargets + Math.floor((level - 1) / 2) };
}

export function weaponSnapshot(system) {
  return Object.freeze(system.visuals.map((line) => Object.freeze({ ...line })));
}

export function resetWeapon(system) {
  system.visuals = [];
  const state = system.player.weaponStates.find((weapon) => weapon.id === system.config.id);
  if (state) state.cooldownRemaining = 0;
}
