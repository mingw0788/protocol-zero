const directions = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };

export class TacticalHUD {
  constructor(root) {
    this.status = root.querySelector('#tactical-hud');
    this.objective = root.querySelector('#objective-hud');
    this.notice = root.querySelector('#pickup-notice');
  }

  render(snapshot, visible) {
    for (const e of [this.status, this.objective, this.notice]) if (e) e.hidden = !visible;
    if (!visible || !snapshot) return;
    const cooldown = snapshot.dash.cooldownRemaining;
    setText(this.status, `Shift · 冲刺 ${cooldown > .05 ? cooldown.toFixed(1) + 's' : '就绪'}  |  护盾 ${snapshot.shield}  |  补给还需 ${snapshot.supply.killsUntilDrop} 击杀`);
    const { exploration, playerPosition } = snapshot;
    const next = snapshot.trackedObjective ?? exploration.terminals.filter(t => !t.completed).sort((a, b) =>
      Math.hypot(a.x - playerPosition.x, a.y - playerPosition.y) - Math.hypot(b.x - playerPosition.x, b.y - playerPosition.y))[0];
    let objective = `档案 ${exploration.completed}/${exploration.total} · 事件 ${snapshot.encounters?.completed ?? 0}/2 · G 切换目标`;
    if (next) {
      const dx = next.x - playerPosition.x, dy = next.y - playerPosition.y;
      const arrow = directions[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
      const remaining = Number.isFinite(next.remaining) ? ` · ${Math.ceil(next.remaining)}s` : '';
      objective += ` · ${arrow} ${next.name}${remaining} · 距离 ${Math.ceil(Math.hypot(dx, dy))}`;
      objective += next.progress > 0 ? ` · ${Math.floor(next.progress * 100)}%` : '';
      objective += ` · ${next.action ?? '站入获取经验'}`;
    } else objective += ' · 完成！额外经验与重抽已获得';
    setText(this.objective, objective);
    setText(this.notice, snapshot.supply.notices.map(n => n.text).join(' · '));
    if (this.notice) this.notice.hidden = snapshot.supply.notices.length === 0;
  }
}
