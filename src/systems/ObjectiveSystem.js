export class ObjectiveSystem {
  #selectedId = null;

  #candidates({ encounters, exploration, supply, relays = [] }) {
    const targets = [];
    const event = encounters?.active;
    if (event) targets.push({ ...event, kind: 'event', action: event.type === 'elite' ? '消灭物资守卫'
      : event.type === 'transport' ? '靠近并跟随无人机' : '留在圆环内防守' });
    for (const terminal of exploration?.terminals ?? []) {
      if (!terminal.completed) targets.push({ ...terminal, kind: 'terminal', action: `连续站入 ${terminal.channelSeconds} 秒` });
    }
    if (supply?.station) targets.push({ ...supply.station, id: 'supply-station', kind: 'supply', name: '救援补给', action: '站入圆环领取补给' });
    for (const relay of relays) targets.push({ ...relay, id: `relay-${relay.id}`, kind: 'relay',
      action: relay.energy >= 100 ? relay.effect === 'firepower' ? '站入获取火力增益与冲击' : '站入获取治疗与冲击' : '附近击杀或电芯补能' });
    return targets;
  }

  getTrackedSnapshot(data) {
    const targets = this.#candidates(data);
    const chosen = targets.find(target => target.id === this.#selectedId);
    if (chosen) return Object.freeze(chosen);
    const event = targets.find(target => target.kind === 'event');
    if (event) return Object.freeze(event);
    const supply = targets.find(target => target.kind === 'supply');
    if (supply) return Object.freeze(supply);
    const terminalTargets = targets.filter(target => target.kind === 'terminal');
    const options = terminalTargets.length > 0 ? terminalTargets : targets;
    const position = data.playerPosition;
    options.sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y)
      || a.id.localeCompare(b.id));
    return options[0] ? Object.freeze(options[0]) : null;
  }

  cycle(data) {
    const candidates = this.#candidates(data);
    if (candidates.length < 2) return false;
    const current = this.getTrackedSnapshot(data);
    const index = candidates.findIndex(target => target.id === current?.id);
    this.#selectedId = candidates[(index + 1) % candidates.length].id;
    return true;
  }

  reset() { this.#selectedId = null; }
}
