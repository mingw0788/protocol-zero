export class ParticleRenderer {
  render(context, camera, particles = [], feedback = {}) {
    if (!Array.isArray(particles)) throw new TypeError('ParticleRenderer requires a particle array');
    if (!context || typeof context.fillRect !== 'function'
      || typeof context.save !== 'function' || typeof context.restore !== 'function') {
      throw new TypeError('ParticleRenderer requires a Canvas 2D context');
    }
    if (!camera || typeof camera.worldToScreen !== 'function'
      || !Number.isFinite(camera.viewportWidth) || camera.viewportWidth <= 0
      || !Number.isFinite(camera.viewportHeight) || camera.viewportHeight <= 0) {
      throw new TypeError('ParticleRenderer requires a camera with a logical viewport');
    }
    if (particles.length === 0) return;

    context.save();
    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();
    for (const particle of particles) {
      if (!Number.isFinite(particle?.x) || !Number.isFinite(particle?.y)
        || !Number.isFinite(particle.radius) || particle.radius <= 0
        || !Number.isFinite(particle.lifetimeSeconds) || particle.lifetimeSeconds <= 0
        || !Number.isFinite(particle.remainingSeconds) || particle.remainingSeconds <= 0
        || typeof particle.color !== 'string') continue;
      const position = camera.worldToScreen(particle.x, particle.y);
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) continue;
      const diameter = particle.radius * 2;
      const x = position.x - particle.radius;
      const y = position.y - particle.radius;
      if (x + diameter <= 0 || y + diameter <= 0
        || x >= camera.viewportWidth || y >= camera.viewportHeight) continue;
      context.globalAlpha = Math.max(0, Math.min(1, particle.remainingSeconds / particle.lifetimeSeconds)) * (feedback.reducedFlash ? .3 : 1);
      context.fillStyle = particle.color;
      context.fillRect(x, y, diameter, diameter);
    }
    context.restore();
  }
}
