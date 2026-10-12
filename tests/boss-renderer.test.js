import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { BossRenderer } from '../src/rendering/BossRenderer.js';

function createContext(events = []) {
  const strokes = [];
  return {
    strokes,
    save() { events.push('save'); },
    beginPath() { events.push('beginPath'); },
    rect(...args) { events.push(['clipRect', ...args]); },
    clip() { events.push('clip'); },
    moveTo(...args) { events.push(['moveTo', ...args]); },
    lineTo(...args) { events.push(['lineTo', ...args]); },
    stroke() {
      strokes.push({ color: this.strokeStyle, width: this.lineWidth, cap: this.lineCap });
      events.push('warning');
    },
    restore() { events.push('restore'); },
  };
}

function snapshot(overrides = {}) {
  return Object.freeze({
    id: 'boss-t01', typeId: 'BOSS-01', x: 800, y: 400, radius: 44,
    alive: true, phase: 'telegraph', phaseRemaining: 0.8,
    chargeDirection: Object.freeze({ x: 1, y: 0 }),
    chargeEnd: Object.freeze({ x: 1200, y: 400 }),
    ...overrides,
  });
}

describe('BossRenderer', () => {
  it('draws no warning before a charge telegraph', () => {
    const camera = new Camera();
    const context = createContext();
    const renderer = new BossRenderer();

    expect(renderer.render(context, camera, null)).toBe(false);
    expect(renderer.render(context, camera, snapshot({ phase: 'approach' }))).toBe(false);
    expect(context.strokes).toEqual([]);
  });

  it('clips the locked warning lane to the viewport with Boss diameter plus padding', () => {
    const camera = new Camera();
    const events = [];
    const context = createContext(events);
    const warning = snapshot({
      x: camera.x - 100,
      y: camera.y + 120,
      chargeDirection: Object.freeze({ x: 1, y: 0 }),
      chargeEnd: Object.freeze({ x: camera.x + 200, y: camera.y + 120 }),
    });

    expect(new BossRenderer().render(context, camera, warning)).toBe(true);

    expect(events).toContainEqual(['clipRect', 0, 0, 1280, 720]);
    expect(events).toContainEqual(['moveTo', -100, 120]);
    expect(events).toContainEqual(['lineTo', 200, 120]);
    expect(context.strokes).toEqual([{ color: 'rgba(255, 65, 105, 0.28)', width: 112, cap: 'butt' }]);
    expect(events.indexOf('clip')).toBeLessThan(events.indexOf('warning'));
    expect(events.at(-1)).toBe('restore');
  });

  it('keeps the same locked lane visible while charging and ignores defeated bosses', () => {
    const camera = new Camera();
    const context = createContext();
    const renderer = new BossRenderer();

    expect(renderer.render(context, camera, snapshot({ phase: 'charging' }))).toBe(true);
    expect(renderer.render(context, camera, snapshot({ alive: false }))).toBe(false);
    expect(context.strokes).toHaveLength(1);
  });
});
