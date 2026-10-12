import { describe, expect, it } from 'vitest';
import { GameClock } from '../src/core/GameClock.js';
import { GameLoop } from '../src/core/GameLoop.js';
import { GameStateManager, GAME_STATES } from '../src/core/GameStateManager.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';

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
    dispatchEvent(type) {
      for (const listener of listeners.get(type) ?? []) listener({ type });
    },
  };
}

function createLoop({ stateManager, world, animationFrame, windowTarget, documentTarget }) {
  return new GameLoop({
    stateManager,
    world,
    requestAnimationFrame: animationFrame.requestAnimationFrame,
    cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    windowTarget,
    documentTarget,
  });
}

describe('GameStateManager', () => {
  it('allows menu start, pause, and manual resume transitions', () => {
    const states = new GameStateManager();

    expect(states.currentState).toBe(GAME_STATES.MENU);
    expect(states.startGame()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.PLAYING);
    expect(states.pause()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.PAUSED);
    expect(states.resume()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.PLAYING);
    expect(states.resume()).toBe(false);
  });

  it('returns to the menu only from a paused run', () => {
    const states = new GameStateManager();
    expect(states.returnToMenu()).toBe(false);
    states.startGame();
    expect(states.returnToMenu()).toBe(false);
    states.pause();
    expect(states.startGame()).toBe(false);
    expect(states.returnToMenu()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.MENU);
    expect(states.resume()).toBe(false);
    expect(states.startGame()).toBe(true);
  });

  it('allows only controlled entry to and completion of LEVEL_UP', () => {
    const states = new GameStateManager();

    expect(states.beginLevelUp()).toBe(false);
    states.startGame();
    expect(states.beginLevelUp()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.LEVEL_UP);
    expect(states.transitionTo(GAME_STATES.PLAYING)).toBe(false);
    expect(states.pause()).toBe(false);
    expect(states.resume()).toBe(false);
    expect(states.returnToMenu()).toBe(false);
    expect(states.completeLevelUp()).toBe(true);
    expect(states.currentState).toBe(GAME_STATES.PLAYING);
    expect(states.completeLevelUp()).toBe(false);
  });
});

describe('GameWorld and GameClock', () => {
  it('advances effective time and simulation steps only while playing', () => {
    const stateManager = new GameStateManager();
    const clock = new GameClock();
    const world = new GameWorld({ stateManager, clock, camera: new Camera() });

    world.update(1 / 60);
    expect(clock.elapsedSeconds).toBe(0);
    expect(world.simulationSteps).toBe(0);

    stateManager.startGame();
    world.update(1 / 60);
    stateManager.pause();
    world.update(1 / 60);

    expect(clock.elapsedSeconds).toBeCloseTo(1 / 60, 12);
    expect(world.simulationSteps).toBe(1);
  });

  it('resets effective time for a fresh run', () => {
    const clock = new GameClock();
    clock.advance(0.5);

    clock.reset();

    expect(clock.elapsedSeconds).toBe(0);
  });
});

describe('GameLoop', () => {
  it('keeps one second of simulation time consistent at different render rates', () => {
    const runAtFrameRate = (framesPerSecond) => {
      const stateManager = new GameStateManager();
      const world = new GameWorld({ stateManager, camera: new Camera() });
      const animationFrame = createAnimationFrameHarness();
      const loop = createLoop({ stateManager, world, animationFrame });

      stateManager.startGame();
      loop.start();
      animationFrame.frame(0);
      for (let frame = 1; frame <= framesPerSecond; frame += 1) {
        animationFrame.frame((frame * 1000) / framesPerSecond);
      }
      loop.stop();

      return world.clock.elapsedSeconds;
    };

    expect(runAtFrameRate(30)).toBeCloseTo(1, 10);
    expect(runAtFrameRate(60)).toBeCloseTo(1, 10);
    expect(runAtFrameRate(120)).toBeCloseTo(1, 10);
  });

  it('limits catch-up to five steps and keeps only the fractional remainder', () => {
    const stateManager = new GameStateManager();
    const world = new GameWorld({ stateManager, camera: new Camera() });
    const animationFrame = createAnimationFrameHarness();
    const loop = createLoop({ stateManager, world, animationFrame });

    stateManager.startGame();
    loop.start();
    animationFrame.frame(0);
    animationFrame.frame(9058.333333333334);
    expect(world.simulationSteps).toBe(5);

    animationFrame.frame(9066.666666666668);
    expect(world.simulationSteps).toBe(6);
    loop.stop();
  });

  it('stops catch-up immediately when a fixed step enters LEVEL_UP', () => {
    const stateManager = new GameStateManager();
    const world = new GameWorld({ stateManager, camera: new Camera() });
    const animationFrame = createAnimationFrameHarness();
    const loop = createLoop({ stateManager, world, animationFrame });
    world.player.exp = 6;

    stateManager.startGame();
    loop.start();
    animationFrame.frame(0);
    animationFrame.frame((5 * 1000) / 60);

    expect(stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
    expect(world.simulationSteps).toBe(1);
    expect(world.clock.elapsedSeconds).toBeCloseTo(1 / 60, 12);
    animationFrame.frame((10 * 1000) / 60);
    expect(world.simulationSteps).toBe(1);
    expect(world.clock.elapsedSeconds).toBeCloseTo(1 / 60, 12);
    loop.stop();
  });

  it('pauses on focus loss and requires manual resume without background catch-up', () => {
    const stateManager = new GameStateManager();
    const world = new GameWorld({ stateManager, camera: new Camera() });
    const animationFrame = createAnimationFrameHarness();
    const windowTarget = createEventTarget();
    const documentTarget = createEventTarget({ hidden: false });
    const loop = createLoop({
      stateManager,
      world,
      animationFrame,
      windowTarget,
      documentTarget,
    });

    stateManager.startGame();
    loop.start();
    animationFrame.frame(0);
    animationFrame.frame(1000 / 60);
    expect(world.simulationSteps).toBe(1);

    windowTarget.dispatchEvent('blur');
    expect(stateManager.currentState).toBe(GAME_STATES.PAUSED);

    documentTarget.hidden = true;
    documentTarget.dispatchEvent('visibilitychange');
    expect(stateManager.currentState).toBe(GAME_STATES.PAUSED);

    documentTarget.hidden = false;
    documentTarget.dispatchEvent('visibilitychange');
    windowTarget.dispatchEvent('focus');
    animationFrame.frame(60_000);
    expect(stateManager.currentState).toBe(GAME_STATES.PAUSED);
    expect(world.simulationSteps).toBe(1);

    stateManager.resume();
    animationFrame.frame(60_016.666666666664);
    expect(world.simulationSteps).toBe(1);
    animationFrame.frame(60_033.33333333333);
    expect(world.simulationSteps).toBe(2);

    loop.stop();
  });
});
