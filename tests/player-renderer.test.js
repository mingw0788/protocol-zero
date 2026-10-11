import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { PlayerRenderer } from '../src/rendering/PlayerRenderer.js';

describe('PlayerRenderer', () => {
  it('draws the player placeholder at the camera-adjusted world position', () => {
    const fills = [];
    const context = {
      fillRect(...args) {
        fills.push(args);
      },
    };
    const camera = new Camera();
    const player = { x: 1200, y: 675, radius: 16 };
    const renderer = new PlayerRenderer();

    renderer.render(context, camera, player);

    expect(fills).toEqual([[624, 344, 32, 32]]);
  });
});
