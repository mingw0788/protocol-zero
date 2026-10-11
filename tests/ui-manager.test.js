import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { UIManager } from '../src/ui/UIManager.js';

// The browser tests cover native DOM/layout; these doubles isolate UI event wiring.
class FakeElement extends EventTarget {
  #textContent = '';
  attributes = new Map();
  hidden = false;
  open = false;
  textWrites = 0;
  focusCount = 0;

  get textContent() { return this.#textContent; }
  set textContent(value) { this.#textContent = value; this.textWrites += 1; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.focusCount += 1; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function emit(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

const activeGames = [];
afterEach(() => {
  for (const game of activeGames.splice(0)) game.stop();
});

function createHarness() {
  const elements = new Map();
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<[a-z][\w-]*\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const element = new FakeElement();
    element.hidden = /\bhidden(?:\s|>)/.test(match[0]);
    elements.set(match[1], element);
  }
  const root = elements.get('game-ui');
  root.querySelector = (selector) => elements.get(selector.slice(1)) ?? null;
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  documentTarget.hidden = false;
  const pendingFrames = new Map();
  let nextFrame = 0;
  const game = new Game({
    inputOptions: { windowTarget, documentTarget },
    loopOptions: {
      windowTarget,
      documentTarget,
      requestAnimationFrame(callback) {
        const id = ++nextFrame;
        pendingFrames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) { pendingFrames.delete(id); },
    },
  });
  const ui = new UIManager({ root, game, windowTarget });
  game.attachUIManager(ui);
  game.start();
  activeGames.push(game);
  return {
    game, ui, root, elements, windowTarget,
    get: (id) => elements.get(id),
    click: (id) => emit(elements.get(id), 'click'),
    escape: (repeat = false) => emit(windowTarget, 'keydown', { code: 'Escape', repeat }),
    frame(timestamp) {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
}

describe('UIManager with real Game state', () => {
  it('opens on a frozen title menu and switches help without starting a run', () => {
    const h = createHarness();
    h.frame(0);
    h.frame(1000);
    h.escape();
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.MENU);
    expect(h.game.clock.elapsedSeconds).toBe(0);
    expect(h.get('main-menu-panel').hidden).toBe(false);
    expect(h.get('game-hud').hidden).toBe(true);
    expect(h.get('pause-panel').hidden).toBe(true);
    h.click('show-help-button');
    expect(h.get('main-menu-panel').hidden).toBe(true);
    expect(h.get('help-panel').hidden).toBe(false);
    h.click('hide-help-button');
    expect(h.get('help-panel').hidden).toBe(true);
    expect(h.get('main-menu-panel').hidden).toBe(false);
  });

  it('starts the game with real initial HUD values', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.frame(0);

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(h.get('main-menu-panel').hidden).toBe(true);
    expect(h.get('game-hud').hidden).toBe(false);
    expect(h.get('hud-health-value').textContent).toBe('100 / 100');
    expect(h.get('hud-level').textContent).toBe('1');
    expect(h.get('hud-experience').textContent).toBe('0');
    expect(h.get('hud-time').textContent).toBe('00:00');
    expect(h.get('hud-kills').textContent).toBe('0');
    expect(h.get('hud-weapons').textContent).toBe('脉冲枪');
  });

  it('retains the runtime sound preference when returning to the menu', () => {
    const h = createHarness();
    expect(h.game.soundEnabled).toBe(true);
    h.click('sound-toggle-button');
    expect(h.game.soundEnabled).toBe(false);
    expect(h.get('sound-toggle-button').getAttribute('aria-pressed')).toBe('false');
    expect(h.get('sound-toggle-button').textContent).toBe('音效：关闭');
    h.click('start-game-button');
    h.escape();
    h.click('return-menu-button');
    h.click('confirm-return-button');
    expect(h.game.soundEnabled).toBe(false);
    h.click('sound-toggle-button');
    expect(h.game.soundEnabled).toBe(true);
  });

  it('pauses and resumes with Escape without toggling on repeated keydown', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.update(3);
    h.escape();
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PAUSED);
    expect(h.get('pause-panel').hidden).toBe(false);
    expect(h.get('game-hud').hidden).toBe(true);
    h.game.world.update(10);
    h.escape(true);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PAUSED);
    expect(h.game.clock.elapsedSeconds).toBe(3);
    h.escape();
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    h.escape();
    h.click('resume-game-button');
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
  });

  it('cancels return confirmation by button, Escape, or native cancel without resuming', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.update(4);
    h.game.world.player.hp = 70;
    h.escape();
    const pausedSnapshot = h.game.getHudSnapshot();
    h.click('return-menu-button');
    expect(h.get('return-menu-dialog').open).toBe(true);
    h.click('cancel-return-button');
    expect(h.get('return-menu-dialog').open).toBe(false);
    h.click('return-menu-button');
    h.escape();
    expect(h.get('return-menu-dialog').open).toBe(false);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PAUSED);
    h.click('return-menu-button');
    emit(h.get('return-menu-dialog'), 'cancel');
    expect(h.get('return-menu-dialog').open).toBe(false);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PAUSED);
    expect(h.game.getHudSnapshot()).toEqual(pausedSnapshot);
  });

  it('confirms return, clears the run, and starts again from the menu', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.update(20);
    h.game.world.player.hp = 5;
    h.game.world.recordKill();
    h.escape();
    h.click('return-menu-button');
    h.click('confirm-return-button');

    expect(h.get('return-menu-dialog').open).toBe(false);
    expect(h.get('main-menu-panel').hidden).toBe(false);
    expect(h.get('pause-panel').hidden).toBe(true);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.MENU);
    expect(h.game.getHudSnapshot()).toMatchObject({
      health: { current: 100, max: 100 }, killCount: 0, elapsedSeconds: 0,
    });
    h.click('start-game-button');
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
  });

  it('renders changed model values through the frame callback without duplicate writes', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.player.hp = 67;
    h.game.world.player.maxHp = 120;
    h.game.world.player.exp = 4;
    h.game.world.player.level = 2;
    h.game.world.player.weaponStates.push({ id: 'unknown-module' });
    h.game.clock.advance(65.9);
    h.game.world.recordKill();
    h.frame(0);

    expect(h.get('hud-health-value').textContent).toBe('67 / 120');
    expect(h.get('hud-health-bar').value).toBe(67);
    expect(h.get('hud-health-bar').max).toBe(120);
    expect(h.get('hud-experience').textContent).toBe('4');
    expect(h.get('hud-level').textContent).toBe('2');
    expect(h.get('hud-time').textContent).toBe('01:05');
    expect(h.get('hud-kills').textContent).toBe('1');
    expect(h.get('hud-weapons').textContent).toBe('脉冲枪 / unknown-module');
    const writes = h.get('hud-time').textWrites;
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('hud-time').textWrites).toBe(writes);
  });

  it('removes event listeners and subscriptions on stop and can start once again', () => {
    const h = createHarness();
    h.ui.start();
    h.game.stop();
    h.click('sound-toggle-button');
    h.click('start-game-button');
    expect(h.game.soundEnabled).toBe(true);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.MENU);
    h.game.start();
    h.click('sound-toggle-button');
    expect(h.game.soundEnabled).toBe(false);
    h.click('start-game-button');
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
  });

  it('reports a missing UI mount or required control clearly', () => {
    const h = createHarness();
    expect(() => new UIManager({ root: null, game: h.game })).toThrow(/UI root/);
    h.elements.delete('start-game-button');
    expect(() => new UIManager({ root: h.root, game: h.game })).toThrow(/#start-game-button/);
  });
});
