export class EnemyAttackRenderer {
  render(ctx, camera, snapshot, enemies = []) {
    const attacks = snapshot?.hostileAttacks;
    if (!attacks) return;
    ctx.save();
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.behavior !== 'aura') continue;
      const p = camera.worldToScreen(enemy.x, enemy.y);
      ctx.strokeStyle = '#ffd07266'; ctx.fillStyle = '#ffcf680b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, enemy.auraRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe59d'; ctx.fillRect(p.x - 9, p.y - enemy.radius - 13, 18, 5);
    }
    for (const aim of attacks.aims) {
      const a = camera.worldToScreen(aim.x1, aim.y1), b = camera.worldToScreen(aim.x2, aim.y2);
      ctx.strokeStyle = '#ff729b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeRect(b.x - 9, b.y - 9, 18, 18);
    }
    for (const fuse of attacks.fuses) {
      const p = camera.worldToScreen(fuse.x, fuse.y);
      ctx.strokeStyle = '#ffa364'; ctx.fillStyle = '#f96b4140'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, fuse.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff0bd'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, fuse.radius - 5, -Math.PI / 2, -Math.PI / 2 + fuse.progress * Math.PI * 2); ctx.stroke();
    }
    for (const shot of attacks.projectiles) {
      const p = camera.worldToScreen(shot.x, shot.y);
      ctx.fillStyle = '#ff6687'; ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      ctx.fillStyle = '#fff1dc'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const explosion of attacks.explosions) {
      const p = camera.worldToScreen(explosion.x, explosion.y);
      ctx.strokeStyle = '#ffcf89'; ctx.lineWidth = 6; ctx.globalAlpha = Math.min(1, explosion.remaining / explosion.lifetime);
      ctx.beginPath(); ctx.arc(p.x, p.y, explosion.radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
