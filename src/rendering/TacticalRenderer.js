import { SUPPLY_NAMES } from '../config/supplyConfig.js';

export class TacticalRenderer {
  renderWorld(ctx, camera, snapshot) {
    if (!snapshot?.exploration) return;
    ctx.save();
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    for (const t of snapshot.exploration.terminals) {
      const p = camera.worldToScreen(t.x, t.y);
      if (p.x < -120 || p.y < -120 || p.x > camera.viewportWidth + 120 || p.y > camera.viewportHeight + 120) continue;
      ctx.fillStyle = t.completed ? '#152c30' : '#281d40';
      ctx.strokeStyle = t.completed ? '#5a8a83' : '#c5a0ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, t.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, t.radius - 7, -Math.PI / 2, -Math.PI / 2 + t.progress * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = t.completed ? '#5a8a83' : '#c5a0ff';
      ctx.fillRect(p.x - 15, p.y - 19, 30, 34);
      ctx.fillStyle = '#10152d'; ctx.fillRect(p.x - 10, p.y - 14, 20, 18);
      ctx.fillStyle = t.completed ? '#78bda4' : '#fff0c3'; ctx.fillRect(p.x - 7, p.y - 9, 14, 3);
      ctx.fillRect(p.x - 5, p.y + 17, 10, 5);
      ctx.fillStyle = t.completed ? '#86b1a4' : '#ebd9ff';
      ctx.fillText(t.name, p.x, p.y - 66);
      ctx.fillText(t.completed ? '档案已上传' : `连续站入 ${t.channelSeconds} 秒 · +${t.experienceReward} 经验 / ${SUPPLY_NAMES[t.reward]}`, p.x, p.y + 73);
    }
    ctx.restore();
  }

  renderOverlay(ctx, camera, snapshot, player) {
    if (!snapshot?.exploration || !player) return;
    ctx.save();
    const p = camera.worldToScreen(player.x, player.y);
    if (snapshot.shield > 0) {
      ctx.strokeStyle = '#83caff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, player.radius + 10, 0, Math.PI * 2); ctx.stroke();
    }
    if (snapshot.dash.remaining > 0) {
      ctx.fillStyle = '#9deaff';
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = .45 / i;
        ctx.fillRect(p.x - player.facingX * i * 15 - 10, p.y - player.facingY * i * 15 - 10, 20, 20);
      }
      ctx.globalAlpha = 1;
    }
    this.#renderMinimap(ctx, camera, snapshot, player);
    ctx.restore();
  }

  #renderMinimap(ctx, camera, snapshot, player) {
    const width = 196, height = 110;
    const x = camera.viewportWidth - width - 18, y = camera.viewportHeight - height - 102;
    const sx = width / camera.worldWidth, sy = height / camera.worldHeight;
    ctx.fillStyle = '#091728ee'; ctx.fillRect(x - 8, y - 26, width + 16, height + 52);
    ctx.strokeStyle = '#375c76'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
    ctx.font = '11px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#aac7d5'; ctx.fillText('区域雷达', x, y - 10);
    ctx.fillStyle = '#c5a0ff'; ctx.fillText('紫 · 档案', x, y + height + 17);
    ctx.fillStyle = '#ffd277'; ctx.fillText('金 · 补给', x + 73, y + height + 17);
    ctx.fillStyle = '#64dfde'; ctx.fillText('青 · 中继', x + 140, y + height + 17);
    ctx.strokeStyle = '#355064';
    ctx.strokeRect(x + camera.x * sx, y + camera.y * sy, camera.viewportWidth * sx, camera.viewportHeight * sy);
    const dot = (point, color, size = 4) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + point.x * sx - size / 2, y + point.y * sy - size / 2, size, size);
    };
    for (const t of snapshot.exploration.terminals) dot(t, t.completed ? '#4c646a' : '#c5a0ff', 6);
    for (const t of snapshot.relays ?? []) dot(t, t.energy >= 100 ? '#64dfde' : '#ae7951', 5);
    for (const item of snapshot.supply.pickups) dot(item, '#ffd277');
    if (snapshot.supply.station) dot(snapshot.supply.station, '#9dffac', 7);
    dot(player, '#ffffff', 6);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + player.x * sx, y + player.y * sy);
    ctx.lineTo(x + player.x * sx + player.facingX * 10, y + player.y * sy + player.facingY * 10);
    ctx.stroke();
  }
}
