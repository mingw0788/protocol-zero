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
  it('consumes E and Q once per press, and clears item actions on pause and blur', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE', repeat: true });
    expect(controller.consumeItemUsePress()).toEqual({ slot: 0 });
    expect(controller.consumeItemUsePress()).toBeNull();
    windowTarget.dispatchEvent('keyup', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    stateManager.pause();
    expect(controller.consumeItemUsePress()).toBeNull();
    stateManager.resume();
    windowTarget.dispatchEvent('keydown', { code: 'KeyE', repeat: true });
    expect(controller.consumeItemUsePress()).toBeNull();
    windowTarget.dispatchEvent('keyup', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    windowTarget.dispatchEvent('blur');
    expect(controller.consumeItemUsePress()).toBeNull();
    controller.stop();
  });

  it('maps Q to the second item slot and F to a separate one-shot exchange action', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyQ' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyQ', repeat: true });
    expect(controller.consumeItemUsePress()).toEqual({ slot: 1 });
    windowTarget.dispatchEvent('keyup', { code: 'KeyQ' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyF' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyF', repeat: true });
    expect(controller.consumeItemExchangePress()).toBe(true);
    expect(controller.consumeItemExchangePress()).toBe(false);
    windowTarget.dispatchEvent('keyup', { code: 'KeyF' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyE' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyF' });
    expect(controller.consumeItemExchangePress()).toBe(true);
    expect(controller.consumeItemUsePress()).toEqual({ slot: 0 });
    stateManager.pause();
    expect(controller.consumeItemExchangePress()).toBe(false);
    expect(controller.consumeItemUsePress()).toBeNull();
    controller.stop();
  });

  it('selects a slot with C without queuing use and clears selection input on pause', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyC' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyC', repeat: true });
    expect(controller.consumeItemSelectPress()).toBe(true);
    expect(controller.consumeItemSelectPress()).toBe(false);
    expect(controller.consumeItemUsePress()).toBeNull();
    windowTarget.dispatchEvent('keyup', { code: 'KeyC' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyC' });
    stateManager.pause();
    expect(controller.consumeItemSelectPress()).toBe(false);
    controller.stop();
  });

  it('cycles objectives once with G and clears a pending request on blur', () => {
    const { controller, stateManager, windowTarget } = createController();
    controller.start();
    stateManager.startGame();
    windowTarget.dispatchEvent('keydown', { code: 'KeyG' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyG', repeat: true });
    expect(controller.consumeObjectivePress()).toBe(true);
    expect(controller.consumeObjectivePress()).toBe(false);
    windowTarget.dispatchEvent('keyup', { code: 'KeyG' });
    windowTarget.dispatchEvent('keydown', { code: 'KeyG' });
    windowTarget.dispatchEvent('blur');
    expect(controller.consumeObjectivePress()).toBe(false);
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
