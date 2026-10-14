import { ENCOUNTER_CONFIG } from '../config/encounterConfig.js';
import { WORLD_MAP } from '../config/worldConfig.js';
import { SUPPLY_NAMES } from '../config/supplyConfig.js';

function copyConfig(config, world) {
  for (const key of ['stopStartingAt', 'minimumDistance', 'clearance', 'transportSpeed', 'transportDistance']) {
    if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError(`Invalid encounter ${key}`);
  }
  if (!Number.isFinite(world?.width) || world.width <= 0 || !Number.isFinite(world.height) || world.height <= 0
    || !Array.isArray(config.schedule) || config.schedule.length > 32
    || config.schedule.some((time, index) => !Number.isFinite(time) || time < 0 || time >= config.stopStartingAt
      || (index > 0 && time <= config.schedule[index - 1]))
    || !Array.isArray(config.types) || config.types.length < config.schedule.length
    || new Set(config.types.map(type => type.id)).size !== config.types.length) throw new RangeError('Invalid encounter timeline');
  for (const type of config.types) {
    if (!['defense', 'transport', 'elite'].includes(type.id) || !type.name || !Object.hasOwn(SUPPLY_NAMES, type.reward)
      || !Number.isSafeInteger(type.experience) || type.experience < 0
      || ['radius', 'channelSeconds', 'duration'].some(key => !Number.isFinite(type[key]) || type[key] <= 0)) throw new RangeError('Invalid encounter type');
  }
  if (!config.maps || typeof config.maps !== 'object' || !config.elite) throw new RangeError('Invalid encounter maps or elite');
  const maps = Object.fromEntries(Object.entries(config.maps).map(([id, anchors]) => {
    if (!Array.isArray(anchors) || anchors.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.y < 0 || point.x > world.width || point.y > world.height)) throw new RangeError('Invalid encounter anchors');
    return [id, Object.freeze(anchors.map(point => Object.freeze({ ...point })))];
  }));
  return Object.freeze({ ...config, maps: Object.freeze(maps), elite: Object.freeze({ ...config.elite }),
    schedule: Object.freeze([...config.schedule]), types: Object.freeze(config.types.map(type => Object.freeze({ ...type }))) });
}

// Duration spent inside a stationary circle along one constant velocity segment.
function proximitySeconds(start, velocity, duration, player, radius) {
  const x = start.x - player.x, y = start.y - player.y;
  const a = velocity.x ** 2 + velocity.y ** 2;
  if (a === 0) return Math.hypot(x, y) <= radius ? duration : 0;
  const b = 2 * (x * velocity.x + y * velocity.y);
  const c = x ** 2 + y ** 2 - radius ** 2;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) return 0;
  const root = Math.sqrt(discriminant);
  return Math.max(0, Math.min(duration, (-b + root) / (2 * a)) - Math.max(0, (-b - root) / (2 * a)));
}

export class EncounterSystem {
  #active = null;
  #nextEvent = 0;
  #nextId = 1;
  #availableTypes = [];
  #mapId = 'laboratory';
  #completed = 0;
  #failed = 0;
  #skipped = 0;

  constructor({ player, enemies, spawnElite, random = Math.random, onReward, onNotice = null, config = ENCOUNTER_CONFIG, world = WORLD_MAP } = {}) {
    if (!player || !Array.isArray(enemies) || typeof spawnElite !== 'function' || typeof random !== 'function'
      || typeof onReward !== 'function' || (onNotice !== null && typeof onNotice !== 'function')) throw new TypeError('Invalid encounter dependencies');
    this.player = player; this.enemies = enemies; this.spawnElite = spawnElite;
    this.random = random; this.onReward = onReward; this.onNotice = onNotice;
    this.config = copyConfig(config, world); this.world = world;
    this.reset();
  }

  update(deltaSeconds, elapsedSeconds, blockedPoints = []) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !Number.isFinite(elapsedSeconds)
      || elapsedSeconds < deltaSeconds || !Array.isArray(blockedPoints)) throw new RangeError('Invalid encounter step');
    if (deltaSeconds === 0 || !this.player.alive) return;
    while (this.#nextEvent < this.config.schedule.length && this.config.schedule[this.#nextEvent] <= elapsedSeconds + 1e-9) {
      const startAt = this.config.schedule[this.#nextEvent++];
      if (this.#active || elapsedSeconds >= this.config.stopStartingAt) { this.#skipped++; continue; }
      this.#start(startAt, elapsedSeconds, blockedPoints);
    }
    const event = this.#active;
    if (!event) return;
    const effectiveDelta = Math.max(0, Math.min(elapsedSeconds, event.deadline) - Math.max(elapsedSeconds - deltaSeconds, event.startedAt));
    event.remaining = Math.max(0, event.deadline - elapsedSeconds);
    let escaped = false;
    if (event.type === 'elite') {
      const enemy = this.enemies.find(enemy => enemy.id === event.enemyId);
      if (enemy) { event.x = enemy.x; event.y = enemy.y; event.progress = 1 - Math.max(0, enemy.hp) / enemy.maxHp; }
    } else if (event.type === 'transport') {
      const distance = Math.abs(event.endX - event.x);
      const direction = Math.sign(event.endX - event.x);
      const movementSeconds = Math.min(effectiveDelta, distance / this.config.transportSpeed);
      event.charge += proximitySeconds(event, { x: direction * this.config.transportSpeed, y: 0 }, movementSeconds, this.player, event.radius);
      event.x += direction * this.config.transportSpeed * movementSeconds;
      escaped = distance <= this.config.transportSpeed * effectiveDelta + 1e-9;
      event.progress = Math.min(1, event.charge / event.channelSeconds);
    } else {
      if (Math.hypot(this.player.x - event.x, this.player.y - event.y) <= event.radius) event.charge += effectiveDelta;
      event.progress = Math.min(1, event.charge / event.channelSeconds);
    }
    if (event.type !== 'elite' && event.charge + 1e-9 >= event.channelSeconds) this.#complete();
    else if (elapsedSeconds + 1e-9 >= event.deadline || escaped) {
      this.#active = null; this.#failed++;
      this.onNotice?.(`${event.name} 已结束 · 本次未获奖励`);
    }
  }

  #start(startAt, elapsed, blockedPoints) {
    const typeIndex = Math.floor(this.#sample() * this.#availableTypes.length);
    const type = this.#availableTypes.splice(typeIndex, 1)[0];
    if (!type || elapsed >= startAt + type.duration) { this.#skipped++; return; }
    let anchors = (this.config.maps[this.#mapId] ?? []).filter(point => {
      if (point.x < type.radius || point.y < type.radius || point.x + type.radius > this.world.width || point.y + type.radius > this.world.height) return false;
      if (Math.hypot(point.x - this.player.x, point.y - this.player.y) < this.config.minimumDistance
        || Math.hypot(point.x - this.world.width / 2, point.y - this.world.height / 2) < this.config.minimumDistance) return false;
      if (type.id === 'transport' && Math.min(point.x, this.world.width - point.x) + this.config.transportDistance + type.radius > this.world.width) return false;
      return blockedPoints.every(block => Math.hypot(point.x - block.x, point.y - block.y) >= type.radius + (block.radius ?? 0) + this.config.clearance);
    });
    if (anchors.length === 0) { this.#skipped++; return; }
    const offset = Math.floor(this.#sample() * anchors.length);
    anchors = [...anchors.slice(offset), ...anchors.slice(0, offset)];
    const id = `encounter-${this.#nextId++}`;
    let point = anchors[0], enemy = null;
    if (type.id === 'elite') {
      for (const anchor of anchors) {
        enemy = this.spawnElite({ ...anchor, config: this.config.elite, encounterId: id });
        if (enemy) { point = anchor; break; }
      }
      if (!enemy) { this.#skipped++; return; }
    }
    this.#active = { id, type: type.id, name: type.name, x: point.x, y: point.y, radius: type.radius,
      startedAt: startAt, deadline: startAt + type.duration, remaining: startAt + type.duration - elapsed,
      channelSeconds: type.channelSeconds, charge: 0, progress: 0, experience: type.experience, reward: type.reward,
      enemyId: enemy?.id ?? null,
      endX: point.x + (point.x < this.world.width / 2 ? 1 : -1) * this.config.transportDistance };
    this.onNotice?.(`可选事件 · ${type.name} · 按 G 追踪目标`);
  }

  notifyEnemyDeath({ enemyId, x, y } = {}, elapsedSeconds = null) {
    if (!this.player.alive || this.#active?.type !== 'elite' || this.#active.enemyId !== enemyId) return false;
    if (elapsedSeconds !== null && (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0)) throw new RangeError('Invalid death time');
    if (elapsedSeconds !== null && elapsedSeconds > this.#active.deadline + 1e-9) {
      this.onNotice?.(`${this.#active.name} 已结束 · 本次未获奖励`);
      this.#active = null; this.#failed++;
      return false;
    }
    if (Number.isFinite(x) && Number.isFinite(y)) { this.#active.x = x; this.#active.y = y; }
    this.#complete();
    return true;
  }

  #complete() {
    const event = this.#active;
    this.#active = null;
    this.#completed++;
    this.onReward(Object.freeze({ id: event.id, type: event.type, name: event.name,
      x: event.x, y: event.y, experience: event.experience, items: Object.freeze([event.reward]) }));
  }

  #sample() {
    const sample = this.random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Encounter random must be in [0,1)');
    return sample;
  }

  getSnapshot() {
    return Object.freeze({ active: this.#active ? Object.freeze({ ...this.#active }) : null,
      completed: this.#completed, failed: this.#failed, skipped: this.#skipped, totalScheduled: this.config.schedule.length });
  }

  reset(mapId = this.#mapId) {
    this.#mapId = mapId; this.#active = null; this.#nextEvent = 0; this.#nextId = 1;
    this.#availableTypes = [...this.config.types];
    this.#completed = 0; this.#failed = 0; this.#skipped = 0;
  }
}
