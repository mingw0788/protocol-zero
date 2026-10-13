import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { PlayerRenderer } from '../src/rendering/PlayerRenderer.js';
import { SPRITE_PATTERNS } from '../src/rendering/spritePatterns.js';

describe('PlayerRenderer', () => {
  it('draws a bounded pixel sprite at the camera-adjusted world position', () => {
    const fills = [];
    const context = {
      fillStyle: '',
      fillRect(...args) {
        fills.push({ color: this.fillStyle, rect: args });
      },
    };
    const camera = new Camera();
    const player = { x: 1200, y: 675, radius: 16 };
    const renderer = new PlayerRenderer();

    renderer.render(context, camera, player);

    expect(fills.length).toBeGreaterThan(1);
    expect(fills.every(({ rect: [x, y, width, height] }) =>
      x >= 624 && y >= 344 && x + width <= 656 && y + height <= 376)).toBe(true);
    expect(SPRITE_PATTERNS.player).toBeDefined();
  });

  it('uses effective time for a two-frame idle animation and flashes while hurt', () => {
    const render = (time, hurt = 0) => {
      const fills = [];
      const context = { fillStyle: '', fillRect(...rect) { fills.push([this.fillStyle, ...rect]); } };
      new PlayerRenderer().render(context, new Camera(), {
        x: 1200, y: 675, radius: 16, invulnerabilityRemaining: hurt,
      }, time);
      return fills;
    };

    expect(render(0)).not.toEqual(render(0.2));
    expect(render(0, 0.04)).not.toEqual(render(0, 0.12));
  });

  it('shows the pulse gun and each unlocked weapon as distinct player-mounted modules', () => {
    const fills = [];
    const context = {
      fillStyle: '', lineWidth: 1, strokeStyle: '',
      fillRect(...rect) { fills.push([this.fillStyle, ...rect]); },
      save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, arc() {}, stroke() {},
    };
    new PlayerRenderer().render(context, new Camera(), {
      x: 1200, y: 675, radius: 16, facingX: 1, facingY: 0,
      weaponStates: [{ id: 'pulse-gun' }, { id: 'arc-coil' }, { id: 'railgun' }],
    });
    const colors = fills.map(([color]) => color);
    expect(colors).toContain('#65e8ff');
    expect(colors).toContain('#b891ff');
    expect(colors).toContain('#ffc65e');
  });
});
