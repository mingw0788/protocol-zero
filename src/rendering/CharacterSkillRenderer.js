export class CharacterSkillRenderer {
  render(context, camera, snapshot, feedback = {}) {
    const effect = snapshot?.expedition?.skill?.effect;
    if (!effect) return;
    const point = camera.worldToScreen(effect.x, effect.y);
    context.save(); context.strokeStyle = effect.color; context.lineWidth = feedback.reducedFlash ? 2 : 3;
    context.globalAlpha = feedback.reducedFlash ? .45 : .7;
    context.beginPath(); context.arc(point.x, point.y, effect.radius, 0, Math.PI * 2); context.stroke(); context.restore();
  }
}
