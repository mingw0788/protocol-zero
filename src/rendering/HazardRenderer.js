export class HazardRenderer {
  render(ctx, camera, snapshot) {
    const hazards = snapshot?.hazards;
    if (!hazards) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, camera.viewportWidth, camera.viewportHeight); ctx.clip();
    ctx.font = '12px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
    for (const zone of hazards.zones) {
      const p = camera.worldToScreen(zone.x, zone.y);
      if (p.x + zone.width < 0 || p.y + zone.height < 0 || p.x > camera.viewportWidth || p.y > camera.viewportHeight) continue;
      const color = zone.disabled ? '#70a99c' : zone.phase === 'active' ? '#ff6682' : zone.phase === 'warning' ? '#ffd075' : '#385267';
      ctx.fillStyle = zone.phase === 'active' ? '#ff466922' : '#20344933';
      ctx.fillRect(p.x, p.y, zone.width, zone.height);
      ctx.strokeStyle = color; ctx.lineWidth = zone.phase === 'safe' ? 1 : 3;
      ctx.strokeRect(p.x, p.y, zone.width, zone.height);
      if (zone.phase !== 'safe') {
        ctx.beginPath();
        for (let y = p.y + 10; y < p.y + zone.height - 10; y += 36) {
          ctx.moveTo(p.x + 12, y); ctx.lineTo(p.x + zone.width - 12, y + 18);
        }
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.fillText(`${zone.name} · ${zone.disabled ? '已断电' : zone.phase === 'active' ? '危险通电' : zone.phase === 'warning' ? '即将通电' : '安全'}`,
        p.x + zone.width / 2, p.y - 12);
    }
    for (const barrel of hazards.barrels) {
      const p = camera.worldToScreen(barrel.x, barrel.y);
      if (p.x < -60 || p.y < -60 || p.x > camera.viewportWidth + 60 || p.y > camera.viewportHeight + 60) continue;
      if (!barrel.alive) { ctx.fillStyle = '#3b454b'; ctx.fillRect(p.x - 10, p.y + 9, 20, 4); continue; }
      ctx.fillStyle = '#6c5933'; ctx.fillRect(p.x - 12, p.y - 16, 24, 32);
      ctx.fillStyle = '#f7cd6d'; ctx.fillRect(p.x - 14, p.y - 12, 28, 5); ctx.fillRect(p.x - 14, p.y + 8, 28, 5);
      ctx.fillStyle = '#fff0b4'; ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
      if (Math.hypot(barrel.x - snapshot.playerPosition.x, barrel.y - snapshot.playerPosition.y) < 150) {
        ctx.fillText('电容桶 · 仅伤敌人', p.x, p.y + 34);
      }
    }
    for (const effect of hazards.effects) {
      const p = camera.worldToScreen(effect.x, effect.y);
      ctx.globalAlpha = Math.min(1, effect.remaining / effect.lifetime);
      ctx.strokeStyle = '#91f3e1'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, effect.radius * (1 - .35 * effect.remaining / effect.lifetime), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
