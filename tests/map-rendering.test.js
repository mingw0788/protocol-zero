import { describe, expect, it } from 'vitest';
import { Camera } from '../src/rendering/Camera.js';
import { CanvasRenderer } from '../src/rendering/CanvasRenderer.js';
import { MapRenderer } from '../src/rendering/MapRenderer.js';

function createRecordingContext() {
  const calls = {
    transforms: [],
    clears: [],
    fills: [],
    rects: [],
    translations: [],
    moveTos: [],
    lineTos: [],
    strokes: 0,
    strokeRects: [],
  };

  return {
    calls,
    setTransform(...args) {
      calls.transforms.push(args);
    },
    clearRect(...args) {
      calls.clears.push(args);
    },
    fillRect(...args) {
      calls.fills.push(args);
    },
    beginPath() {},
    rect(...args) {
      calls.rects.push(args);
    },
    clip() {},
    translate(...args) {
      calls.translations.push(args);
    },
    moveTo(...args) {
      calls.moveTos.push(args);
    },
    lineTo(...args) {
      calls.lineTos.push(args);
    },
    stroke() {
      calls.strokes += 1;
    },
    strokeRect(...args) {
      calls.strokeRects.push(args);
    },
    save() {},
    restore() {},
  };
}

function createCanvas(width, height) {
  const context = createRecordingContext();
  const canvas = {
    width: 300,
    height: 150,
    getContext(type) {
      return type === '2d' ? context : null;
    },
    getBoundingClientRect() {
      return { width, height };
    },
  };

  return { canvas, context };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      const eventListeners = listeners.get(type) ?? new Set();
      eventListeners.add(callback);
      listeners.set(type, eventListeners);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    dispatchEvent(type) {
      for (const callback of listeners.get(type) ?? []) callback({ type });
    },
  };
}

describe('MapRenderer', () => {
  it('draws a clipped finite map with grid lines and a visible boundary', () => {
    const context = createRecordingContext();
    const camera = new Camera();
    const renderer = new MapRenderer();

    renderer.render(context, camera);

    expect(context.calls.fills).toContainEqual([0, 0, 1280, 720]);
    expect(context.calls.fills).toContainEqual([0, 0, 2400, 1350]);
    expect(context.calls.rects).toContainEqual([0, 0, 1280, 720]);
    expect(context.calls.moveTos).toContainEqual([64, 0]);
    expect(context.calls.lineTos).toContainEqual([64, 1350]);
    expect(context.calls.strokeRects).toContainEqual([0, 0, 2400, 1350]);
    expect(context.calls.translations).toContainEqual([-560, -315]);
  });
});

describe('CanvasRenderer', () => {
  it('uses device pixels while preserving logical aspect ratio with letterboxing', () => {
    const { canvas, context } = createCanvas(800, 500);
    const renderer = new CanvasRenderer({
      canvas,
      camera: new Camera(),
      mapRenderer: new MapRenderer(),
      devicePixelRatio: () => 2,
    });

    renderer.render();

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1000);
    expect(context.calls.transforms.at(-1)).toEqual([1.25, 0, 0, 1.25, 0, 50]);
    expect(context.calls.clears.at(-1)).toEqual([0, 0, 1600, 1000]);
  });

  it('resizes the backing canvas and notices a device-pixel-ratio change', () => {
    const { canvas } = createCanvas(640, 360);
    const windowTarget = createEventTarget();
    let devicePixelRatio = 2;
    const renderer = new CanvasRenderer({
      canvas,
      camera: new Camera(),
      mapRenderer: new MapRenderer(),
      windowTarget,
      devicePixelRatio: () => devicePixelRatio,
    });

    renderer.start();
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);

    canvas.getBoundingClientRect = () => ({ width: 800, height: 450 });
    windowTarget.dispatchEvent('resize');
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);

    devicePixelRatio = 1;
    renderer.render();
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(450);

    renderer.stop();
  });
});
