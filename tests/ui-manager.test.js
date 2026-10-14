import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Enemy } from '../src/entities/Enemy.js';
import { UIManager } from '../src/ui/UIManager.js';

// The browser tests cover native DOM/layout; these doubles isolate UI event wiring.
class FakeElement extends EventTarget {
  #textContent = '';
  ownerDocument = null;
  attributes = new Map();
  hidden = false;
  open = false;
  textWrites = 0;
  focusCount = 0;
  children = [];

  get textContent() { return this.#textContent; }
  set textContent(value) { this.#textContent = value; this.children = []; this.textWrites += 1; }
  appendChild(element) { this.children.push(element); return element; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() {
    this.focusCount += 1;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }
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

function createHarness({ upgradeChoices = null } = {}) {
  const elements = new Map();
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  documentTarget.hidden = false;
  documentTarget.activeElement = null;
  documentTarget.createElement = () => { const element = new FakeElement(); element.ownerDocument = documentTarget; return element; };
  windowTarget.document = documentTarget;
  for (const match of html.matchAll(/<[a-z][\w-]*\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const element = new FakeElement();
    element.ownerDocument = documentTarget;
    element.hidden = /\bhidden(?:\s|>)/.test(match[0]);
    for (const attribute of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) {
      element.setAttribute(attribute[1], attribute[2]);
    }
    elements.set(match[1], element);
  }
  const root = elements.get('game-ui');
  root.querySelector = (selector) => elements.get(selector.slice(1)) ?? null;
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
  if (upgradeChoices) game.getUpgradeChoices = () => upgradeChoices;
  const ui = new UIManager({ root, game, windowTarget });
  game.attachUIManager(ui);
  game.start();
  activeGames.push(game);
  return {
    game, ui, root, elements, windowTarget, documentTarget,
    get: (id) => elements.get(id),
    click: (id) => emit(elements.get(id), 'click'),
    escape: (repeat = false) => emit(windowTarget, 'keydown', { code: 'Escape', repeat }),
    key: (code, properties = {}) => emit(windowTarget, 'keydown', { code, repeat: false, ...properties }),
    frame(timestamp) {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
}

describe('tactical controls', () => {
  it('shows the laboratory tactical HUD and rerolls with R without consuming a level', () => {
    const h = createHarness();
    h.click('start-game-button');
    expect(h.get('tactical-hud').hidden).toBe(false);
    expect(h.get('tactical-hud').textContent).toContain('Shift');
    h.game.world.player.exp = 6;
    h.game.world.update(1 / 60);
    expect(h.get('reroll-upgrades-button').disabled).toBe(false);
    h.key('KeyR', { repeat: true });
    expect(h.game.getUpgradeRerollSnapshot().remaining).toBe(2);
    h.key('KeyR');
    expect(h.game.getUpgradeRerollSnapshot().remaining).toBe(1);
    expect(h.game.world.levelSystem.pendingLevelUps).toBe(1);
    h.key('Digit1');
    expect(h.game.stateManager.currentState).toBe('PLAYING');
  });
});

function triggerLevelUp(harness, expValue = 35) {
  harness.click('start-game-button');
  harness.game.world.experienceCrystals.push(new ExperienceCrystal({
    id: `ui-upgrade-${expValue}`,
    x: harness.game.world.player.x,
    y: harness.game.world.player.y,
    expValue,
  }));
  harness.game.world.update(1 / 60);
  return harness.game.getUpgradeChoices();
}

describe('UIManager with real Game state', () => {
  it('selects the city, shows a carried item and clears expansion HUD state on return', () => {
    const h = createHarness();
    h.get('map-select').value = 'east-city';
    emit(h.get('map-select'), 'change');
    h.click('start-game-button');
    expect(h.get('active-item-slot-0').textContent).toContain('E · 空槽');
    const player = h.game.world.player;
    h.game.world.supplySystem.addPickup('decoy', player.x, player.y);
    h.game.world.update(1 / 60);
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('active-item-slot-0').textContent).toContain('E · 诱饵信标');
    h.key('KeyE');
    h.game.world.update(1 / 60);
    expect(h.game.getExpansionSnapshot().supply.decoy).not.toBeNull();
    h.escape();
    expect(h.get('expansion-hud').hidden).toBe(true);
    const frozen = h.game.getExpansionSnapshot();
    h.game.world.update(5);
    expect(h.game.getExpansionSnapshot()).toEqual(frozen);
    h.click('return-menu-button');
    h.click('confirm-return-button');
    h.click('start-game-button');
    expect(h.game.getMapSnapshot().id).toBe('east-city');
    expect(h.get('active-item-slot-0').textContent).toContain('E · 空槽');
    expect(h.game.getExpansionSnapshot().supply.decoy).toBeNull();
    player.x = 620; player.y = 360; player.hp = 50;
    h.game.world.supplySystem.addPickup('medkit', player.x, player.y);
    h.game.world.update(1 / 60);
    expect(player.hp).toBe(80);
    h.game.world.relaySystem.update(2);
    expect(h.game.world.getExpansionSnapshot().relays[0].energy).toBe(0);
    h.game.world.supplySystem.addPickup('relay-cell', player.x, player.y);
    h.game.world.update(1 / 60);
    expect(h.game.world.getSupplySnapshot().activeItem).toBe('relay-cell');
    h.key('KeyE'); h.game.world.update(1 / 60);
    expect(h.game.world.getExpansionSnapshot().relays[0].energy).toBe(100);
    expect(h.game.world.getSupplySnapshot().activeItem).toBeNull();
  });

  it('shows two selectable item slots and uses the Q slot independently', () => {
    const h = createHarness();
    h.get('map-select').value = 'east-city';
    emit(h.get('map-select'), 'change');
    h.click('start-game-button');
    const player = h.game.world.player;
    h.game.world.supplySystem.addPickup('decoy', player.x, player.y);
    h.game.world.supplySystem.addPickup('emp-charge', player.x, player.y);
    h.game.world.update(1 / 60);
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('active-item-slot-0').textContent).toContain('E · 诱饵信标');
    expect(h.get('active-item-slot-1').textContent).toContain('Q · EMP 电荷');
    expect(h.get('active-item-hud').getAttribute('data-selected-slot')).toBe('0');

    const enemy = new Enemy({ id: 'q-slot-emp-target', x: player.x + 80, y: player.y });
    h.game.world.enemies.push(enemy);
    h.key('KeyQ');
    h.game.world.update(1 / 60);
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(enemy.hp).toBe(0);
    expect(h.get('active-item-hud').getAttribute('data-selected-slot')).toBe('1');
    expect(h.game.world.getSupplySnapshot().activeItems).toEqual(['decoy', null]);
  });

  it('prioritizes F exchange when E is pressed in the same simulation step', () => {
    const h = createHarness();
    h.click('start-game-button');
    const player = h.game.world.player;
    h.game.world.supplySystem.addPickup('decoy', player.x, player.y);
    h.game.world.supplySystem.addPickup('emp-charge', player.x, player.y);
    h.game.world.update(1 / 60);
    h.game.world.supplySystem.addPickup('relay-cell', player.x + 40, player.y);
    h.key('KeyE');
    h.key('KeyF');
    h.game.world.update(1 / 60);
    expect(h.game.world.getSupplySnapshot().activeItems).toEqual(['relay-cell', 'emp-charge']);
    expect(h.game.world.getSupplySnapshot().decoy).toBeNull();
    expect(h.game.world.getSupplySnapshot().pickups[0].type).toBe('decoy');
  });

  it('uses C to select a full Q slot without deploying it before F exchange', () => {
    const h = createHarness();
    h.click('start-game-button');
    const player = h.game.world.player;
    h.game.world.supplySystem.addPickup('decoy', player.x, player.y);
    h.game.world.supplySystem.addPickup('emp-charge', player.x, player.y);
    h.game.world.update(1 / 60);
    h.key('KeyC');
    h.game.world.update(1 / 60);
    expect(h.game.world.getSupplySnapshot().selectedSlot).toBe(1);
    expect(h.game.world.getSupplySnapshot().activeItems).toEqual(['decoy', 'emp-charge']);
    h.game.world.supplySystem.addPickup('relay-cell', player.x + 40, player.y);
    h.key('KeyF');
    h.game.world.update(1 / 60);
    expect(h.game.world.getSupplySnapshot().activeItems).toEqual(['decoy', 'relay-cell']);
    expect(h.game.world.getSupplySnapshot().pulse).toBeNull();
  });

  it('shows an immutable victory summary and restarts a clean run from the result panel', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.bossSystem.update(0, 270);
    h.game.world.enemies[0].hp = 0;
    h.game.world.enemies[0].alive = false;
    h.game.clock.advance(300);
    h.game.world.update(1 / 60);

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.VICTORY);
    expect(h.get('run-result-panel').hidden).toBe(false);
    expect(h.get('run-result-title').textContent).toBe('任务完成');
    expect(h.get('run-result-kills').textContent).toBe('1');
    expect(h.get('run-result-time').textContent).toBe('05:00');

    const shiftTab = h.key('Tab', { shiftKey: true });
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(h.documentTarget.activeElement).toBe(h.get('result-menu-button'));
    const tab = h.key('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(h.documentTarget.activeElement).toBe(h.get('restart-run-button'));

    h.click('restart-run-button');

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(h.get('run-result-panel').hidden).toBe(true);
    expect(h.game.getHudSnapshot().killCount).toBe(0);
    expect(h.game.getRunResultSnapshot()).toBeNull();
  });

  it('shows defeat results and returns to a clean main menu', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.player.hp = 10;
    h.game.world.enemies.push(new Enemy({
      id: 'ui-lethal', x: h.game.world.player.x, y: h.game.world.player.y,
    }));
    h.game.world.update(1 / 60);

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.DEFEAT);
    expect(h.get('run-result-title').textContent).toBe('任务失败');
    h.click('result-menu-button');

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.MENU);
    expect(h.get('run-result-panel').hidden).toBe(true);
    expect(h.game.clock.elapsedSeconds).toBe(0);
  });

  it('shows the live Boss snapshot as an accessible name, health value, and progress bar', () => {
    const h = createHarness();
    h.click('start-game-button');
    expect(h.get('boss-hud').hidden).toBe(true);

    h.game.world.getBossSnapshot = () => Object.freeze({
      id: 'boss-t01', typeId: 'BOSS-01', name: '机械暴君 T-01',
      hp: 900, maxHp: 1800, alive: true,
    });
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);

    expect(h.get('boss-hud').hidden).toBe(false);
    expect(h.get('boss-name').textContent).toBe('机械暴君 T-01');
    expect(h.get('boss-health-value').textContent).toBe('900 / 1800');
    expect(h.get('boss-health-bar').value).toBe(900);
    expect(h.get('boss-health-bar').max).toBe(1800);

    h.game.world.getBossSnapshot = () => Object.freeze({
      id: 'boss-t01', typeId: 'BOSS-01', name: '机械暴君 T-01',
      hp: 0, maxHp: 1800, alive: false,
    });
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('boss-hud').hidden).toBe(true);
  });

  it('hides Boss health outside active play and before a Boss snapshot exists', () => {
    const h = createHarness();
    h.click('start-game-button');
    h.game.world.getBossSnapshot = () => Object.freeze({
      id: 'boss-t01', typeId: 'BOSS-01', name: '机械暴君 T-01',
      hp: 1200, maxHp: 1800, alive: true,
    });
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('boss-hud').hidden).toBe(false);

    h.game.stateManager.pause();
    expect(h.get('boss-hud').hidden).toBe(true);
    h.game.stateManager.resume();
    h.game.world.getBossSnapshot = () => null;
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.PLAYING);
    expect(h.get('boss-hud').hidden).toBe(true);
  });

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
    expect(h.get('hud-experience').textContent).toBe('0 / 6');
    expect(h.get('hud-experience-bar').max).toBe(6);
    expect(h.get('hud-time').textContent).toBe('00:00');
    expect(h.get('hud-kills').textContent).toBe('0');
    expect(h.get('hud-weapons').textContent).toBe('脉冲枪');
  });

  it('shows the orbital blade name and decorative icon only while it is equipped', () => {
    const h = createHarness();
    h.click('start-game-button');
    const current = h.game.getHudSnapshot();

    h.ui.renderSnapshot(Object.freeze({
      ...current,
      weaponIds: Object.freeze(['pulse-gun', 'orbital-blade']),
    }), GAME_STATES.PLAYING);

    expect(h.get('hud-weapons').textContent).toBe('脉冲枪 / 轨道刃');
    expect(h.get('hud-weapons').getAttribute('data-orbital-blade')).toBe('true');

    h.ui.renderSnapshot(Object.freeze({
      ...current,
      weaponIds: Object.freeze(['pulse-gun']),
    }), GAME_STATES.PLAYING);

    expect(h.get('hud-weapons').textContent).toBe('脉冲枪');
    expect(h.get('hud-weapons').getAttribute('data-orbital-blade')).toBe('false');
  });

  it('shows upgrade choices only during LEVEL_UP and renders the current candidates', () => {
    const h = createHarness();
    expect(h.get('upgrade-panel')?.hidden).toBe(true);
    const choices = triggerLevelUp(h);

    expect(h.game.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
    expect(h.get('upgrade-panel')?.hidden).toBe(false);
    expect(h.get('main-menu-panel').hidden).toBe(true);
    expect(h.get('pause-panel').hidden).toBe(true);
    expect(h.get('game-hud').hidden).toBe(true);
    expect(h.get('upgrade-remaining')?.textContent).toBe('剩余升级选择：3');
    expect(h.get('upgrade-choice-0-name')?.textContent).toBe(choices[0].name);
    expect(h.get('upgrade-choice-0-description')?.textContent).toBe(choices[0].description);
    expect(h.get('upgrade-choice-0-level')?.textContent)
      .toBe(`等级 0 → 1 / ${choices[0].maxLevel}`);
    expect(h.get('upgrade-choice-0')?.focusCount).toBeGreaterThan(0);
  });

  it('hides unused card slots when fewer than three candidates are legal', () => {
    const upgradeChoices = Object.freeze([
      Object.freeze({
        id: 'one', name: '一项', description: '第一项描述',
        currentLevel: 0, targetLevel: 1, maxLevel: 1, repeatable: false,
      }),
      Object.freeze({
        id: 'two', name: '二项', description: '第二项描述',
        currentLevel: 1, targetLevel: 2, maxLevel: 2, repeatable: false,
      }),
    ]);
    const h = createHarness({ upgradeChoices });
    triggerLevelUp(h);

    expect(h.get('upgrade-choice-0')?.hidden).toBe(false);
    expect(h.get('upgrade-choice-1')?.hidden).toBe(false);
    expect(h.get('upgrade-choice-2')?.hidden).toBe(true);
    expect(h.get('upgrade-choice-1-level')?.textContent).toBe('等级 1 → 2 / 2');
  });

  it('refreshes choices for the next queued level and resumes after the final card', () => {
    const h = createHarness();
    triggerLevelUp(h);
    expect(h.get('upgrade-choice-0')?.hidden).toBe(false);

    for (let selection = 0; selection < 3; selection += 1) {
      const [choice] = h.game.getUpgradeChoices();
      h.click(`upgrade-choice-0`);
      if (selection < 2) {
        expect(h.game.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
        expect(h.game.world.levelSystem.pendingLevelUps).toBe(2 - selection);
        expect(h.get('upgrade-remaining')?.textContent).toBe(`剩余升级选择：${2 - selection}`);
        expect(h.get('upgrade-choice-0-name')?.textContent).toBe(h.game.getUpgradeChoices()[0].name);
      } else {
        expect(h.game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
        expect(h.get('upgrade-panel')?.hidden).toBe(true);
        expect(h.get('game-hud').hidden).toBe(false);
        expect(h.get('game-ui')).toBe(h.documentTarget.activeElement);
      }
      expect(choice.id).toBeTruthy();
    }
  });

  it('keeps LEVEL_UP open on Escape and traps Tab focus among visible choices', () => {
    const h = createHarness();
    triggerLevelUp(h);
    const firstChoice = h.get('upgrade-choice-0');
    const lastChoice = h.get('reroll-upgrades-button');

    const escape = h.escape();
    expect(escape.defaultPrevented).toBe(true);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
    expect(h.game.world.levelSystem.pendingLevelUps).toBe(3);

    const backwardTab = h.key('Tab', { shiftKey: true });
    expect(backwardTab.defaultPrevented).toBe(true);
    expect(h.documentTarget.activeElement).toBe(lastChoice);
    expect(lastChoice?.focusCount).toBeGreaterThan(0);

    lastChoice?.focus();
    const forwardTab = h.key('Tab');
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(h.documentTarget.activeElement).toBe(firstChoice);
    expect(firstChoice?.focusCount).toBeGreaterThan(1);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
  });

  it('removes upgrade listeners across repeated start and stop', () => {
    const h = createHarness();
    h.ui.stop();
    h.ui.start();
    triggerLevelUp(h);
    h.ui.stop();
    h.ui.start();

    h.click('upgrade-choice-0');

    expect(h.game.world.levelSystem.pendingLevelUps).toBe(2);
    expect(h.game.stateManager.currentState).toBe(GAME_STATES.LEVEL_UP);
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

  it('exposes an accessible volume slider and keeps its value independent from mute', () => {
    const h = createHarness();
    expect(h.get('sound-volume-slider').value).toBe('65');
    expect(h.get('sound-volume-slider').getAttribute('aria-label')).toBe('音效音量');
    expect(h.get('sound-volume-value').textContent).toBe('65%');

    h.get('sound-volume-slider').value = '35';
    emit(h.get('sound-volume-slider'), 'input');
    expect(h.game.soundVolume).toBe(0.35);
    expect(h.get('sound-volume-value').textContent).toBe('35%');

    h.click('sound-toggle-button');
    expect(h.game.soundEnabled).toBe(false);
    expect(h.get('sound-toggle-button').getAttribute('aria-pressed')).toBe('false');
    expect(h.get('sound-volume-slider').value).toBe('35');
    expect(h.get('sound-volume-value').textContent).toBe('35%');

    h.click('sound-toggle-button');
    h.click('start-game-button');
    h.game.world.reset();
    expect(h.game.soundVolume).toBe(0.35);
  });

  it('renders empty and saved local records in the main menu', () => {
    const h = createHarness();
    expect(h.get('menu-highest-kills').textContent).toBe('0');
    expect(h.get('menu-best-victory-time').textContent).toBe('尚无');

    h.game.getProgressSnapshot = () => Object.freeze({
      highestKillCount: 72,
      bestVictorySeconds: 312.8,
    });
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.MENU);
    expect(h.get('menu-highest-kills').textContent).toBe('72');
    expect(h.get('menu-best-victory-time').textContent).toBe('05:12');

    h.game.getProgressSnapshot = () => Object.freeze({ highestKillCount: 1, bestVictorySeconds: null });
    h.ui.renderSnapshot(h.game.getHudSnapshot(), GAME_STATES.MENU);
    expect(h.get('menu-highest-kills').textContent).toBe('1');
    expect(h.get('menu-best-victory-time').textContent).toBe('尚无');
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
    expect(h.get('hud-experience').textContent).toBe('4 / 10');
    expect(h.get('hud-experience-bar').value).toBe(4);
    expect(h.get('hud-experience-bar').max).toBe(10);
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
