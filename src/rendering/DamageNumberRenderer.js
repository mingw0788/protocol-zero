export class DamageNumberRenderer {
  render(ctx, camera, snapshot) {
    if (snapshot?.feedback?.showDamageNumbers === false || !snapshot?.damageNumbers?.length) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, camera.viewportWidth, camera.viewportHeight); ctx.clip();
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
    for (const number of snapshot.damageNumbers) {
      const p = camera.worldToScreen(number.x, number.y);
      if (p.x < -30 || p.x > camera.viewportWidth + 30 || p.y < -30 || p.y > camera.viewportHeight + 60) continue;
      const color = number.kind === 'player' ? '#ff8c9c' : number.kind === 'shield' ? '#9ed7ff' : '#fff0be';
      const text = (number.kind === 'shield' ? '盾 ' : '') + Number(number.amount.toFixed(1));
      const y = p.y - 28 - number.age * 32 - (number.kind === 'shield' ? 15 : 0);
      ctx.globalAlpha = Math.min(1, number.remaining / .2);
      ctx.fillStyle = '#0a1522'; ctx.fillText(text, p.x + 1, y + 1);
      ctx.fillStyle = color; ctx.fillText(text, p.x, y);
    }
    ctx.restore();
  }
}
