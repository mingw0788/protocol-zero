import { GAME_STATES } from '../core/GameStateManager.js';

const WEAPON_LABELS = Object.freeze({ 'pulse-gun': '脉冲枪', 'orbital-blade': '轨道刃' });
const ELEMENT_IDS = Object.freeze({
  menu: 'main-menu-panel',
  help: 'help-panel',
  hud: 'game-hud',
  pause: 'pause-panel',
  upgradePanel: 'upgrade-panel',
  upgradeTitle: 'upgrade-title',
  upgradeRemaining: 'upgrade-remaining',
  dialog: 'return-menu-dialog',
  start: 'start-game-button',
  showHelp: 'show-help-button',
  hideHelp: 'hide-help-button',
  sound: 'sound-toggle-button',
  resume: 'resume-game-button',
  returnMenu: 'return-menu-button',
  confirmReturn: 'confirm-return-button',
  cancelReturn: 'cancel-return-button',
  healthText: 'hud-health-value',
  healthBar: 'hud-health-bar',
  experience: 'hud-experience',
  level: 'hud-level',
  time: 'hud-time',
  kills: 'hud-kills',
  weapons: 'hud-weapons',
});
const UPGRADE_CHOICE_COUNT = 3;

function formatTime(elapsedSeconds) {
  const seconds = Math.floor(elapsedSeconds);
  return String(Math.floor(seconds / 60)).padStart(2, '0')
    + ':' + String(seconds % 60).padStart(2, '0');
}

export class UIManager {
  #root;
  #game;
  #windowTarget;
  #elements = {};
  #started = false;
  #unsubscribe = null;
  #removeListeners = [];
  #displayedChoices = Object.freeze([]);

  constructor({ root, game, windowTarget = globalThis.window ?? null } = {}) {
    if (!root || typeof root.querySelector !== 'function') {
      throw new TypeError('UI root must be an element with querySelector');
    }
    if (!game?.stateManager
      || typeof game.getHudSnapshot !== 'function'
      || typeof game.getUpgradeChoices !== 'function'
      || typeof game.chooseUpgrade !== 'function') {
      throw new TypeError('UIManager requires a game controller with state and HUD access');
    }
    this.#root = root;
    this.#game = game;
    this.#windowTarget = windowTarget;
    for (const [name, id] of Object.entries(ELEMENT_IDS)) {
      const element = root.querySelector('#' + id);
      if (!element) throw new Error('Missing required UI control: #' + id);
      this.#elements[name] = element;
    }
    this.#elements.upgradeChoiceButtons = [];
    this.#elements.upgradeChoiceNames = [];
    this.#elements.upgradeChoiceLevels = [];
    this.#elements.upgradeChoiceDescriptions = [];
    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      const slots = [
        ['upgradeChoiceButtons', `upgrade-choice-${index}`],
        ['upgradeChoiceNames', `upgrade-choice-${index}-name`],
        ['upgradeChoiceLevels', `upgrade-choice-${index}-level`],
        ['upgradeChoiceDescriptions', `upgrade-choice-${index}-description`],
      ];
      for (const [name, id] of slots) {
        const element = root.querySelector('#' + id);
        if (!element) throw new Error('Missing required UI control: #' + id);
        this.#elements[name].push(element);
      }
    }
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    const e = this.#elements;
    this.#listen(e.start, 'click', () => this.#game.startGame());
    this.#listen(e.showHelp, 'click', () => this.#showHelp(true));
    this.#listen(e.hideHelp, 'click', () => this.#showHelp(false));
    this.#listen(e.sound, 'click', () => {
      this.#game.toggleSound();
      this.#renderSound();
    });
    this.#listen(e.resume, 'click', () => this.#game.resume());
    this.#listen(e.returnMenu, 'click', () => {
      if (this.#game.stateManager.currentState !== GAME_STATES.PAUSED || e.dialog.open) return;
      e.dialog.showModal();
    });
    this.#listen(e.cancelReturn, 'click', () => this.#cancelReturn());
    this.#listen(e.confirmReturn, 'click', () => {
      if (!e.dialog.open || this.#game.stateManager.currentState !== GAME_STATES.PAUSED) return;
      e.dialog.close();
      this.#game.returnToMenu();
    });
    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      this.#listen(e.upgradeChoiceButtons[index], 'click', () => this.#selectUpgrade(index));
    }
    this.#listen(e.dialog, 'cancel', (event) => {
      event.preventDefault();
      this.#cancelReturn();
    });
    if (this.#windowTarget) this.#listen(this.#windowTarget, 'keydown', this.#handleKeyDown);
    this.#unsubscribe = this.#game.stateManager.subscribe((state) => this.#renderState(state));
    this.#renderSound();
    this.#renderState(this.#game.stateManager.currentState);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    for (const remove of this.#removeListeners.splice(0)) remove();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#elements.dialog.open) this.#elements.dialog.close();
  }

  renderSnapshot(snapshot, currentState) {
    if (currentState !== GAME_STATES.PLAYING) return;
    const e = this.#elements;
    this.#setText(e.healthText, snapshot.health.current + ' / ' + snapshot.health.max);
    this.#setText(e.experience, String(snapshot.experience));
    this.#setText(e.level, String(snapshot.level));
    this.#setText(e.time, formatTime(snapshot.elapsedSeconds));
    this.#setText(e.kills, String(snapshot.killCount));
    this.#setText(e.weapons, snapshot.weaponIds.map((id) => WEAPON_LABELS[id] ?? id).join(' / ') || '无');
    const orbitalBladeEquipped = String(snapshot.weaponIds.includes('orbital-blade'));
    if (e.weapons.getAttribute('data-orbital-blade') !== orbitalBladeEquipped) {
      e.weapons.setAttribute('data-orbital-blade', orbitalBladeEquipped);
    }
    if (e.healthBar.max !== snapshot.health.max) e.healthBar.max = snapshot.health.max;
    if (e.healthBar.value !== snapshot.health.current) e.healthBar.value = snapshot.health.current;
  }

  #renderState(state) {
    const e = this.#elements;
    e.menu.hidden = state !== GAME_STATES.MENU;
    e.help.hidden = true;
    e.hud.hidden = state !== GAME_STATES.PLAYING;
    e.pause.hidden = state !== GAME_STATES.PAUSED;
    e.upgradePanel.hidden = state !== GAME_STATES.LEVEL_UP;
    if (state !== GAME_STATES.PAUSED && e.dialog.open) e.dialog.close();
    if (state === GAME_STATES.MENU) e.start.focus();
    if (state === GAME_STATES.PAUSED) e.resume.focus();
    if (state === GAME_STATES.LEVEL_UP) {
      this.#renderUpgradeChoices();
      this.#focusFirstUpgradeChoice();
    }
    if (state === GAME_STATES.PLAYING) this.#root.focus();
    this.renderSnapshot(this.#game.getHudSnapshot(), state);
  }

  #renderUpgradeChoices() {
    const choices = this.#game.getUpgradeChoices();
    this.#displayedChoices = choices;
    const pendingLevelUps = this.#game.getHudSnapshot().pendingLevelUps;
    this.#setText(this.#elements.upgradeRemaining, `剩余升级选择：${pendingLevelUps}`);

    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      const choice = choices[index];
      this.#elements.upgradeChoiceButtons[index].hidden = !choice;
      if (!choice) continue;
      this.#setText(this.#elements.upgradeChoiceNames[index], choice.name);
      const levelText = choice.repeatable
        ? '可重复恢复'
        : `等级 ${choice.currentLevel} → ${choice.targetLevel} / ${choice.maxLevel}`;
      this.#setText(this.#elements.upgradeChoiceLevels[index], levelText);
      this.#setText(this.#elements.upgradeChoiceDescriptions[index], choice.description);
    }
  }

  #focusFirstUpgradeChoice() {
    this.#elements.upgradeChoiceButtons.find((button) => !button.hidden)?.focus();
  }

  #selectUpgrade(index) {
    const choice = this.#displayedChoices[index];
    if (!choice || !this.#game.chooseUpgrade(choice.id)) return false;
    if (this.#game.stateManager.currentState === GAME_STATES.LEVEL_UP) {
      this.#renderUpgradeChoices();
      this.#focusFirstUpgradeChoice();
    }
    return true;
  }

  #showHelp(visible) {
    if (this.#game.stateManager.currentState !== GAME_STATES.MENU) return;
    this.#elements.menu.hidden = visible;
    this.#elements.help.hidden = !visible;
    (visible ? this.#elements.hideHelp : this.#elements.showHelp).focus();
  }

  #renderSound() {
    const e = this.#elements.sound;
    this.#setText(e, this.#game.soundEnabled ? '音效：开启' : '音效：关闭');
    e.setAttribute('aria-pressed', String(this.#game.soundEnabled));
  }

  #cancelReturn() {
    if (!this.#elements.dialog.open) return;
    this.#elements.dialog.close();
    this.#elements.returnMenu.focus();
  }

  #handleKeyDown = (event) => {
    const state = this.#game.stateManager.currentState;
    if (state === GAME_STATES.LEVEL_UP) {
      if (event.code === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.code === 'Tab') {
        const visibleButtons = this.#elements.upgradeChoiceButtons.filter((button) => !button.hidden);
        const first = visibleButtons[0];
        const last = visibleButtons.at(-1);
        const active = this.#windowTarget?.document?.activeElement;
        if ((event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (event.code !== 'Escape' || event.repeat) return;
    if (this.#elements.dialog.open) {
      event.preventDefault();
      this.#cancelReturn();
      return;
    }
    if (state === GAME_STATES.PLAYING || state === GAME_STATES.PAUSED) {
      event.preventDefault();
      this.#game.togglePause();
    }
  };

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#removeListeners.push(() => target.removeEventListener(type, listener));
  }

  #setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }
}
