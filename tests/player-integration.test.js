import { describe, expect, it } from 'vitest';
import { GameLoop } from '../src/core/GameLoop.js';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { InputController } from '../src/input/InputController.js';
import { Camera } from '../src/rendering/Camera.js';

function createEventTarget(properties = {}) {
  const listeners = new Map();

  return {
    ...properties,
    addEventListener(type, listener) {
      const eventListeners = listeners.get(type) ?? new Set();
      eventListeners.add(listener);
      listeners.set(type, eventListeners);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener({ type, code: '', ...event });
    },
  };
}

function createAnimationFrameHarness() {
  let nextHandle = 0;
  const callbacks = new Map();

  return {
    requestAnimationFrame(callback) {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) {
      callbacks.delete(handle);
    },
    frame(timestamp) {
      const pendingCallbacks = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pendingCallbacks) callback(timestamp);
    },
  };
}

function runRightwardForOneSecondAt(framesPerSecond) {
  const stateManager = new GameStateManager();
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget({ hidden: false });
  const inputController = new InputController({ stateManager, windowTarget, documentTarget });
  const world = new GameWorld({ stateManager, inputController, camera: new Camera() });
  const animationFrame = createAnimationFrameHarness();
  const loop = new GameLoop({
    stateManager,
    world,
    requestAnimationFrame: animationFrame.requestAnimationFrame,
    cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    windowTarget,
    documentTarget,
  });

  inputController.start();
  stateManager.startGame();
  windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
  loop.start();
  animationFrame.frame(0);
  for (let frame = 1; frame <= framesPerSecond; frame += 1) {
    animationFrame.frame((frame * 1000) / framesPerSecond);
  }
  loop.stop();
  inputController.stop();

  return world.player.x - 1200;
}

describe('player movement in the game loop', () => {
  it('moves only while playing and clears input before manual resume', () => {
    const stateManager = new GameStateManager();
    const windowTarget = createEventTarget();
    const documentTarget = createEventTarget({ hidden: false });
    const inputController = new InputController({ stateManager, windowTarget, documentTarget });
    const world = new GameWorld({ stateManager, inputController, camera: new Camera() });
    inputController.start();
    stateManager.startGame();

    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    world.update(1 / 60);
    const movedX = world.player.x;
    stateManager.pause();
    stateManager.resume();
    world.update(1 / 60);

    expect(movedX).toBeGreaterThan(1200);
    expect(world.player.x).toBe(movedX);
    inputController.stop();
  });

  it.each([30, 60, 120])('travels the same distance at %i rendered frames per second', (rate) => {
    expect(runRightwardForOneSecondAt(rate)).toBeCloseTo(220, 7);
  });
});
