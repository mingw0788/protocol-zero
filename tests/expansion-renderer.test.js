import { describe, expect, it, vi } from 'vitest';
import { ExpansionRenderer } from '../src/rendering/ExpansionRenderer.js';
import { Camera } from '../src/rendering/Camera.js';

function context() {
  return Object.fromEntries(['save', 'restore', 'beginPath', 'rect', 'clip', 'arc', 'stroke',
    'fill', 'fillRect', 'strokeRect', 'moveTo', 'lineTo', 'fillText'].map((name) => [name, vi.fn()]));
}

describe('ExpansionRenderer', () => {
  it('does no drawing without expansion data', () => {
    const ctx = context();
    new ExpansionRenderer().render(ctx, new Camera());
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('clips world art, distinguishes capsules and draws beams without modifying snapshots', () => {
    const ctx = context();
    const snapshot = { supply: { station: { x: 1200, y: 675, radius: 56, progress: 0.5 },
      pickups: ['overclock', 'decoy', 'scanner'].map((type, i) => ({ type, x: 1200 + i * 40, y: 750 })),
      decoy: { x: 1200, y: 800, radius: 420 } },
    arc: [{ x1: 1200, y1: 675, x2: 1300, y2: 675, color: '#a796ff' }],
    rail: [{ x1: 1200, y1: 675, x2: 2000, y2: 675, color: '#ffcc77' }] };
    const before = JSON.stringify(snapshot);
    new ExpansionRenderer().render(ctx, new Camera(), snapshot);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(ctx.clip).toHaveBeenCalledOnce();
    expect(ctx.fillText.mock.calls.flat()).toEqual(expect.arrayContaining(['站入蓄能', '+', '◎', '⌖']));
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(2);
    expect(ctx.restore).toHaveBeenCalledOnce();
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('keeps offscreen station hints inside the viewport and omits offscreen capsules', () => {
    const ctx = context();
    new ExpansionRenderer().render(ctx, new Camera(), { supply: {
      station: { x: 0, y: 0, radius: 56, progress: 0 }, pickups: [{ x: -1000, y: -1000, type: 'overclock' }],
    }, arc: [], rail: [] });
    const hint = ctx.fillText.mock.calls.find(([text]) => text.includes('补给'));
    expect(hint).toBeDefined();
    expect(hint[1]).toBeGreaterThanOrEqual(70);
    expect(hint[2]).toBeGreaterThanOrEqual(140);
    expect(ctx.fillText.mock.calls.some(([text]) => text === '+')).toBe(false);
  });
});
