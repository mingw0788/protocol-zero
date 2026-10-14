export class AdvancedWeaponRenderer {
  render(ctx, camera, snapshot) {
    if (!snapshot) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, camera.viewportWidth, camera.viewportHeight); ctx.clip();
    for (const field of snapshot.railFields ?? []) {
      const a = camera.worldToScreen(field.x1, field.y1), b = camera.worldToScreen(field.x2, field.y2);
      ctx.strokeStyle = '#e9a456'; ctx.lineWidth = 32; ctx.globalAlpha = .14 * field.remaining / 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = .65; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    for (const cone of snapshot.cryo ?? []) {
      const a = camera.worldToScreen(cone.x1, cone.y1), b = camera.worldToScreen(cone.x2, cone.y2);
      const angle = Math.atan2(b.y - a.y, b.x - a.x), range = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.globalAlpha = .16; ctx.fillStyle = cone.color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, range, angle - cone.halfAngle, angle + cone.halfAngle); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .8; ctx.strokeStyle = cone.color; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 1; i <= 5; i++) {
        const direction = angle + cone.halfAngle * (i / 3 - 1), distance = range * (.3 + i * .1);
        ctx.fillRect(a.x + Math.cos(direction) * distance, a.y + Math.sin(direction) * distance, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    for (const drone of snapshot.drones?.drones ?? []) {
      const p = camera.worldToScreen(drone.x, drone.y);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(drone.aimAngle);
      ctx.fillStyle = '#2e4938'; ctx.fillRect(-8, -7, 16, 14);
      ctx.fillStyle = '#b4f09c'; ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#eaffd9'; ctx.fillRect(3, -2, 8, 4);
      ctx.fillStyle = '#76bb8b'; ctx.fillRect(-7, -10, 5, 3); ctx.fillRect(-7, 7, 5, 3); ctx.restore();
    }
    ctx.fillStyle = '#d0ffc0';
    for (const bolt of snapshot.drones?.bolts ?? []) {
      const p = camera.worldToScreen(bolt.x, bolt.y); ctx.fillRect(p.x - bolt.radius, p.y - bolt.radius, bolt.radius * 2, bolt.radius * 2);
    }
    ctx.restore();
  }
}
