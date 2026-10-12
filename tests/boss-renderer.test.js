import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { BossRenderer } from '../src/rendering/BossRenderer.js';

function createContext(events = []) {
  const strokes = [];
  const fills = [];
  let dash = [];
  return {
    strokes,
    fills,
    save() { events.push('save'); },
    beginPath() { events.push('beginPath'); },
    rect(...args) { events.push(['clipRect', ...args]); },
    clip() { events.push('clip'); },
    moveTo(...args) { events.push(['moveTo', ...args]); },
    lineTo(...args) { events.push(['lineTo', ...args]); },
    stroke() {
      strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth, cap: this.lineCap, dash });
      events.push('warning');
    },
    fillRect(...rect) { fills.push({ color: this.fillStyle, rect }); },
    setLineDash(value) { dash = value; },
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
    expect(context.strokes).toEqual([{ color: '#ff4169', alpha: 0.23, width: 112, cap: 'butt', dash: [24, 16] }]);
    expect(context.fills).toHaveLength(0);
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

  it('draws an alive Boss as a type-specific sprite within its collision diameter', () => {
    const camera = new Camera();
    const context = createContext();
    new BossRenderer().render(context, camera, snapshot({ phase: 'approach' }));
    expect(context.fills.length).toBeGreaterThan(1);
    expect(context.fills.every(({ rect: [x, y, width, height] }) =>
      x >= 195.999 && y >= 40.999 && x + width <= 284.001 && y + height <= 129.001)).toBe(true);
  });

  it('pulses the segmented telegraph using effective time', () => {
    const camera = new Camera();
    const atStart = createContext();
    const later = createContext();
    const renderer = new BossRenderer();
    renderer.render(atStart, camera, snapshot(), 0);
    renderer.render(later, camera, snapshot(), 0.1);
    expect(atStart.strokes[0].dash).toEqual([24, 16]);
    expect(later.strokes[0].dash).toEqual([24, 16]);
    expect(later.strokes[0].alpha).not.toBe(atStart.strokes[0].alpha);
  });
});
