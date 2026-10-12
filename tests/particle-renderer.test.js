import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { ParticleRenderer } from '../src/rendering/ParticleRenderer.js';

function createContext(events = []) {
  const fills = [];
  return {
    fills,
    globalAlpha: 1,
    save() { events.push('save'); },
    beginPath() {},
    rect(...rect) { events.push(['clipRect', ...rect]); },
    clip() { events.push('clip'); },
    fillRect(...rect) { fills.push({ alpha: this.globalAlpha, color: this.fillStyle, rect }); },
    restore() { events.push('restore'); },
  };
}

describe('ParticleRenderer', () => {
  it('draws fading squares inside the clipped camera viewport', () => {
    const camera = new Camera();
    const events = [];
    const context = createContext(events);
    new ParticleRenderer().render(context, camera, [
      { id: 'visible', x: camera.x + 100, y: camera.y + 100, radius: 2, color: '#ffffff', lifetimeSeconds: 0.45, remainingSeconds: 0.225 },
      { id: 'outside', x: camera.x - 20, y: camera.y + 100, radius: 2, color: '#ffffff', lifetimeSeconds: 0.45, remainingSeconds: 0.4 },
    ]);
    expect(events).toContainEqual(['clipRect', 0, 0, 1280, 720]);
    expect(context.fills).toEqual([{ alpha: 0.5, color: '#ffffff', rect: [98, 98, 4, 4] }]);
    expect(events.at(-1)).toBe('restore');
  });

  it('skips expired or invalid snapshots and accepts an empty collection', () => {
    const context = createContext();
    const renderer = new ParticleRenderer();
    renderer.render(context, new Camera(), [
      { x: 10, y: 10, radius: 2, color: '#fff', lifetimeSeconds: 0.45, remainingSeconds: 0 },
      { x: 10, y: 10, radius: -1, color: '#fff', lifetimeSeconds: 0.45, remainingSeconds: 0.2 },
    ]);
    renderer.render(context, new Camera(), []);
    expect(context.fills).toEqual([]);
  });
});
