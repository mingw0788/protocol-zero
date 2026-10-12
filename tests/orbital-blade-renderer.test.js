import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { OrbitalBladeRenderer } from '../src/rendering/OrbitalBladeRenderer.js';

function createContext() {
  const fills = [];
  const rotations = [];
  const translations = [];
  return {
    fills,
    rotations,
    translations,
    save() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate(x, y) { translations.push([x, y]); },
    rotate(angle) { rotations.push(angle); },
    fillRect(...rect) { fills.push({ color: this.fillStyle, rect }); },
    restore() {},
  };
}

describe('OrbitalBladeRenderer', () => {
  it('draws an active visible snapshot as a rotated world-to-screen diamond', () => {
    const camera = new Camera();
    const context = createContext();
    const snapshot = Object.freeze({
      active: true,
      level: 1,
      x: camera.x + 100,
      y: camera.y + 120,
      radius: 8,
      angleRadians: Math.PI / 4,
      color: '#d66dff',
    });

    new OrbitalBladeRenderer().render(context, camera, snapshot);

    expect(context.translations).toEqual([[100, 120]]);
    expect(context.rotations[0]).toBeCloseTo(Math.PI / 2, 12);
    expect(context.fills).toEqual([
      { color: '#d66dff', rect: [-8, -8, 16, 16] },
      { color: '#f4dcff', rect: [-4, -4, 8, 8] },
    ]);
  });

  it('skips locked and fully offscreen snapshots', () => {
    const camera = new Camera();
    const context = createContext();
    const renderer = new OrbitalBladeRenderer();

    renderer.render(context, camera, { active: false });
    renderer.render(context, camera, {
      active: true,
      level: 1,
      x: camera.x - 40,
      y: camera.y + 100,
      radius: 8,
      angleRadians: 0,
      color: '#d66dff',
    });

    expect(context.fills).toEqual([]);
  });

  it('draws a partially visible rotated diamond at the viewport edge', () => {
    const camera = new Camera();
    const context = createContext();
    const renderer = new OrbitalBladeRenderer();

    const drawn = renderer.render(context, camera, {
      active: true,
      level: 1,
      x: camera.x - 9,
      y: camera.y + 100,
      radius: 8,
      angleRadians: 0,
      color: '#d66dff',
    });

    expect(drawn).toBe(true);
    expect(context.fills).toHaveLength(2);
  });
});
