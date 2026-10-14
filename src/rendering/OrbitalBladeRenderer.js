export class OrbitalBladeRenderer {
  render(context, camera, snapshot = null) {
    if (snapshot?.active !== true) return false;
    if (!context || ![
      'save', 'beginPath', 'rect', 'clip', 'translate', 'rotate', 'fillRect', 'restore',
    ].every((method) => typeof context[method] === 'function')) {
      throw new TypeError('OrbitalBladeRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('OrbitalBladeRenderer requires a camera with a logical viewport');
    }
    if (!Number.isFinite(snapshot.x) || !Number.isFinite(snapshot.y)
      || !Number.isFinite(snapshot.radius) || snapshot.radius <= 0
      || !Number.isFinite(snapshot.angleRadians)
      || !Number.isSafeInteger(snapshot.level) || snapshot.level < 1
      || typeof snapshot.color !== 'string' || snapshot.color.trim().length === 0) {
      return false;
    }

    if (snapshot.sweepRemaining > 0) {
      const center = camera.worldToScreen(snapshot.playerX, snapshot.playerY);
      context.save();
      context.beginPath(); context.rect(0, 0, camera.viewportWidth, camera.viewportHeight); context.clip();
      context.globalAlpha = .6 * snapshot.sweepRemaining / snapshot.sweepLifetime;
      context.strokeStyle = '#ffcf7c'; context.lineWidth = 5;
      context.beginPath(); context.arc(center.x, center.y, snapshot.sweepRadius, 0, Math.PI * 2); context.stroke();
      context.restore();
    }
    const position = camera.worldToScreen(snapshot.x, snapshot.y);
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return false;
    const boundsRadius = snapshot.radius * Math.SQRT2;
    if (!Number.isFinite(boundsRadius)) return false;
    if (position.x + boundsRadius <= 0 || position.y + boundsRadius <= 0
      || position.x - boundsRadius >= camera.viewportWidth
      || position.y - boundsRadius >= camera.viewportHeight) {
      return false;
    }

    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();
    context.translate(position.x, position.y);
    context.rotate(snapshot.angleRadians + Math.PI / 4);
    context.fillStyle = snapshot.color;
    context.fillRect(-snapshot.radius, -snapshot.radius, snapshot.radius * 2, snapshot.radius * 2);
    context.fillStyle = '#f4dcff';
    context.fillRect(-snapshot.radius / 2, -snapshot.radius / 2, snapshot.radius, snapshot.radius);
    context.restore();
    return true;
  }
}
