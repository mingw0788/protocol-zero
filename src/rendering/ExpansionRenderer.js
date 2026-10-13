const CAPSULES = Object.freeze({
  overclock: { color: '#ffcc77', symbol: '+' },
  decoy: { color: '#ff88c8', symbol: '◎' },
  scanner: { color: '#83efba', symbol: '⌖' },
  medkit: { color: '#ff7986', symbol: '+' },
  'emp-charge': { color: '#85adff', symbol: '✦' },
  'relay-cell': { color: '#64dfde', symbol: 'ϟ' },
});

export class ExpansionRenderer {
  render(ctx, camera, snapshot = null) {
    if (!snapshot) return;
    const width = camera.viewportWidth, height = camera.viewportHeight;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    for (const relay of snapshot.relays ?? []) {
      const energy = Number.isFinite(relay.energy) ? relay.energy : (relay.used ? 0 : 100);
      const p = camera.worldToScreen(relay.x, relay.y);
      const extent = relay.pulseRadius + 30;
      if (p.x + extent < 0 || p.y + extent < 0 || p.x - extent > width || p.y - extent > height) continue;
      const color = energy === 0 ? '#ff9b70' : energy < 100 ? '#ffc268' : '#64dfde';
      ctx.fillStyle = energy === 0 ? '#30242a' : '#163944';
      ctx.beginPath(); ctx.arc(p.x, p.y, relay.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, relay.radius - 7, -Math.PI / 2, -Math.PI / 2 + relay.progress * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = energy < 100 ? '#ffbd73' : '#468d96';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, relay.radius + 6, -Math.PI / 2,
        -Math.PI / 2 + energy / 100 * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
      ctx.fillStyle = '#0c2431';
      ctx.fillRect(p.x - 2, p.y - 9, 4, 18); ctx.fillRect(p.x - 9, p.y - 2, 18, 4);
      ctx.fillStyle = relay.used ? '#91a4ad' : '#c6ffff';
      ctx.fillText(relay.name, p.x, p.y - relay.radius - 18);
      const relayStatus = energy === 0 ? '能量耗尽 · 就近击杀补充'
        : energy < 100 ? `能量 ${energy}% · 就近击杀补充`
          : relay.progress > 0 ? `蓄能 ${Math.round(relay.progress * 100)}% · 修复 + 冲击` : '站入 2 秒 · 修复 + 冲击';
      ctx.fillText(relayStatus, p.x, p.y + relay.radius + 20);
      if (relay.pulseRemaining > 0) {
        ctx.globalAlpha = 1 - relay.pulseProgress;
        ctx.strokeStyle = '#cbffff'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, relay.radius + (relay.pulseRadius - relay.radius) * relay.pulseProgress, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const station = snapshot.supply?.station;
    if (station) {
      const p = camera.worldToScreen(station.x, station.y);
      ctx.strokeStyle = '#83efba';
      ctx.fillStyle = '#83efba';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, station.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, station.radius - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * station.progress);
      ctx.stroke();
      ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
      ctx.fillStyle = '#0c2630';
      ctx.fillRect(p.x - 2, p.y - 8, 4, 16);
      ctx.fillRect(p.x - 8, p.y - 2, 16, 4);
      ctx.fillStyle = '#caffdf';
      ctx.fillText('站入蓄能', p.x, p.y + station.radius + 18);
      if (p.x < 70 || p.x > width - 70 || p.y < 140 || p.y > height - 90) {
        const x = Math.max(70, Math.min(width - 70, p.x));
        const y = Math.max(140, Math.min(height - 90, p.y));
        const dx = p.x - x, dy = p.y - y;
        const angle = Math.atan2(dy, dx);
        const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
        const arrow = arrows[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
        ctx.fillStyle = '#0b2630';
        ctx.fillRect(x - 54, y - 16, 108, 32);
        ctx.fillStyle = '#a2ffcc';
        ctx.fillText(`${arrow} 救援补给`, x, y);
      }
    }
    for (const pickup of snapshot.supply?.pickups ?? []) {
      const p = camera.worldToScreen(pickup.x, pickup.y);
      if (p.x < -18 || p.y < -18 || p.x > width + 18 || p.y > height + 18) continue;
      const style = CAPSULES[pickup.type];
      if (!style) continue;
      ctx.fillStyle = '#102536';
      ctx.fillRect(p.x - 13, p.y - 13, 26, 26);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 13, p.y - 13, 26, 26);
      ctx.fillStyle = style.color;
      ctx.fillText(style.symbol, p.x, p.y);
    }
    const decoy = snapshot.supply?.decoy;
    if (decoy) {
      const p = camera.worldToScreen(decoy.x, decoy.y);
      ctx.strokeStyle = '#ff88c8';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, decoy.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff88c8';
      ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
      ctx.fillText('诱饵', p.x, p.y + 25);
    }
    const pulse = snapshot.supply?.pulse;
    if (pulse) {
      const p = camera.worldToScreen(pulse.x, pulse.y);
      ctx.strokeStyle = '#9ac5ff'; ctx.lineWidth = 7;
      ctx.globalAlpha = pulse.remaining / pulse.lifetime;
      ctx.beginPath(); ctx.arc(p.x, p.y, pulse.radius * (1 - pulse.remaining / pulse.lifetime), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const [kind, segments] of [['arc', snapshot.arc], ['rail', snapshot.rail]]) {
      for (const beam of segments ?? []) {
        const a = camera.worldToScreen(beam.x1, beam.y1), b = camera.worldToScreen(beam.x2, beam.y2);
        ctx.strokeStyle = beam.color;
        ctx.lineWidth = kind === 'rail' ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        if (kind === 'arc') {
          const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          for (let i = 1; i < 6; i += 1) {
            const offset = i % 2 ? 7 : -7;
            ctx.lineTo(a.x + (b.x - a.x) * i / 6 - (b.y - a.y) / length * offset,
              a.y + (b.y - a.y) * i / 6 + (b.x - a.x) / length * offset);
          }
        }
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
