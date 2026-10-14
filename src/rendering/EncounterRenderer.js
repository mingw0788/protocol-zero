export class EncounterRenderer {
  render(ctx, camera, snapshot) {
    const event = snapshot?.encounters?.active;
    if (!event) return;
    const p = camera.worldToScreen(event.x, event.y);
    if (p.x < -130 || p.y < -130 || p.x > camera.viewportWidth + 130 || p.y > camera.viewportHeight + 130) return;
    ctx.save();
    ctx.strokeStyle = '#ffbe6b'; ctx.fillStyle = '#30231780'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, event.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff0ba'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, event.radius - 6, -Math.PI / 2, -Math.PI / 2 + event.progress * Math.PI * 2); ctx.stroke();
    if (event.type !== 'elite') {
      ctx.fillStyle = '#ffcc7a'; ctx.fillRect(p.x - 17, p.y - 10, 34, 20);
      ctx.fillStyle = '#17263a'; ctx.fillRect(p.x - 10, p.y - 6, 20, 8);
      ctx.fillStyle = '#fff4bb';
      if (event.type === 'transport') {
        ctx.fillRect(p.x - 27, p.y - 15, 12, 4); ctx.fillRect(p.x + 15, p.y - 15, 12, 4);
        ctx.fillRect(p.x - 27, p.y + 11, 12, 4); ctx.fillRect(p.x + 15, p.y + 11, 12, 4);
      } else ctx.fillRect(p.x - 4, p.y + 11, 8, 12);
    }
    ctx.fillStyle = '#ffe6b2'; ctx.font = '13px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${event.name} · ${Math.ceil(event.remaining)}s`, p.x, p.y - event.radius - 16);
    ctx.fillText(event.type === 'elite' ? '击败领取物资箱' : `${Math.floor(event.progress * 100)}% · 靠近完成`, p.x, p.y + event.radius + 22);
    ctx.restore();
  }
}
