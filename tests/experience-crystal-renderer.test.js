import { describe, expect, it } from 'vitest';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Camera } from '../src/rendering/Camera.js';

async function loadExperienceCrystalRenderer() {
  const module = await import('../src/rendering/ExperienceCrystalRenderer.js').catch(() => undefined);
  expect(module, 'experience crystal renderer module exists').toBeDefined();
  return module.ExperienceCrystalRenderer;
}

function createContext(events = []) {
  const fills = [];
  return {
    fills,
    save() { events.push('save'); },
    beginPath() { events.push('beginPath'); },
    rect(...args) { events.push(['clipRect', ...args]); },
    clip() { events.push('clip'); },
    fillRect(...args) {
      fills.push({ color: this.fillStyle, rect: args });
      events.push('crystal');
    },
    restore() { events.push('restore'); },
  };
}

function makeCrystal(id, x, y) {
  return new ExperienceCrystal({ id, x, y, expValue: 1 });
}

describe('ExperienceCrystalRenderer', () => {
  it('draws active crystals in camera coordinates without mutating them', async () => {
    const ExperienceCrystalRenderer = await loadExperienceCrystalRenderer();
    const camera = new Camera();
    const context = createContext();
    const visible = makeCrystal('visible-crystal', camera.x + 100, camera.y + 120);
    const inactive = makeCrystal('inactive-crystal', camera.x + 200, camera.y + 120);
    inactive.active = false;
    const crystals = [visible, inactive];
    const before = crystals.map((crystal) => ({ ...crystal }));

    new ExperienceCrystalRenderer().render(context, camera, crystals);

    expect(context.fills).toEqual([{
      color: '#ffbf47',
      rect: [96, 116, 8, 8],
    }]);
    expect(crystals).toEqual(before);
  });

  it('clips partial crystals and culls offscreen or inactive crystals', async () => {
    const ExperienceCrystalRenderer = await loadExperienceCrystalRenderer();
    const camera = new Camera();
    const events = [];
    const context = createContext(events);
    const partial = makeCrystal('partial-crystal', camera.x - 2, camera.y + 100);
    const outside = makeCrystal('outside-crystal', camera.x - 10, camera.y + 100);
    const inactive = makeCrystal('inactive-crystal', camera.x + 100, camera.y + 100);
    inactive.active = false;

    new ExperienceCrystalRenderer().render(context, camera, [partial, outside, inactive]);

    expect(events).toContainEqual(['clipRect', 0, 0, 1280, 720]);
    expect(events.indexOf('clip')).toBeLessThan(events.indexOf('crystal'));
    expect(context.fills).toEqual([{
      color: '#ffbf47',
      rect: [-6, 96, 8, 8],
    }]);
    expect(events.at(-1)).toBe('restore');
  });
});
