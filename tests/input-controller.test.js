import { describe, expect, it } from 'vitest';
import { InputController } from '../src/input/InputController.js';
import { GameStateManager } from '../src/core/GameStateManager.js';

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
      for (const listener of listeners.get(type) ?? []) {
        listener({ type, code: '', preventDefault() {}, ...event });
      }
    },
  };
}

function createController() {
  const stateManager = new GameStateManager();
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget({ hidden: false });
  const controller = new InputController({ stateManager, windowTarget, documentTarget });

  return { controller, documentTarget, stateManager, windowTarget };
}

describe('InputController', () => {
  it('consumes E once per press and clears pending actions on pause and blur', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE', repeat: true });
    expect(controller.consumeItemUsePress()).toBe(true);
    expect(controller.consumeItemUsePress()).toBe(false);
    windowTarget.dispatchEvent('keyup', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    stateManager.pause();
    expect(controller.consumeItemUsePress()).toBe(false);
    stateManager.resume();
    windowTarget.dispatchEvent('keydown', { code: 'KeyE', repeat: true });
    expect(controller.consumeItemUsePress()).toBe(false);
    windowTarget.dispatchEvent('keyup', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    windowTarget.dispatchEvent('blur');
    expect(controller.consumeItemUsePress()).toBe(false);
    controller.stop();
  });
  it('maps WASD and arrow keys to a movement vector and releases individual keys', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();

    windowTarget.dispatchEvent('keydown', { code: 'KeyW' });
    windowTarget.dispatchEvent('keydown', { code: 'ArrowRight' });
    expect(controller.getMovementVector()).toEqual({ x: 1, y: -1 });

    windowTarget.dispatchEvent('keyup', { code: 'KeyW' });
    expect(controller.getMovementVector()).toEqual({ x: 1, y: 0 });

    windowTarget.dispatchEvent('keyup', { code: 'ArrowRight' });
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });
    controller.stop();
  });

  it('clears held keys on blur, hidden tab, and pause', () => {
    const { controller, documentTarget, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();

    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    windowTarget.dispatchEvent('blur');
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });

    windowTarget.dispatchEvent('keydown', { code: 'KeyA' });
    documentTarget.hidden = true;
    documentTarget.dispatchEvent('visibilitychange');
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });

    documentTarget.hidden = false;
    stateManager.resume();
    windowTarget.dispatchEvent('keydown', { code: 'KeyS' });
    stateManager.pause();
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });
    controller.stop();
  });

  it('ignores movement keys while the game is not playing and removes listeners on stop', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();

    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });

    stateManager.startGame();
    controller.stop();
    windowTarget.dispatchEvent('keydown', { code: 'KeyD' });
    expect(controller.getMovementVector()).toEqual({ x: 0, y: 0 });
  });
});
