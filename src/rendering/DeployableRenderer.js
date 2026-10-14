export class DeployableRenderer {
  render(ctx, camera, snapshot) {
    const data = snapshot?.deployables;
    if (!data) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, camera.viewportWidth, camera.viewportHeight); ctx.clip();
    ctx.textAlign = 'center'; ctx.font = '12px "Microsoft YaHei", sans-serif';
    for (const field of data.healingFields) {
      const p = camera.worldToScreen(field.x, field.y);
      ctx.fillStyle = '#82efb1'; ctx.globalAlpha = .08;
      ctx.beginPath(); ctx.arc(p.x, p.y, field.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .8; ctx.strokeStyle = '#82efb1'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillRect(p.x - 3, p.y - 13, 6, 26); ctx.fillRect(p.x - 13, p.y - 3, 26, 6);
      ctx.fillText(`维修场 ${Math.ceil(field.remaining)}s`, p.x, p.y + field.radius + 17);
    }
    ctx.globalAlpha = 1;
    for (const turret of data.turrets) {
      const p = camera.worldToScreen(turret.x, turret.y);
      ctx.fillStyle = '#263e48'; ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
      ctx.strokeStyle = '#e2c590'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 14, p.y - 14, 28, 28);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(turret.aimAngle);
      ctx.fillStyle = '#e2c590'; ctx.fillRect(-6, -5, 22, 10); ctx.restore();
      ctx.fillStyle = '#ffe2ab'; ctx.fillText(`炮台 ${Math.ceil(turret.remaining)}s`, p.x, p.y + 30);
    }
    for (const beam of data.beams) {
      const a = camera.worldToScreen(beam.x1, beam.y1), b = camera.worldToScreen(beam.x2, beam.y2);
      ctx.strokeStyle = '#ffe2ab'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (data.pulse) {
      const pulse = data.pulse, p = camera.worldToScreen(pulse.x, pulse.y);
      ctx.strokeStyle = '#8af5f6'; ctx.lineWidth = 4; ctx.globalAlpha = pulse.remaining / pulse.lifetime;
      ctx.beginPath(); ctx.arc(p.x, p.y, pulse.radius * (1 - pulse.remaining / pulse.lifetime), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
