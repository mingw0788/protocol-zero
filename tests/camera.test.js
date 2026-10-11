import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';

describe('Camera', () => {
  it('starts centered on the configured finite map', () => {
    const camera = new Camera();

    expect(camera.x).toBe(560);
    expect(camera.y).toBe(315);
  });

  it('follows a target while clamping to all four map edges', () => {
    const camera = new Camera();
    const target = { x: 20, y: 20 };

    camera.follow(target);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);

    target.x = 1200;
    target.y = 675;
    camera.update();
    expect(camera.x).toBe(560);
    expect(camera.y).toBe(315);

    target.x = 2380;
    target.y = 1330;
    camera.update();
    expect(camera.x).toBe(1120);
    expect(camera.y).toBe(630);
  });

  it('converts between world and screen coordinates without changing positions', () => {
    const camera = new Camera();
    camera.follow({ x: 1200, y: 675 });

    const screenPoint = camera.worldToScreen(600, 400);
    expect(screenPoint).toEqual({ x: 40, y: 85 });
    expect(camera.screenToWorld(screenPoint.x, screenPoint.y)).toEqual({ x: 600, y: 400 });
  });

  it('centers a map that is smaller than its viewport', () => {
    const camera = new Camera({
      worldWidth: 640,
      worldHeight: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    expect(camera.x).toBe(-320);
    expect(camera.y).toBe(-180);
  });

  it('recenters and reclamps after the logical viewport changes', () => {
    const camera = new Camera();
    camera.follow({ x: 1200, y: 675 });

    camera.setViewport(1600, 900);

    expect(camera.x).toBe(400);
    expect(camera.y).toBe(225);
  });
});
